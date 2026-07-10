from __future__ import annotations

from typing import Any


TEXT_LIMIT = 240


def _clip(value: str) -> str:
    value = value.replace("\n", "\\n")
    if len(value) <= TEXT_LIMIT:
        return value
    return value[: TEXT_LIMIT - 3] + "..."


def _is_tensor_like(value: Any) -> bool:
    return all(
        hasattr(value, attribute) for attribute in ("shape", "dtype", "device", "numel")
    )


def _tensor_metadata(value: Any) -> dict[str, Any]:
    return {
        "kind": "tensor",
        "shape": [int(size) for size in value.shape],
        "dtype": str(value.dtype),
        "device": str(value.device),
        "numel": int(value.numel()),
    }


def _capture_tensor_values(
    value: Any,
    metadata: dict[str, Any],
    *,
    sample_limit: int,
    topk: int,
    row_limit: int,
) -> None:
    if metadata["numel"] == 0:
        return
    try:
        import torch

        if not isinstance(value, torch.Tensor):
            return
        detached = value.detach()
        numeric = detached.float()
        sample = numeric.reshape(-1)[:sample_limit]
        stats = torch.stack(
            (
                numeric.amin(),
                numeric.amax(),
                numeric.mean(),
                numeric.std(unbiased=False),
            )
        )
        metadata["sample"] = sample.cpu().tolist()
        metadata["sampleCount"] = int(sample.numel())
        metadata["valueCoverage"] = (
            "FULL" if int(sample.numel()) == metadata["numel"] else "PREFIX"
        )
        stats_values = stats.cpu().tolist()
        metadata["stats"] = dict(
            zip(("min", "max", "mean", "std"), stats_values, strict=True)
        )
        if topk > 0 and numeric.ndim > 0 and numeric.shape[-1] > 0:
            rows = numeric.reshape(-1, numeric.shape[-1])[:row_limit]
            values, indices = torch.topk(
                rows,
                k=min(topk, rows.shape[-1]),
                dim=-1,
            )
            metadata["topk"] = {
                "values": values.cpu().tolist(),
                "indices": indices.cpu().tolist(),
            }
    except Exception as exc:
        metadata["captureError"] = f"{exc.__class__.__name__}: {_clip(str(exc))}"


def summarize(
    value: Any,
    *,
    capture_values: bool = False,
    sample_limit: int = 64,
    topk: int = 0,
    row_limit: int = 8,
    depth: int = 0,
) -> Any:
    if depth > 3:
        return "<depth-limit>"
    if _is_tensor_like(value):
        metadata = _tensor_metadata(value)
        if capture_values:
            _capture_tensor_values(
                value,
                metadata,
                sample_limit=sample_limit,
                topk=topk,
                row_limit=row_limit,
            )
        return metadata
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if isinstance(value, str):
        return _clip(value)
    if isinstance(value, (list, tuple)):
        return [summarize(item, depth=depth + 1) for item in list(value)[:8]]
    if isinstance(value, dict):
        return {
            _clip(str(key)): summarize(item, depth=depth + 1)
            for key, item in list(value.items())[:12]
        }

    interesting = {}
    for name in (
        "request_id",
        "req_id",
        "prompt",
        "prompt_token_ids",
        "total_num_scheduled_tokens",
        "num_reqs",
        "num_computed_tokens",
    ):
        if hasattr(value, name):
            try:
                interesting[name] = summarize(
                    getattr(value, name),
                    depth=depth + 1,
                )
            except Exception as exc:
                interesting[name] = f"<{exc.__class__.__name__}>"
    if interesting:
        return {"kind": value.__class__.__name__, **interesting}
    return {
        "kind": value.__class__.__name__,
        "module": value.__class__.__module__,
    }


def summarize_call(args: tuple[Any, ...], kwargs: dict[str, Any]) -> dict[str, Any]:
    return {
        "args": [summarize(item) for item in list(args[1:5])],
        "kwargs": {key: summarize(value) for key, value in list(kwargs.items())[:12]},
    }
