"""End-to-end CLI behavior for the `argus claude` command tree."""
from __future__ import annotations

from pathlib import Path

from typer.testing import CliRunner

from argus.cli import app

runner = CliRunner()


def test_init_scaffolds_default_into_dir(tmp_path: Path):
    proj = tmp_path / "proj"
    proj.mkdir()
    result = runner.invoke(
        app, ["claude", "init", str(proj), "--data-dir", str(tmp_path / "data")]
    )
    assert result.exit_code == 0, result.output
    assert (proj / "CLAUDE.md").is_file()
    assert (proj / ".claude" / "settings.json").is_file()
    assert (proj / ".claude" / "agents" / "code-reviewer.md").is_file()
    assert "created" in result.output


def test_init_skips_existing_and_protects_claude_md(tmp_path: Path):
    proj = tmp_path / "proj"
    proj.mkdir()
    (proj / "CLAUDE.md").write_text("USER BRAIN", encoding="utf-8")
    result = runner.invoke(
        app,
        ["claude", "init", str(proj), "--force", "--data-dir", str(tmp_path / "data")],
    )
    assert result.exit_code == 0, result.output
    assert (proj / "CLAUDE.md").read_text(encoding="utf-8") == "USER BRAIN"
    assert "left untouched" in result.output


def test_init_unknown_template_errors_with_list(tmp_path: Path):
    proj = tmp_path / "proj"
    proj.mkdir()
    result = runner.invoke(
        app,
        ["claude", "init", str(proj), "--template", "nope",
         "--data-dir", str(tmp_path / "data")],
    )
    assert result.exit_code == 1
    assert "Unknown template" in result.output
    assert "default" in result.output  # lists what's available


def test_template_list_shows_default(tmp_path: Path):
    result = runner.invoke(
        app, ["claude", "template", "list", "--data-dir", str(tmp_path / "data")]
    )
    assert result.exit_code == 0
    assert "default" in result.output


def test_template_create_then_list_roundtrip(tmp_path: Path):
    # Build a project with a .claude/ to snapshot.
    proj = tmp_path / "proj"
    (proj / ".claude" / "agents").mkdir(parents=True)
    (proj / ".claude" / "settings.json").write_text("{}", encoding="utf-8")
    (proj / ".claude" / "agents" / "a.md").write_text("x", encoding="utf-8")
    data = tmp_path / "data"

    created = runner.invoke(
        app,
        ["claude", "template", "create", "mine",
         "--path", str(proj), "--all", "--data-dir", str(data)],
    )
    assert created.exit_code == 0, created.output
    assert (data / "templates" / "mine" / ".claude" / "agents" / "a.md").is_file()

    listed = runner.invoke(
        app, ["claude", "template", "list", "--data-dir", str(data)]
    )
    assert "mine" in listed.output


def test_template_create_default_is_blocked(tmp_path: Path):
    proj = tmp_path / "proj"
    (proj / ".claude").mkdir(parents=True)
    (proj / ".claude" / "settings.json").write_text("{}", encoding="utf-8")
    result = runner.invoke(
        app,
        ["claude", "template", "create", "default",
         "--path", str(proj), "--all", "--data-dir", str(tmp_path / "data")],
    )
    assert result.exit_code == 1
    assert "reserved" in result.output


def test_template_create_per_folder_prompt(tmp_path: Path):
    # Without --all, the picker asks per subfolder. Answer y for agents, n for commands.
    proj = tmp_path / "proj"
    (proj / ".claude" / "agents").mkdir(parents=True)
    (proj / ".claude" / "commands").mkdir(parents=True)
    (proj / ".claude" / "agents" / "a.md").write_text("x", encoding="utf-8")
    (proj / ".claude" / "commands" / "c.md").write_text("y", encoding="utf-8")
    data = tmp_path / "data"

    result = runner.invoke(
        app,
        ["claude", "template", "create", "picked", "--path", str(proj),
         "--data-dir", str(data)],
        input="y\nn\n",  # candidates are sorted: agents -> y, commands -> n
    )
    assert result.exit_code == 0, result.output
    assert (data / "templates" / "picked" / ".claude" / "agents").is_dir()
    assert not (data / "templates" / "picked" / ".claude" / "commands").exists()
