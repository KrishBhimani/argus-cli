"""Parse a Claude Code workflow run record (``<sid>/workflows/wf_*.json``).

Pure: reads one file, returns typed rows, never writes. The caller decides
what to do with a failure — importantly, it must NOT advance the file cursor,
or a half-written snapshot becomes a permanently missing run.

Claude Code owns this JSON schema, so every field is read defensively with a
default. Unknown fields survive in ``raw_json``, which is the re-derive path
when a future column is added: the source file is deleted by Claude Code
within days, so anything not captured now is lost forever.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ...schema.types import ParsedWorkflowRun, WorkflowAgent, WorkflowRun

logger = logging.getLogger(__name__)

# ~3x the largest record observed in the wild (642 KB).
RAW_JSON_CAP = 2_000_000


def _ms_to_iso(ms: Any) -> str:
    """Epoch milliseconds -> ISO-8601 UTC with a trailing Z. '' when absent."""
    if not isinstance(ms, (int, float)) or isinstance(ms, bool) or ms <= 0:
        return ""
    try:
        dt = datetime.fromtimestamp(ms / 1000.0, tz=timezone.utc)
    except (OverflowError, OSError, ValueError):
        return ""
    return dt.isoformat().replace("+00:00", "Z")


def _s(v: Any) -> str:
    return "" if v is None else str(v)


def _i(v: Any, default: int = 0) -> int:
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return default
    return int(v)


def _json_list(v: Any) -> str:
    return json.dumps(v) if isinstance(v, list) else "[]"


def parse_workflow_record(path: Path, session_id: str) -> ParsedWorkflowRun | None:
    """Parse one run record. Raises json.JSONDecodeError on malformed JSON."""
    text = path.read_text(encoding="utf-8", errors="replace")
    doc = json.loads(text)
    if not isinstance(doc, dict):
        return None

    run_id = _s(doc.get("runId")) or path.stem
    if not run_id:
        return None

    agents: list[WorkflowAgent] = []
    progress = doc.get("workflowProgress")
    if isinstance(progress, list):
        for entry in progress:
            if not isinstance(entry, dict):
                continue
            if entry.get("type") != "workflow_agent":
                continue
            agent_id = _s(entry.get("agentId"))
            if not agent_id:
                continue
            agents.append(
                WorkflowAgent(
                    run_id=run_id,
                    agent_id=agent_id,
                    sub_session_id=f"{session_id}/agent-{agent_id}",
                    seq=_i(entry.get("index")),
                    label=_s(entry.get("label")),
                    phase_index=_i(entry.get("phaseIndex")),
                    phase_title=_s(entry.get("phaseTitle")),
                    model=_s(entry.get("model")),
                    fallback_model=_s(entry.get("fallbackModel")),
                    state=_s(entry.get("state")),
                    attempt=_i(entry.get("attempt"), 1),
                    queued_at=_ms_to_iso(entry.get("queuedAt")),
                    started_at=_ms_to_iso(entry.get("startedAt")),
                    last_progress_at=_ms_to_iso(entry.get("lastProgressAt")),
                    duration_ms=_i(entry.get("durationMs")),
                    wf_tokens=_i(entry.get("tokens")),
                    wf_tool_calls=_i(entry.get("toolCalls")),
                    last_tool_name=_s(entry.get("lastToolName")),
                    last_tool_summary=_s(entry.get("lastToolSummary")),
                    prompt_preview=_s(entry.get("promptPreview")),
                    result_preview=_s(entry.get("resultPreview")),
                )
            )

    agent_count = _i(doc.get("agentCount"))
    if agent_count > 0 and not agents:
        # Tripwire, same spirit as discover.py's: silent under-counting looks
        # exactly like success, so say something instead of reporting zero.
        logger.warning(
            "workflow record %s declares %d agents but none parsed; "
            "progress format may have changed",
            path.name,
            agent_count,
        )

    truncated = max(0, len(text) - RAW_JSON_CAP)
    run = WorkflowRun(
        run_id=run_id,
        session_id=session_id,
        name=_s(doc.get("workflowName")),
        summary=_s(doc.get("summary")),
        status=_s(doc.get("status")),
        task_id=_s(doc.get("taskId")),
        started_at=_ms_to_iso(doc.get("startTime")),
        duration_ms=_i(doc.get("durationMs")),
        agent_count=agent_count or len(agents),
        default_model=_s(doc.get("defaultModel")),
        wf_total_tokens=_i(doc.get("totalTokens")),
        wf_total_tools=_i(doc.get("totalToolCalls")),
        phases_json=_json_list(doc.get("phases")),
        logs_json=_json_list(doc.get("logs")),
        script=_s(doc.get("script")),
        raw_json=text[:RAW_JSON_CAP],
    )
    return ParsedWorkflowRun(run=run, agents=agents, truncated_bytes=truncated)
