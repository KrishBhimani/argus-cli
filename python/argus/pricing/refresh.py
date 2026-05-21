"""Diff against current pricing and fetch the latest from LiteLLM."""
from __future__ import annotations

import datetime as dt
import json
from typing import Any, Callable

from pydantic import BaseModel

from .types import ModelPricing, PricingTable

LITELLM_URL = (
    "https://raw.githubusercontent.com/BerriAI/litellm/main/"
    "model_prices_and_context_window.json"
)


class PricingDiff(BaseModel):
    added: list[str]
    removed: list[str]
    changed: list[str]
    unchanged: list[str]


def diff_pricing(old: PricingTable, new: PricingTable) -> PricingDiff:
    """Return added / removed / changed / unchanged model-key sets."""
    old_keys = set(old.models.keys())
    new_keys = set(new.models.keys())

    added = sorted(new_keys - old_keys)
    removed = sorted(old_keys - new_keys)
    changed: list[str] = []
    unchanged: list[str] = []
    for k in new_keys & old_keys:
        a = old.models[k].model_dump()
        b = new.models[k].model_dump()
        if json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True):
            unchanged.append(k)
        else:
            changed.append(k)
    return PricingDiff(
        added=added,
        removed=removed,
        changed=sorted(changed),
        unchanged=sorted(unchanged),
    )


def fetch_litellm_table(
    url: str = LITELLM_URL,
    fetch: Callable[[str], dict[str, Any]] | None = None,
) -> PricingTable:
    """Fetch LiteLLM's per-token pricing JSON and convert to per-MTok shape.

    ``fetch`` is the network function; tests inject a stub so no real
    HTTPS is made. Default is httpx.
    """
    if fetch is None:
        import httpx  # local import — httpx is the runtime default

        def _fetch(u: str) -> dict[str, Any]:
            r = httpx.get(u, timeout=30.0)
            r.raise_for_status()
            return r.json()

        fetch = _fetch

    raw = fetch(url)
    models: dict[str, ModelPricing] = {}
    for k, v in raw.items():
        if k == "sample_spec":
            continue
        if not isinstance(v, dict) or "input_cost_per_token" not in v:
            continue
        input_ = (v.get("input_cost_per_token") or 0) * 1_000_000
        output = (v.get("output_cost_per_token") or 0) * 1_000_000
        cache_read = (v.get("cache_read_input_token_cost") or 0) * 1_000_000
        cache_write = (v.get("cache_creation_input_token_cost") or 0) * 1_000_000
        entry: dict[str, Any] = {
            "input": input_,
            "output": output,
            "cache_read": cache_read,
        }
        if cache_write:
            entry["cache_write_5m"] = cache_write
            entry["cache_write_1h"] = cache_write * 1.6
        models[k] = ModelPricing.model_validate(entry)
    return PricingTable(
        version=dt.datetime.now(dt.timezone.utc).date().isoformat(),
        models=models,
    )
