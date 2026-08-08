"""Workflow run/agent storage."""
from __future__ import annotations

import sqlite3


def _columns(repo, table: str) -> set[str]:
    return {r["name"] for r in repo.db.execute(f"PRAGMA table_info({table})")}


def test_migration_007_creates_workflow_tables(repo):
    assert "run_id" in _columns(repo, "workflow_runs")
    assert "raw_json" in _columns(repo, "workflow_runs")
    assert "sub_session_id" in _columns(repo, "workflow_agents")
    assert "last_progress_at" in _columns(repo, "workflow_agents")
    assert "last_tool_summary" in _columns(repo, "workflow_agents")


def test_schema_version_is_7(repo):
    row = repo.db.execute(
        "SELECT value FROM app_meta WHERE key = 'schema_version'"
    ).fetchone()
    assert row["value"] == "7"


def test_migration_007_is_idempotent_and_non_destructive(repo, tmp_path):
    # Regression: migrations must be re-runnable. Insert a row, re-open the DB
    # (which re-runs the migration gate), assert the row survives.
    from argus.store.db import open_db

    repo.db.execute(
        "INSERT INTO workflow_runs (run_id, session_id, name, status, started_at) "
        "VALUES ('wf_x', 'claude_code:s', 'n', 'completed', '2026-01-01T00:00:00Z')"
    )
    path = repo.db.execute("PRAGMA database_list").fetchone()["file"]
    repo.db.close()
    conn = open_db(path)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT run_id FROM workflow_runs").fetchall()
    assert [r["run_id"] for r in rows] == ["wf_x"]
    conn.close()


from argus.schema.types import WorkflowAgent, WorkflowRun


def _run(run_id="wf_1", status="completed", **kw):
    base = dict(
        run_id=run_id, session_id="claude_code:s1", name="audit",
        status=status, started_at="2026-07-31T10:51:33Z", duration_ms=1000,
        agent_count=2,
    )
    base.update(kw)
    return WorkflowRun(**base)


def _agent(agent_id="a1", run_id="wf_1", **kw):
    base = dict(
        run_id=run_id, agent_id=agent_id,
        sub_session_id=f"claude_code:s1/agent-{agent_id}",
        seq=1, label="recon:http", phase_title="Recon", phase_index=1,
        state="done", duration_ms=500,
    )
    base.update(kw)
    return WorkflowAgent(**base)


def test_upsert_workflow_run_roundtrips(repo):
    repo.upsert_workflow_run(_run())
    assert repo.workflow_run_status("wf_1") == "completed"


def test_workflow_run_status_is_none_for_unknown(repo):
    assert repo.workflow_run_status("wf_nope") is None


def test_upsert_workflow_run_is_idempotent_and_updates(repo):
    repo.upsert_workflow_run(_run(status="running"))
    repo.upsert_workflow_run(_run(status="completed"))
    assert repo.workflow_run_status("wf_1") == "completed"
    n = repo.db.execute("SELECT COUNT(*) c FROM workflow_runs").fetchone()["c"]
    assert n == 1


def test_upsert_workflow_agents_is_idempotent(repo):
    repo.upsert_workflow_run(_run())
    repo.upsert_workflow_agents([_agent("a1"), _agent("a2")])
    repo.upsert_workflow_agents([_agent("a1", label="renamed")])
    rows = repo.db.execute(
        "SELECT agent_id, label FROM workflow_agents ORDER BY agent_id"
    ).fetchall()
    assert [(r["agent_id"], r["label"]) for r in rows] == [
        ("a1", "renamed"), ("a2", "recon:http")
    ]


def test_upsert_workflow_agents_empty_list_is_a_noop(repo):
    repo.upsert_workflow_agents([])
    assert repo.db.execute("SELECT COUNT(*) c FROM workflow_agents").fetchone()["c"] == 0


from argus.schema.types import Session, ToolCall


def _session_row(sid, cost=1.5, out=100, turns=3):
    return Session(
        id=sid, agent="claude_code", agent_version=None, project_path="c:/x",
        started_at="2026-07-31T10:00:00Z", ended_at="2026-07-31T10:05:00Z",
        duration_sec=300, total_fresh_input_tokens=10, total_output_tokens=out,
        total_cache_read_tokens=1000, total_cache_write_tokens=20,
        total_cost_usd=cost, primary_model="claude-opus-5", turn_count=turns,
        pricing_table_version="v1", computed_at="2026-07-31T10:05:00Z",
        agent_reported_cost_usd=None, metadata={},
    )


def _seed(repo):
    repo.upsert_workflow_run(_run(agent_count=2))
    repo.upsert_workflow_agents([
        _agent("a1", seq=1, state="done"),
        _agent("a2", seq=2, state="error", phase_title="Verify", phase_index=2),
    ])
    repo.upsert_session(_session_row("claude_code:s1/agent-a1", cost=2.0))
    repo.upsert_session(_session_row("claude_code:s1/agent-a2", cost=1.0))
    repo.upsert_tool_calls([
        ToolCall(id="t1", session_id="claude_code:s1/agent-a1", turn_index=0,
                 tool_name="Grep", is_error=0, input_size=5, subagent_type=None,
                 timestamp="2026-07-31T10:01:00Z"),
        ToolCall(id="t2", session_id="claude_code:s1/agent-a1", turn_index=0,
                 tool_name="Grep", is_error=1, input_size=5, subagent_type=None,
                 timestamp="2026-07-31T10:02:00Z"),
    ])


def test_list_workflow_runs_aggregates_argus_cost(repo):
    _seed(repo)
    runs = repo.list_workflow_runs(limit=10, offset=0)
    assert len(runs) == 1
    r = runs[0]
    assert r["run_id"] == "wf_1"
    assert r["cost_usd"] == 3.0          # 2.0 + 1.0 from sessions, not the record
    assert r["error_agents"] == 1        # state != 'done'
    assert r["phase_count"] == 0         # phases_json defaults to []
    assert repo.count_workflow_runs() == 1


def test_workflow_detail_joins_sessions_and_tools(repo):
    _seed(repo)
    d = repo.workflow_detail("wf_1")
    a1 = next(a for a in d["agents"] if a["agent_id"] == "a1")
    assert a1["linked"] is True
    assert a1["cost_usd"] == 2.0
    assert a1["turns"] == 3
    assert a1["tools"] == [{"name": "Grep", "count": 2, "errors": 1}]
    assert a1["errors"] == 1
    assert a1["tool_calls"] == 2
    assert d["agents"][0]["seq"] == 1  # ordered by seq


def test_workflow_detail_keeps_unlinked_agents(repo):
    repo.upsert_workflow_run(_run())
    repo.upsert_workflow_agents([_agent("ghost", label="find:gone")])
    d = repo.workflow_detail("wf_1")
    a = d["agents"][0]
    assert a["linked"] is False
    assert a["label"] == "find:gone"     # the irreplaceable half survives
    assert a["cost_usd"] is None
    assert a["tools"] == []


def test_workflow_detail_computes_queue_wait(repo):
    repo.upsert_workflow_run(_run())
    repo.upsert_workflow_agents([
        _agent("a1", queued_at="2026-07-31T10:00:00Z",
               started_at="2026-07-31T10:00:07Z"),
    ])
    assert repo.workflow_detail("wf_1")["agents"][0]["queue_wait_ms"] == 7000


def test_workflow_detail_unknown_run_is_none(repo):
    assert repo.workflow_detail("wf_nope") is None


def test_workflow_detail_is_not_n_plus_1(repo):
    # sqlite3.Connection.execute is read-only and cannot be reassigned, so count
    # statements with the connection's trace callback instead of monkeypatching.
    _seed(repo)
    seen: list[str] = []
    repo.db.set_trace_callback(seen.append)
    try:
        repo.workflow_detail("wf_1")
    finally:
        repo.db.set_trace_callback(None)
    # run row + agents join + grouped tool summary. Constant, not per-agent.
    assert len(seen) == 3, seen


def test_workflow_runs_for_session(repo):
    _seed(repo)
    out = repo.workflow_runs_for_session("claude_code:s1")
    assert out == [{"run_id": "wf_1", "name": "audit", "agent_count": 2}]


def test_workflow_script(repo):
    repo.upsert_workflow_run(_run(script="export const meta = {}"))
    assert repo.workflow_script("wf_1") == "export const meta = {}"
    assert repo.workflow_script("wf_nope") is None
