from argus.adapters.base import AdapterIngestResult
from argus.collector.aggregate import aggregate_adapter_result
from argus.pricing.types import ModelPricing, PricingTable
from argus.schema.types import RawSessionHeader, RawTurnEvent


def _table() -> PricingTable:
    return PricingTable(
        version="2026-05-02",
        models={
            "claude-opus-4-7": ModelPricing(
                input=5, output=25, cache_write_5m=6.25, cache_write_1h=10, cache_read=0.50
            )
        },
    )


def _header(sid: str = "s1") -> RawSessionHeader:
    return RawSessionHeader(
        native_session_id=sid,
        agent="claude_code",
        agent_version="2.1.94",
        project_path="/p",
        started_at="t0",
        ended_at="t1",
        agent_reported_cost_usd=None,
        metadata={},
    )


def _turn(msg: str, sequence: int, model: str, fresh: int, output: int) -> RawTurnEvent:
    return RawTurnEvent(
        native_turn_id=msg,
        sequence=sequence,
        timestamp=f"t{sequence}",
        model=model,
        model_raw=model,
        fresh_input_tokens=fresh,
        output_tokens=output,
        cache_read_tokens=0,
        cache_write_tokens=0,
        cache_write_5m_tokens=None,
        cache_write_1h_tokens=None,
        tool_calls_count=0,
        metadata={},
    )


def test_rolls_up_turn_totals_into_session():
    result = AdapterIngestResult(
        header=_header(),
        turns=[
            _turn("m1", 0, "claude-opus-4-7", 1_000_000, 0),
            _turn("m2", 1, "claude-opus-4-7", 0, 1_000_000),
        ],
        parse_errors=[],
    )
    session, turns = aggregate_adapter_result(result, _table())
    assert session.id == "claude_code:s1"
    assert session.total_fresh_input_tokens == 1_000_000
    assert session.total_output_tokens == 1_000_000
    assert abs(session.total_cost_usd - (5 + 25)) < 1e-4
    assert session.primary_model == "claude-opus-4-7"
    assert session.turn_count == 2
    assert len(turns) == 2
    assert turns[0].id == "claude_code:s1:m1"


def test_picks_primary_model_by_input_plus_output_tokens():
    result = AdapterIngestResult(
        header=_header(),
        turns=[
            _turn("a", 0, "claude-opus-4-7", 100, 100),
            _turn("b", 1, "claude-haiku-4-5", 1000, 1000),
        ],
        parse_errors=[],
    )
    session, _ = aggregate_adapter_result(result, _table())
    assert session.primary_model == "claude-haiku-4-5"
