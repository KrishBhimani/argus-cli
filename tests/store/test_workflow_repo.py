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
