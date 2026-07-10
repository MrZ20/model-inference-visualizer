import json
import tempfile
import unittest
from pathlib import Path

from inference_trace.writer import TraceWriter


class TraceWriterTests(unittest.TestCase):
    def test_writer_emits_valid_events_and_limits_each_stage(self):
        with tempfile.TemporaryDirectory() as tmp:
            writer = TraceWriter(
                Path(tmp),
                run_id="run-test",
                max_bytes=1024 * 1024,
                per_stage_limit=2,
            )

            self.assertTrue(writer.emit("runner.step", {"index": 1}, phase="prefill"))
            self.assertTrue(writer.emit("runner.step", {"index": 2}, phase="decode"))
            self.assertFalse(writer.emit("runner.step", {"index": 3}, phase="decode"))
            stats = writer.close()

            event_files = list(Path(tmp).glob("events-*.ndjson"))
            self.assertEqual(len(event_files), 1)
            events = [
                json.loads(line)
                for line in event_files[0].read_text().splitlines()
                if line
            ]
            self.assertEqual([event["payload"]["index"] for event in events], [1, 2])
            self.assertEqual(events[0]["schemaVersion"], "1.0")
            self.assertEqual(events[0]["runId"], "run-test")
            self.assertEqual(events[0]["stage"], "runner.step")
            self.assertEqual(stats["writtenEvents"], 2)
            self.assertEqual(stats["droppedEvents"], 1)


if __name__ == "__main__":
    unittest.main()
