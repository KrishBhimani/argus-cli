"""Bundled pricing-table load."""
from __future__ import annotations

import json

from argus.pricing.load import _latest_table_file, load_pricing_table


def test_loads_bundled_pricing_json():
    t = load_pricing_table()
    assert t.version == "2026-06-12"
    assert t.models["claude-opus-4-7"].input == 5
    assert t.models["gpt-5.3-codex"].output == 14


def test_unknown_model_lookup_returns_none():
    t = load_pricing_table()
    assert "fake-model" not in t.models


def test_bundled_table_prices_fable_and_opus_48():
    t = load_pricing_table()
    fable = t.models["claude-fable-5"]
    assert (fable.input, fable.output) == (10, 50)
    assert fable.cache_write_5m == 12.5
    assert fable.cache_write_1h == 20
    assert fable.cache_read == 1.0
    opus = t.models["claude-opus-4-8"]
    assert (opus.input, opus.output) == (5, 25)
    assert opus.cache_read == 0.50
    # Mythos 5 is the same model under a different id — same prices.
    assert t.models["claude-mythos-5"].input == 10


def test_latest_table_file_picks_newest_version(tmp_path):
    """`argus pricing refresh` writes {version}.json — the loader must pick
    the newest file, not a hardcoded name, or refreshes never take effect."""
    for name in ("2026-05-02.json", "2026-07-01.json", "2026-06-12.json"):
        (tmp_path / name).write_text(
            json.dumps({"version": name.removesuffix(".json"), "models": {}}),
            encoding="utf-8",
        )
    assert _latest_table_file(tmp_path).name == "2026-07-01.json"
