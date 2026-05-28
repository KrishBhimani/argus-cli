"""Copy a template directory into a project — the `argus claude init` core."""
from __future__ import annotations

import shutil
from dataclasses import dataclass, field
from pathlib import Path

# CLAUDE.md is the user's project brain — never overwrite it, even with --force.
_CLAUDE_MD = "CLAUDE.md"


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
    for src in sorted(p for p in template_dir.rglob("*") if p.is_file()):
        rel = src.relative_to(template_dir)
        target = dest / rel
        is_claude_md = rel.as_posix() == _CLAUDE_MD

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
