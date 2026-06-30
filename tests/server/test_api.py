"""API endpoint tests + windowed-aggregation regressions."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from argus.collector.first_run import IngestStatus
from argus.pricing.types import PricingTable
from argus.server.api import ApiDeps, build_api
from tests.conftest import alert_factory, session_factory, turn_factory


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


def test_ingest_status_includes_daemon_flag(repo):
    # Default: no daemon.
    body = TestClient(_make_app(repo)).get("/api/ingest/status").json()
    assert body["daemon"] is False
    # Read-only/yielded dashboard: daemon=True flows through to the response.
    body = TestClient(_make_app(repo, daemon=True)).get("/api/ingest/status").json()
    assert body["daemon"] is True


def test_write_endpoints_blocked_in_read_only(repo):
    """When yielded to argusd, write endpoints return 409 — never a 500."""
    client = TestClient(_make_app(repo, daemon=True))
    for path in (
        "/api/search-index/enable",
        "/api/search-index/disable",
        "/api/search-index/clear",
    ):
        r = client.post(path)
        assert r.status_code == 409, path
        assert "read-only" in r.json()["detail"].lower()
    r = client.post("/api/alerts/1/seen")
    assert r.status_code == 409


def test_write_endpoints_work_when_not_read_only(repo):
    client = TestClient(_make_app(repo))  # daemon=False
    r = client.post("/api/search-index/disable")
    assert r.status_code == 200
    assert r.json()["enabled"] is False


def test_overview_exposes_token_breakdowns(api_client, repo):
    """Overview drives its charts/rankings off tokens, not cost."""
    # Two sessions + turns in the window so there are tokens to aggregate.
    repo.upsert_session(session_factory("a", _iso(datetime.now(timezone.utc))))
    repo.upsert_session(session_factory("b", _iso(datetime.now(timezone.utc))))
    repo.upsert_turn(
        turn_factory("ta", "a", _iso(datetime.now(timezone.utc)), fresh=100, output=50)
    )
    repo.upsert_turn(
        turn_factory("tb", "b", _iso(datetime.now(timezone.utc)), fresh=10, output=5)
    )

    body = api_client.get("/api/overview?window=30d").json()

    # Token breakdowns are present and sum to the headline token total.
    assert "tokens_by_day" in body and "tokens_by_model" in body
    assert sum(body["tokens_by_day"].values()) == body["total_tokens"]
    assert sum(body["tokens_by_model"].values()) == body["total_tokens"]

    # Top sessions are ranked by tokens (session "a" has more than "b").
    ids = [s["id"] for s in body["top_sessions"]]
    assert ids[0] == "a"
    assert body["top_sessions"][0]["window_tokens"] >= body["top_sessions"][1]["window_tokens"]


@pytest.fixture
def api_client(repo):
    return TestClient(_make_app(repo))


def _iso(dt: datetime) -> str:
    return dt.isoformat().replace("+00:00", "Z")


def test_get_api_sessions_returns_sorted_list(api_client, repo):
    repo.upsert_session(session_factory("a", "2026-01-01T00:00:00Z"))
    repo.upsert_session(session_factory("b", "2026-05-01T00:00:00Z"))
    r = api_client.get("/api/sessions")
    assert r.status_code == 200
    body = r.json()
    assert [s["id"] for s in body["sessions"]] == ["b", "a"]


def test_get_api_session_by_id(api_client, repo):
    repo.upsert_session(session_factory("a", "2026-05-01T00:00:00Z"))
    r = api_client.get("/api/sessions/a")
    assert r.status_code == 200
    body = r.json()
    assert body["session"]["id"] == "a"
    assert body["turns"] == []


def test_get_api_overview_returns_totals_for_window(api_client, repo):
    recent = _iso(datetime.now(timezone.utc) - timedelta(days=1))
    old = _iso(datetime.now(timezone.utc) - timedelta(days=30))
    repo.upsert_session(session_factory("a", recent))
    repo.upsert_session(session_factory("b", old, agent="codex"))
    repo.upsert_turn(turn_factory("a-t1", "a", recent))
    repo.upsert_turn(turn_factory("b-t1", "b", old))
    r = api_client.get("/api/overview?window=7d")
    body = r.json()
    assert abs(body["total_cost_usd"] - 1.5) < 1e-4
    assert body["session_count"] == 1
    assert abs(body["agent_split"]["claude_code"]["cost"] - 1.5) < 1e-4


def test_overview_includes_turns_from_sessions_started_before_window(api_client, repo):
    """REGRESSION: long-runner sessions must appear via turn-level aggregation."""
    old_start = _iso(datetime.now(timezone.utc) - timedelta(days=21))
    recent_turn = _iso(datetime.now(timezone.utc) - timedelta(days=2))
    repo.upsert_session(session_factory("long-runner", old_start))
    repo.upsert_turn(turn_factory("lr-t1", "long-runner", recent_turn, cost=4.25))

    r = api_client.get("/api/overview?window=7d")
    body = r.json()
    assert abs(body["total_cost_usd"] - 4.25) < 1e-4
    assert body["session_count"] == 1
    assert abs(body["cost_by_day"][recent_turn[:10]] - 4.25) < 1e-4
    assert len(body["top_sessions"]) == 1
    assert body["top_sessions"][0]["id"] == "long-runner"
    assert abs(body["top_sessions"][0]["window_cost_usd"] - 4.25) < 1e-4
    assert body["top_sessions"][0]["started_at"] == old_start
    assert abs(body["cost_by_model"]["claude-opus-4-7"] - 4.25) < 1e-4


def test_top_sessions_rows_are_window_only_summing_to_hero(api_client, repo):
    """REGRESSION: rows show window contribution, not lifetime."""
    now = datetime.now(timezone.utc)
    repo.upsert_session(session_factory("a", _iso(now - timedelta(days=2))))
    repo.upsert_session(session_factory("b", _iso(now - timedelta(days=30))))
    repo.upsert_turn(turn_factory("a-t1", "a", _iso(now - timedelta(days=2)), cost=1.0))
    repo.upsert_turn(turn_factory("a-t2", "a", _iso(now - timedelta(days=1)), cost=2.0))
    repo.upsert_turn(turn_factory("b-t1", "b", _iso(now - timedelta(days=3)), cost=3.0))
    # Lifetime turn outside the 7d window — must NOT count.
    repo.upsert_turn(turn_factory("b-old", "b", _iso(now - timedelta(days=30)), cost=99.0))

    r = api_client.get("/api/overview?window=7d")
    body = r.json()
    sum_rows = sum(s["window_cost_usd"] for s in body["top_sessions"])
    assert abs(sum_rows - body["total_cost_usd"]) < 1e-4
    assert abs(body["total_cost_usd"] - 6.0) < 1e-4  # 1+2+3, NOT 1+2+3+99

    by_id = {s["id"]: s for s in body["top_sessions"]}
    assert abs(by_id["a"]["window_cost_usd"] - 3.0) < 1e-4
    assert by_id["a"]["days_active"] == 2
    assert abs(by_id["b"]["window_cost_usd"] - 3.0) < 1e-4
    assert by_id["b"]["days_active"] == 1


def test_overview_distributes_multiday_session_across_turn_dates(api_client, repo):
    """REGRESSION: heatmap must split cost by turn day, not dump it on started_at."""
    start = _iso(datetime.now(timezone.utc) - timedelta(days=3))
    day1 = _iso(datetime.now(timezone.utc) - timedelta(days=3))
    day2 = _iso(datetime.now(timezone.utc) - timedelta(days=1))
    repo.upsert_session(session_factory("multi-day", start))
    repo.upsert_turn(turn_factory("md-t1", "multi-day", day1, cost=2.0))
    repo.upsert_turn(turn_factory("md-t2", "multi-day", day2, cost=3.0))

    r = api_client.get("/api/overview?window=7d")
    body = r.json()
    assert abs(body["total_cost_usd"] - 5.0) < 1e-4
    assert abs(body["cost_by_day"][day1[:10]] - 2.0) < 1e-4
    assert abs(body["cost_by_day"][day2[:10]] - 3.0) < 1e-4


def test_trends_groups_by_day_and_agent(api_client, repo):
    ts = _iso(datetime.now(timezone.utc) - timedelta(days=1))
    repo.upsert_session(session_factory("a", ts))
    repo.upsert_turn(turn_factory("a-t1", "a", ts))
    r = api_client.get("/api/trends?granularity=day&groupBy=agent")
    body = r.json()
    assert isinstance(body["points"], list)
    assert len(body["points"]) > 0


def test_trends_granularity_week_does_not_crash(api_client, repo):
    """REGRESSION: ``rebucket`` passes a date-only string (from
    ``substr(timestamp, 1, 10)``) into ``_week_of``, which previously
    raised ``TypeError: can't subtract offset-naive and offset-aware
    datetimes`` because the date-only form parses as a naive datetime."""
    ts = _iso(datetime.now(timezone.utc) - timedelta(days=1))
    repo.upsert_session(session_factory("a", ts))
    repo.upsert_turn(turn_factory("a-t1", "a", ts))
    r = api_client.get("/api/trends?granularity=week&groupBy=agent")
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body["points"], list)
    assert len(body["points"]) > 0
    # Bucket label format is "YYYY-W##".
    bucket = body["points"][0]["bucket"]
    assert bucket[4:6] == "-W"
    assert bucket[6:].isdigit() and len(bucket[6:]) == 2


def test_ingest_status_reports(api_client):
    r = api_client.get("/api/ingest/status")
    body = r.json()
    assert body["foregroundComplete"] is True
    assert body["total"] == 1


def test_pricing_returns_version(api_client):
    r = api_client.get("/api/pricing")
    assert r.json() == {"version": "2026-05-02"}


def test_export_json_returns_all_sessions(api_client, repo):
    repo.upsert_session(session_factory("a", "2026-05-01T00:00:00Z"))
    r = api_client.get("/api/export.json")
    assert len(r.json()["sessions"]) == 1


def test_export_csv_returns_csv_content_type(api_client):
    r = api_client.get("/api/export.csv")
    assert "text/csv" in r.headers["content-type"]


def test_parse_errors_returns_array(api_client):
    r = api_client.get("/api/parse-errors")
    assert isinstance(r.json()["errors"], list)


# ─── Alerts ───────────────────────────────────────────────────────────


def test_alerts_list_returns_empty_when_no_rows(api_client):
    r = api_client.get("/api/alerts")
    assert r.status_code == 200
    assert r.json() == {"alerts": []}


def test_alerts_list_returns_rows(api_client, repo):
    repo.upsert_alert(alert_factory(dedup_key="d1", severity="warning"))
    repo.upsert_alert(alert_factory(dedup_key="d2", severity="critical"))
    r = api_client.get("/api/alerts")
    assert r.status_code == 200
    body = r.json()
    assert {a["dedup_key"] for a in body["alerts"]} == {"d1", "d2"}


def test_alerts_unseen_filters_by_severity(api_client, repo):
    repo.upsert_alert(alert_factory(dedup_key="d1", severity="warning"))
    repo.upsert_alert(alert_factory(dedup_key="d2", severity="critical"))
    r = api_client.get("/api/alerts/unseen?severity=critical")
    assert r.status_code == 200
    body = r.json()
    assert [a["dedup_key"] for a in body["alerts"]] == ["d2"]


def test_alerts_unseen_rejects_bad_severity(api_client):
    r = api_client.get("/api/alerts/unseen?severity=fatal")
    assert r.status_code == 400


def test_mark_alert_seen_marks_seen(api_client, repo):
    rid = repo.upsert_alert(alert_factory(severity="critical"))
    r = api_client.post(f"/api/alerts/{rid}/seen")
    assert r.status_code == 200
    assert r.json() == {"ok": True}
    r2 = api_client.get("/api/alerts/unseen?severity=critical")
    assert r2.json() == {"alerts": []}


def test_mark_alert_seen_404_for_unknown_id(api_client):
    r = api_client.post("/api/alerts/99999/seen")
    assert r.status_code == 404


def test_session_timeline_endpoint_shape(api_client, repo):
    from argus.schema.types import ToolCall

    repo.upsert_session(session_factory("s1", "2026-05-01T00:00:00Z"))
    repo.upsert_turn(turn_factory("s1:m0", "s1", "2026-05-01T00:00:00Z"))
    repo.upsert_tool_calls([
        ToolCall(id="s1:tu_1", session_id="s1", turn_index=0, tool_name="Bash",
                 is_error=1, input_size=42, subagent_type=None,
                 timestamp="2026-05-01T00:00:01Z"),
    ])
    repo.set_search_indexing_enabled(False)

    r = api_client.get("/api/sessions/s1/timeline")
    assert r.status_code == 200
    body = r.json()
    assert body["search_enabled"] is False
    assert len(body["turns"]) == 1
    turn = body["turns"][0]
    assert turn["sequence"] == 0
    assert turn["cost_usd"] == 1.5
    call = turn["tool_calls"][0]
    assert call["tool_name"] == "Bash"
    assert call["is_error"] == 1
    assert call["error_text"] is None


def test_session_timeline_404_for_unknown_session(api_client):
    r = api_client.get("/api/sessions/nope/timeline")
    assert r.status_code == 404


def test_session_tool_output_endpoint(api_client, repo):
    from argus.schema.types import TranscriptSegment

    repo.upsert_session(session_factory("s1", "2026-05-01T00:00:00Z"))
    repo.set_search_indexing_enabled(True)
    repo.upsert_transcript_segments([
        TranscriptSegment(uid="s1:u1:0", session_id="s1",
                          timestamp="2026-05-01T00:00:01Z", role="tool_result",
                          text="drwxr-xr-x 3 files", tool_use_id="tu_ls"),
    ])

    body = api_client.get("/api/sessions/s1/tool-output/tu_ls").json()
    assert body == {"search_enabled": True, "found": True, "text": "drwxr-xr-x 3 files"}

    body = api_client.get("/api/sessions/s1/tool-output/tu_nope").json()
    assert body["found"] is False and body["text"] is None

    repo.set_search_indexing_enabled(False)
    body = api_client.get("/api/sessions/s1/tool-output/tu_ls").json()
    assert body == {"search_enabled": False, "found": False, "text": None}

    assert api_client.get("/api/sessions/ghost/tool-output/tu_ls").status_code == 404


def test_session_routes_accept_slash_ids_and_ordering(repo):
    parent = session_factory("claude_code:P", "2026-06-01T00:00:00Z")
    sub = session_factory("claude_code:P/agent-a1", "2026-06-01T00:00:00Z")
    repo.upsert_session(parent)
    repo.upsert_session(sub)
    client = TestClient(_make_app(repo))

    # Bare get_session matches a slash id (was unmatchable before :path).
    r = client.get("/api/sessions/claude_code:P/agent-a1")
    assert r.status_code == 200
    assert r.json()["session"]["id"] == "claude_code:P/agent-a1"

    # The /timeline suffix on a slash id reaches the timeline handler, not the
    # greedy bare {session_id:path} route. Timeline responses carry
    # "search_enabled"; get_session responses carry "session".
    r = client.get("/api/sessions/claude_code:P/agent-a1/timeline")
    assert r.status_code == 200
    body = r.json()
    assert "search_enabled" in body and "session" not in body


def test_subagents_endpoint(repo):
    parent = session_factory("claude_code:P", "2026-06-01T00:00:00Z")
    parent.metadata["sub_agent_session_ids"] = ["claude_code:P/agent-a1"]
    repo.upsert_session(parent)
    repo.upsert_session(session_factory("claude_code:P/agent-a1", "2026-06-01T00:00:00Z"))
    client = TestClient(_make_app(repo))

    r = client.get("/api/sessions/claude_code:P/subagents")
    assert r.status_code == 200
    subs = r.json()["subagents"]
    assert len(subs) == 1 and subs[0]["id"] == "claude_code:P/agent-a1"

    # Unknown parent -> 404.
    assert client.get("/api/sessions/claude_code:nope/subagents").status_code == 404

    # Childless session -> empty list.
    repo.upsert_session(session_factory("claude_code:lonely", "2026-06-01T00:00:00Z"))
    r = client.get("/api/sessions/claude_code:lonely/subagents")
    assert r.status_code == 200 and r.json() == {"subagents": []}
