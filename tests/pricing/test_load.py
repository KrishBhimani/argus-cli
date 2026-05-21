"""Bundled pricing-table load."""
from __future__ import annotations

from argus.pricing.load import load_pricing_table


def test_loads_bundled_pricing_json():
    t = load_pricing_table()
    assert t.version == "2026-05-02"
    assert t.models["claude-opus-4-7"].input == 5
    assert t.models["gpt-5.3-codex"].output == 14


def test_unknown_model_lookup_returns_none():
    t = load_pricing_table()
    assert "fake-model" not in t.models
