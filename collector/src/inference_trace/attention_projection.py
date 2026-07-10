from __future__ import annotations

import math
from typing import Any


QKV_STAGE = "tensor.full_attention.qkv.layer3"
OUTPUT_STAGE = "tensor.full_attention.output.layer3"


def _full_tensor_rows(metadata: Any, name: str) -> list[list[float]]:
    if not isinstance(metadata, dict):
        raise ValueError(f"{name} metadata is missing")
    shape = metadata.get("shape")
    values = metadata.get("sample")
    if (
        not isinstance(shape, list)
        or len(shape) != 2
        or metadata.get("valueCoverage") != "FULL"
        or not isinstance(values, list)
    ):
        raise ValueError(f"{name} is not a fully captured rank-2 tensor")
    rows, columns = (int(shape[0]), int(shape[1]))
    if len(values) != rows * columns:
        raise ValueError(
            f"{name} value count {len(values)} does not match shape {shape}"
        )
    return [
        [float(item) for item in values[index : index + columns]]
        for index in range(0, len(values), columns)
    ]


def _attention_settings(
    payload: dict[str, Any],
    model_config: dict[str, Any],
    tp_size: int,
) -> tuple[int, int, int, float, int | None]:
    num_heads = int(
        payload.get("numHeads") or int(model_config["num_attention_heads"]) // tp_size
    )
    num_kv_heads = int(
        payload.get("numKvHeads") or int(model_config["num_key_value_heads"]) // tp_size
    )
    head_size = int(payload.get("headSize") or model_config["head_dim"])
    scale = float(payload.get("scale") or head_size**-0.5)
    sliding_window = payload.get("slidingWindow")
    return (
        num_heads,
        num_kv_heads,
        head_size,
        scale,
        int(sliding_window) if sliding_window is not None else None,
    )


def _derive_rank(
    qkv_event: dict[str, Any],
    output_event: dict[str, Any],
    model_config: dict[str, Any],
    tp_size: int,
) -> dict[str, Any]:
    payload = qkv_event["payload"]
    query = _full_tensor_rows(payload.get("query"), "query")
    key = _full_tensor_rows(payload.get("key"), "key")
    value = _full_tensor_rows(payload.get("value"), "value")
    real_output = _full_tensor_rows(
        output_event.get("payload", {}).get("output"),
        "fused attention output",
    )
    num_heads, num_kv_heads, head_size, scale, sliding_window = _attention_settings(
        payload, model_config, tp_size
    )

    token_count = len(query)
    if not token_count or len(key) != token_count or len(value) != token_count:
        raise ValueError("Q/K/V token counts do not match")
    if len(query[0]) != num_heads * head_size:
        raise ValueError("query width does not match numHeads × headSize")
    if len(key[0]) != num_kv_heads * head_size:
        raise ValueError("key width does not match numKvHeads × headSize")
    if len(value[0]) != num_kv_heads * head_size:
        raise ValueError("value width does not match numKvHeads × headSize")
    if num_heads % num_kv_heads:
        raise ValueError("numHeads must be divisible by numKvHeads for GQA")

    queries_per_kv = num_heads // num_kv_heads
    derived_output = [
        [0.0 for _ in range(num_heads * head_size)] for _ in range(token_count)
    ]
    heads = []
    row_sum_error = 0.0
    masked_probability = 0.0
    rank = str(qkv_event.get("rank"))

    for head in range(num_heads):
        kv_head = head // queries_per_kv
        score_matrix: list[list[float | None]] = []
        probability_matrix: list[list[float]] = []
        top_keys = []
        for query_index in range(token_count):
            first_key = 0
            if sliding_window is not None:
                first_key = max(0, query_index - sliding_window + 1)
            allowed_keys = range(first_key, query_index + 1)
            scores = []
            for key_index in allowed_keys:
                q_offset = head * head_size
                k_offset = kv_head * head_size
                dot = sum(
                    query[query_index][q_offset + component]
                    * key[key_index][k_offset + component]
                    for component in range(head_size)
                )
                scores.append(dot * scale)

            maximum = max(scores)
            exponentials = [math.exp(item - maximum) for item in scores]
            denominator = sum(exponentials)
            probabilities = [item / denominator for item in exponentials]
            score_row: list[float | None] = [None] * token_count
            probability_row = [0.0] * token_count
            for key_index, score, probability in zip(
                allowed_keys,
                scores,
                probabilities,
                strict=True,
            ):
                score_row[key_index] = score
                probability_row[key_index] = probability
            score_matrix.append(score_row)
            probability_matrix.append(probability_row)
            row_sum_error = max(
                row_sum_error,
                abs(sum(probability_row) - 1.0),
            )
            masked_probability = max(
                masked_probability,
                max(probability_row[query_index + 1 :], default=0.0),
            )
            top_key = max(range(token_count), key=probability_row.__getitem__)
            top_keys.append(
                {
                    "queryToken": query_index,
                    "keyToken": top_key,
                    "probability": probability_row[top_key],
                }
            )

            output_offset = head * head_size
            value_offset = kv_head * head_size
            for component in range(head_size):
                derived_output[query_index][output_offset + component] = sum(
                    probability_row[key_index]
                    * value[key_index][value_offset + component]
                    for key_index in range(token_count)
                )

        heads.append(
            {
                "localHead": head,
                "displayHead": int(rank) * num_heads + head,
                "kvHead": kv_head,
                "scores": score_matrix,
                "probabilities": probability_matrix,
                "topKeys": top_keys,
            }
        )

    derived_flat = [item for row in derived_output for item in row]
    real_flat = [item for row in real_output for item in row]
    if len(derived_flat) != len(real_flat):
        raise ValueError("derived and fused attention output shapes do not match")
    differences = [
        abs(derived - real)
        for derived, real in zip(derived_flat, real_flat, strict=True)
    ]
    dot_product = sum(
        derived * real for derived, real in zip(derived_flat, real_flat, strict=True)
    )
    derived_norm = math.sqrt(sum(item * item for item in derived_flat))
    real_norm = math.sqrt(sum(item * item for item in real_flat))

    return {
        "rank": rank,
        "inputLayout": payload.get("inputLayout", "TND"),
        "tokenCount": token_count,
        "numHeads": num_heads,
        "numKvHeads": num_kv_heads,
        "headSize": head_size,
        "queriesPerKv": queries_per_kv,
        "scale": scale,
        "slidingWindow": sliding_window,
        "heads": heads,
        "outputComparison": {
            "derivedShape": [token_count, num_heads * head_size],
            "fusedShape": [token_count, num_heads * head_size],
            "maxAbsError": max(differences, default=0.0),
            "meanAbsError": sum(differences) / len(differences),
            "rmse": math.sqrt(
                sum(item * item for item in differences) / len(differences)
            ),
            "cosineSimilarity": dot_product / (derived_norm * real_norm),
            "maxProbabilityRowSumError": row_sum_error,
            "maxMaskedProbability": masked_probability,
            "derivedSample": derived_flat[:64],
            "fusedSample": real_flat[:64],
        },
        "sourceEventIds": [qkv_event.get("eventId"), output_event.get("eventId")],
    }


def derive_attention(events: list[dict[str, Any]]) -> dict[str, Any]:
    qkv_events = [
        item
        for item in events
        if item.get("stage") == QKV_STAGE and item.get("phase") == "prefill"
    ]
    output_events = {
        str(item.get("rank")): item
        for item in events
        if item.get("stage") == OUTPUT_STAGE and item.get("phase") == "prefill"
    }
    model_config = next(
        (
            item.get("payload", {})
            for item in events
            if item.get("stage") == "model.config"
        ),
        {},
    )
    run_start = next(
        (
            item.get("payload", {})
            for item in events
            if item.get("stage") == "run.start"
        ),
        {},
    )
    tp_size = int(run_start.get("tensorParallelSize", 1))
    errors = []
    ranks = []
    for event in sorted(qkv_events, key=lambda item: str(item.get("rank"))):
        rank = str(event.get("rank"))
        try:
            ranks.append(
                _derive_rank(
                    event,
                    output_events[rank],
                    model_config,
                    tp_size,
                )
            )
        except (KeyError, TypeError, ValueError, ZeroDivisionError) as exc:
            errors.append(f"rank {rank}: {exc}")

    token_count = ranks[0]["tokenCount"] if ranks else 0
    all_heads = [head for rank in ranks for head in rank["heads"]]
    mean_probability_matrix = []
    mean_top_keys = []
    mean_entropy_by_query = []
    for query_index in range(token_count):
        row = [
            sum(head["probabilities"][query_index][key_index] for head in all_heads)
            / len(all_heads)
            for key_index in range(token_count)
        ]
        mean_probability_matrix.append(row)
        top_key = max(range(token_count), key=row.__getitem__)
        mean_top_keys.append(
            {
                "queryToken": query_index,
                "keyToken": top_key,
                "probability": row[top_key],
            }
        )
        mean_entropy_by_query.append(
            -sum(
                probability * math.log(probability)
                for probability in row
                if probability
            )
        )
    output_tokens = next(
        (
            item.get("payload", {}).get("outputs", [{}])[0].get("tokenIds", [])
            for item in reversed(events)
            if item.get("stage") == "run.output"
        ),
        [],
    )
    return {
        "schemaVersion": "1.0",
        "fidelity": "DERIVED",
        "status": "available" if ranks and not errors else "unavailable",
        "formula": "softmax((Q @ K^T) * scale + causalMask) @ V",
        "sourceSemantics": {
            "queryKey": "real Q/K after QK RMSNorm and RoPE",
            "value": "real projected V before fused attention",
            "fusedOutput": "real fused attention output before output gate and O projection",
            "causal": True,
            "groupedQueryAttention": True,
        },
        "promptTokenIds": list(output_tokens[:token_count]),
        "tokenCount": token_count,
        "overview": {
            "headCount": len(all_heads),
            "meanProbabilityMatrix": mean_probability_matrix,
            "meanTopKeys": mean_top_keys,
            "meanEntropyByQuery": mean_entropy_by_query,
        },
        "ranks": ranks,
        "errors": errors,
    }


def validate_attention_artifact(artifact: dict[str, Any]) -> dict[str, Any]:
    errors = list(artifact.get("errors", []))
    ranks = artifact.get("ranks", [])
    rank_ids = {str(item.get("rank")) for item in ranks}
    if artifact.get("status") != "available":
        errors.append("derived attention artifact is unavailable")
    if rank_ids != {"0", "1"}:
        errors.append(f"derived attention ranks are incomplete: {sorted(rank_ids)}")

    comparisons = []
    for item in ranks:
        comparison = item.get("outputComparison", {})
        comparisons.append({"rank": item.get("rank"), **comparison})
        if comparison.get("maxProbabilityRowSumError", 1.0) > 1e-6:
            errors.append(f"rank {item.get('rank')} softmax rows do not sum to 1")
        if comparison.get("maxMaskedProbability", 1.0) > 1e-12:
            errors.append(
                f"rank {item.get('rank')} causal mask is not zero above diagonal"
            )
        if comparison.get("cosineSimilarity", 0.0) < 0.99:
            errors.append(
                f"rank {item.get('rank')} derived output does not match fused output"
            )

    return {
        "errors": errors,
        "status": artifact.get("status"),
        "fidelity": artifact.get("fidelity"),
        "rankCount": len(ranks),
        "tokenCount": artifact.get("tokenCount"),
        "headCount": sum(len(item.get("heads", [])) for item in ranks),
        "comparisons": comparisons,
    }
