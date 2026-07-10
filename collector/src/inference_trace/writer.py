from __future__ import annotations

import atexit
import json
import os
import socket
import time
from collections import Counter
from pathlib import Path
from typing import Any


def _rank() -> str:
    environment_rank = (
        os.getenv("RANK")
        or os.getenv("LOCAL_RANK")
        or os.getenv("VLLM_DP_RANK")
    )
    if environment_rank is not None:
        return environment_rank
    try:
        import torch.distributed as distributed

        if distributed.is_available() and distributed.is_initialized():
            return str(distributed.get_rank())
    except Exception:
        pass
    return "-"


def _process_role(rank: str) -> str:
    name = os.getenv("VLLM_PROCESS_NAME")
    if name:
        return name
    if rank != "-":
        return "worker"
    return "main"


class TraceWriter:
    """Write bounded, per-process NDJSON events.

    Each process owns one file, so multiprocessing workers never share a file
    descriptor or lock. Limits are enforced before writes.
    """

    def __init__(
        self,
        output_dir: Path,
        *,
        run_id: str,
        max_bytes: int = 64 * 1024 * 1024,
        per_stage_limit: int = 32,
    ) -> None:
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.run_id = run_id
        self.max_bytes = max_bytes
        self.per_stage_limit = per_stage_limit
        self.pid = os.getpid()
        self.rank = _rank()
        safe_rank = self.rank.replace("/", "_")
        self.path = self.output_dir / f"events-pid{self.pid}-rank{safe_rank}.ndjson"
        self._stream = self.path.open("a", encoding="utf-8")
        self._sequence = 0
        self._written_bytes = self.path.stat().st_size
        self._written_events = 0
        self._dropped_events = 0
        self._stage_counts: Counter[str] = Counter()
        self._closed = False
        atexit.register(self.close)

    @classmethod
    def from_env(cls) -> TraceWriter:
        return cls(
            Path(os.environ["INFERENCE_TRACE_OUTPUT_DIR"]),
            run_id=os.environ["INFERENCE_TRACE_RUN_ID"],
            max_bytes=int(
                os.getenv(
                    "INFERENCE_TRACE_MAX_BYTES_PER_PROCESS",
                    str(64 * 1024 * 1024),
                )
            ),
            per_stage_limit=int(os.getenv("INFERENCE_TRACE_STAGE_LIMIT", "32")),
        )

    def emit(
        self,
        stage: str,
        payload: dict[str, Any] | None = None,
        *,
        phase: str = "unknown",
        logical_step: dict[str, Any] | None = None,
        fidelity: str = "STRUCTURAL",
    ) -> bool:
        if self._closed:
            return False
        if self._stage_counts[stage] >= self.per_stage_limit:
            self._dropped_events += 1
            return False

        self._sequence += 1
        event_rank = _rank()
        event = {
            "schemaVersion": "1.0",
            "eventId": f"{self.pid}-{self._sequence:06d}",
            "runId": self.run_id,
            "timestampNs": time.monotonic_ns(),
            "wallTime": time.time_ns(),
            "pid": self.pid,
            "rank": event_rank,
            "processRole": _process_role(event_rank),
            "hostname": socket.gethostname(),
            "phase": phase,
            "logicalStep": logical_step or {"kind": phase, "index": 0},
            "stage": stage,
            "fidelity": fidelity,
            "payload": payload or {},
        }
        encoded = (
            json.dumps(event, ensure_ascii=False, separators=(",", ":")) + "\n"
        ).encode("utf-8")
        if self._written_bytes + len(encoded) > self.max_bytes:
            self._dropped_events += 1
            return False

        self._stream.write(encoded.decode("utf-8"))
        self._stream.flush()
        self._written_bytes += len(encoded)
        self._written_events += 1
        self._stage_counts[stage] += 1
        return True

    def stats(self) -> dict[str, Any]:
        return {
            "path": str(self.path),
            "writtenBytes": self._written_bytes,
            "writtenEvents": self._written_events,
            "droppedEvents": self._dropped_events,
            "stageCounts": dict(self._stage_counts),
        }

    def close(self) -> dict[str, Any]:
        if not self._closed:
            self._stream.close()
            self._closed = True
        return self.stats()
