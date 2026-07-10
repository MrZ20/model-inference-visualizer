from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


COLLECTOR_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(COLLECTOR_ROOT / "src"))

from inference_trace.qwen_validation import validate_events  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("events_json", type=Path)
    parser.add_argument("report_json", type=Path)
    args = parser.parse_args()

    events = json.loads(args.events_json.read_text(encoding="utf-8"))
    report = validate_events(events)
    args.report_json.parent.mkdir(parents=True, exist_ok=True)
    args.report_json.write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if not report["errors"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
