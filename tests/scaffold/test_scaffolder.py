"""scaffold_project copies a template into a project with skip/force rules."""
from __future__ import annotations

from pathlib import Path

from argus.scaffold.scaffolder import ScaffoldResult, scaffold_project


def _make_template(root: Path) -> Path:
    tpl = root / "tpl"
    (tpl / ".claude" / "agents").mkdir(parents=True)
    (tpl / "CLAUDE.md").write_text("template claude md", encoding="utf-8")
    (tpl / ".claude" / "settings.json").write_text('{"a":1}', encoding="utf-8")
    (tpl / ".claude" / "agents" / "code-reviewer.md").write_text("reviewer", encoding="utf-8")
    return tpl


def test_copies_all_files_into_project(tmp_path: Path):
    tpl = _make_template(tmp_path)
    dest = tmp_path / "proj"
    dest.mkdir()
    result = scaffold_project(tpl, dest, force=False)

    assert (dest / "CLAUDE.md").read_text(encoding="utf-8") == "template claude md"
    assert (dest / ".claude" / "settings.json").read_text(encoding="utf-8") == '{"a":1}'
    assert (dest / ".claude" / "agents" / "code-reviewer.md").is_file()
    assert isinstance(result, ScaffoldResult)
    assert len(result.created) == 3
    assert result.skipped == []


def test_claude_md_lands_at_root_not_under_dotclaude(tmp_path: Path):
    tpl = _make_template(tmp_path)
    dest = tmp_path / "proj"
    dest.mkdir()
    scaffold_project(tpl, dest, force=False)
    assert (dest / "CLAUDE.md").is_file()
    assert not (dest / ".claude" / "CLAUDE.md").exists()


def test_skips_existing_files_without_force(tmp_path: Path):
    tpl = _make_template(tmp_path)
    dest = tmp_path / "proj"
    (dest / ".claude").mkdir(parents=True)
    (dest / ".claude" / "settings.json").write_text("MINE", encoding="utf-8")

    result = scaffold_project(tpl, dest, force=False)

    assert (dest / ".claude" / "settings.json").read_text(encoding="utf-8") == "MINE"
    skipped_names = {p.name for p, _ in result.skipped}
    assert "settings.json" in skipped_names


def test_force_overwrites_existing_non_claude_files(tmp_path: Path):
    tpl = _make_template(tmp_path)
    dest = tmp_path / "proj"
    (dest / ".claude").mkdir(parents=True)
    (dest / ".claude" / "settings.json").write_text("MINE", encoding="utf-8")

    scaffold_project(tpl, dest, force=True)

    assert (dest / ".claude" / "settings.json").read_text(encoding="utf-8") == '{"a":1}'


def test_claude_md_never_overwritten_even_with_force(tmp_path: Path):
    tpl = _make_template(tmp_path)
    dest = tmp_path / "proj"
    dest.mkdir()
    (dest / "CLAUDE.md").write_text("USER BRAIN", encoding="utf-8")

    result = scaffold_project(tpl, dest, force=True)

    assert (dest / "CLAUDE.md").read_text(encoding="utf-8") == "USER BRAIN"
    reasons = {p.name: reason for p, reason in result.skipped}
    assert "CLAUDE.md" in reasons
    assert "left untouched" in reasons["CLAUDE.md"]
