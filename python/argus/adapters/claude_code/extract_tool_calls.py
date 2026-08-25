"""Extract one RawToolCall per tool_use block."""
from __future__ import annotations

import json

from ..base import RawToolCall
from .schemas import AssistantLine, UserLine


# The sub-agent tool was called "Task" in early Claude Code and is "Agent" now;
# both carry the chosen agent in input.subagent_type.
_SUBAGENT_TOOLS = frozenset({"Task", "Agent"})


def _safe_json_length(v: object) -> int:
    """Length of JSON-stringified ``v``, matching JS ``JSON.stringify`` byte count."""
    try:
        # Compact separators reproduce JS default JSON.stringify output
        # (no whitespace), so input_size stays consistent with the TS impl.
        return len(json.dumps(v, separators=(",", ":")))
    except (TypeError, ValueError):
        return 0


def extract_tool_calls(
    assistant_lines: list[AssistantLine],
    user_lines: list[UserLine],
) -> list[RawToolCall]:
    """Emit one RawToolCall per tool_use block; attribute is_error from results."""
    # 1) Build tool_use_id → is_error from tool_result blocks in user messages.
    error_map: dict[str, bool] = {}
    for u in user_lines:
        content = u.message.content
        if not isinstance(content, list):
            continue
        for block in content:
            if not isinstance(block, dict):
                continue
            if block.get("type") != "tool_result":
                continue
            tool_use_id = block.get("tool_use_id")
            if not isinstance(tool_use_id, str):
                continue
            is_err_raw = block.get("is_error", False)
            flag = is_err_raw is True or is_err_raw == "true"
            error_map[tool_use_id] = flag

    # 2) Group assistant lines by message.id, preserve order.
    by_id: dict[str, list[AssistantLine]] = {}
    order: list[str] = []
    for line in assistant_lines:
        mid = line.message.id
        if mid not in by_id:
            by_id[mid] = []
            order.append(mid)
        by_id[mid].append(line)

    # 3) Emit one RawToolCall per tool_use block.
    out: list[RawToolCall] = []
    turn_index = 0
    for mid in order:
        group = by_id[mid]
        block_index = 0
        for line in group:
            for block in line.message.content:
                if block.get("type") != "tool_use":
                    continue
                inp = block.get("input") or {}
                name = block.get("name") or ""
                use_id = block.get("id") or ""
                subagent = (
                    inp.get("subagent_type")
                    if name in _SUBAGENT_TOOLS and isinstance(inp, dict) and isinstance(inp.get("subagent_type"), str)
                    else None
                )
                out.append(
                    RawToolCall(
                        native_turn_id=mid,
                        turn_index=turn_index,
                        block_index=block_index,
                        tool_name=name,
                        tool_use_id=use_id,
                        is_error=1 if error_map.get(use_id) else 0,
                        input_size=_safe_json_length(inp),
                        subagent_type=subagent,
                        timestamp=line.timestamp,
                    )
                )
                block_index += 1
        turn_index += 1
    return out
