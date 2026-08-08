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
