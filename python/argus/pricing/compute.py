"""Per-turn cost computation."""
from __future__ import annotations

from typing import Any

from .types import PricingTable

PER_MTOK = 1_000_000


def compute_turn_cost(t: Any, table: PricingTable) -> float:
    """Compute the USD cost for one turn given a pricing table.

    ``t`` is duck-typed — it must expose ``model``, ``fresh_input_tokens``,
    ``output_tokens``, ``cache_read_tokens``, ``cache_write_tokens``,
    ``cache_write_5m_tokens``, ``cache_write_1h_tokens``. Both
    pydantic models (RawTurnEvent, Turn) and plain dicts work via
    ``getattr`` / dict access.
    """
    def g(name: str, default: Any = None) -> Any:
        if isinstance(t, dict):
            return t.get(name, default)
        return getattr(t, name, default)

    model = g("model")
    p = table.models.get(model)
    if p is None:
        return 0.0

    cw5 = p.cache_write_5m if p.cache_write_5m is not None else p.input
    cw1 = p.cache_write_1h if p.cache_write_1h is not None else p.input

    cw5_tokens = g("cache_write_5m_tokens")
    cw1_tokens = g("cache_write_1h_tokens")

    if cw5_tokens is not None and cw1_tokens is not None:
        write_tier = (cw5_tokens * cw5 + cw1_tokens * cw1) / PER_MTOK
    else:
        write_tier = (g("cache_write_tokens", 0) * cw5) / PER_MTOK

    return (
        (g("fresh_input_tokens", 0) * p.input) / PER_MTOK
        + (g("output_tokens", 0) * p.output) / PER_MTOK
        + (g("cache_read_tokens", 0) * p.cache_read) / PER_MTOK
        + write_tier
    )
