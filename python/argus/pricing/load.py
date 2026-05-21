"""Load the bundled pricing JSON shipped inside the wheel."""
from __future__ import annotations

import json
from importlib import resources
from pathlib import Path

from .types import PricingTable

_DEFAULT_FILENAME = "2026-05-02.json"


def _bundled_dir() -> Path:
    """Path of the bundled ``pricing/`` directory.

    Works in:
    - installed wheel (data shipped alongside the package as argus/pricing/)
    - editable install (`uv pip install -e .`)
    - dev `uv run` from the repo (pricing/ at repo root)

    The in-wheel path coincides with the source layout's ``argus/pricing``
    subpackage (which has its own ``__init__.py``). We only trust that
    location if the expected JSON actually lives there — otherwise we fall
    back to the repo-root ``pricing/`` directory.
    """
    # In-wheel location: only trust it if the expected file is present.
    try:
        traversable = resources.files("argus") / "pricing"
        candidate = Path(str(traversable))
        if (candidate / _DEFAULT_FILENAME).exists():
            return candidate
    except (ModuleNotFoundError, FileNotFoundError):
        pass

    # Dev fallback: repo-root pricing/.
    # python/argus/pricing/load.py → parents[3] is the repo root.
    here = Path(__file__).resolve()
    return here.parents[3] / "pricing"


def load_pricing_table(path: Path | None = None) -> PricingTable:
    """Read a pricing JSON from disk and parse it."""
    p = path or (_bundled_dir() / _DEFAULT_FILENAME)
    raw = p.read_text(encoding="utf-8")
    return PricingTable.model_validate(json.loads(raw))
