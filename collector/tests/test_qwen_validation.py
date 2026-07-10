import unittest

from inference_trace.qwen_validation import _validate_detail_events, validate_events


def trace_event(stage, rank, payload, timestamp, phase="prefill"):
    return {
        "stage": stage,
        "rank": rank,
        "payload": payload,
        "timestampNs": timestamp,
        "phase": phase,
    }


class QwenValidationTests(unittest.TestCase):
    def test_validation_connects_tensor_shapes_logits_and_generated_token(self):
        events = [
            trace_event(
                "run.output",
                "-",
                {"outputs": [{"tokenIds": [1, 2, 9], "text": "ok"}]},
                50,
                phase="init",
            ),
            trace_event(
                "tensor.embedding",
                "0",
                {"output": {"shape": [2, 2048]}},
                10,
            ),
            trace_event(
                "tensor.full_attention.qkv.layer3",
                "0",
                {
                    "query": {"shape": [2, 2048]},
                    "key": {"shape": [2, 256]},
                    "value": {"shape": [2, 256]},
                },
                20,
            ),
            trace_event(
                "tensor.linear_attention.layer0",
                "0",
                {"output": {"shape": [2, 2048]}},
                21,
            ),
            trace_event(
                "tensor.moe.router.layer3",
                "0",
                {
                    "routerLogits": {
                        "shape": [2, 256],
                        "topk": {"indices": [[0] * 8, [1] * 8]},
                    }
                },
                30,
            ),
            trace_event(
                "tensor.logits",
                "0",
                {
                    "shape": [1, 248320],
                    "topk": {"indices": [[9]]},
                },
                40,
            ),
            trace_event(
                "tensor.logits",
                "1",
                {
                    "shape": [1, 248320],
                    "topk": {"indices": [[9]]},
                },
                41,
            ),
        ]

        report = validate_events(events)

        self.assertEqual(report["errors"], [])
        self.assertEqual(report["promptTokenCount"], 2)
        self.assertEqual(report["generatedTokenIds"], [9])
        self.assertEqual(report["logitTop1Ids"], [9])

    def test_detail_validation_requires_two_rank_scales_and_balanced_spans(self):
        items = []
        timestamp = 0
        shard_stages = {
            "layer3.qkv_projection",
            "layer3.o_projection",
            "layer3.moe_router",
            "layer3.moe_experts",
        }

        def add(stage, rank, payload, phase="prefill"):
            nonlocal timestamp
            timestamp += 1
            items.append(trace_event(stage, rank, payload, timestamp, phase=phase))

        def full_tensor(values):
            return {
                "shape": [len(values)],
                "numel": len(values),
                "sample": values,
                "sampleCount": len(values),
                "valueCoverage": "FULL",
            }

        for rank in ("0", "1"):
            add("parallel.topology", rank, {"tpWorldSize": 2})
            for stage in shard_stages:
                add("parallel.module_shard", rank, {"spanStage": stage})
                add(f"parallel.span.{stage}.start", rank, {})
                add(f"parallel.span.{stage}.end", rank, {"durationNs": 1})

            for phase in ("prefill", "decode", "decode"):
                add(
                    "tensor.moe.routing.layer3",
                    rank,
                    {
                        "topkIds": full_tensor([1, 2]),
                        "topkWeights": full_tensor([0.6, 0.4]),
                    },
                    phase,
                )
                add(
                    "tensor.moe.dispatch.layer3",
                    rank,
                    {"dynamicScale": full_tensor([0.1, 0.2])},
                    phase,
                )
                add(
                    "tensor.moe.gmm1_swiglu_input.layer3",
                    rank,
                    {"inputScale": full_tensor([0.1, 0.2])},
                    phase,
                )
                add(
                    "tensor.moe.gmm1_swiglu_output.layer3",
                    rank,
                    {"outputScale": full_tensor([0.3, 0.4])},
                    phase,
                )
                add(
                    "tensor.moe.gmm2_input.layer3",
                    rank,
                    {"perTokenScale": full_tensor([0.3, 0.4])},
                    phase,
                )
                add("tensor.moe.gmm2_output.layer3", rank, {}, phase)

        detail = _validate_detail_events(items)

        self.assertEqual(detail["errors"], [])
        self.assertEqual(detail["topologyRanks"], ["0", "1"])
        self.assertEqual(detail["fullRoutingEvents"], 6)
        self.assertEqual(detail["phases"], {"prefill": 2, "decode": 4})


if __name__ == "__main__":
    unittest.main()
