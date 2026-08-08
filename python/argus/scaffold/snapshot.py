"""Snapshot a project's .claude/ into a named user template (`template create`)."""
from __future__ import annotations

import shutil
from pathlib import Path

from .storage import (
    RESERVED_TEMPLATE_NAMES,
    user_templates_dir,
    validate_template_name,
)

# Never snapshot these — session/history/cache, or machine-local config.
_EXCLUDED_DIRS = {
    "projects", "todos", "shell-snapshots", "statsig", "logs", "ide",
    "__pycache__", ".DS_Store",
}
_EXCLUDED_TOP_FILE_SUFFIXES = (".local.json",)
_EXCLUDED_TOP_FILE_NAMES = {"history.jsonl"}
_COPY_IGNORE = shutil.ignore_patterns("__pycache__", "*.pyc", ".DS_Store")

# Credentials must never land in a template. A real ~/.claude/ holds
# `.credentials.json` (OAuth tokens) and `.env`, and `--path` defaults to `.`,
# so snapshotting from your home directory is both easy and inviting — the
# result then gets copied into every scaffolded project, which people commit.
_SECRET_FILE_NAMES = {".credentials.json", "credentials.json", ".env"}
# Substring match on the stem. Deliberately narrow: a heuristic that silently
# drops a file the user wanted is its own bug, which is why callers surface
# `secret_files_in()` to the user rather than omitting things quietly.
_SECRET_STEM_MARKERS = ("credential", "secret", "password", "api-key", "api_key", "apikey")
_SECRET_STEM_SUFFIXES = ("-token", "_token", "-key", "_key")


def is_secret_file(name: str) -> bool:
    """True if a filename looks like it carries a credential."""
    lower = name.lower()
    if lower in _SECRET_FILE_NAMES or lower.startswith(".env"):
        return True
    stem = lower.rsplit(".", 1)[0] if "." in lower else lower
    if any(m in stem for m in _SECRET_STEM_MARKERS):
        return True
    return any(stem.endswith(s) for s in _SECRET_STEM_SUFFIXES)


def secret_files_in(claude: Path) -> list[str]:
    """Top-level filenames under ``claude`` that snapshotting will withhold."""
    if not claude.is_dir():
        return []
    return sorted(
        p.name for p in claude.iterdir() if p.is_file() and is_secret_file(p.name)
    )


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
        # is_symlink() first: a link out of the tree must not have its target's
        # contents pulled in (shutil.copyfile dereferences).
        if p.is_symlink() or not p.is_file():
            continue
        if p.name in _EXCLUDED_TOP_FILE_NAMES:
            continue
        if any(p.name.endswith(s) for s in _EXCLUDED_TOP_FILE_SUFFIXES):
            continue
        if is_secret_file(p.name):
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
    validate_template_name(name)
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
