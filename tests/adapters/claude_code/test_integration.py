"""Real-fixture smoke test — opt-in via ARGUS_REAL_CLAUDE_ROOT env var.

Runs only when the env var points at a real ~/.claude/ directory. Skipped
otherwise so CI doesn't depend on machine-specific data.
"""
from __future__ import annotations

import os
from pathlib import Path

import pytest

from argus.adapters.claude_code.adapter import ClaudeCodeAdapter

_REAL_ROOT = os.environ.get("ARGUS_REAL_CLAUDE_ROOT")

pytestmark = pytest.mark.skipif(
    _REAL_ROOT is None,
    reason="ARGUS_REAL_CLAUDE_ROOT not set; skipping real-fixture tests",
)


def test_discovers_session_files_in_real_root():
    a = ClaudeCodeAdapter(Path(_REAL_ROOT))  # type: ignore[arg-type]
    files = a.discover_session_files()
    assert len(files) > 0


def test_ingests_real_session_with_low_parse_error_rate():
    a = ClaudeCodeAdapter(Path(_REAL_ROOT))  # type: ignore[arg-type]
    files = [f for f in a.discover_session_files() if "subagents" not in f.parts]
    assert files, "no top-level session files found"
    result, _ = a.ingest_file(files[0])
    line_count = len(result.turns) + len(result.parse_errors)
    if line_count > 0:
        error_rate = len(result.parse_errors) / line_count
        assert error_rate < 0.05, f"parse error rate {error_rate:.2%} >= 5%"
