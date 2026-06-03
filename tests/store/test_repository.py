"""Repository surface tests — ported 1:1 from src/store/repository.test.ts."""
from __future__ import annotations

import pytest

from argus.schema.types import (
    Prompt,
    Session,
    ToolCall,
    TranscriptSegment,
    Turn,
)
from tests.conftest import alert_factory, session_factory

# Sample row shared across tests (matches the TS SESSION/TURN constants).
SAMPLE = Session(
    id="claude_code:s1",
    agent="claude_code",
    agent_version="2.1.94",
    project_path="/proj",
    started_at="2026-05-01T10:00:00Z",
    ended_at="2026-05-01T11:00:00Z",
    duration_sec=3600,
    total_fresh_input_tokens=100,
    total_output_tokens=200,
    total_cache_read_tokens=50,
    total_cache_write_tokens=10,
    total_cost_usd=1.5,
    primary_model="claude-opus-4-7",
    turn_count=2,
    pricing_table_version="2026-05-02",
    computed_at="2026-05-02T00:00:00Z",
    agent_reported_cost_usd=None,
    metadata={"foo": "bar"},
)

SAMPLE_TURN = Turn(
    id="claude_code:s1:0",
    session_id="claude_code:s1",
    sequence=0,
    timestamp="2026-05-01T10:00:00Z",
    model="claude-opus-4-7",
    model_raw="claude-opus-4-7",
    fresh_input_tokens=50,
    output_tokens=100,
    cache_read_tokens=25,
    cache_write_tokens=5,
    cache_write_5m_tokens=5,
    cache_write_1h_tokens=0,
    tool_calls_count=1,
    cost_usd=0.75,
    metadata={},
)


def test_upserts_and_reads_session(repo):
    repo.upsert_session(SAMPLE)
    got = repo.get_session(SAMPLE.id)
    assert got is not None
    # project_path is normalized; on Linux "/proj" → "/proj"; on Windows
    # everything lowercases. Both round-trip safely.
    assert got.id == SAMPLE.id
    assert got.total_cost_usd == SAMPLE.total_cost_usd
    assert got.metadata == SAMPLE.metadata


def test_upsert_is_idempotent(repo):
    repo.upsert_session(SAMPLE)
    repo.upsert_session(SAMPLE.model_copy(update={"total_cost_usd": 2.0}))
    got = repo.get_session(SAMPLE.id)
    assert got is not None
    assert got.total_cost_usd == 2.0


def test_upserts_and_reads_turns(repo):
    repo.upsert_session(SAMPLE)
    repo.upsert_turn(SAMPLE_TURN)
    turns = repo.get_turns_for_session(SAMPLE.id)
    assert len(turns) == 1
    assert turns[0] == SAMPLE_TURN


def test_lists_sessions_sorted_by_started_at_desc(repo):
    repo.upsert_session(SAMPLE.model_copy(update={"id": "a", "started_at": "2026-01-01T00:00:00Z"}))
    repo.upsert_session(SAMPLE.model_copy(update={"id": "b", "started_at": "2026-05-01T00:00:00Z"}))
    ids = [s.id for s in repo.list_sessions(limit=10)]
    assert ids == ["b", "a"]


def test_tracks_file_byte_offsets(repo):
    repo.set_file_offset("/p/f.jsonl", 1234)
    assert repo.get_file_offset("/p/f.jsonl") == 1234
    assert repo.get_file_offset("/p/missing.jsonl") == 0


def test_records_parse_errors(repo):
    repo.record_parse_error(
        {"file": "f", "byte_offset": 0, "reason": "bad json", "raw_line_truncated": "{"}
    )
    errs = repo.recent_parse_errors(10)
    assert len(errs) == 1


def test_upserts_tool_calls_and_aggregates_leaderboard(repo):
    repo.upsert_session(SAMPLE)
    repo.upsert_tool_calls(
        [
            ToolCall(
                id="claude_code:s1:t1",
                session_id=SAMPLE.id,
                turn_index=0,
                tool_name="Bash",
                is_error=0,
                input_size=10,
                subagent_type=None,
                timestamp="2026-05-01T10:00:00Z",
            ),
            ToolCall(
                id="claude_code:s1:t2",
                session_id=SAMPLE.id,
                turn_index=0,
                tool_name="Bash",
                is_error=1,
                input_size=20,
                subagent_type=None,
                timestamp="2026-05-01T10:01:00Z",
            ),
            ToolCall(
                id="claude_code:s1:t3",
                session_id=SAMPLE.id,
                turn_index=1,
                tool_name="Edit",
                is_error=0,
                input_size=30,
                subagent_type=None,
                timestamp="2026-05-01T10:02:00Z",
            ),
        ]
    )
    board = repo.tool_leaderboard("", 10)
    by_name = {r["name"]: r for r in board}
    assert by_name["Bash"]["calls"] == 2
    assert by_name["Bash"]["errors"] == 1
    assert by_name["Edit"]["calls"] == 1

    # Idempotent re-upsert.
    repo.upsert_tool_calls(
        [
            ToolCall(
                id="claude_code:s1:t1",
                session_id=SAMPLE.id,
                turn_index=0,
                tool_name="Bash",
                is_error=0,
                input_size=10,
                subagent_type=None,
                timestamp="2026-05-01T10:00:00Z",
            )
        ]
    )
    assert repo.count_tool_calls_for_session(SAMPLE.id) == 3


def test_links_prompt_to_session_by_project_and_time(repo):
    from datetime import datetime, timezone

    def ms(iso: str) -> int:
        return int(
            datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp() * 1000
        )

    repo.upsert_session(SAMPLE)
    # SAMPLE spans 2026-05-01 10:00 → 11:00 UTC.
    inside = repo.link_prompt_to_session("/proj", ms("2026-05-01T10:30:00Z"))
    assert inside == SAMPLE.id

    before = repo.link_prompt_to_session("/proj", ms("2026-05-01T09:00:00Z"))
    assert before is None

    wrong = repo.link_prompt_to_session("/elsewhere", ms("2026-05-01T10:30:00Z"))
    assert wrong is None


def test_subagent_rollup_returns_only_task_tool(repo):
    repo.upsert_session(SAMPLE)
    repo.upsert_tool_calls(
        [
            ToolCall(
                id="claude_code:s1:a",
                session_id=SAMPLE.id,
                turn_index=0,
                tool_name="Task",
                is_error=0,
                input_size=50,
                subagent_type="Explore",
                timestamp="2026-05-01T10:00:00Z",
            ),
            ToolCall(
                id="claude_code:s1:b",
                session_id=SAMPLE.id,
                turn_index=1,
                tool_name="Task",
                is_error=0,
                input_size=50,
                subagent_type="Plan",
                timestamp="2026-05-01T10:01:00Z",
            ),
            ToolCall(
                id="claude_code:s1:c",
                session_id=SAMPLE.id,
                turn_index=2,
                tool_name="Bash",
                is_error=0,
                input_size=5,
                subagent_type=None,
                timestamp="2026-05-01T10:02:00Z",
            ),
        ]
    )
    rows = repo.subagent_calls("")
    types = sorted(r["type"] for r in rows)
    assert types == ["Explore", "Plan"]


def test_aggregate_turns_attributes_subagent_tokens_to_parent(repo):
    """Windowed aggregation rolls sub-agent (``parent/sub``) turns into the
    parent session id so the Overview reconciles with the session detail
    total, which already includes the sub-agent rollup."""
    parent = SAMPLE.model_copy(update={"id": "claude_code:p"})
    sub = SAMPLE.model_copy(update={"id": "claude_code:p/explore"})
    repo.upsert_session(parent)
    repo.upsert_session(sub)
    repo.upsert_turn(
        SAMPLE_TURN.model_copy(
            update={
                "id": "claude_code:p:0",
                "session_id": "claude_code:p",
                "fresh_input_tokens": 100,
                "output_tokens": 0,
                "cache_read_tokens": 0,
                "cache_write_tokens": 0,
                "cost_usd": 1.0,
            }
        )
    )
    repo.upsert_turn(
        SAMPLE_TURN.model_copy(
            update={
                "id": "claude_code:p/explore:0",
                "session_id": "claude_code:p/explore",
                "fresh_input_tokens": 25,
                "output_tokens": 0,
                "cache_read_tokens": 0,
                "cache_write_tokens": 0,
                "cost_usd": 0.5,
            }
        )
    )

    rows = repo.aggregate_turns_by_day("")

    # No sub-agent ids leak through; their tokens roll into the parent.
    assert all("/" not in r["session_id"] for r in rows)
    by_session: dict[str, dict[str, float]] = {}
    for r in rows:
        agg = by_session.setdefault(r["session_id"], {"fresh": 0, "cost": 0.0})
        agg["fresh"] += r["fresh_input"]
        agg["cost"] += r["cost"]
    assert "claude_code:p/explore" not in by_session
    assert by_session["claude_code:p"]["fresh"] == 125
    assert by_session["claude_code:p"]["cost"] == 1.5


def test_inserts_prompts_and_fts_search_returns_marked_snippets(repo):
    repo.insert_prompts(
        [
            Prompt(timestamp_ms=1000, project_path="/p", display="how do I configure vitest", pasted_chars=0, is_slash=0),
            Prompt(timestamp_ms=2000, project_path="/p", display="unrelated", pasted_chars=0, is_slash=0),
            Prompt(timestamp_ms=3000, project_path="/p", display="vitest hangs", pasted_chars=0, is_slash=0),
        ]
    )
    r = repo.search_prompts(q="vitest", limit=10)
    assert r["total"] == 2
    assert all("<mark>" in row["snippet"] for row in r["rows"])


def test_transcript_segments_fts_returns_matches(repo):
    repo.upsert_session(SAMPLE)
    repo.upsert_transcript_segments(
        [
            TranscriptSegment(
                uid="claude_code:s1:u1:0",
                session_id=SAMPLE.id,
                timestamp="2026-05-01T10:00:00Z",
                role="user",
                text="how do I check ccusage output",
            ),
            TranscriptSegment(
                uid="claude_code:s1:a1:0",
                session_id=SAMPLE.id,
                timestamp="2026-05-01T10:00:01Z",
                role="assistant",
                text="ccusage prints summary statistics",
            ),
            TranscriptSegment(
                uid="claude_code:s1:a2:0",
                session_id=SAMPLE.id,
                timestamp="2026-05-01T10:00:02Z",
                role="assistant",
                text="unrelated text",
            ),
        ]
    )
    r = repo.search_transcripts(q="ccusage", limit=10)
    assert r["total"] == 2
    assert all("<mark>" in row["snippet"] for row in r["rows"])


def test_transcript_search_respects_role_filter(repo):
    repo.upsert_session(SAMPLE)
    repo.upsert_transcript_segments(
        [
            TranscriptSegment(
                uid="claude_code:s1:u1:0",
                session_id=SAMPLE.id,
                timestamp="2026-05-01T10:00:00Z",
                role="user",
                text="find ccusage",
            ),
            TranscriptSegment(
                uid="claude_code:s1:a1:0",
                session_id=SAMPLE.id,
                timestamp="2026-05-01T10:00:01Z",
                role="assistant",
                text="about ccusage",
            ),
        ]
    )
    r = repo.search_transcripts(q="ccusage", limit=10, roles=["user"])
    assert r["total"] == 1
    assert r["rows"][0]["role"] == "user"


def test_transcript_segments_upsert_idempotent_by_uid(repo):
    repo.upsert_session(SAMPLE)
    seg = TranscriptSegment(
        uid="claude_code:s1:u1:0",
        session_id=SAMPLE.id,
        timestamp="2026-05-01T10:00:00Z",
        role="user",
        text="ccusage v1",
    )
    repo.upsert_transcript_segments([seg])
    repo.upsert_transcript_segments([seg.model_copy(update={"text": "ccusage v2 updated"})])
    assert repo.count_segments_for_session(SAMPLE.id) == 1
    r = repo.search_transcripts(q="updated", limit=10)
    assert r["total"] == 1


def test_search_indexing_flag_defaults_off(repo):
    assert repo.is_search_indexing_enabled() is False


def test_search_indexing_flag_defaults_on_when_segments_exist(repo):
    """Migration default: ON when an existing install already has segments."""
    repo.upsert_session(SAMPLE)
    repo.upsert_transcript_segments(
        [
            TranscriptSegment(
                uid="claude_code:s1:u1:0",
                session_id=SAMPLE.id,
                timestamp="2026-05-01T10:00:00Z",
                role="user",
                text="data",
            )
        ]
    )
    # Simulate the absent-key migration path.
    repo.db.execute("DELETE FROM app_meta WHERE key = 'enable_transcript_search'")
    assert repo.is_search_indexing_enabled() is True


def test_set_search_indexing_persists(repo):
    repo.set_search_indexing_enabled(True)
    assert repo.is_search_indexing_enabled() is True
    repo.set_search_indexing_enabled(False)
    assert repo.is_search_indexing_enabled() is False


def test_clear_all_segments_wipes_table_and_fts(repo):
    repo.upsert_session(SAMPLE)
    repo.upsert_transcript_segments(
        [
            TranscriptSegment(
                uid="claude_code:s1:a:0",
                session_id=SAMPLE.id,
                timestamp="2026-05-01T10:00:00Z",
                role="assistant",
                text="hello",
            ),
            TranscriptSegment(
                uid="claude_code:s1:b:0",
                session_id=SAMPLE.id,
                timestamp="2026-05-01T10:01:00Z",
                role="user",
                text="world",
            ),
        ]
    )
    assert repo.segment_stats()["total"] == 2
    repo.clear_all_segments()
    assert repo.segment_stats()["total"] == 0
    r = repo.search_transcripts(q="hello", limit=10)
    assert r["total"] == 0


def test_vacuum_succeeds_with_active_statement_on_shared_connection(repo, db):
    """VACUUM must not fail when another statement is mid-flight on the shared
    connection (watcher/scheduler/request threads all share one). Regression
    for: clicking "Clear indexed data" while the watcher was ingesting raised
    'cannot VACUUM - SQL statements in progress'.
    """
    repo.upsert_session(session_factory("a", "2026-01-01T00:00:00Z"))
    repo.upsert_session(session_factory("b", "2026-02-01T00:00:00Z"))

    # Leave an unfinalized cursor active on the shared connection — this is
    # what makes a same-connection VACUUM raise.
    cur = db.execute("SELECT * FROM sessions")
    cur.fetchone()  # partially consumed → statement still in progress

    repo.vacuum()  # must not raise

    # The original cursor is unaffected.
    assert cur.fetchone() is not None


# ─── Alerts ───────────────────────────────────────────────────────────


def test_upsert_alert_inserts_new_row(repo):
    rid = repo.upsert_alert(alert_factory())
    assert isinstance(rid, int) and rid > 0
    got = repo.list_alerts(limit=10)
    assert len(got) == 1
    assert got[0].detector == "tool_error_rate_spike"
    assert got[0].dedup_key == "Bash"
    assert got[0].seen_at is None
    assert got[0].resolved_at is None


def test_upsert_alert_is_idempotent_on_same_key(repo):
    repo.upsert_alert(alert_factory(first_seen_at="2026-05-27T12:00:00Z",
                                    last_seen_at="2026-05-27T12:00:00Z"))
    repo.upsert_alert(
        alert_factory(
            first_seen_at="2026-05-28T09:00:00Z",  # ignored on conflict
            last_seen_at="2026-05-27T13:00:00Z",
            message="Last 7d: 18.0% over 130 calls. Prior 28d: 4.8% over 450 calls.",
        )
    )
    got = repo.list_alerts(limit=10)
    assert len(got) == 1
    assert got[0].last_seen_at == "2026-05-27T13:00:00Z"
    assert got[0].message == "Last 7d: 18.0% over 130 calls. Prior 28d: 4.8% over 450 calls."
    assert got[0].first_seen_at == "2026-05-27T12:00:00Z"  # preserved from first insert


def test_upsert_alert_preserves_seen_when_severity_unchanged(repo):
    rid = repo.upsert_alert(alert_factory(severity="warning"))
    repo.mark_alert_seen(rid)
    repo.upsert_alert(alert_factory(severity="warning", last_seen_at="2026-05-26T14:00:00Z"))
    got = repo.list_alerts(limit=10)
    assert got[0].seen_at is not None


def test_upsert_alert_resets_seen_on_severity_change(repo):
    rid = repo.upsert_alert(alert_factory(severity="warning"))
    repo.mark_alert_seen(rid)
    repo.upsert_alert(alert_factory(severity="critical", last_seen_at="2026-05-26T14:00:00Z"))
    got = repo.list_alerts(limit=10)
    assert got[0].seen_at is None


def test_list_unseen_alerts_filters_by_severity(repo):
    repo.upsert_alert(alert_factory(dedup_key="d1", severity="warning"))
    repo.upsert_alert(alert_factory(dedup_key="d2", severity="critical"))
    unseen = repo.list_unseen_alerts(severity="critical")
    assert [a.dedup_key for a in unseen] == ["d2"]


def test_list_unseen_alerts_excludes_seen_rows(repo):
    rid = repo.upsert_alert(alert_factory(dedup_key="d1", severity="critical"))
    repo.mark_alert_seen(rid)
    repo.upsert_alert(alert_factory(dedup_key="d2", severity="critical"))
    unseen = repo.list_unseen_alerts(severity="critical")
    assert [a.dedup_key for a in unseen] == ["d2"]


def test_mark_alert_seen_returns_false_for_unknown_id(repo):
    assert repo.mark_alert_seen(99999) is False


def test_list_alerts_excludes_resolved_rows(repo):
    repo.upsert_alert(alert_factory(dedup_key="Bash"))
    repo.upsert_alert(alert_factory(dedup_key="Read"))
    repo.resolve_stale_alerts(detector="tool_error_rate_spike", active_dedup_keys=["Bash"])
    keys = {a.dedup_key for a in repo.list_alerts(limit=10)}
    assert keys == {"Bash"}


def test_list_unseen_excludes_resolved_rows(repo):
    repo.upsert_alert(alert_factory(dedup_key="Bash", severity="critical"))
    repo.upsert_alert(alert_factory(dedup_key="Read", severity="critical"))
    repo.resolve_stale_alerts(detector="tool_error_rate_spike", active_dedup_keys=["Bash"])
    keys = [a.dedup_key for a in repo.list_unseen_alerts(severity="critical")]
    assert keys == ["Bash"]


def test_resolve_stale_alerts_only_touches_named_detector(repo):
    repo.upsert_alert(alert_factory(detector="tool_error_rate_spike", dedup_key="Bash"))
    repo.upsert_alert(alert_factory(detector="some_other", dedup_key="X"))
    repo.resolve_stale_alerts(detector="tool_error_rate_spike", active_dedup_keys=[])
    by_detector = {a.detector: a for a in repo.list_alerts(limit=10)}
    assert "tool_error_rate_spike" not in by_detector
    assert "some_other" in by_detector


def test_resolve_stale_alerts_returns_count(repo):
    repo.upsert_alert(alert_factory(dedup_key="Bash"))
    repo.upsert_alert(alert_factory(dedup_key="Read"))
    n = repo.resolve_stale_alerts(detector="tool_error_rate_spike", active_dedup_keys=["Bash"])
    assert n == 1


def test_resolve_stale_alerts_with_empty_active_set_resolves_all(repo):
    repo.upsert_alert(alert_factory(dedup_key="Bash"))
    repo.upsert_alert(alert_factory(dedup_key="Read"))
    n = repo.resolve_stale_alerts(detector="tool_error_rate_spike", active_dedup_keys=[])
    assert n == 2
    assert repo.list_alerts(limit=10) == []


def test_upsert_clears_resolved_at_and_resets_seen_on_refire(repo):
    rid = repo.upsert_alert(alert_factory(dedup_key="Bash", severity="warning"))
    repo.mark_alert_seen(rid)
    repo.resolve_stale_alerts(detector="tool_error_rate_spike", active_dedup_keys=[])
    repo.upsert_alert(alert_factory(dedup_key="Bash", severity="warning",
                                    last_seen_at="2026-05-28T10:00:00Z"))
    rows = repo.list_alerts(limit=10)
    assert len(rows) == 1
    got = rows[0]
    assert got.resolved_at is None
    assert got.seen_at is None
    assert got.severity == "warning"


def test_upsert_preserves_seen_when_steady_state(repo):
    rid = repo.upsert_alert(alert_factory(dedup_key="Bash", severity="warning"))
    repo.mark_alert_seen(rid)
    repo.upsert_alert(alert_factory(dedup_key="Bash", severity="warning",
                                    last_seen_at="2026-05-28T10:00:00Z"))
    assert repo.list_alerts(limit=10)[0].seen_at is not None


def test_tool_call_stats_in_range_returns_per_tool_counts(repo):
    from argus.schema.types import ToolCall

    repo.upsert_session(session_factory("s1", "2026-05-20T00:00:00Z"))
    repo.upsert_tool_calls([
        ToolCall(id="t1", session_id="s1", turn_index=0, tool_name="Bash",
                 is_error=0, input_size=0, subagent_type=None,
                 timestamp="2026-05-21T00:00:00Z"),
        ToolCall(id="t2", session_id="s1", turn_index=1, tool_name="Bash",
                 is_error=1, input_size=0, subagent_type=None,
                 timestamp="2026-05-21T01:00:00Z"),
        ToolCall(id="t3", session_id="s1", turn_index=2, tool_name="Read",
                 is_error=0, input_size=0, subagent_type=None,
                 timestamp="2026-05-21T02:00:00Z"),
        ToolCall(id="t4", session_id="s1", turn_index=3, tool_name="Bash",
                 is_error=1, input_size=0, subagent_type=None,
                 timestamp="2026-05-15T00:00:00Z"),  # outside range
    ])
    stats = repo.tool_call_stats_in_range(
        start_iso="2026-05-20T00:00:00Z", end_iso="2026-05-22T00:00:00Z"
    )
    by_name = {r["tool_name"]: r for r in stats}
    assert by_name["Bash"]["calls"] == 2
    assert by_name["Bash"]["errors"] == 1
    assert by_name["Read"]["calls"] == 1
    assert by_name["Read"]["errors"] == 0
