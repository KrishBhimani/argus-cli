"""Roll sub-agent session totals up into the parent."""
from __future__ import annotations

from ..schema.types import Session


def rollup_subagents(parent: Session, subs: list[Session]) -> Session:
    if not subs:
        return parent
    fresh = parent.total_fresh_input_tokens + sum(s.total_fresh_input_tokens for s in subs)
    out = parent.total_output_tokens + sum(s.total_output_tokens for s in subs)
    cr = parent.total_cache_read_tokens + sum(s.total_cache_read_tokens for s in subs)
    cw = parent.total_cache_write_tokens + sum(s.total_cache_write_tokens for s in subs)
    cost = parent.total_cost_usd + sum(s.total_cost_usd for s in subs)
    turns = parent.turn_count + sum(s.turn_count for s in subs)
    metadata = {**parent.metadata, "sub_agent_session_ids": [s.id for s in subs]}
    return parent.model_copy(
        update={
            "total_fresh_input_tokens": fresh,
            "total_output_tokens": out,
            "total_cache_read_tokens": cr,
            "total_cache_write_tokens": cw,
            "total_cost_usd": cost,
            "turn_count": turns,
            "metadata": metadata,
        }
    )
