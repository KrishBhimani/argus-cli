"""Pipeline regression tests — turn merging, sub-agent double-count, segment gating."""
from __future__ import annotations

import json
from pathlib import Path

from argus.adapters.claude_code.adapter import ClaudeCodeAdapter
from argus.collector.pipeline import ingest_file
from argus.pricing.load import load_pricing_table


def _line(msg_id: str, *, sid="sess1", input_tokens=1_000_000, output_tokens=1_000_000) -> str:
    return json.dumps(
        {
            "type": "assistant",
            "sessionId": sid,
            "uuid": "u" + msg_id,
            "timestamp": "2026-05-01T00:00:00Z",
            "cwd": "C:/proj",
            "version": "2.1.94",
            "userType": "external",
            "entrypoint": "cli",
            "message": {
                "id": msg_id,
                "model": "claude-opus-4-7",
                "role": "assistant",
                "content": [],
                "usage": {
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "cache_read_input_tokens": 0,
                    "cache_creation_input_tokens": 0,
                },
            },
        }
    )


def test_incremental_reingest_does_not_reduce_session_totals(tmp_path: Path, repo):
    """REGRESSION: re-ingesting a file must merge new turns, not stomp totals."""
    claude_root = tmp_path / ".claude"
    proj = claude_root / "projects" / "C--proj"
    proj.mkdir(parents=True)
    f = proj / "sess1.jsonl"
    f.write_text(_line("m1") + "\n" + _line("m2") + "\n" + _line("m3") + "\n", encoding="utf-8")

    adapter = ClaudeCodeAdapter(claude_root)
    table = load_pricing_table()

    ingest_file(adapter, f, repo, table)
    after1 = repo.get_session("claude_code:sess1")
    assert after1 is not None
    assert after1.turn_count == 3
    cost1 = after1.total_cost_usd
    assert cost1 > 0

    with f.open("a", encoding="utf-8") as fp:
        fp.write(_line("m4") + "\n")
    ingest_file(adapter, f, repo, table)
    after2 = repo.get_session("claude_code:sess1")
    assert after2 is not None
    assert after2.turn_count == 4
    assert after2.total_cost_usd > cost1  # MUST increase

    # Re-ingest with no new content → totals stay the same.
    ingest_file(adapter, f, repo, table)
    after3 = repo.get_session("claude_code:sess1")
    assert after3 is not None
    assert after3.turn_count == 4
    assert after3.total_cost_usd == after2.total_cost_usd


def test_subagent_files_not_counted_twice(tmp_path: Path, repo):
    """REGRESSION: discover must NOT return sub-agent files; rollup MUST sum."""
    claude_root = tmp_path / ".claude"
    proj = claude_root / "projects" / "C--proj"
    proj.mkdir(parents=True)
    parent_file = proj / "parent.jsonl"
    sub_dir = proj / "parent" / "subagents"
    sub_dir.mkdir(parents=True)
    sub_file = sub_dir / "agent-aabc.jsonl"

    def line(sid: str, mid: str, tokens: int) -> str:
        return json.dumps(
            {
                "type": "assistant",
                "sessionId": sid,
                "uuid": "u" + mid,
                "timestamp": "2026-05-01T00:00:00Z",
                "cwd": "C:/proj",
                "version": "2.1.94",
                "userType": "external",
                "entrypoint": "cli",
                "message": {
                    "id": mid,
                    "model": "claude-opus-4-7",
                    "role": "assistant",
                    "content": [],
                    "usage": {
                        "input_tokens": tokens,
                        "output_tokens": tokens,
                        "cache_read_input_tokens": 0,
                        "cache_creation_input_tokens": 0,
                    },
                },
            }
        )

    parent_file.write_text(line("parent", "p1", 1_000_000) + "\n" + line("parent", "p2", 1_000_000) + "\n", encoding="utf-8")
    sub_file.write_text(line("parent", "s1", 500_000) + "\n", encoding="utf-8")

    adapter = ClaudeCodeAdapter(claude_root)
    table = load_pricing_table()

    files = adapter.discover_session_files()
    # Sub-agent files MUST be excluded from top-level discovery.
    assert files == [parent_file]

    for fp in files:
        ingest_file(adapter, fp, repo, table)

    parent = repo.get_session("claude_code:parent")
    assert parent is not None
    # parent: 2 turns × (1M+1M) plus sub-agent: 1 turn × (500k+500k)
    # = fresh: 2*1M + 1*500k = 2.5M
    assert parent.total_fresh_input_tokens == 2_500_000
    assert parent.total_output_tokens == 2_500_000
    # 2 parent turns + 1 sub-agent turn = 3
    assert parent.turn_count == 3


def test_ingests_synthetic_session_end_to_end(tmp_path: Path, repo):
    claude_root = tmp_path / ".claude"
    proj = claude_root / "projects" / "C--proj"
    proj.mkdir(parents=True)
    session_file = proj / "sess1.jsonl"
    session_file.write_text(
        json.dumps(
            {
                "type": "assistant",
                "sessionId": "sess1",
                "uuid": "u1",
                "timestamp": "2026-05-01T00:00:00Z",
                "cwd": "C:/proj",
                "version": "2.1.94",
                "userType": "external",
                "entrypoint": "cli",
                "message": {
                    "id": "m1",
                    "model": "claude-opus-4-7",
                    "role": "assistant",
                    "content": [],
                    "usage": {
                        "input_tokens": 1000,
                        "output_tokens": 2000,
                        "cache_read_input_tokens": 0,
                        "cache_creation_input_tokens": 0,
                    },
                },
            }
        )
        + "\n",
        encoding="utf-8",
    )

    adapter = ClaudeCodeAdapter(claude_root)
    table = load_pricing_table()
    ingest_file(adapter, session_file, repo, table)
    sessions = repo.list_sessions(limit=10)
    assert len(sessions) == 1
    assert sessions[0].agent == "claude_code"
    assert sessions[0].total_fresh_input_tokens == 1000
    assert sessions[0].total_cost_usd > 0
    assert repo.get_file_offset(str(session_file)) > 0


def test_skips_segment_writes_when_search_flag_off(tmp_path: Path, repo):
    """REGRESSION: opt-out must mean no segments written, even if data exists."""
    claude_root = tmp_path / ".claude"
    proj = claude_root / "projects" / "C--proj"
    proj.mkdir(parents=True)
    session_file = proj / "sess1.jsonl"
    session_file.write_text(
        json.dumps(
            {
                "type": "assistant",
                "sessionId": "sess1",
                "uuid": "u1",
                "timestamp": "2026-05-01T00:00:00Z",
                "cwd": "C:/proj",
                "version": "2.1.94",
                "userType": "external",
                "entrypoint": "cli",
                "message": {
                    "id": "m1",
                    "model": "claude-opus-4-7",
                    "role": "assistant",
                    "content": [{"type": "text", "text": "this is some assistant text we would normally index"}],
                    "usage": {
                        "input_tokens": 100,
                        "output_tokens": 200,
                        "cache_read_input_tokens": 0,
                        "cache_creation_input_tokens": 0,
                    },
                },
            }
        )
        + "\n",
        encoding="utf-8",
    )

    adapter = ClaudeCodeAdapter(claude_root)
    table = load_pricing_table()

    assert repo.is_search_indexing_enabled() is False
    ingest_file(adapter, session_file, repo, table)
    assert repo.segment_stats()["total"] == 0

    # Flip on, re-ingest from offset 0 → segments populate.
    repo.set_search_indexing_enabled(True)
    repo.set_file_offset(str(session_file), 0)
    ingest_file(adapter, session_file, repo, table)
    assert repo.segment_stats()["total"] == 1
