from __future__ import annotations

from collections import Counter
from typing import Any, Iterable


def _events(
    items: Iterable[dict[str, Any]],
    stage: str,
    *,
    rank: str | None = None,
    phase: str | None = None,
) -> list[dict[str, Any]]:
    result = [
        item
        for item in items
        if item.get("stage") == stage
        and (rank is None or str(item.get("rank")) == rank)
        and (phase is None or item.get("phase") == phase)
    ]
    return sorted(result, key=lambda item: item.get("timestampNs", 0))


def _shape(value: Any) -> list[int] | None:
    if isinstance(value, dict) and isinstance(value.get("shape"), list):
        return value["shape"]
    return None


def validate_events(events: list[dict[str, Any]]) -> dict[str, Any]:
    errors: list[str] = []
    output_events = _events(events, "run.output")
    embedding_events = _events(
        events,
        "tensor.embedding",
        rank="0",
        phase="prefill",
    )
    qkv_events = _events(
        events,
        "tensor.full_attention.qkv.layer3",
        rank="0",
        phase="prefill",
    )
    linear_events = _events(
        events,
        "tensor.linear_attention.layer0",
        rank="0",
        phase="prefill",
    )
    router_events = _events(
        events,
        "tensor.moe.router.layer3",
        rank="0",
        phase="prefill",
    )
    logits_events = _events(events, "tensor.logits", rank="0")

    final_token_ids: list[int] = []
    final_text = None
    if not output_events:
        errors.append("missing run.output")
    else:
        outputs = output_events[-1]["payload"].get("outputs", [])
        if not outputs:
            errors.append("run.output has no outputs")
        else:
            final_token_ids = list(outputs[0].get("tokenIds", []))
            final_text = outputs[0].get("text")

    prompt_token_count = 0
    embedding_shape = None
    if not embedding_events:
        errors.append("missing rank 0 prefill embedding")
    else:
        embedding_shape = _shape(embedding_events[0]["payload"].get("output"))
        if not embedding_shape:
            errors.append("embedding shape missing")
        else:
            prompt_token_count = embedding_shape[0]
            if embedding_shape[1:] != [2048]:
                errors.append(f"unexpected embedding shape {embedding_shape}")

    qkv_shapes = None
    if not qkv_events:
        errors.append("missing rank 0 prefill Q/K/V")
    else:
        payload = qkv_events[0]["payload"]
        qkv_shapes = {
            name: _shape(payload.get(name))
            for name in ("query", "key", "value")
        }
        expected = {
            "query": [prompt_token_count, 2048],
            "key": [prompt_token_count, 256],
            "value": [prompt_token_count, 256],
        }
        if qkv_shapes != expected:
            errors.append(f"unexpected Q/K/V shapes {qkv_shapes}")

    linear_shape = None
    if not linear_events:
        errors.append("missing rank 0 linear attention")
    else:
        linear_shape = _shape(linear_events[0]["payload"].get("output"))
        if linear_shape != [prompt_token_count, 2048]:
            errors.append(f"unexpected linear attention shape {linear_shape}")

    router_shape = None
    router_topk_ids = None
    if not router_events:
        errors.append("missing rank 0 MoE router")
    else:
        router = router_events[0]["payload"].get("routerLogits", {})
        router_shape = _shape(router)
        router_topk_ids = router.get("topk", {}).get("indices")
        if router_shape != [prompt_token_count, 256]:
            errors.append(f"unexpected router shape {router_shape}")
        if (
            not isinstance(router_topk_ids, list)
            or len(router_topk_ids) != prompt_token_count
            or any(len(row) != 8 for row in router_topk_ids)
        ):
            errors.append("router top-k must contain 8 experts per prompt token")

    logit_top1_ids: list[int] = []
    logit_shapes: list[list[int] | None] = []
    for item in logits_events:
        payload = item["payload"]
        logit_shapes.append(_shape(payload))
        indices = payload.get("topk", {}).get("indices", [])
        if indices and indices[0]:
            logit_top1_ids.append(indices[0][0])
    if not logits_events:
        errors.append("missing rank 0 logits")
    if any(shape != [1, 248320] for shape in logit_shapes):
        errors.append(f"unexpected logits shapes {logit_shapes}")

    generated_token_ids = final_token_ids[prompt_token_count:]
    if generated_token_ids != logit_top1_ids:
        errors.append(
            "greedy logits top-1 IDs do not match generated token IDs: "
            f"{logit_top1_ids} != {generated_token_ids}"
        )

    rank_counts = Counter(str(item.get("rank")) for item in events)
    if not {"0", "1"}.issubset(rank_counts):
        errors.append(f"missing TP rank events: {dict(rank_counts)}")

    return {
        "errors": errors,
        "promptTokenCount": prompt_token_count,
        "finalTokenIds": final_token_ids,
        "generatedTokenIds": generated_token_ids,
        "finalText": final_text,
        "logitTop1Ids": logit_top1_ids,
        "embeddingShape": embedding_shape,
        "qkvShapes": qkv_shapes,
        "linearAttentionShape": linear_shape,
        "routerShape": router_shape,
        "routerTopkIds": router_topk_ids,
        "logitsShapes": logit_shapes,
        "rankCounts": dict(rank_counts),
    }
