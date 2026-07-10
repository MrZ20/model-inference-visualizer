import json
import tempfile
import unittest
from pathlib import Path

from inference_trace.compiler import compile_trace


def event(event_id, stage, phase, timestamp, payload):
    return {
        "schemaVersion": "1.0",
        "eventId": event_id,
        "runId": "run-test",
        "timestampNs": timestamp,
        "wallTime": timestamp,
        "pid": 1,
        "rank": "0",
        "processRole": "worker",
        "hostname": "private-host",
        "phase": phase,
        "logicalStep": {"kind": phase, "index": 0},
        "stage": stage,
        "fidelity": "EXACT",
        "payload": payload,
    }


class TraceCompilerTests(unittest.TestCase):
    def test_compiler_merges_sanitizes_validates_and_splits_chapters(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            raw = root / "raw"
            out = root / "curated"
            raw.mkdir()
            first = event(
                "2",
                "tensor.logits",
                "prefill",
                20,
                {"path": "/root/private/model", "shape": [1, 8]},
            )
            second = event(
                "1",
                "run.environment",
                "init",
                10,
                {"host": "private-host", "ip": "172.22.0.155"},
            )
            final = event(
                "3",
                "run.output",
                "final",
                30,
                {"text": "Hello"},
            )
            (raw / "events-a.ndjson").write_text(
                json.dumps(first) + "\n" + json.dumps(final) + "\n"
            )
            (raw / "events-b.ndjson").write_text(json.dumps(second) + "\n")

            report = compile_trace(
                raw,
                out,
                required_stages={
                    "run.environment",
                    "tensor.logits",
                    "run.output",
                },
            )

            self.assertEqual(report["errors"], [])
            self.assertEqual(report["missingStages"], [])
            self.assertEqual(report["eventCount"], 3)
            events = json.loads((out / "events.json").read_text())
            self.assertEqual([item["eventId"] for item in events], ["1", "2", "3"])
            serialized = json.dumps(events)
            self.assertNotIn("private-host", serialized)
            self.assertNotIn("172.22.0.155", serialized)
            self.assertNotIn("/root/private/model", serialized)
            self.assertTrue((out / "chapters" / "init.json").exists())
            self.assertTrue((out / "chapters" / "prefill.json").exists())
            self.assertTrue((out / "chapters" / "final.json").exists())
            self.assertTrue((out / "parallel-summary.json").exists())
            self.assertTrue((out / "moe-quantization.json").exists())
            self.assertTrue((out / "attention-derived.json").exists())
            self.assertTrue((out / "attention-validation-report.json").exists())
            manifest = json.loads((out / "manifest.json").read_text())
            self.assertEqual(
                manifest["projections"]["parallel"],
                "parallel-summary.json",
            )
            self.assertEqual(
                manifest["projections"]["attentionDerived"],
                "attention-derived.json",
            )


if __name__ == "__main__":
    unittest.main()
