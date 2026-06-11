"""Load the bundled pricing JSON shipped inside the wheel."""
from __future__ import annotations

import json
from importlib import resources
from pathlib import Path

from .types import PricingTable

def _latest_table_file(d: Path) -> Path:
    """Newest pricing file in ``d`` — versions are ISO dates, so lexicographic
    max is chronological max. `argus pricing refresh` writes {version}.json;
    picking the latest here is what makes a refresh actually take effect."""
    candidates = sorted(d.glob("*.json"))
    if not candidates:
        raise FileNotFoundError(f"no pricing tables in {d}")
    return candidates[-1]


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
    # In-wheel location: only trust it if a pricing table is present.
    try:
        traversable = resources.files("argus") / "pricing"
        candidate = Path(str(traversable))
        if any(candidate.glob("*.json")):
            return candidate
    except (ModuleNotFoundError, FileNotFoundError):
        pass

    # Dev fallback: repo-root pricing/.
    # python/argus/pricing/load.py → parents[3] is the repo root.
    here = Path(__file__).resolve()
    return here.parents[3] / "pricing"


def load_pricing_table(path: Path | None = None) -> PricingTable:
    """Read a pricing JSON from disk and parse it. With no explicit path,
    loads the newest table in the bundled dir (refreshes write new files)."""
    p = path or _latest_table_file(_bundled_dir())
    raw = p.read_text(encoding="utf-8")
    return PricingTable.model_validate(json.loads(raw))
