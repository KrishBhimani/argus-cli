"""Ingest must refuse any path that escapes the Claude root.

Regression guard for docs/SECURITY_AUDIT_2026-07-31.md #4. ``discover_session_files``
already realpath-checked its candidates, but two live paths did not:

  * ``sub_agent_files_for()`` globbed ``subagents/`` with no check at all, so a
    symlink planted at ``<sid>/subagents/agent-x.jsonl`` was read verbatim; and
  * the watcher hands the pipeline whatever path fired an fs event.

Either way the bytes land in ``parse_errors``, which ``GET /api/parse-errors``
serves back out over HTTP -- an arbitrary-file-read primitive.

The fix puts the check at the single choke point every read passes through
(``ClaudeCodeAdapter.ingest_file``) rather than at each caller, so a new call
site cannot silently reopen the hole.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

from argus.adapters.claude_code.adapter import ClaudeCodeAdapter
from argus.adapters.claude_code.discover import sub_agent_files_for

SECRET = '{"secret":"id_rsa contents"}\n'


def _mk_root(tmp_path: Path) -> tuple[Path, Path]:
    """Build a ~/.claude-shaped tree; return (claude_root, project_dir)."""
    root = tmp_path / ".claude"
    proj = root / "projects" / "p"
    proj.mkdir(parents=True)
    return root, proj


def _try_symlink(link: Path, target: Path) -> None:
    """Create a symlink or skip — Windows needs admin/developer mode."""
    try:
        link.symlink_to(target)
    except (OSError, NotImplementedError) as exc:  # pragma: no cover - env dependent
        pytest.skip(f"symlinks not permitted here: {exc}")


def test_ingest_refuses_a_path_outside_the_claude_root(tmp_path: Path):
    """The cross-platform core of the guard: no symlink required."""
    root, _ = _mk_root(tmp_path)
    outside = tmp_path / "secrets.jsonl"
    outside.write_text(SECRET, encoding="utf-8")

    adapter = ClaudeCodeAdapter(root)
    result, offset = adapter.ingest_file(outside, 0)

    assert result.turns == []
    assert result.parse_errors == []
    assert offset == 0, "must not advance the offset for a rejected file"


def test_ingest_refuses_a_symlink_that_escapes_the_root(tmp_path: Path):
    root, proj = _mk_root(tmp_path)
    outside = tmp_path / "id_rsa"
    outside.write_text(SECRET, encoding="utf-8")
    _try_symlink(proj / "leak.jsonl", outside)

    adapter = ClaudeCodeAdapter(root)
    result, _ = adapter.ingest_file(proj / "leak.jsonl", 0)

    assert result.turns == []
    assert result.parse_errors == [], "secret bytes must not reach parse_errors"


def test_sub_agent_discovery_drops_escaping_symlinks(tmp_path: Path):
    root, proj = _mk_root(tmp_path)
    session = proj / "s1.jsonl"
    session.write_text("", encoding="utf-8")
    subs = proj / "s1" / "subagents"
    subs.mkdir(parents=True)

    legit = subs / "agent-real.jsonl"
    legit.write_text("", encoding="utf-8")
    outside = tmp_path / "id_rsa"
    outside.write_text(SECRET, encoding="utf-8")
    _try_symlink(subs / "agent-evil.jsonl", outside)

    found = sub_agent_files_for(session, root)

    assert legit in found
    assert not any(f.name == "agent-evil.jsonl" for f in found)


def test_sub_agent_discovery_still_finds_normal_files(tmp_path: Path):
    """The guard must not break the ordinary flat + nested layouts."""
    root, proj = _mk_root(tmp_path)
    session = proj / "s1.jsonl"
    session.write_text("", encoding="utf-8")
    subs = proj / "s1" / "subagents"
    (subs / "workflows" / "wf1").mkdir(parents=True)
    (subs / "agent-flat.jsonl").write_text("", encoding="utf-8")
    (subs / "workflows" / "wf1" / "agent-nested.jsonl").write_text("", encoding="utf-8")
    (subs / "workflows" / "wf1" / "journal.jsonl").write_text("", encoding="utf-8")

    names = {f.name for f in sub_agent_files_for(session, root)}

    assert names == {"agent-flat.jsonl", "agent-nested.jsonl"}, (
        "journal.jsonl is bookkeeping and must stay excluded"
    )


@pytest.mark.skipif(sys.platform != "win32", reason="NTFS junctions are Windows-only")
def test_ingest_refuses_a_windows_junction_that_escapes_the_root(tmp_path: Path):
    """Directory junctions are the Windows reparse point that needs no admin.

    Unlike ``os.symlink`` (which needs a privilege the CI/dev account usually
    lacks, so those tests skip), ``mklink /J`` works unprivileged — making this
    the case a Windows attacker would actually reach for.
    """
    root, proj = _mk_root(tmp_path)
    subs = proj / "s1" / "subagents"
    subs.mkdir(parents=True)
    (proj / "s1.jsonl").write_text("", encoding="utf-8")
    (subs / "agent-real.jsonl").write_text("", encoding="utf-8")
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "agent-evil.jsonl").write_text(SECRET, encoding="utf-8")

    rc = subprocess.run(
        ["cmd", "/c", "mklink", "/J", str(subs / "linked"), str(outside)],
        capture_output=True,
    )
    if rc.returncode != 0:  # pragma: no cover - env dependent
        pytest.skip(f"could not create junction: {rc.stdout!r} {rc.stderr!r}")

    found = sub_agent_files_for(proj / "s1.jsonl", root)
    assert {f.name for f in found} == {"agent-real.jsonl"}

    adapter = ClaudeCodeAdapter(root)
    result, offset = adapter.ingest_file(subs / "linked" / "agent-evil.jsonl", 0)
    assert result.turns == []
    assert result.parse_errors == []
    assert offset == 0


def test_legitimate_file_inside_the_root_still_ingests(tmp_path: Path):
    """Fail-closed must not mean fail-always."""
    root, proj = _mk_root(tmp_path)
    good = proj / "s1.jsonl"
    good.write_text('{"type":"user","message":{"role":"user","content":"hi"}}\n', encoding="utf-8")

    adapter = ClaudeCodeAdapter(root)
    _, offset = adapter.ingest_file(good, 0)

    assert offset > 0, "a real file under the root must be read"
