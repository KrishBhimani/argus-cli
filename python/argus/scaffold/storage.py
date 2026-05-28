"""Locate and resolve `argus claude` project-scaffolding templates.

Two tiers:
- bundled templates ship inside the wheel (read-only), mirroring ``pricing/``.
- user templates live under ``~/.argus/templates/<name>/`` (read-write).

``resolve_template`` checks the user dir first, then bundled.
"""
from __future__ import annotations

from importlib import resources
from pathlib import Path

RESERVED_TEMPLATE_NAMES = {"default"}


def bundled_templates_dir() -> Path:
    """Path of the bundled ``templates/`` dir (in-wheel, else repo-root in dev)."""
    try:
        traversable = resources.files("argus") / "templates"
        candidate = Path(str(traversable))
        if (candidate / "default" / "CLAUDE.md").exists():
            return candidate
    except (ModuleNotFoundError, FileNotFoundError):
        pass
    # Dev fallback: repo-root templates/.
    # python/argus/scaffold/storage.py -> parents[3] is the repo root.
    return Path(__file__).resolve().parents[3] / "templates"


def user_templates_dir(data_dir: Path) -> Path:
    """Path of the user template store (``~/.argus/templates`` by default)."""
    return data_dir / "templates"


def _subdir_names(d: Path) -> list[str]:
    if not d.is_dir():
        return []
    return sorted(p.name for p in d.iterdir() if p.is_dir())


def list_templates(data_dir: Path) -> list[str]:
    """All available template names: bundled ∪ user, sorted and de-duped."""
    names = set(_subdir_names(bundled_templates_dir()))
    names.update(_subdir_names(user_templates_dir(data_dir)))
    return sorted(names)


def resolve_template(name: str, data_dir: Path) -> Path:
    """Return the directory for ``name``, preferring user templates.

    Raises ``KeyError`` if no template with that name exists in either tier.
    """
    user = user_templates_dir(data_dir) / name
    if user.is_dir():
        return user
    bundled = bundled_templates_dir() / name
    if bundled.is_dir():
        return bundled
    raise KeyError(name)
