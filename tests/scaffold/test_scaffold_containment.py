"""Scaffolding must read and write only inside its intended directories.

Two findings, both in the `argus claude` path:

* docs/SECURITY_AUDIT_2026-07-31.md #7 -- `scaffold_project` resolved its
  destination with plain `dest / rel` and wrote with `shutil.copyfile`, which
  follows symlinks. Worse, the "already exists, skip it" guard is
  `target.exists()`, and that **also** follows: a *dangling* symlink reports
  False, so the guard never fires and copyfile writes through the link,
  creating whatever it points at -- no `--force` required.

* docs/SECURITY_FIXES.md #3 (raised against 0.2.0, never implemented) --
  template names are pasted straight into a path, so `--template ../../x`
  reads a "template" from anywhere on disk and `template create ../../x`
  writes outside the template store.

Threat model note: the attacker here is not the user typing the command, it is
whoever authored the *repository the user ran it in*. Cloning a hostile repo
and running `argus claude init` is an ordinary thing to do.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

from argus.scaffold.scaffolder import scaffold_project
from argus.scaffold.snapshot import snapshot_template
from argus.scaffold.storage import resolve_template


def _template(tmp_path: Path) -> Path:
    """A minimal template dir: CLAUDE.md + .claude/settings.json."""
    t = tmp_path / "tpl"
    (t / ".claude").mkdir(parents=True)
    (t / "CLAUDE.md").write_text("# template\n", encoding="utf-8")
    (t / ".claude" / "settings.json").write_text('{"tpl":true}\n', encoding="utf-8")
    return t


def _try_symlink(link: Path, target: Path) -> None:
    try:
        link.symlink_to(target)
    except (OSError, NotImplementedError) as exc:  # pragma: no cover - env dependent
        pytest.skip(f"symlinks not permitted here: {exc}")


def _junction(link: Path, target: Path) -> None:
    """Windows directory junction — works without the symlink privilege."""
    rc = subprocess.run(
        ["cmd", "/c", "mklink", "/J", str(link), str(target)], capture_output=True
    )
    if rc.returncode != 0:  # pragma: no cover - env dependent
        pytest.skip(f"could not create junction: {rc.stdout!r}")


# --- #7: writes must stay inside dest ---------------------------------------


def test_scaffold_does_not_write_through_a_dangling_symlink(tmp_path: Path):
    """The severe case: no --force needed, because exists() follows the link."""
    tpl = _template(tmp_path)
    dest = tmp_path / "proj"
    (dest / ".claude").mkdir(parents=True)
    victim = tmp_path / "authorized_keys"  # deliberately does NOT exist
    _try_symlink(dest / ".claude" / "settings.json", victim)

    scaffold_project(tpl, dest, force=False)

    assert not victim.exists(), "scaffold created a file outside dest via a symlink"


def test_scaffold_does_not_overwrite_through_a_symlink_with_force(tmp_path: Path):
    tpl = _template(tmp_path)
    dest = tmp_path / "proj"
    (dest / ".claude").mkdir(parents=True)
    victim = tmp_path / "precious.txt"
    victim.write_text("ORIGINAL", encoding="utf-8")
    _try_symlink(dest / ".claude" / "settings.json", victim)

    scaffold_project(tpl, dest, force=True)

    assert victim.read_text(encoding="utf-8") == "ORIGINAL", "symlink was followed"


@pytest.mark.skipif(sys.platform != "win32", reason="junctions are Windows-only")
def test_scaffold_does_not_write_into_a_junctioned_subdir(tmp_path: Path):
    """Directory reparse points need no privilege on Windows."""
    tpl = _template(tmp_path)
    dest = tmp_path / "proj"
    dest.mkdir()
    outside = tmp_path / "outside"
    outside.mkdir()
    _junction(dest / ".claude", outside)

    scaffold_project(tpl, dest, force=True)

    assert not (outside / "settings.json").exists(), "wrote through a junction"


def test_normal_scaffold_still_works(tmp_path: Path):
    """Fail-closed must not mean fail-always."""
    tpl = _template(tmp_path)
    dest = tmp_path / "proj"

    result = scaffold_project(tpl, dest, force=False)

    assert (dest / "CLAUDE.md").read_text(encoding="utf-8") == "# template\n"
    assert (dest / ".claude" / "settings.json").exists()
    assert len(result.created) == 2


def test_existing_claude_md_is_still_never_overwritten(tmp_path: Path):
    tpl = _template(tmp_path)
    dest = tmp_path / "proj"
    dest.mkdir()
    (dest / "CLAUDE.md").write_text("MINE", encoding="utf-8")

    scaffold_project(tpl, dest, force=True)

    assert (dest / "CLAUDE.md").read_text(encoding="utf-8") == "MINE"


# --- 0.2.0 #3: template names must not escape the store ----------------------


@pytest.mark.parametrize(
    "bad", ["../evil", "../../evil", "a/b", "a\\b", "..", ".", "", "  ", "e/../../x"]
)
def test_resolve_template_rejects_path_like_names(tmp_path: Path, bad: str):
    with pytest.raises((ValueError, KeyError)):
        resolve_template(bad, tmp_path)


@pytest.mark.parametrize("bad", ["../evil", "../../evil", "a/b", "a\\b", "..", "."])
def test_snapshot_template_rejects_path_like_names(tmp_path: Path, bad: str):
    project = tmp_path / "proj"
    (project / ".claude").mkdir(parents=True)
    (project / ".claude" / "settings.json").write_text("{}", encoding="utf-8")

    with pytest.raises(ValueError):
        snapshot_template(project, bad, tmp_path, include_subdirs=[])

    assert not (tmp_path.parent / "evil").exists()


def test_snapshot_template_accepts_ordinary_names(tmp_path: Path):
    project = tmp_path / "proj"
    (project / ".claude").mkdir(parents=True)
    (project / ".claude" / "settings.json").write_text("{}", encoding="utf-8")

    target = snapshot_template(project, "my-team_v2.1", tmp_path, include_subdirs=[])

    assert target.is_dir()
    assert (target / ".claude" / "settings.json").exists()
