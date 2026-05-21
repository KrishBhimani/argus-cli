from pathlib import Path

from argus.adapters.claude_code.adapter import ClaudeCodeAdapter


def test_exposes_agent_name_and_root_path(tmp_path: Path):
    a = ClaudeCodeAdapter(tmp_path / ".claude")
    assert a.agent == "claude_code"
    # Resolve handles symlinks consistently on every platform.
    assert a.root_path() == (tmp_path / ".claude").resolve(strict=False)
