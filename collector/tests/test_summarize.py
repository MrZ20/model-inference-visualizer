import unittest

from inference_trace.summarize import summarize


class FakeTensor:
    shape = (2, 3)
    dtype = "torch.bfloat16"
    device = "npu:0"

    def numel(self):
        return 6


class SummarizeTests(unittest.TestCase):
    def test_summarize_preserves_tensor_metadata_without_reading_values(self):
        result = summarize(FakeTensor())

        self.assertEqual(
            result,
            {
                "kind": "tensor",
                "shape": [2, 3],
                "dtype": "torch.bfloat16",
                "device": "npu:0",
                "numel": 6,
            },
        )


if __name__ == "__main__":
    unittest.main()
