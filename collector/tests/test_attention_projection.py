import math
import unittest

from inference_trace.attention_projection import derive_attention


def full_tensor(rows):
    values = [item for row in rows for item in row]
    return {
        "shape": [len(rows), len(rows[0])],
        "numel": len(values),
        "sample": values,
        "sampleCount": len(values),
        "valueCoverage": "FULL",
    }


def trace_event(stage, payload, timestamp):
    return {
        "eventId": str(timestamp),
        "rank": "0",
        "phase": "prefill",
        "stage": stage,
        "payload": payload,
    }


class AttentionProjectionTests(unittest.TestCase):
    def test_derives_causal_gqa_softmax_and_matches_attention_output(self):
        high = math.e / (math.e + 1.0)
        low = 1.0 / (math.e + 1.0)
        events = [
            trace_event(
                "model.config",
                {
                    "num_attention_heads": 2,
                    "num_key_value_heads": 1,
                    "head_dim": 2,
                },
                1,
            ),
            trace_event(
                "run.start",
                {"tensorParallelSize": 1},
                2,
            ),
            trace_event(
                "tensor.full_attention.qkv.layer3",
                {
                    "numHeads": 2,
                    "numKvHeads": 1,
                    "headSize": 2,
                    "scale": 1.0,
                    "query": full_tensor(
                        [
                            [1.0, 0.0, 0.0, 1.0],
                            [1.0, 0.0, 0.0, 1.0],
                        ]
                    ),
                    "key": full_tensor([[1.0, 0.0], [0.0, 1.0]]),
                    "value": full_tensor([[2.0, 0.0], [0.0, 4.0]]),
                },
                3,
            ),
            trace_event(
                "tensor.full_attention.output.layer3",
                {
                    "output": full_tensor(
                        [
                            [2.0, 0.0, 2.0, 0.0],
                            [2.0 * high, 4.0 * low, 2.0 * low, 4.0 * high],
                        ]
                    )
                },
                4,
            ),
            trace_event(
                "run.output",
                {"outputs": [{"tokenIds": [101, 102, 103]}]},
                5,
            ),
        ]

        artifact = derive_attention(events)

        self.assertEqual(artifact["status"], "available")
        self.assertEqual(artifact["fidelity"], "DERIVED")
        self.assertEqual(artifact["promptTokenIds"], [101, 102])
        self.assertEqual(
            artifact["overview"]["meanProbabilityMatrix"][1],
            [0.5, 0.5],
        )
        rank = artifact["ranks"][0]
        self.assertEqual(rank["queriesPerKv"], 2)
        self.assertEqual(rank["heads"][0]["probabilities"][0], [1.0, 0.0])
        self.assertAlmostEqual(
            rank["heads"][0]["probabilities"][1][0],
            high,
        )
        self.assertAlmostEqual(
            rank["heads"][1]["probabilities"][1][0],
            low,
        )
        self.assertLess(rank["outputComparison"]["maxAbsError"], 1e-12)
        self.assertAlmostEqual(
            rank["outputComparison"]["cosineSimilarity"],
            1.0,
        )


if __name__ == "__main__":
    unittest.main()
