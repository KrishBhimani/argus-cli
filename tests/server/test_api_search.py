"""Tests for /api/prompts, /api/search, /api/sessions/:id/transcript,
/api/tools/overview, and /api/search-index/* — the routes that aren't
covered by test_api.py."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from argus.collector.first_run import IngestStatus
from argus.pricing.types import PricingTable
from argus.schema.types import Prompt, ToolCall, TranscriptSegment
from argus.server.api import ApiDeps, build_api
from tests.conftest import session_factory


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
        ),
    )
    app.include_router(api)
    return app


@pytest.fixture
def api_client(repo):
    return TestClient(_make_app(repo))


def _iso(dt: datetime) -> str:
    return dt.isoformat().replace("+00:00", "Z")


# ─── /api/prompts ──────────────────────────────────────────────────────


def test_prompts_returns_empty_when_indexing_off(api_client, repo):
    assert repo.is_search_indexing_enabled() is False
    repo.insert_prompts(
        [Prompt(timestamp_ms=1000, project_path="/p", display="how to use vitest", pasted_chars=0, is_slash=0)]
    )
    r = api_client.get("/api/prompts?q=vitest")
    assert r.status_code == 200
    assert r.json() == {"total": 0, "prompts": []}


def test_prompts_returns_results_when_indexing_on(api_client, repo):
    repo.set_search_indexing_enabled(True)
    repo.insert_prompts(
        [
            Prompt(timestamp_ms=1000, project_path="/p", display="how to use vitest", pasted_chars=0, is_slash=0),
            Prompt(timestamp_ms=2000, project_path="/p", display="unrelated text", pasted_chars=0, is_slash=0),
        ]
    )
    r = api_client.get("/api/prompts?q=vitest")
    body = r.json()
    assert body["total"] == 1
    assert "<mark>" in body["prompts"][0]["snippet"]


def test_prompts_stats_gated_on_flag(api_client, repo):
    # OFF -> zeros.
    body = api_client.get("/api/prompts/stats").json()
    assert body == {"total": 0, "projects": 0, "oldest_ms": None}

    # ON -> real numbers.
    repo.set_search_indexing_enabled(True)
    repo.insert_prompts(
        [Prompt(timestamp_ms=1000, project_path="/p", display="hi", pasted_chars=0, is_slash=0)]
    )
    body = api_client.get("/api/prompts/stats").json()
    assert body["total"] == 1


def test_prompts_projects_gated_on_flag(api_client, repo):
    assert api_client.get("/api/prompts/projects").json() == {"projects": []}
    repo.set_search_indexing_enabled(True)
    repo.insert_prompts(
        [Prompt(timestamp_ms=1000, project_path="/a", display="hi", pasted_chars=0, is_slash=0)]
    )
    assert api_client.get("/api/prompts/projects").json() == {"projects": ["/a"]}


# ─── /api/search (unified) ─────────────────────────────────────────────


def test_unified_search_returns_empty_when_flag_off(api_client):
    body = api_client.get("/api/search?q=hello").json()
    assert body == {
        "total": 0,
        "prompt_total": 0,
        "transcript_total": 0,
        "search_indexing_enabled": False,
        "results": [],
    }


def test_unified_search_returns_mixed_results(api_client, repo):
    repo.set_search_indexing_enabled(True)
    repo.upsert_session(session_factory("s1", "2026-05-22T00:00:00Z"))
    repo.insert_prompts(
        [Prompt(timestamp_ms=1000, project_path="/p", display="ccusage prompts", pasted_chars=0, is_slash=0)]
    )
    repo.upsert_transcript_segments(
        [
            TranscriptSegment(
                uid="s1:u1:0",
                session_id="s1",
                timestamp="2026-05-22T00:00:00Z",
                role="assistant",
                text="ccusage from a transcript",
            )
        ]
    )
    body = api_client.get("/api/search?q=ccusage").json()
    assert body["search_indexing_enabled"] is True
    assert body["prompt_total"] == 1
    assert body["transcript_total"] == 1
    kinds = {r["kind"] for r in body["results"]}
    assert kinds == {"prompt", "transcript"}


def test_unified_search_respects_roles_filter(api_client, repo):
    repo.set_search_indexing_enabled(True)
    repo.upsert_session(session_factory("s1", "2026-05-22T00:00:00Z"))
    repo.upsert_transcript_segments(
        [
            TranscriptSegment(
                uid="s1:u1:0",
                session_id="s1",
                timestamp="2026-05-22T00:00:00Z",
                role="user",
                text="ccusage from user",
            ),
            TranscriptSegment(
                uid="s1:a1:0",
                session_id="s1",
                timestamp="2026-05-22T00:00:01Z",
                role="assistant",
                text="ccusage from assistant",
            ),
        ]
    )
    body = api_client.get("/api/search?q=ccusage&roles=user").json()
    assert body["transcript_total"] == 1
    assert all(r["role"] == "user" for r in body["results"] if r["kind"] == "transcript")


# ─── /api/sessions/:id/transcript ──────────────────────────────────────


def test_session_transcript_requires_query(api_client, repo):
    repo.set_search_indexing_enabled(True)
    body = api_client.get("/api/sessions/s1/transcript").json()
    assert body == {"total": 0, "segments": [], "search_indexing_enabled": True}


def test_session_transcript_returns_marked_matches(api_client, repo):
    repo.set_search_indexing_enabled(True)
    repo.upsert_session(session_factory("s1", "2026-05-22T00:00:00Z"))
    repo.upsert_transcript_segments(
        [
            TranscriptSegment(
                uid="s1:a1:0",
                session_id="s1",
                timestamp="2026-05-22T00:00:00Z",
                role="assistant",
                text="ccusage output here",
            )
        ]
    )
    body = api_client.get("/api/sessions/s1/transcript?q=ccusage").json()
    assert body["total"] == 1
    assert "<mark>" in body["segments"][0]["snippet"]


# ─── /api/tools/overview ───────────────────────────────────────────────


def test_tools_overview_aggregates_calls_and_errors(api_client, repo):
    repo.upsert_session(session_factory("s1", _iso(datetime.now(timezone.utc) - timedelta(days=1))))
    repo.upsert_tool_calls(
        [
            ToolCall(
                id="s1:t1",
                session_id="s1",
                turn_index=0,
                tool_name="Bash",
                is_error=0,
                input_size=10,
                subagent_type=None,
                timestamp=_iso(datetime.now(timezone.utc) - timedelta(days=1)),
            ),
            ToolCall(
                id="s1:t2",
                session_id="s1",
                turn_index=0,
                tool_name="Bash",
                is_error=1,
                input_size=15,
                subagent_type=None,
                timestamp=_iso(datetime.now(timezone.utc) - timedelta(days=1)),
            ),
            ToolCall(
                id="s1:t3",
                session_id="s1",
                turn_index=1,
                tool_name="mcp__context7__query-docs",
                is_error=0,
                input_size=20,
                subagent_type=None,
                timestamp=_iso(datetime.now(timezone.utc) - timedelta(days=1)),
            ),
            ToolCall(
                id="s1:t4",
                session_id="s1",
                turn_index=2,
                tool_name="Task",
                is_error=0,
                input_size=30,
                subagent_type="Explore",
                timestamp=_iso(datetime.now(timezone.utc) - timedelta(days=1)),
            ),
        ]
    )
    body = api_client.get("/api/tools/overview?window=7d").json()
    assert body["total_calls"] == 4
    assert body["total_errors"] == 1
    by_name = {t["name"]: t for t in body["tool_leaderboard"]}
    assert by_name["Bash"]["calls"] == 2
    assert by_name["Bash"]["error_rate"] == 0.5
    # MCP rollup keys by server name (between mcp__ and __).
    assert any(s["server"] == "context7" for s in body["mcp_servers"])
    # Sub-agent rollup by subagent_type.
    assert any(s["type"] == "Explore" for s in body["subagents"])


# ─── /api/search-index/* lifecycle ─────────────────────────────────────


def test_search_index_status_reflects_flag_and_counts(api_client, repo):
    body = api_client.get("/api/search-index/status").json()
    assert body["enabled"] is False
    assert body["segment_count"] == 0

    repo.set_search_indexing_enabled(True)
    repo.upsert_session(session_factory("s1", "2026-05-22T00:00:00Z"))
    repo.upsert_transcript_segments(
        [
            TranscriptSegment(
                uid="s1:u1:0",
                session_id="s1",
                timestamp="2026-05-22T00:00:00Z",
                role="user",
                text="x",
            )
        ]
    )
    body = api_client.get("/api/search-index/status").json()
    assert body["enabled"] is True
    assert body["segment_count"] == 1
    assert body["indexed_sessions"] == 1


def test_search_index_enable_then_disable(api_client):
    r = api_client.post(
        "/api/search-index/enable", headers={"origin": "http://localhost:4242"}
    )
    assert r.status_code == 200
    assert r.json()["enabled"] is True

    r = api_client.post(
        "/api/search-index/disable", headers={"origin": "http://localhost:4242"}
    )
    assert r.status_code == 200
    assert r.json() == {"enabled": False}


def test_search_index_clear_wipes_segments_and_disables(api_client, repo):
    repo.set_search_indexing_enabled(True)
    repo.upsert_session(session_factory("s1", "2026-05-22T00:00:00Z"))
    repo.upsert_transcript_segments(
        [
            TranscriptSegment(
                uid="s1:u1:0",
                session_id="s1",
                timestamp="2026-05-22T00:00:00Z",
                role="user",
                text="data",
            )
        ]
    )
    assert repo.segment_stats()["total"] == 1

    r = api_client.post(
        "/api/search-index/clear", headers={"origin": "http://localhost:4242"}
    )
    body = r.json()
    assert body["enabled"] is False
    assert body["cleared"] is True
    assert repo.segment_stats()["total"] == 0
    assert repo.is_search_indexing_enabled() is False
