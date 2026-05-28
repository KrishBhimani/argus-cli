"""snapshot_template saves a project's .claude/ into a named user template."""
from __future__ import annotations

from pathlib import Path

import pytest

from argus.scaffold.snapshot import snapshot_candidates, snapshot_template


def _make_project(root: Path) -> Path:
    proj = root / "proj"
    claude = proj / ".claude"
    (claude / "agents").mkdir(parents=True)
    (claude / "commands").mkdir(parents=True)
    (claude / "projects" / "C--foo").mkdir(parents=True)  # session junk
    (claude / "settings.json").write_text("{}", encoding="utf-8")
    (claude / "settings.local.json").write_text("{}", encoding="utf-8")  # machine-local
    (claude / "agents" / "a.md").write_text("agent", encoding="utf-8")
    (claude / "commands" / "c.md").write_text("cmd", encoding="utf-8")
    (claude / "projects" / "C--foo" / "s.jsonl").write_text("{}", encoding="utf-8")
    return proj


def test_candidates_exclude_session_dirs(tmp_path: Path):
    proj = _make_project(tmp_path)
    cands = snapshot_candidates(proj)
    assert "agents" in cands
    assert "commands" in cands
    assert "projects" not in cands  # session junk excluded


def test_candidates_empty_when_no_dotclaude(tmp_path: Path):
    assert snapshot_candidates(tmp_path / "nope") == []


def test_snapshot_copies_picked_subdirs_and_safe_top_files(tmp_path: Path):
    proj = _make_project(tmp_path)
    target = snapshot_template(
        proj, "mine", tmp_path / "data", include_subdirs=["agents"]
    )
    assert target == tmp_path / "data" / "templates" / "mine"
    assert (target / ".claude" / "agents" / "a.md").is_file()
    assert (target / ".claude" / "settings.json").is_file()
    # Not picked, and machine-local / session files never copied:
    assert not (target / ".claude" / "commands").exists()
    assert not (target / ".claude" / "settings.local.json").exists()
    assert not (target / ".claude" / "projects").exists()


def test_snapshot_rejects_reserved_name(tmp_path: Path):
    proj = _make_project(tmp_path)
    with pytest.raises(ValueError, match="reserved"):
        snapshot_template(proj, "default", tmp_path / "data", include_subdirs=[])


def test_snapshot_rejects_existing_template(tmp_path: Path):
    proj = _make_project(tmp_path)
    snapshot_template(proj, "mine", tmp_path / "data", include_subdirs=[])
    with pytest.raises(ValueError, match="already exists"):
        snapshot_template(proj, "mine", tmp_path / "data", include_subdirs=[])


def test_snapshot_rejects_missing_dotclaude(tmp_path: Path):
    (tmp_path / "empty").mkdir()
    with pytest.raises(ValueError, match="no .claude"):
        snapshot_template(tmp_path / "empty", "mine", tmp_path / "data", include_subdirs=[])
