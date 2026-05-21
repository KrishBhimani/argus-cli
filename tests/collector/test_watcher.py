"""Watchdog live-tail. Slow-ish because we wait for the debouncer to fire."""
from __future__ import annotations

import json
import time
from pathlib import Path

import pytest

from argus.adapters.claude_code.adapter import ClaudeCodeAdapter
from argus.collector.watcher import start_watcher
from argus.pricing.load import load_pricing_table


def _line(sid: str, uid: str, mid: str) -> str:
    return json.dumps(
        {
            "type": "assistant",
            "sessionId": sid,
            "uuid": uid,
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
                    "input_tokens": 1,
                    "output_tokens": 1,
                    "cache_read_input_tokens": 0,
                    "cache_creation_input_tokens": 0,
                },
            },
        }
    )


def test_picks_up_appended_lines_after_start(tmp_path: Path, repo):
    claude_root = tmp_path / ".claude"
    proj = claude_root / "projects" / "C--proj"
    proj.mkdir(parents=True)
    f = proj / "s1.jsonl"
    f.write_text(_line("s1", "u1", "m1") + "\n", encoding="utf-8")

    adapter = ClaudeCodeAdapter(claude_root)
    table = load_pricing_table()

    handle = start_watcher([adapter], repo, table, stability_threshold_ms=50)
    try:
        # Give the Observer time to spin up, then wait for the initial-state
        # event (if any) to debounce and ingest.
        time.sleep(0.5)

        # Append a second turn.
        with f.open("a", encoding="utf-8") as fp:
            fp.write(_line("s1", "u2", "m2") + "\n")
        # Wait long enough for debounce + ingest worker thread to finish.
        time.sleep(1.0)

        turns = repo.get_turns_for_session("claude_code:s1")
        assert len(turns) == 2
    finally:
        handle.stop()
