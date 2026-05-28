"""Snapshot a project's .claude/ into a named user template (`template create`)."""
from __future__ import annotations

import shutil
from pathlib import Path

from .storage import RESERVED_TEMPLATE_NAMES, user_templates_dir

# Never snapshot these — session/history/cache, or machine-local config.
_EXCLUDED_DIRS = {
    "projects", "todos", "shell-snapshots", "statsig", "logs", "ide",
    "__pycache__", ".DS_Store",
}
_EXCLUDED_TOP_FILE_SUFFIXES = (".local.json",)
_EXCLUDED_TOP_FILE_NAMES = {"history.jsonl"}
_COPY_IGNORE = shutil.ignore_patterns("__pycache__", "*.pyc", ".DS_Store")


def snapshot_candidates(project_dir: Path) -> list[str]:
    """Subfolder names under ``project_dir/.claude/`` eligible for snapshotting."""
    claude = project_dir / ".claude"
    if not claude.is_dir():
        return []
    return sorted(
        p.name
        for p in claude.iterdir()
        if p.is_dir() and p.name not in _EXCLUDED_DIRS
    )


def _safe_top_files(claude: Path) -> list[Path]:
    out: list[Path] = []
    for p in claude.iterdir():
        if not p.is_file():
            continue
        if p.name in _EXCLUDED_TOP_FILE_NAMES:
            continue
        if any(p.name.endswith(s) for s in _EXCLUDED_TOP_FILE_SUFFIXES):
            continue
        out.append(p)
    return out


def snapshot_template(
    project_dir: Path, name: str, data_dir: Path, *, include_subdirs: list[str]
) -> Path:
    """Copy chosen ``.claude/`` subfolders + safe top-level files into a template.

    Raises ``ValueError`` if ``name`` is reserved, the template already exists,
    or there is no ``.claude/`` directory to snapshot. Returns the new template dir.
    """
    if name in RESERVED_TEMPLATE_NAMES:
        raise ValueError(f"'{name}' is reserved, pick another name")
    claude = project_dir / ".claude"
    if not claude.is_dir():
        raise ValueError(f"no .claude/ directory found in {project_dir}")

    target_root = user_templates_dir(data_dir) / name
    if target_root.exists():
        raise ValueError(
            f"template '{name}' already exists; delete it or choose another name"
        )

    dest_claude = target_root / ".claude"
    dest_claude.mkdir(parents=True)

    for f in _safe_top_files(claude):
        shutil.copyfile(f, dest_claude / f.name)
    for sub in include_subdirs:
        src = claude / sub
        if src.is_dir():
            shutil.copytree(src, dest_claude / sub, ignore=_COPY_IGNORE)
    return target_root
