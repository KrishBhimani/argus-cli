"""Two-tier template storage: bundled (read-only) + user (~/.argus/templates)."""
from __future__ import annotations

from pathlib import Path

import pytest

from argus.scaffold import storage


def _make_template(root: Path, name: str) -> Path:
    d = root / name / ".claude"
    d.mkdir(parents=True)
    (d / "settings.json").write_text("{}", encoding="utf-8")
    return root / name


def test_bundled_dir_resolves_to_real_default(tmp_path: Path):
    # In dev/test the bundled dir is the repo-root templates/, which Task 1 seeded.
    bundled = storage.bundled_templates_dir()
    assert (bundled / "default" / "CLAUDE.md").is_file()


def test_user_templates_dir_is_under_data_dir(tmp_path: Path):
    assert storage.user_templates_dir(tmp_path) == tmp_path / "templates"


def test_list_templates_includes_bundled_default(tmp_path: Path):
    names = storage.list_templates(tmp_path)
    assert "default" in names


def test_list_templates_merges_and_sorts_user_templates(tmp_path: Path):
    _make_template(tmp_path / "templates", "zeta")
    _make_template(tmp_path / "templates", "alpha")
    names = storage.list_templates(tmp_path)
    assert names == sorted(names)
    assert {"alpha", "zeta", "default"}.issubset(set(names))


def test_resolve_prefers_user_over_bundled(tmp_path: Path):
    user_default = _make_template(tmp_path / "templates", "mine")
    assert storage.resolve_template("mine", tmp_path) == user_default


def test_resolve_falls_back_to_bundled(tmp_path: Path):
    resolved = storage.resolve_template("default", tmp_path)
    assert (resolved / "CLAUDE.md").is_file()


def test_resolve_unknown_raises_keyerror(tmp_path: Path):
    with pytest.raises(KeyError):
        storage.resolve_template("does-not-exist", tmp_path)


def test_reserved_names_contains_default():
    assert "default" in storage.RESERVED_TEMPLATE_NAMES
