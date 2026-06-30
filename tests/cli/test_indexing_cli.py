"""The transcript-indexing command group: new `indexing` name + hidden `search` alias."""
from __future__ import annotations

from pathlib import Path

from typer.testing import CliRunner

from argus.cli import app

runner = CliRunner()


def test_indexing_is_the_listed_command_name():
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0, result.output
    # The group is presented under its new name.
    assert "indexing" in result.output


def test_indexing_status_runs_and_emits_no_rename_note(tmp_path: Path):
    result = runner.invoke(
        app, ["indexing", "status", "--data-dir", str(tmp_path / "data")]
    )
    assert result.exit_code == 0, result.output
    assert "Status:" in result.output
    # Invoked under the primary name -> no deprecation nudge.
    assert "renamed" not in result.output


def test_search_alias_still_works_and_nudges_to_indexing(tmp_path: Path):
    """The old `search` name keeps working for existing scripts/muscle memory,
    but prints a one-line pointer to the new name."""
    result = runner.invoke(
        app, ["search", "status", "--data-dir", str(tmp_path / "data")]
    )
    assert result.exit_code == 0, result.output
    assert "Status:" in result.output
    assert "renamed to `argus indexing`" in result.output


def test_indexing_enable_then_status_reports_enabled(tmp_path: Path):
    data = str(tmp_path / "data")
    enabled = runner.invoke(app, ["indexing", "enable", "--data-dir", data])
    assert enabled.exit_code == 0, enabled.output
    status = runner.invoke(app, ["indexing", "status", "--data-dir", data])
    assert status.exit_code == 0, status.output
    assert "ENABLED" in status.output
