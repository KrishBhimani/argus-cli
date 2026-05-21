from argus.collector.rollup_subagents import rollup_subagents
from argus.schema.types import Session


def _base(sid: str, **overrides) -> Session:
    defaults = dict(
        id=sid,
        agent="claude_code",
        agent_version="2.1.94",
        project_path="/p",
        started_at="t0",
        ended_at="t1",
        duration_sec=0,
        total_fresh_input_tokens=0,
        total_output_tokens=0,
        total_cache_read_tokens=0,
        total_cache_write_tokens=0,
        total_cost_usd=0.0,
        primary_model="claude-opus-4-7",
        turn_count=0,
        pricing_table_version="v",
        computed_at="c",
        agent_reported_cost_usd=None,
        metadata={},
    )
    defaults.update(overrides)
    return Session(**defaults)


def test_sums_subagent_totals_into_parent():
    parent = _base("claude_code:p", total_fresh_input_tokens=100, total_output_tokens=200, total_cost_usd=1, turn_count=2)
    sub1 = _base("claude_code:p/sub1", total_fresh_input_tokens=50, total_output_tokens=75, total_cost_usd=0.5, turn_count=1)
    sub2 = _base("claude_code:p/sub2", total_fresh_input_tokens=10, total_output_tokens=20, total_cost_usd=0.1, turn_count=1)
    merged = rollup_subagents(parent, [sub1, sub2])
    assert merged.total_fresh_input_tokens == 160
    assert merged.total_output_tokens == 295
    assert abs(merged.total_cost_usd - 1.6) < 1e-4
    assert merged.turn_count == 4
    assert merged.metadata["sub_agent_session_ids"] == ["claude_code:p/sub1", "claude_code:p/sub2"]
