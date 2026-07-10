import unittest

from inference_trace.instrumentation import step_from_scheduler


class SchedulerOutput:
    def __init__(self, total):
        self.total_num_scheduled_tokens = total


class InstrumentationTests(unittest.TestCase):
    def test_scheduler_steps_separate_prefill_and_decode(self):
        prefill, next_decode = step_from_scheduler(SchedulerOutput(5), 0)
        decode, final_decode = step_from_scheduler(SchedulerOutput(1), next_decode)

        self.assertEqual(prefill, {"phase": "prefill", "kind": "prefill", "index": 0})
        self.assertEqual(next_decode, 0)
        self.assertEqual(decode, {"phase": "decode", "kind": "decode", "index": 1})
        self.assertEqual(final_decode, 1)


if __name__ == "__main__":
    unittest.main()
