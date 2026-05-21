"""Orchestrate one ingest: read new bytes, upsert turns/calls/segments, recompute session."""
from __future__ import annotations

from pathlib import Path

from ..adapters.base import Adapter, RawSegment, RawToolCall
from ..pricing.types import PricingTable
from ..schema.types import Session, ToolCall, TranscriptSegment
from ..store.repository import Repository
from .aggregate import build_session, build_turn
from .rollup_subagents import rollup_subagents


def _to_tool_call(r: RawToolCall, session_id: str) -> ToolCall:
    return ToolCall(
        id=f"{session_id}:{r.tool_use_id}",
        session_id=session_id,
        turn_index=r.turn_index,
        tool_name=r.tool_name,
        is_error=r.is_error,
        input_size=r.input_size,
        subagent_type=r.subagent_type,
        timestamp=r.timestamp,
    )


def _to_segment(r: RawSegment, session_id: str) -> TranscriptSegment:
    return TranscriptSegment(
        uid=f"{session_id}:{r.uid_suffix}",
        session_id=session_id,
        timestamp=r.timestamp,
        role=r.role,  # type: ignore[arg-type]
        text=r.text,
    )


def ingest_file(
    adapter: Adapter, file_path: Path, repo: Repository, table: PricingTable
) -> None:
    """Read new bytes from ``file_path`` via ``adapter`` and upsert into ``repo``."""
    file_str = str(file_path)
    from_offset = repo.get_file_offset(file_str)
    result, new_offset = adapter.ingest_file(file_path, from_offset)

    for e in result.parse_errors:
        repo.record_parse_error(
            {
                "file": e.file,
                "byte_offset": e.byte_offset,
                "reason": e.reason,
                "raw_line_truncated": e.raw_line_truncated,
            }
        )

    # No turn events in the bytes we just read.
    #   (a) re-ingest with no growth — nothing to do
    #   (b) first ingest of a file with only metadata / user lines / hooks
    #   (c) Codex stub (binary launched, no prompt sent)
    # For (b)/(c) we still record the new offset, but MUST NOT create an
    # empty session row that would clutter the dashboard.
    if not result.turns:
        if new_offset > from_offset:
            repo.set_file_offset(file_str, new_offset)
        return

    session_id = f"{result.header.agent}:{result.header.native_session_id}"

    # Ensure a session row exists (FK target for turns + tool_calls).
    if repo.get_session(session_id) is None:
        repo.upsert_session(build_session(result.header, session_id, [], table.version))

    for raw in result.turns:
        repo.upsert_turn(build_turn(raw, session_id, table))

    if result.tool_calls:
        repo.upsert_tool_calls([_to_tool_call(r, session_id) for r in result.tool_calls])

    if result.segments and repo.is_search_indexing_enabled():
        repo.upsert_transcript_segments(
            [_to_segment(r, session_id) for r in result.segments]
        )

    # Sub-agents: each sub-agent JSONL becomes its own session under
    # <sessionId>/<filename>. Adapter decides what counts as a sub-session
    # via sub_session_files_for(); the pipeline never branches on agent.
    sub_sessions: list[Session] = []
    if not adapter.should_skip(file_path):
        for sub in adapter.sub_session_files_for(file_path):
            sub_session_id = f"{session_id}/{sub.stem}"
            sub_from_offset = repo.get_file_offset(str(sub))
            sub_result, sub_new_offset = adapter.ingest_file(sub, sub_from_offset)

            for e in sub_result.parse_errors:
                repo.record_parse_error(
                    {
                        "file": e.file,
                        "byte_offset": e.byte_offset,
                        "reason": e.reason,
                        "raw_line_truncated": e.raw_line_truncated,
                    }
                )

            if (
                repo.get_session(sub_session_id) is None
                and sub_result.turns
            ):
                repo.upsert_session(
                    build_session(sub_result.header, sub_session_id, [], table.version)
                )
            for raw in sub_result.turns:
                repo.upsert_turn(build_turn(raw, sub_session_id, table))
            if sub_result.tool_calls:
                repo.upsert_tool_calls(
                    [_to_tool_call(r, sub_session_id) for r in sub_result.tool_calls]
                )
            if sub_result.segments and repo.is_search_indexing_enabled():
                repo.upsert_transcript_segments(
                    [_to_segment(r, sub_session_id) for r in sub_result.segments]
                )

            existing_sub = repo.get_session(sub_session_id)
            if existing_sub:
                all_sub_turns = repo.get_turns_for_session(sub_session_id)
                recomputed = build_session(
                    sub_result.header, sub_session_id, all_sub_turns, table.version
                )
                repo.upsert_session(recomputed)
                sub_sessions.append(recomputed)
            repo.set_file_offset(str(sub), sub_new_offset)

    # Recompute parent session totals from ALL stored turns (the new ones
    # we just upserted + any previously stored). Then layer the sub-agent
    # rollup on top — build_session only sums the parent's own turns, so
    # this is idempotent.
    all_turns = repo.get_turns_for_session(session_id)
    session = build_session(result.header, session_id, all_turns, table.version)
    if sub_sessions:
        session = rollup_subagents(session, sub_sessions)
    repo.upsert_session(session)
    repo.set_file_offset(file_str, new_offset)
