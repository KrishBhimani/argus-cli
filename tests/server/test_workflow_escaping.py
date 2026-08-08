"""Model-authored workflow text must reach the browser escaped.

Regression: commit 444eabb fixed stored XSS in /tools chart tooltips. The
workflow bloom renders label / phase_title / model / last_tool_name /
fallback_model into innerHTML AND into tooltip strings -- the tooltip is where
it hid last time. The API must hand back the raw string (escaping is the
renderer's job), and the built bundle must call escapeHtml on the tooltip path.
"""
from __future__ import annotations

from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from argus.collector.first_run import IngestStatus
from argus.pricing.types import PricingTable
from argus.schema.types import Session, WorkflowAgent, WorkflowRun
from argus.server.api import ApiDeps, build_api

LOOPBACK = "http://127.0.0.1:4242"
PAYLOAD = "<img src=x onerror=alert(1)>"


def _make_app(repo) -> FastAPI:
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
            daemon=False,
        ),
    )
    app.include_router(api)
    return app


@pytest.fixture
def client(repo) -> TestClient:
    return TestClient(_make_app(repo), base_url=LOOPBACK)


def _session_row(sid, cost=1.5):
    return Session(
        id=sid, agent="claude_code", agent_version=None, project_path="c:/x",
        started_at="2026-07-31T10:00:00Z", ended_at="2026-07-31T10:05:00Z",
        duration_sec=300, total_fresh_input_tokens=10, total_output_tokens=100,
        total_cache_read_tokens=1000, total_cache_write_tokens=20,
        total_cost_usd=cost, primary_model="claude-opus-5", turn_count=3,
        pricing_table_version="v1", computed_at="2026-07-31T10:05:00Z",
        agent_reported_cost_usd=None, metadata={},
    )


@pytest.fixture
def seed_workflow():
    def _seed(repo, *, label="recon:http", prompt_preview=""):
        repo.upsert_session(_session_row("claude_code:s1"))
        repo.upsert_workflow_run(
            WorkflowRun(
                run_id="wf_1", session_id="claude_code:s1", name="audit",
                status="completed", started_at="2026-07-31T10:51:33Z",
                duration_ms=1000, agent_count=1,
            )
        )
        repo.upsert_workflow_agents([
            WorkflowAgent(
                run_id="wf_1", agent_id="a1",
                sub_session_id="claude_code:s1/agent-a1", seq=1, label=label,
                phase_title="Recon", phase_index=1, state="done",
                duration_ms=500, prompt_preview=prompt_preview,
            ),
        ])
        repo.upsert_session(_session_row("claude_code:s1/agent-a1", cost=2.0))
    return _seed


def test_api_returns_the_raw_string_for_the_client_to_escape(client, repo,
                                                             seed_workflow):
    seed_workflow(repo, label=PAYLOAD, prompt_preview=PAYLOAD)
    body = client.get("/api/workflows/wf_1").json()
    a = body["agents"][0]
    assert a["label"] == PAYLOAD
    assert a["prompt_preview"] == PAYLOAD


def test_bloom_source_escapes_tooltip_fields():
    src = Path("dashboard/src/scripts/bloom.ts").read_text(encoding="utf-8")
    tip = src.split("function tooltipHtml")[1].split("\nexport function")[0]
    for field in ("a.label", "a.phase_title", "a.model", "a.last_tool_name",
                  "a.fallback_model"):
        assert f"escapeHtml({field}" in tip, f"{field} reaches the tooltip unescaped"
