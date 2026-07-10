from __future__ import annotations

import importlib.metadata
import json
import os
import subprocess
import sys
import time
from collections import Counter
from pathlib import Path
from typing import Any


COLLECTOR_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(COLLECTOR_ROOT / "src"))

from inference_trace.instrumentation import emit, install  # noqa: E402


MODEL_ID = "Eco-Tech/Qwen3.5-35B-A3B-w8a8-mtp"
MODEL_DIR = Path(
    "/root/.cache/modelscope/hub/models/"
    "Eco-Tech/Qwen3___5-35B-A3B-w8a8-mtp"
)
PROMPTS = ["Hello, my name is"]


def _git_sha(path: str) -> str:
    completed = subprocess.run(
        ["git", "-C", path, "rev-parse", "HEAD"],
        check=True,
        capture_output=True,
        text=True,
    )
    return completed.stdout.strip()


def _versions() -> dict[str, str]:
    result = {"python": sys.version.split()[0]}
    for name in ("vllm", "vllm-ascend", "torch", "torch-npu", "transformers"):
        try:
            result[name] = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            result[name] = "<not-installed>"
    return result


def _walk_quant_types(value: Any, counts: Counter[str]) -> None:
    if isinstance(value, dict):
        for item in value.values():
            _walk_quant_types(item, counts)
    elif isinstance(value, list):
        for item in value:
            _walk_quant_types(item, counts)
    elif value in {"FLOAT", "W8A8_DYNAMIC"}:
        counts[str(value)] += 1


def record_static_evidence() -> None:
    config = json.loads((MODEL_DIR / "config.json").read_text())
    text_config = config.get("text_config", config)
    quant = json.loads((MODEL_DIR / "quant_model_description.json").read_text())
    quant_counts: Counter[str] = Counter()
    _walk_quant_types(quant, quant_counts)
    shards = [
        {"name": path.name, "bytes": path.stat().st_size}
        for path in sorted(MODEL_DIR.glob("quant_model_weights-*.safetensors"))
    ]

    emit(
        "run.environment",
        {
            "traceMode": "eager-observability",
            "modelId": MODEL_ID,
            "versions": _versions(),
            "vllmCommit": _git_sha("/vllm-workspace/vllm"),
            "vllmAscendCommit": _git_sha("/vllm-workspace/vllm-ascend"),
            "visibleDevices": os.getenv("ASCEND_RT_VISIBLE_DEVICES"),
            "workerMethod": os.getenv("VLLM_WORKER_MULTIPROC_METHOD"),
        },
        fidelity="EXACT",
    )
    keys = (
        "model_type",
        "vocab_size",
        "hidden_size",
        "num_hidden_layers",
        "num_attention_heads",
        "num_key_value_heads",
        "head_dim",
        "num_experts",
        "num_experts_per_tok",
        "moe_intermediate_size",
        "shared_expert_intermediate_size",
    )
    emit(
        "model.config",
        {
            **{key: text_config.get(key) for key in keys},
            "layerTypes": text_config.get("layer_types"),
        },
        fidelity="EXACT",
    )
    emit(
        "model.quantization",
        {
            "modelQuantType": quant.get("model_quant_type"),
            "leafTypeCounts": dict(quant_counts),
        },
        fidelity="EXACT",
    )
    emit(
        "model.weight_shards",
        {
            "count": len(shards),
            "totalBytes": sum(item["bytes"] for item in shards),
            "shards": shards,
        },
        fidelity="EXACT",
    )


def _serializable_outputs(outputs: Any) -> list[dict[str, Any]]:
    result = []
    for token_ids, text in outputs:
        result.append(
            {
                "tokenIds": list(token_ids),
                "text": text,
            }
        )
    return result


def main() -> None:
    output_dir = Path(os.environ["INFERENCE_TRACE_OUTPUT_DIR"])
    output_dir.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("HCCL_BUFFSIZE", "1024")
    record_static_evidence()
    emit(
        "run.start",
        {
            "prompts": PROMPTS,
            "maxTokens": 5,
            "temperature": 0.0,
            "tensorParallelSize": 2,
            "expertParallel": False,
            "enforceEager": True,
        },
        fidelity="EXACT",
    )
    started = time.time()
    summary: dict[str, Any]
    runner = None
    try:
        from tests.e2e.conftest import VllmRunner

        runner = VllmRunner(
            MODEL_ID,
            max_model_len=4096,
            tensor_parallel_size=2,
            enable_expert_parallel=False,
            quantization="ascend",
            gpu_memory_utilization=0.9,
            distributed_executor_backend="mp",
            enforce_eager=True,
        )
        outputs = runner.generate_greedy(PROMPTS, max_tokens=5)
        serialized = _serializable_outputs(outputs)
        emit("run.output", {"outputs": serialized}, fidelity="EXACT")
        summary = {
            "status": "passed",
            "durationSeconds": time.time() - started,
            "outputs": serialized,
        }
    except BaseException as exc:
        emit(
            "run.error",
            {"error": f"{exc.__class__.__name__}: {exc}"},
            fidelity="EXACT",
        )
        summary = {
            "status": "failed",
            "durationSeconds": time.time() - started,
            "error": f"{exc.__class__.__name__}: {exc}",
        }
        raise
    finally:
        if runner is not None:
            runner.__exit__(None, None, None)
        (output_dir / "run-summary.json").write_text(
            json.dumps(summary, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )


install()

if __name__ == "__main__":
    main()
