"""Build per-turn records from a session's assistant lines."""
from __future__ import annotations

from ...schema.types import RawTurnEvent
from .model import canonicalize_claude_model
from .schemas import AssistantLine


def extract_turns(lines: list[AssistantLine]) -> list[RawTurnEvent]:
    """Group assistant lines by message.id, emit one RawTurnEvent per group.

    A single message can be split across multiple JSONL lines (one per
    content block in some Claude Code versions) — all sharing message.id.
    We preserve first-seen order and walk every line in the group.
    """
    by_id: dict[str, list[AssistantLine]] = {}
    order: list[str] = []
    for line in lines:
        mid = line.message.id
        if mid not in by_id:
            by_id[mid] = []
            order.append(mid)
        by_id[mid].append(line)

    turns: list[RawTurnEvent] = []
    seq = 0
    for mid in order:
        group = by_id[mid]
        first = group[0]
        usage = first.message.usage
        cache_5m = (
            usage.cache_creation.ephemeral_5m_input_tokens
            if usage.cache_creation is not None
            else None
        )
        cache_1h = (
            usage.cache_creation.ephemeral_1h_input_tokens
            if usage.cache_creation is not None
            else None
        )
        tool_calls = sum(
            sum(1 for b in line.message.content if b.get("type") == "tool_use")
            for line in group
        )

        turns.append(
            RawTurnEvent(
                native_turn_id=mid,
                sequence=seq,
                timestamp=first.timestamp,
                model=canonicalize_claude_model(first.message.model),
                model_raw=first.message.model,
                fresh_input_tokens=usage.input_tokens,
                output_tokens=usage.output_tokens,
                cache_read_tokens=usage.cache_read_input_tokens,
                cache_write_tokens=usage.cache_creation_input_tokens,
                cache_write_5m_tokens=cache_5m,
                cache_write_1h_tokens=cache_1h,
                tool_calls_count=tool_calls,
                metadata={
                    "service_tier": usage.service_tier,
                    "agentId": first.agentId,
                    "attribution_agent": first.attribution_agent,
                    "isSidechain": first.isSidechain if first.isSidechain is not None else False,
                },
            )
        )
        seq += 1
    return turns
