"""Discover Claude Code session JSONL files under ``~/.claude/``.

Path-safety rules:

- Realpath every candidate; reject anything that doesn't canonicalize
  under the claude root (defends against a hostile symlink pointing at
  ``/etc/passwd``).
- On Windows, lowercase the comparison since the filesystem is
  case-insensitive but Python string equality isn't.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

_IS_WIN = sys.platform == "win32"


def _norm(p: str) -> str:
    return p.lower() if _IS_WIN else p


def _safe_realpath_under(candidate: Path, canonical_root: Path) -> Path | None:
    """Return resolved path if it's the root or a descendant, else None."""
    try:
        resolved = candidate.resolve(strict=True)
    except (OSError, RuntimeError):
        return None
    a = _norm(str(resolved))
    b = _norm(str(canonical_root))
    if a == b:
        return resolved
    if a.startswith(b + os.sep):
        return resolved
    return None


def discover_session_files(claude_root: Path) -> list[Path]:
    """Find every top-level session JSONL under ``~/.claude/projects/*/``.

    Sub-agent files inside ``<sid>/subagents/`` are intentionally excluded;
    they're rolled up under their parent session by the pipeline.
    """
    projects_dir = claude_root / "projects"
    if not projects_dir.exists():
        return []
    try:
        canonical_root = claude_root.resolve(strict=True)
    except (OSError, RuntimeError):
        return []

    out: list[Path] = []
    for proj in projects_dir.iterdir():
        if not proj.is_dir():
            continue
        for f in proj.iterdir():
            if f.suffix != ".jsonl":
                continue
            safe = _safe_realpath_under(f, canonical_root)
            if safe is not None:
                out.append(f)
    return out


def sub_agent_files_for(session_file: Path) -> list[Path]:
    """Return ``<session_dir>/<sid>/subagents/*.jsonl`` if it exists."""
    sid = session_file.stem  # filename without .jsonl
    sub = session_file.parent / sid / "subagents"
    if not sub.exists():
        return []
    return sorted(f for f in sub.iterdir() if f.suffix == ".jsonl")
