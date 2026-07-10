from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable


REQUIRED_EVENT_KEYS = {
    "schemaVersion",
    "eventId",
    "runId",
    "timestampNs",
    "pid",
    "rank",
    "phase",
    "stage",
    "fidelity",
    "payload",
}
IP_PATTERN = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
ROOT_PATH_PATTERN = re.compile(r"/root/([^\s\"']+)")
WORKSPACE_PATH_PATTERN = re.compile(r"/vllm-workspace/([^\s\"']+)")


def _sanitize(value: Any, hostnames: set[str], key: str | None = None) -> Any:
    if isinstance(value, dict):
        return {name: _sanitize(item, hostnames, name) for name, item in value.items()}
    if isinstance(value, list):
        return [_sanitize(item, hostnames) for item in value]
    if isinstance(value, tuple):
        return [_sanitize(item, hostnames) for item in value]
    if not isinstance(value, str):
        return value
    if key in {"hostname", "host"}:
        return "<REMOTE_HOST>"

    sanitized = value
    for hostname in hostnames:
        if hostname:
            sanitized = sanitized.replace(hostname, "<REMOTE_HOST>")
    sanitized = IP_PATTERN.sub("<IP_ADDRESS>", sanitized)
    sanitized = ROOT_PATH_PATTERN.sub(r"<REMOTE_ROOT>/\1", sanitized)
    sanitized = WORKSPACE_PATH_PATTERN.sub(r"<REMOTE_WORKSPACE>/\1", sanitized)
    return sanitized


def _chapter(phase: str) -> str:
    if phase == "decode":
        return "decode"
    if phase in {"prefill", "final", "init", "warmup"}:
        return phase
    return "init"


def compile_trace(
    raw_dir: Path,
    output_dir: Path,
    *,
    required_stages: Iterable[str] = (),
) -> dict[str, Any]:
    raw_dir = Path(raw_dir)
    output_dir = Path(output_dir)
    errors: list[str] = []
    events: list[dict[str, Any]] = []
    files = sorted(raw_dir.rglob("events-*.ndjson"))
    raw_bytes = sum(path.stat().st_size for path in files)

    for path in files:
        for line_number, line in enumerate(
            path.read_text(encoding="utf-8").splitlines(),
            start=1,
        ):
            if not line:
                continue
            try:
                item = json.loads(line)
            except json.JSONDecodeError as exc:
                errors.append(f"{path.name}:{line_number}: invalid JSON: {exc}")
                continue
            missing = sorted(REQUIRED_EVENT_KEYS - set(item))
            if missing:
                errors.append(
                    f"{path.name}:{line_number}: missing keys {', '.join(missing)}"
                )
                continue
            events.append(item)

    run_ids = {event["runId"] for event in events}
    if len(run_ids) > 1:
        errors.append(f"multiple run IDs: {sorted(run_ids)}")
    hostnames = {
        str(event.get("hostname", ""))
        for event in events
        if event.get("hostname")
    }
    events.sort(key=lambda event: (event["timestampNs"], event["eventId"]))
    events = [_sanitize(event, hostnames) for event in events]

    stage_counts = Counter(event["stage"] for event in events)
    phase_counts = Counter(event["phase"] for event in events)
    rank_counts = Counter(str(event["rank"]) for event in events)
    fidelity_counts = Counter(event["fidelity"] for event in events)
    missing_stages = sorted(set(required_stages) - set(stage_counts))

    output_dir.mkdir(parents=True, exist_ok=True)
    chapters_dir = output_dir / "chapters"
    chapters_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "events.json").write_text(
        json.dumps(events, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    chapter_events: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for event in events:
        chapter_events[_chapter(event["phase"])].append(event)
    for chapter_name, items in sorted(chapter_events.items()):
        (chapters_dir / f"{chapter_name}.json").write_text(
            json.dumps(items, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )

    report = {
        "schemaVersion": "1.0",
        "runId": next(iter(run_ids), None),
        "eventCount": len(events),
        "rawBytes": raw_bytes,
        "inputFiles": [path.name for path in files],
        "stageCounts": dict(stage_counts),
        "phaseCounts": dict(phase_counts),
        "rankCounts": dict(rank_counts),
        "fidelityCounts": dict(fidelity_counts),
        "missingStages": missing_stages,
        "errors": errors,
        "chapters": {
            name: len(items) for name, items in sorted(chapter_events.items())
        },
    }
    (output_dir / "validation-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (output_dir / "manifest.json").write_text(
        json.dumps(
            {
                "schemaVersion": "1.0",
                "runId": report["runId"],
                "eventCount": report["eventCount"],
                "chapters": report["chapters"],
                "validation": {
                    "errors": len(errors),
                    "missingStages": missing_stages,
                },
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return report
