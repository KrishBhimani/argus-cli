"""Ingest workflow run records into workflow_runs / workflow_agents.

The collector owns every write; the adapter only parses. Same separation as
detectors (pure reads) vs. the alert scheduler (the only writer).

Change detection differs from every other ingest path in Argus. Elsewhere a
file is an append-only JSONL and the cursor is a byte offset tested with
``size > offset``. A workflow record is a *snapshot rewritten in place*: it can
shrink, and its content can change without growing. So:

    re-parse when st_size != stored OR the stored run's status != 'completed'

The ``!=`` covers a shrinking rewrite. The status clause covers a run captured
mid-flight that later finishes at a coincidentally identical size, and it
self-limits: a completed run is immutable, so steady-state restarts re-parse
nothing.
"""
from __future__ import annotations

import logging
from pathlib import Path

from ..adapters.base import Adapter
from ..store.repository import Repository

logger = logging.getLogger(__name__)


def ingest_workflow_records(
    adapter: Adapter, session_file: Path, session_id: str, repo: Repository
) -> None:
    """Parse and upsert any changed workflow run records for a session."""
    for path in adapter.workflow_files_for(session_file):
        key = str(path)
        try:
            size = path.stat().st_size
        except OSError:
            continue

        # The filename stem IS the runId (wf_268c5193-b32.json), so the stored
        # status can be checked without parsing the file first.
        run_id = path.stem
        if size == repo.get_file_offset(key):
            if repo.workflow_run_status(run_id) == "completed":
                continue

        try:
            parsed = adapter.parse_workflow_record(path, session_id)
        except Exception as e:  # noqa: BLE001
            # Do NOT advance the cursor: the next tick must retry. A record
            # caught mid-write is the common case here.
            repo.record_parse_error(
                {
                    "file": key,
                    "byte_offset": 0,
                    "reason": f"[workflow] {e}",
                    "raw_line_truncated": "",
                }
            )
            continue

        if parsed is None:
            continue

        repo.upsert_workflow_run(parsed.run)
        repo.upsert_workflow_agents(parsed.agents)

        if parsed.truncated_bytes > 0:
            # Surface the loss on Settings -> Parse errors rather than
            # discovering it years later.
            repo.record_parse_error(
                {
                    "file": key,
                    "byte_offset": 0,
                    "reason": (
                        f"[workflow] raw_json truncated, "
                        f"{parsed.truncated_bytes} bytes dropped"
                    ),
                    "raw_line_truncated": "",
                }
            )

        repo.set_file_offset(key, size)
