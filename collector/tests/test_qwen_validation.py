import unittest

from inference_trace.qwen_validation import validate_events


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


if __name__ == "__main__":
    unittest.main()
