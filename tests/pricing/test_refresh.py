"""LiteLLM pricing refresh."""
from __future__ import annotations

from argus.pricing.refresh import diff_pricing, fetch_litellm_table
from argus.pricing.types import ModelPricing, PricingTable


def test_diff_detects_added_removed_changed():
    old = PricingTable(
        version="a",
        models={
            "keep": ModelPricing(input=1, output=2, cache_read=0),
            "remove": ModelPricing(input=1, output=2, cache_read=0),
            "change": ModelPricing(input=1, output=2, cache_read=0),
        },
    )
    new = PricingTable(
        version="b",
        models={
            "keep": ModelPricing(input=1, output=2, cache_read=0),
            "change": ModelPricing(input=5, output=2, cache_read=0),
            "add": ModelPricing(input=1, output=2, cache_read=0),
        },
    )
    d = diff_pricing(old, new)
    assert d.added == ["add"]
    assert d.removed == ["remove"]
    assert d.changed == ["change"]
    assert d.unchanged == ["keep"]


def test_fetch_parses_litellm_json_into_per_mtok_shape():
    sample = {
        "claude-opus-4-7": {
            "input_cost_per_token": 0.000005,
            "output_cost_per_token": 0.000025,
            "cache_read_input_token_cost": 0.0000005,
            "cache_creation_input_token_cost": 0.00000625,
        },
        "gpt-5.3-codex": {
            "input_cost_per_token": 0.00000175,
            "output_cost_per_token": 0.000014,
            "cache_read_input_token_cost": 0.000000175,
        },
        "sample_spec": {},
    }

    def fake_fetch(url: str) -> dict:
        return sample

    t = fetch_litellm_table("https://x", fetch=fake_fetch)
    assert abs(t.models["claude-opus-4-7"].input - 5.0) < 1e-4
    assert abs(t.models["gpt-5.3-codex"].cache_read - 0.175) < 1e-4
    assert "sample_spec" not in t.models
