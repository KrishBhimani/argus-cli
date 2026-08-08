"""Discover Claude Code session JSONL files under ``~/.claude/``.

Path-safety rules:

- Realpath every candidate; reject anything that doesn't canonicalize
  under the claude root (defends against a hostile symlink pointing at
  ``/etc/passwd``).
- On Windows, lowercase the comparison since the filesystem is
  case-insensitive but Python string equality isn't.
"""
from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

logger = logging.getLogger(__name__)

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


def sub_agent_files_for(session_file: Path, claude_root: Path) -> list[Path]:
    """Return the sub-agent transcript JSONLs for a session.

    Two on-disk layouts coexist under ``<session_dir>/<sid>/subagents/``:

    - **Flat** (plain Task/Agent sub-agents): ``subagents/*.jsonl``.
    - **Nested** (Workflow sub-agents): each workflow run gets its own
      directory, ``subagents/workflows/<wf-id>/agent-*.jsonl``. Only the
      ``agent-*.jsonl`` files are real transcripts — ``journal.jsonl`` is
      workflow bookkeeping (no turns) and ``*.meta.json`` are sidecars, so
      neither matches and both are excluded.

    Matching is an allowlist (known transcript shapes) rather than "every
    ``.jsonl``", so a future bookkeeping file can never be mistaken for a
    sub-session and inflate the parent's rollup. The tripwire below means
    that if Claude Code changes the naming and we start matching nothing,
    it's logged rather than silently under-counting.
    """
    sid = session_file.stem  # filename without .jsonl
    sub = session_file.parent / sid / "subagents"
    if not sub.exists():
        return []
    try:
        canonical_root = claude_root.resolve(strict=True)
    except (OSError, RuntimeError):
        return []
    out: set[Path] = set()
    # Flat transcripts directly under subagents/ (dirs like workflows/ have
    # no .jsonl suffix, so they're skipped here).
    out.update(f for f in sub.iterdir() if f.is_file() and f.suffix == ".jsonl")
    # Nested Workflow sub-agent transcripts, any depth below subagents/.
    out.update(f for f in sub.rglob("agent-*.jsonl") if f.is_file())
    # Same containment rule as discover_session_files: a symlink planted in
    # subagents/ must not turn into an arbitrary file read. (rglob does not
    # follow directory symlinks, but a symlinked *file* still resolves out.)
    dropped = {f for f in out if _safe_realpath_under(f, canonical_root) is None}
    for f in sorted(dropped):
        logger.warning(
            "skipping sub-agent transcript that escapes the claude root: %s", f
        )
    out -= dropped

    if not out and any(c.is_dir() for c in sub.iterdir()):
        # subagents/ has subdirectories but nothing matched — the layout
        # likely changed. Surface it instead of quietly reporting zero.
        logger.warning(
            "subagents/ for %s contains subdirectories but no recognized "
            "transcript files matched; sub-agent layout may have changed",
            session_file.name,
        )
    return sorted(out)


def workflow_record_files_for(session_file: Path, claude_root: Path) -> list[Path]:
    """Return the workflow run records for a session.

    Records live at ``<session_dir>/<sid>/workflows/wf_*.json`` — a *sibling*
    of ``subagents/``, not inside it. ``glob`` (not ``rglob``) is deliberate:
    ``workflows/scripts/`` holds the orchestration source, which is already
    inlined in each record's ``script`` field and must never be read as a
    record. Same containment rule as everywhere else — a symlink planted here
    must not become an arbitrary file read.
    """
    sid = session_file.stem
    wf_dir = session_file.parent / sid / "workflows"
    if not wf_dir.is_dir():
        return []
    try:
        canonical_root = claude_root.resolve(strict=True)
    except (OSError, RuntimeError):
        return []
    out: list[Path] = []
    for f in wf_dir.glob("wf_*.json"):
        if not f.is_file():
            continue
        if _safe_realpath_under(f, canonical_root) is None:
            logger.warning(
                "skipping workflow record that escapes the claude root: %s", f
            )
            continue
        out.append(f)
    return sorted(out)
