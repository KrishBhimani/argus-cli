"""Copy a template directory into a project — the `argus claude init` core."""
from __future__ import annotations

import os
import shutil
from dataclasses import dataclass, field
from pathlib import Path

# CLAUDE.md is the user's project brain — never overwrite it, even with --force.
_CLAUDE_MD = "CLAUDE.md"


def _resolves_inside(target: Path, root: Path) -> bool:
    """True if ``target`` canonicalises to ``root`` or below it.

    ``resolve()`` follows every symlink and NTFS junction on the path —
    including the final component, and including a *dangling* link — which is
    exactly what we need. ``shutil.copyfile`` writes *through* a symlink, and
    the caller's ``target.exists()`` guard follows one too (so a dangling link
    reports "doesn't exist" and then gets created on write). Comparing
    canonical paths is the only check that catches all of those.
    """
    try:
        resolved = target.resolve()
    except (OSError, RuntimeError):
        return False
    a = os.path.normcase(str(resolved))
    b = os.path.normcase(str(root))
    return a == b or a.startswith(b + os.sep)


@dataclass
class ScaffoldResult:
    created: list[Path] = field(default_factory=list)
    skipped: list[tuple[Path, str]] = field(default_factory=list)  # (path, reason)


def scaffold_project(
    template_dir: Path, dest: Path, *, force: bool = False
) -> ScaffoldResult:
    """Copy every file under ``template_dir`` into ``dest``, preserving layout.

    - A template file at ``CLAUDE.md`` lands at ``dest/CLAUDE.md``; everything
      else (all under ``.claude/``) lands at ``dest/.claude/...``.
    - An existing destination file is skipped unless ``force`` is set.
    - ``CLAUDE.md`` is NEVER overwritten, even with ``force``.
    """
    result = ScaffoldResult()
    dest_root = dest.resolve()
    for src in sorted(p for p in template_dir.rglob("*") if p.is_file()):
        rel = src.relative_to(template_dir)
        target = dest / rel
        is_claude_md = rel.as_posix() == _CLAUDE_MD

        # Never write outside the destination. A hostile repo can ship
        # `.claude/` as a symlink/junction, or `.claude/settings.json` as a
        # link to ~/.ssh/authorized_keys; cloning it and running
        # `argus claude init` would otherwise write through that link.
        if not _resolves_inside(target, dest_root):
            result.skipped.append((target, "would write outside the project"))
            continue

        if target.exists():
            if is_claude_md:
                result.skipped.append((target, "CLAUDE.md exists, left untouched"))
                continue
            if not force:
                result.skipped.append((target, "exists"))
                continue

        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, target)
        result.created.append(target)
    return result
