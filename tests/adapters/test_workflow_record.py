"""Parsing a workflow run record into typed rows."""
from __future__ import annotations

import json

import pytest

from argus.adapters.claude_code.workflow_record import (
    RAW_JSON_CAP,
    parse_workflow_record,
)


def _record(**over):
    doc = {
        "runId": "wf_abc",
        "workflowName": "audit",
        "summary": "a security audit",
        "status": "completed",
        "taskId": "wg123",
        "startTime": 1785495093959,
        "durationMs": 2677621,
        "agentCount": 2,
        "defaultModel": "claude-opus-5[1m]",
        "totalTokens": 4876013,
        "totalToolCalls": 1601,
        "phases": [{"title": "Recon", "detail": "map surface"}],
        "logs": ["Raised 33 findings"],
        "script": "export const meta = {}",
        "workflowProgress": [
            {"type": "workflow_phase", "index": 1, "title": "Recon"},
            {
                "type": "workflow_agent", "index": 1, "label": "recon:http",
                "phaseIndex": 1, "phaseTitle": "Recon",
                "agentId": "a311d8ee0f9bf1938", "model": "claude-opus-5[1m]",
                "state": "done", "startedAt": 1785495093986,
                "queuedAt": 1785495093983, "attempt": 1,
                "lastToolName": "Grep", "lastToolSummary": "store/",
                "promptPreview": "You are auditing", "resultPreview": "done",
                "lastProgressAt": 1785495212330, "tokens": 56754,
                "toolCalls": 10, "durationMs": 118343,
            },
        ],
    }
    doc.update(over)
    return doc


def _write(tmp_path, doc, name="wf_abc.json"):
    p = tmp_path / name
    p.write_text(json.dumps(doc), encoding="utf-8")
    return p


def test_parses_run_fields(tmp_path):
    parsed = parse_workflow_record(_write(tmp_path, _record()), "claude_code:s1")
    r = parsed.run
    assert r.run_id == "wf_abc"
    assert r.session_id == "claude_code:s1"
    assert r.name == "audit"
    assert r.status == "completed"
    assert r.duration_ms == 2677621
    assert r.wf_total_tokens == 4876013
    assert json.loads(r.phases_json)[0]["title"] == "Recon"
    assert json.loads(r.logs_json) == ["Raised 33 findings"]
    assert r.script == "export const meta = {}"


def test_start_time_ms_becomes_iso_utc(tmp_path):
    parsed = parse_workflow_record(_write(tmp_path, _record()), "claude_code:s1")
    assert parsed.run.started_at.startswith("2026-07-31T")
    assert parsed.run.started_at.endswith("Z")


def test_agent_rows_and_join_key(tmp_path):
    parsed = parse_workflow_record(_write(tmp_path, _record()), "claude_code:s1")
    assert len(parsed.agents) == 1  # workflow_phase entries are not agents
    a = parsed.agents[0]
    assert a.agent_id == "a311d8ee0f9bf1938"
    assert a.sub_session_id == "claude_code:s1/agent-a311d8ee0f9bf1938"
    assert a.label == "recon:http"
    assert a.phase_title == "Recon"
    assert a.duration_ms == 118343
    assert a.last_tool_name == "Grep"


def test_missing_optional_fields_use_defaults(tmp_path):
    doc = _record(workflowProgress=[
        {"type": "workflow_agent", "agentId": "a1"},
    ], phases=None, logs=None)
    parsed = parse_workflow_record(_write(tmp_path, doc), "claude_code:s1")
    a = parsed.agents[0]
    assert a.queued_at == "" and a.started_at == ""
    assert a.attempt == 1 and a.duration_ms == 0
    assert parsed.run.phases_json == "[]"
    assert parsed.run.logs_json == "[]"


def test_agent_without_id_is_dropped(tmp_path):
    doc = _record(workflowProgress=[{"type": "workflow_agent", "label": "x"}])
    parsed = parse_workflow_record(_write(tmp_path, doc), "claude_code:s1")
    assert parsed.agents == []


def test_tripwire_logs_when_agent_count_positive_but_none_parsed(tmp_path, caplog):
    doc = _record(agentCount=5, workflowProgress=[])
    parse_workflow_record(_write(tmp_path, doc), "claude_code:s1")
    assert "progress format may have changed" in caplog.text


def test_raw_json_is_capped_and_reports_truncation(tmp_path):
    doc = _record(script="x" * (RAW_JSON_CAP + 5000))
    parsed = parse_workflow_record(_write(tmp_path, doc), "claude_code:s1")
    assert len(parsed.run.raw_json) == RAW_JSON_CAP
    assert parsed.truncated_bytes > 0


def test_malformed_json_raises(tmp_path):
    p = tmp_path / "wf_bad.json"
    p.write_text('{"runId": "wf_bad", ', encoding="utf-8")
    with pytest.raises(json.JSONDecodeError):
        parse_workflow_record(p, "claude_code:s1")


def test_run_id_falls_back_to_filename_stem(tmp_path):
    doc = _record()
    del doc["runId"]
    parsed = parse_workflow_record(_write(tmp_path, doc, "wf_from_name.json"), "s")
    assert parsed.run.run_id == "wf_from_name"
