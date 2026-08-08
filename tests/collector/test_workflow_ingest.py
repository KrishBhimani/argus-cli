"""Workflow record ingest: change detection, error isolation, cursor rules."""
from __future__ import annotations

import json

from argus.adapters.claude_code.adapter import ClaudeCodeAdapter
from argus.collector.workflow_ingest import ingest_workflow_records
from argus.pricing.load import load_pricing_table


def _mk_session_file(root, sid="s1"):
    proj = root / "projects" / "p1"
    proj.mkdir(parents=True, exist_ok=True)
    f = proj / f"{sid}.jsonl"
    f.write_text("", encoding="utf-8")
    return f


def _write_record(session_file, run_id="wf_abc", status="completed", agents=2, pad=""):
    wf = session_file.parent / session_file.stem / "workflows"
    wf.mkdir(parents=True, exist_ok=True)
    doc = {
        "runId": run_id, "workflowName": "audit", "status": status,
        "startTime": 1785495093959, "durationMs": 1000, "agentCount": agents,
        "summary": pad,
        "workflowProgress": [
            {
                "type": "workflow_agent", "index": i + 1, "agentId": f"a{i}",
                "label": f"find:{i}", "phaseTitle": "Find", "phaseIndex": 1,
                "state": "done", "startedAt": 1785495093986 + i,
                "queuedAt": 1785495093983, "durationMs": 500, "tokens": 10,
                "toolCalls": 1,
            }
            for i in range(agents)
        ],
    }
    p = wf / f"{run_id}.json"
    p.write_text(json.dumps(doc), encoding="utf-8")
    return p


def test_ingests_run_and_agents(repo, tmp_path):
    root = tmp_path / ".claude"
    sf = _mk_session_file(root)
    _write_record(sf)
    adapter = ClaudeCodeAdapter(root=root)

    ingest_workflow_records(adapter, sf, "claude_code:s1", repo)

    assert repo.workflow_run_status("wf_abc") == "completed"
    rows = repo.db.execute(
        "SELECT agent_id, sub_session_id, label FROM workflow_agents ORDER BY agent_id"
    ).fetchall()
    assert len(rows) == 2
    assert rows[0]["sub_session_id"] == "claude_code:s1/agent-a0"
    assert rows[0]["label"] == "find:0"


def test_rewrite_in_place_smaller_is_re_read(repo, tmp_path):
    # Regression: the offset cursor assumes append-only files; wf JSON does not.
    # A `size > stored` test misses a snapshot that shrinks. This asserts `!=`.
    root = tmp_path / ".claude"
    sf = _mk_session_file(root)
    p = _write_record(sf, status="running", agents=2, pad="x" * 500)
    adapter = ClaudeCodeAdapter(root=root)
    ingest_workflow_records(adapter, sf, "claude_code:s1", repo)
    assert repo.workflow_run_status("wf_abc") == "running"
    big = p.stat().st_size

    _write_record(sf, status="completed", agents=2, pad="")  # strictly smaller
    assert p.stat().st_size < big
    ingest_workflow_records(adapter, sf, "claude_code:s1", repo)

    assert repo.workflow_run_status("wf_abc") == "completed"


def test_unchanged_completed_run_is_not_re_read(repo, tmp_path):
    root = tmp_path / ".claude"
    sf = _mk_session_file(root)
    _write_record(sf)
    adapter = ClaudeCodeAdapter(root=root)
    ingest_workflow_records(adapter, sf, "claude_code:s1", repo)

    calls = {"n": 0}
    original = adapter.parse_workflow_record

    def counting(path, session_id):
        calls["n"] += 1
        return original(path, session_id)

    adapter.parse_workflow_record = counting  # type: ignore[method-assign]
    ingest_workflow_records(adapter, sf, "claude_code:s1", repo)
    assert calls["n"] == 0


def test_running_run_is_re_read_even_when_size_is_unchanged(repo, tmp_path):
    root = tmp_path / ".claude"
    sf = _mk_session_file(root)
    _write_record(sf, status="running")
    adapter = ClaudeCodeAdapter(root=root)
    ingest_workflow_records(adapter, sf, "claude_code:s1", repo)

    calls = {"n": 0}
    original = adapter.parse_workflow_record

    def counting(path, session_id):
        calls["n"] += 1
        return original(path, session_id)

    adapter.parse_workflow_record = counting  # type: ignore[method-assign]
    ingest_workflow_records(adapter, sf, "claude_code:s1", repo)
    assert calls["n"] == 1


def test_malformed_record_records_error_and_does_not_advance_cursor(repo, tmp_path):
    # Advancing the cursor on a parse failure turns a half-written snapshot
    # into a permanently missing run.
    root = tmp_path / ".claude"
    sf = _mk_session_file(root)
    wf = sf.parent / "s1" / "workflows"
    wf.mkdir(parents=True)
    bad = wf / "wf_abc.json"
    bad.write_text('{"runId": "wf_abc", ', encoding="utf-8")
    adapter = ClaudeCodeAdapter(root=root)

    ingest_workflow_records(adapter, sf, "claude_code:s1", repo)

    assert repo.get_file_offset(str(bad)) == 0
    errs = repo.db.execute("SELECT file, reason FROM parse_errors").fetchall()
    assert len(errs) == 1
    assert "[workflow]" in errs[0]["reason"]

    # A later tick with valid content succeeds.
    _write_record(sf)
    ingest_workflow_records(adapter, sf, "claude_code:s1", repo)
    assert repo.workflow_run_status("wf_abc") == "completed"


def test_truncated_raw_json_records_a_parse_error(repo, tmp_path, monkeypatch):
    from argus.adapters.claude_code import workflow_record

    monkeypatch.setattr(workflow_record, "RAW_JSON_CAP", 50)
    root = tmp_path / ".claude"
    sf = _mk_session_file(root)
    _write_record(sf)
    adapter = ClaudeCodeAdapter(root=root)

    ingest_workflow_records(adapter, sf, "claude_code:s1", repo)

    errs = repo.db.execute("SELECT reason FROM parse_errors").fetchall()
    assert any("truncated" in e["reason"] for e in errs)


def test_no_workflows_dir_is_a_noop(repo, tmp_path):
    root = tmp_path / ".claude"
    sf = _mk_session_file(root)
    adapter = ClaudeCodeAdapter(root=root)
    ingest_workflow_records(adapter, sf, "claude_code:s1", repo)
    assert repo.db.execute("SELECT COUNT(*) c FROM workflow_runs").fetchone()["c"] == 0


def test_pipeline_ingests_workflow_records(repo, tmp_path):
    from argus.collector.pipeline import ingest_file

    table = load_pricing_table()
    root = tmp_path / ".claude"
    sf = _mk_session_file(root)
    sf.write_text(
        json.dumps(
            {
                "type": "assistant", "uuid": "u1", "sessionId": "s1",
                "timestamp": "2026-07-31T10:51:33.000Z", "cwd": "C:/x",
                "message": {
                    "id": "m1", "model": "claude-opus-5", "role": "assistant",
                    "content": [{"type": "text", "text": "x"}],
                    "usage": {"input_tokens": 1, "output_tokens": 1},
                },
            }
        )
        + "\n",
        encoding="utf-8",
    )
    _write_record(sf)

    ingest_file(ClaudeCodeAdapter(root=root), sf, repo, table)

    assert repo.workflow_run_status("wf_abc") == "completed"


def test_workflow_failure_does_not_abort_parent_ingest(repo, tmp_path, monkeypatch):
    # Orchestration metadata is the bonus; session data is the product.
    from argus.collector import pipeline

    table = load_pricing_table()
    root = tmp_path / ".claude"
    sf = _mk_session_file(root)
    sf.write_text(
        json.dumps(
            {
                "type": "assistant", "uuid": "u1", "sessionId": "s1",
                "timestamp": "2026-07-31T10:51:33.000Z", "cwd": "C:/x",
                "message": {
                    "id": "m1", "model": "claude-opus-5", "role": "assistant",
                    "content": [{"type": "text", "text": "x"}],
                    "usage": {"input_tokens": 1, "output_tokens": 1},
                },
            }
        )
        + "\n",
        encoding="utf-8",
    )
    _write_record(sf)

    def boom(*a, **k):
        raise RuntimeError("workflow ingest exploded")

    monkeypatch.setattr(pipeline, "ingest_workflow_records", boom)
    pipeline.ingest_file(ClaudeCodeAdapter(root=root), sf, repo, table)

    assert repo.get_session("claude_code:s1") is not None
