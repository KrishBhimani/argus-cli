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
