from __future__ import annotations

import functools
import importlib
import inspect
import os
import time
from contextvars import ContextVar
from typing import Any, Callable

from .summarize import summarize, summarize_call
from .writer import TraceWriter


TraceContext = dict[str, Any]
_CONTEXT: ContextVar[TraceContext] = ContextVar(
    "inference_trace_context",
    default={"phase": "init", "kind": "init", "index": 0},
)
_WRITER: TraceWriter | None = None
_PATCHED: set[str] = set()
_HOOK_HANDLES: list[Any] = []
_DECODE_INDEX = 0
_LAST_INFERENCE_CONTEXT: TraceContext = {
    "phase": "inference",
    "kind": "inference",
    "index": 0,
}


def step_from_scheduler(
    scheduler_output: Any,
    decode_index: int,
) -> tuple[TraceContext, int]:
    total = getattr(scheduler_output, "total_num_scheduled_tokens", None)
    if total == 1:
        decode_index += 1
        return (
            {"phase": "decode", "kind": "decode", "index": decode_index},
            decode_index,
        )
    if isinstance(total, int) and total > 1:
        return (
            {"phase": "prefill", "kind": "prefill", "index": 0},
            decode_index,
        )
    return (
        {"phase": "inference", "kind": "inference", "index": 0},
        decode_index,
    )


def _writer() -> TraceWriter | None:
    global _WRITER
    if _WRITER is None and os.getenv("INFERENCE_TRACE_OUTPUT_DIR"):
        _WRITER = TraceWriter.from_env()
    return _WRITER


def emit(
    stage: str,
    payload: dict[str, Any] | None = None,
    *,
    fidelity: str = "STRUCTURAL",
) -> bool:
    writer = _writer()
    if writer is None:
        return False
    context = _CONTEXT.get()
    return writer.emit(
        stage,
        payload,
        phase=context["phase"],
        logical_step={
            "kind": context["kind"],
            "index": context["index"],
        },
        fidelity=fidelity,
    )


def _first_tensor(value: Any) -> Any | None:
    if all(
        hasattr(value, attribute)
        for attribute in ("shape", "dtype", "device", "numel")
    ):
        return value
    if isinstance(value, (list, tuple)):
        for item in value:
            found = _first_tensor(item)
            if found is not None:
                return found
    if isinstance(value, dict):
        for item in value.values():
            found = _first_tensor(item)
            if found is not None:
                return found
    return None


def _real_inference() -> bool:
    return _CONTEXT.get()["phase"] in {"prefill", "decode"}


def _safe_hook(stage: str, callback: Callable[[], dict[str, Any]]) -> None:
    if not _real_inference():
        return
    try:
        emit(stage, callback(), fidelity="SUMMARY")
    except Exception as exc:
        emit(
            "instrumentation.hook_error",
            {
                "stage": stage,
                "error": f"{exc.__class__.__name__}: {exc}",
            },
            fidelity="EXACT",
        )


def _forward_tensor_hook(stage: str, *, topk: int = 0):
    def hook(module: Any, args: tuple[Any, ...], kwargs: dict[str, Any], output: Any):
        def payload() -> dict[str, Any]:
            tensor = _first_tensor(output)
            return {
                "module": module.__class__.__name__,
                "output": summarize(
                    tensor,
                    capture_values=True,
                    topk=topk,
                )
                if tensor is not None
                else summarize(output),
            }

        _safe_hook(stage, payload)

    return hook


def _linear_attention_hook(
    module: Any,
    args: tuple[Any, ...],
    kwargs: dict[str, Any],
    output: Any,
) -> None:
    def payload() -> dict[str, Any]:
        hidden = kwargs.get("hidden_states")
        target = kwargs.get("output")
        if hidden is None and args:
            hidden = args[0]
        return {
            "module": module.__class__.__name__,
            "hiddenStates": summarize(hidden, capture_values=True),
            "output": summarize(target, capture_values=True),
        }

    _safe_hook("tensor.linear_attention.layer0", payload)


def _attention_pre_hook(
    module: Any,
    args: tuple[Any, ...],
    kwargs: dict[str, Any],
) -> None:
    def payload() -> dict[str, Any]:
        values = list(args)
        q = kwargs.get("query")
        k = kwargs.get("key")
        v = kwargs.get("value")
        if q is None:
            q = kwargs.get("q")
        if k is None:
            k = kwargs.get("k")
        if v is None:
            v = kwargs.get("v")
        if q is None and len(values) > 0:
            q = values[0]
        if k is None and len(values) > 1:
            k = values[1]
        if v is None and len(values) > 2:
            v = values[2]
        return {
            "module": module.__class__.__name__,
            "query": summarize(q, capture_values=True),
            "key": summarize(k, capture_values=True),
            "value": summarize(v, capture_values=True),
        }

    _safe_hook("tensor.full_attention.qkv.layer3", payload)


def _moe_gate_hook(
    module: Any,
    args: tuple[Any, ...],
    kwargs: dict[str, Any],
    output: Any,
) -> None:
    def payload() -> dict[str, Any]:
        logits = _first_tensor(output)
        return {
            "module": module.__class__.__name__,
            "routerLogits": summarize(
                logits,
                capture_values=True,
                topk=8,
                row_limit=8,
            ),
        }

    _safe_hook("tensor.moe.router.layer3", payload)


def _moe_experts_hook(
    module: Any,
    args: tuple[Any, ...],
    kwargs: dict[str, Any],
    output: Any,
) -> None:
    def payload() -> dict[str, Any]:
        return {
            "module": module.__class__.__name__,
            "hiddenStates": summarize(
                kwargs.get("hidden_states"),
                capture_values=True,
            ),
            "routerLogits": summarize(
                kwargs.get("router_logits"),
                capture_values=False,
            ),
            "output": summarize(_first_tensor(output), capture_values=True),
        }

    _safe_hook("tensor.moe.experts.layer3", payload)


def _install_selected_hooks(model: Any) -> None:
    if getattr(model, "_inference_trace_hooks_installed", False):
        return
    matched: list[str] = []
    for name, module in model.named_modules():
        try:
            if name.endswith("embed_tokens"):
                _HOOK_HANDLES.append(
                    module.register_forward_hook(
                        _forward_tensor_hook("tensor.embedding"),
                        with_kwargs=True,
                    )
                )
                matched.append(name)
            elif name.endswith(".layers.0.linear_attn"):
                _HOOK_HANDLES.append(
                    module.register_forward_hook(
                        _linear_attention_hook,
                        with_kwargs=True,
                    )
                )
                matched.append(name)
            elif name.endswith(".layers.3.self_attn.qkv_proj"):
                _HOOK_HANDLES.append(
                    module.register_forward_hook(
                        _forward_tensor_hook(
                            "tensor.full_attention.qkv_projection.layer3"
                        ),
                        with_kwargs=True,
                    )
                )
                matched.append(name)
            elif name.endswith(".layers.3.self_attn.attn"):
                _HOOK_HANDLES.append(
                    module.register_forward_pre_hook(
                        _attention_pre_hook,
                        with_kwargs=True,
                    )
                )
                matched.append(name)
            elif name.endswith(".layers.3.mlp.gate"):
                _HOOK_HANDLES.append(
                    module.register_forward_hook(
                        _moe_gate_hook,
                        with_kwargs=True,
                    )
                )
                matched.append(name)
            elif name.endswith(".layers.3.mlp.experts"):
                _HOOK_HANDLES.append(
                    module.register_forward_hook(
                        _moe_experts_hook,
                        with_kwargs=True,
                    )
                )
                matched.append(name)
        except Exception as exc:
            emit(
                "instrumentation.hook_install_error",
                {
                    "module": name,
                    "error": f"{exc.__class__.__name__}: {exc}",
                },
                fidelity="EXACT",
            )
    setattr(model, "_inference_trace_hooks_installed", True)
    emit(
        "instrumentation.hooks_installed",
        {"modules": matched},
        fidelity="EXACT",
    )


def _model_inventory(model: Any) -> dict[str, Any]:
    dtype_counts: dict[str, int] = {}
    dtype_bytes: dict[str, int] = {}
    representatives: list[dict[str, Any]] = []
    total_parameters = 0
    total_bytes = 0
    for name, parameter in model.named_parameters():
        numel = int(parameter.numel())
        size = numel * int(parameter.element_size())
        dtype = str(parameter.dtype)
        total_parameters += numel
        total_bytes += size
        dtype_counts[dtype] = dtype_counts.get(dtype, 0) + numel
        dtype_bytes[dtype] = dtype_bytes.get(dtype, 0) + size
        if (
            len(representatives) < 96
            and (
                "embed_tokens" in name
                or ".layers.0." in name
                or ".layers.3." in name
                or ".layers.39." in name
                or "lm_head" in name
            )
        ):
            representatives.append(
                {
                    "name": name,
                    "shape": [int(size) for size in parameter.shape],
                    "dtype": dtype,
                    "device": str(parameter.device),
                    "numel": numel,
                    "bytes": size,
                }
            )
    return {
        "totalParameters": total_parameters,
        "totalBytes": total_bytes,
        "dtypeParameterCounts": dtype_counts,
        "dtypeBytes": dtype_bytes,
        "representatives": representatives,
    }


def _context_for_call(
    label: str,
    args: tuple[Any, ...],
    kwargs: dict[str, Any],
) -> tuple[TraceContext | None, int | None]:
    global _DECODE_INDEX, _LAST_INFERENCE_CONTEXT
    if label.endswith("NPUModelRunner.execute_model"):
        scheduler = kwargs.get("scheduler_output")
        if scheduler is None and len(args) > 1:
            scheduler = args[1]
        context, _DECODE_INDEX = step_from_scheduler(scheduler, _DECODE_INDEX)
        _LAST_INFERENCE_CONTEXT = context
        return context, _DECODE_INDEX
    if (
        label.endswith("NPUModelRunner.sample_tokens")
        or label.endswith("NPUModelRunner._sample")
        or ".Sampler." in label
    ):
        return _LAST_INFERENCE_CONTEXT, None
    if label.endswith("NPUModelRunner.profile_run"):
        return {"phase": "warmup", "kind": "warmup", "index": 0}, None
    return None, None


def _wrap(label: str, fn: Callable[..., Any]) -> Callable[..., Any]:
    @functools.wraps(fn)
    def wrapped(*args: Any, **kwargs: Any) -> Any:
        context, _ = _context_for_call(label, args, kwargs)
        token = _CONTEXT.set(context) if context is not None else None
        start = time.perf_counter_ns()
        call_payload = summarize_call(args, kwargs)
        if label.endswith("NPUModelRunner._sample"):
            logits = kwargs.get("logits")
            if logits is None and len(args) > 1:
                logits = args[1]
            call_payload["logits"] = summarize(
                logits,
                capture_values=_real_inference(),
                topk=20 if _real_inference() else 0,
                row_limit=4,
            )
            if _real_inference():
                emit("tensor.logits", call_payload["logits"], fidelity="SUMMARY")
        emit(f"{label}.start", call_payload)
        try:
            result = fn(*args, **kwargs)
        except Exception as exc:
            emit(
                f"{label}.error",
                {
                    "durationNs": time.perf_counter_ns() - start,
                    "error": f"{exc.__class__.__name__}: {exc}",
                },
                fidelity="EXACT",
            )
            raise
        finally:
            if token is not None and "result" not in locals():
                _CONTEXT.reset(token)

        if label.endswith("NPUModelRunner.load_model") and args:
            runner = args[0]
            model = getattr(runner, "model", None)
            if model is not None:
                try:
                    emit(
                        "model.parameter_inventory",
                        _model_inventory(model),
                        fidelity="STRUCTURAL",
                    )
                    _install_selected_hooks(model)
                except Exception as exc:
                    emit(
                        "instrumentation.model_setup_error",
                        {"error": f"{exc.__class__.__name__}: {exc}"},
                        fidelity="EXACT",
                    )
        emit(
            f"{label}.end",
            {
                "durationNs": time.perf_counter_ns() - start,
                "result": summarize(result),
            },
            fidelity="SUMMARY",
        )
        if token is not None:
            _CONTEXT.reset(token)
        return result

    setattr(wrapped, "_inference_trace_wrapped", True)
    return wrapped


def _patch_method(module_name: str, class_name: str, method_name: str) -> None:
    key = f"{module_name}.{class_name}.{method_name}"
    if key in _PATCHED:
        return
    try:
        module = importlib.import_module(module_name)
        cls = getattr(module, class_name)
        static_attr = inspect.getattr_static(cls, method_name)
        original = getattr(cls, method_name)
        if getattr(original, "_inference_trace_wrapped", False):
            return
    except Exception as exc:
        emit(
            "instrumentation.patch_skipped",
            {"target": key, "error": f"{exc.__class__.__name__}: {exc}"},
            fidelity="EXACT",
        )
        return

    if isinstance(static_attr, staticmethod):
        setattr(cls, method_name, staticmethod(_wrap(key, static_attr.__func__)))
    elif isinstance(static_attr, classmethod):
        setattr(cls, method_name, classmethod(_wrap(key, static_attr.__func__)))
    else:
        setattr(cls, method_name, _wrap(key, original))
    _PATCHED.add(key)
    emit("instrumentation.patched", {"target": key}, fidelity="EXACT")


def install() -> None:
    targets = [
        ("tests.e2e.conftest", "VllmRunner", "__init__"),
        ("tests.e2e.conftest", "VllmRunner", "get_inputs"),
        ("tests.e2e.conftest", "VllmRunner", "generate"),
        ("tests.e2e.conftest", "VllmRunner", "generate_greedy"),
        ("tests.e2e.conftest", "VllmRunner", "_finalize_generate_outputs"),
        ("vllm.entrypoints.llm", "LLM", "__init__"),
        ("vllm.entrypoints.llm", "LLM", "generate"),
        ("vllm.entrypoints.offline_utils", "OfflineInferenceMixin", "_run_completion"),
        ("vllm.entrypoints.offline_utils", "OfflineInferenceMixin", "_render_and_add_requests"),
        ("vllm.entrypoints.offline_utils", "OfflineInferenceMixin", "_add_request"),
        ("vllm.entrypoints.offline_utils", "OfflineInferenceMixin", "_run_engine"),
        ("vllm.engine.llm_engine", "LLMEngine", "add_request"),
        ("vllm.engine.llm_engine", "LLMEngine", "step"),
        ("vllm.v1.engine.llm_engine", "LLMEngine", "add_request"),
        ("vllm.v1.engine.llm_engine", "LLMEngine", "step"),
        ("vllm_ascend.worker.model_runner_v1", "NPUModelRunner", "load_model"),
        ("vllm_ascend.worker.model_runner_v1", "NPUModelRunner", "initialize_kv_cache"),
        ("vllm_ascend.worker.model_runner_v1", "NPUModelRunner", "profile_run"),
        ("vllm_ascend.worker.model_runner_v1", "NPUModelRunner", "execute_model"),
        ("vllm_ascend.worker.model_runner_v1", "NPUModelRunner", "_prepare_inputs"),
        ("vllm_ascend.worker.model_runner_v1", "NPUModelRunner", "_preprocess"),
        ("vllm_ascend.worker.model_runner_v1", "NPUModelRunner", "_model_forward"),
        ("vllm_ascend.worker.model_runner_v1", "NPUModelRunner", "sample_tokens"),
        ("vllm_ascend.worker.model_runner_v1", "NPUModelRunner", "_sample"),
        ("vllm.v1.sample.sampler", "Sampler", "forward"),
        ("vllm.v1.sample.sampler", "Sampler", "sample"),
        ("vllm.v1.sample.sampler", "Sampler", "greedy_sample"),
    ]
    for module_name, class_name, method_name in targets:
        _patch_method(module_name, class_name, method_name)
    emit(
        "instrumentation.install_complete",
        {"patchedTargets": sorted(_PATCHED)},
        fidelity="EXACT",
    )
