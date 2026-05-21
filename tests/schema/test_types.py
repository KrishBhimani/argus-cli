"""Pydantic model construction smoke tests.

TS uses ``expectTypeOf`` (compile-time). Python equivalent is runtime
construction — assert the models accept the shape we expect and round-trip
through model_dump.
"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from argus.schema.types import NormalizedCacheFields, Session, Turn


def test_session_has_all_required_fields():
    s = Session(
        id="claude_code:abc",
        agent="claude_code",
        agent_version="2.1.94",
        project_path="C:/proj",
        started_at="2026-05-01T10:00:00Z",
        ended_at="2026-05-01T11:00:00Z",
        duration_sec=3600,
        total_fresh_input_tokens=100,
        total_output_tokens=200,
        total_cache_read_tokens=50,
        total_cache_write_tokens=10,
        total_cost_usd=0.5,
        primary_model="claude-opus-4-7",
        turn_count=5,
        pricing_table_version="2026-05-02",
        computed_at="2026-05-02T00:00:00Z",
        agent_reported_cost_usd=None,
        metadata={},
    )
    assert isinstance(s.agent, str)
    assert s.model_dump()["id"] == "claude_code:abc"


def test_session_round_trips_through_model_dump_json():
    s = Session(
        id="claude_code:x",
        agent="claude_code",
        agent_version=None,
        project_path="/p",
        started_at="t",
        ended_at=None,
        duration_sec=None,
        primary_model="claude-opus-4-7",
        pricing_table_version="v",
        computed_at="c",
        agent_reported_cost_usd=None,
        metadata={"foo": "bar"},
    )
    j = s.model_dump_json()
    s2 = Session.model_validate_json(j)
    assert s2 == s


def test_normalized_cache_fields_allows_codex_zero_write():
    c = NormalizedCacheFields(
        fresh_input_tokens=100,
        cache_read_tokens=20,
        cache_write_tokens=0,
        cache_write_5m_tokens=None,
        cache_write_1h_tokens=None,
    )
    assert c.cache_write_tokens == 0
    assert c.cache_write_5m_tokens is None


def test_turn_model_validation_rejects_obviously_bad_input():
    with pytest.raises(ValidationError):
        Turn.model_validate({"id": "x"})  # missing nearly all required fields
