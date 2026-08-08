"""Workflow API routes."""
from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from argus.collector.first_run import IngestStatus
from argus.pricing.types import PricingTable
from argus.schema.types import Session, ToolCall, WorkflowAgent, WorkflowRun
from argus.server.api import ApiDeps, build_api

# Argus requires a loopback Host header (DNS-rebinding guard); TestClient
# otherwise sends "Host: testserver", which the guard rejects.
LOOPBACK = "http://127.0.0.1:4242"


def _make_app(repo, *, daemon: bool = False) -> FastAPI:
    app = FastAPI()
    api = build_api(
        repo,
        ApiDeps(
            pricing_table_version="2026-05-02",
            ingest_status=lambda: IngestStatus(
                foreground_complete=True, pending=0, processed=1, total=1
            ),
            adapters=[],
            pricing_table=PricingTable(version="2026-05-02", models={}),
            daemon=daemon,
        ),
    )
    app.include_router(api)
    return app


@pytest.fixture
def client(repo) -> TestClient:
    return TestClient(_make_app(repo), base_url=LOOPBACK)


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


@pytest.fixture
def seed_workflow():
    """Insert a parent session, one run, two agents, their sessions + tools.

    Kept as a local factory (repo passed in) per the repo's
    duplicate-factories-per-file convention. Accepts overrides used by the
    escaping regression (label / prompt_preview) and the script test.
    """
    def _seed(repo, *, label="recon:http", prompt_preview="", script=""):
        # Parent session so /subagents resolves.
        repo.upsert_session(_session_row("claude_code:s1"))
        repo.upsert_workflow_run(
            WorkflowRun(
                run_id="wf_1", session_id="claude_code:s1", name="audit",
                status="completed", started_at="2026-07-31T10:51:33Z",
                duration_ms=1000, agent_count=2, script=script,
            )
        )
        repo.upsert_workflow_agents([
            WorkflowAgent(
                run_id="wf_1", agent_id="a1",
                sub_session_id="claude_code:s1/agent-a1", seq=1, label=label,
                phase_title="Recon", phase_index=1, state="done",
                duration_ms=500, prompt_preview=prompt_preview,
            ),
            WorkflowAgent(
                run_id="wf_1", agent_id="a2",
                sub_session_id="claude_code:s1/agent-a2", seq=2,
                label="find:authz", phase_title="Verify", phase_index=2,
                state="error", duration_ms=500,
            ),
        ])
        repo.upsert_session(_session_row("claude_code:s1/agent-a1", cost=2.0))
        repo.upsert_session(_session_row("claude_code:s1/agent-a2", cost=1.0))
        repo.upsert_tool_calls([
            ToolCall(id="t1", session_id="claude_code:s1/agent-a1", turn_index=0,
                     tool_name="Grep", is_error=0, input_size=5,
                     subagent_type=None, timestamp="2026-07-31T10:01:00Z"),
            ToolCall(id="t2", session_id="claude_code:s1/agent-a1", turn_index=0,
                     tool_name="Grep", is_error=1, input_size=5,
                     subagent_type=None, timestamp="2026-07-31T10:02:00Z"),
        ])
    return _seed


def test_list_workflows_returns_runs(client, repo, seed_workflow):
    seed_workflow(repo)
    r = client.get("/api/workflows")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 1
    assert body["workflows"][0]["run_id"] == "wf_1"
    assert body["workflows"][0]["cost_usd"] == 3.0


def test_list_workflows_rejects_negative_limit(client):
    # SQLite reads LIMIT -1 as unlimited; Query(ge=0) must stop it at the edge.
    assert client.get("/api/workflows?limit=-1").status_code == 422
    assert client.get("/api/workflows?offset=-5").status_code == 422


def test_list_workflows_clamps_absurd_limit(client, repo, seed_workflow):
    seed_workflow(repo)
    assert client.get("/api/workflows?limit=99999999999").status_code == 422


def test_workflow_detail(client, repo, seed_workflow):
    seed_workflow(repo)
    body = client.get("/api/workflows/wf_1").json()
    assert body["run"]["name"] == "audit"
    assert body["run"]["has_script"] is False
    assert len(body["agents"]) == 2
    assert body["agents"][0]["label"] == "recon:http"


def test_workflow_detail_unknown_is_404(client):
    assert client.get("/api/workflows/wf_nope").status_code == 404


def test_workflow_script_returns_text(client, repo, seed_workflow):
    seed_workflow(repo, script="export const meta = {}")
    r = client.get("/api/workflows/wf_1/script")
    assert r.status_code == 200
    assert r.text == "export const meta = {}"
    assert r.headers["content-type"].startswith("text/plain")


def test_workflow_script_unknown_is_404(client):
    assert client.get("/api/workflows/wf_nope/script").status_code == 404


def test_subagents_payload_gains_workflow_runs(client, repo, seed_workflow):
    seed_workflow(repo)
    body = client.get("/api/sessions/claude_code:s1/subagents").json()
    assert "subagents" in body
    assert body["workflow_runs"] == [
        {"run_id": "wf_1", "name": "audit", "agent_count": 2}
    ]


def test_session_route_still_wins_over_bare_path_route(client, repo, seed_workflow):
    # Regression: the greedy {session_id:path} handler must stay registered last.
    seed_workflow(repo)
    r = client.get("/api/sessions/claude_code:s1/timeline")
    assert r.status_code == 200
    assert "turns" in r.json()
