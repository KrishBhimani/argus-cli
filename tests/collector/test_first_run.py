"""Foreground (recent) vs background (older) first-pass ingest."""
from __future__ import annotations

import json
import os
import time
from pathlib import Path

from argus.adapters.claude_code.adapter import ClaudeCodeAdapter
from argus.collector.first_run import run_first_pass_ingest
from argus.pricing.load import load_pricing_table


def _line(sid: str, mid: str, ts: str) -> str:
    return json.dumps(
        {
            "type": "assistant",
            "sessionId": sid,
            "uuid": "u",
            "timestamp": ts,
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


def test_ingests_recent_files_in_foreground_older_in_background(tmp_path: Path, repo):
    """REGRESSION: status.processed/total reflect both phases after backfill done."""
    claude_root = tmp_path / ".claude"
    proj = claude_root / "projects" / "C--proj"
    proj.mkdir(parents=True)

    recent_file = proj / "recent.jsonl"
    old_file = proj / "old.jsonl"
    recent_file.write_text(
        _line("rec", "mr", "2026-05-22T00:00:00Z") + "\n", encoding="utf-8"
    )
    old_file.write_text(
        _line("old", "mo", "2025-01-01T00:00:00Z") + "\n", encoding="utf-8"
    )

    # Backdate old_file's mtime so it falls outside the recent-days cutoff.
    old_mtime = time.mktime((2025, 1, 1, 0, 0, 0, 0, 0, 0))
    os.utime(old_file, (old_mtime, old_mtime))

    adapter = ClaudeCodeAdapter(claude_root)
    table = load_pricing_table()

    handle = run_first_pass_ingest([adapter], repo, table, recent_days=30)

    handle.wait_foreground(timeout=10)
    ids_after_fg = sorted(s.id for s in repo.list_sessions(limit=10))
    # Only the recent file should be ingested at this point.
    assert ids_after_fg == ["claude_code:recent"]
    s = handle.status()
    assert s.total == 2

    handle.wait_backfill(timeout=10)
    ids_after_bg = sorted(s.id for s in repo.list_sessions(limit=10))
    assert ids_after_bg == ["claude_code:old", "claude_code:recent"]
    s = handle.status()
    assert s.pending == 0
    assert s.processed == 2
