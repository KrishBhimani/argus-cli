import json

from argus.adapters.claude_code.extract_tool_calls import extract_tool_calls
from argus.adapters.claude_code.schemas import AssistantLine, UserLine
from tests.conftest import assistant_line, user_tool_result


def _mk_assistant(msg_id: str, seq: int, content: list) -> AssistantLine:
    line = assistant_line(msg_id, seq)
    line["message"]["content"] = content
    return AssistantLine.model_validate(line)


def _mk_user(tool_use_id: str, is_error: bool, seq: int) -> UserLine:
    return UserLine.model_validate(user_tool_result(tool_use_id, is_error, seq))


def test_emits_one_row_per_tool_use_block():
    a = _mk_assistant(
        "m1",
        0,
        [
            {"type": "tool_use", "id": "t1", "name": "Bash", "input": {"command": "ls"}},
            {"type": "text", "text": "between"},
            {"type": "tool_use", "id": "t2", "name": "Edit", "input": {"file_path": "/x", "old_string": "a", "new_string": "b"}},
        ],
    )
    calls = extract_tool_calls([a], [])
    assert len(calls) == 2
    assert calls[0].tool_name == "Bash"
    assert calls[0].tool_use_id == "t1"
    assert calls[1].tool_name == "Edit"
    assert calls[1].tool_use_id == "t2"
    # block_index reflects position within content[], skipping non-tool_use.
    assert calls[0].block_index == 0
    assert calls[1].block_index == 1


def test_subagent_type_only_for_task_tool():
    a = _mk_assistant(
        "m1",
        0,
        [
            {"type": "tool_use", "id": "t1", "name": "Bash", "input": {"command": "ls"}},
            {"type": "tool_use", "id": "t2", "name": "Task", "input": {"subagent_type": "Explore", "prompt": "find x"}},
            {"type": "tool_use", "id": "t3", "name": "Read", "input": {"file_path": "/x"}},
        ],
    )
    calls = extract_tool_calls([a], [])
    assert calls[0].subagent_type is None
    assert calls[1].subagent_type == "Explore"
    assert calls[2].subagent_type is None


def test_attributes_is_error_from_matching_tool_result():
    a = _mk_assistant(
        "m1",
        0,
        [
            {"type": "tool_use", "id": "t1", "name": "Bash", "input": {"command": "fail"}},
            {"type": "tool_use", "id": "t2", "name": "Bash", "input": {"command": "ok"}},
        ],
    )
    u_lines = [_mk_user("t1", True, 1), _mk_user("t2", False, 2)]
    calls = extract_tool_calls([a], u_lines)
    by_id = {c.tool_use_id: c for c in calls}
    assert by_id["t1"].is_error == 1
    assert by_id["t2"].is_error == 0


def test_defaults_is_error_to_zero_when_no_tool_result():
    a = _mk_assistant("m1", 0, [{"type": "tool_use", "id": "orphan", "name": "Bash", "input": {}}])
    calls = extract_tool_calls([a], [])
    assert calls[0].is_error == 0


def test_mcp_tool_name_passes_through():
    a = _mk_assistant(
        "m1",
        0,
        [{"type": "tool_use", "id": "t1", "name": "mcp__context7__query-docs", "input": {"q": "react"}}],
    )
    calls = extract_tool_calls([a], [])
    assert calls[0].tool_name == "mcp__context7__query-docs"


def test_input_size_uses_compact_json_length():
    a = _mk_assistant(
        "m1",
        0,
        [{"type": "tool_use", "id": "t1", "name": "Bash", "input": {"command": "echo hi"}}],
    )
    calls = extract_tool_calls([a], [])
    assert calls[0].input_size == len(json.dumps({"command": "echo hi"}, separators=(",", ":")))


def test_dedupes_by_message_id_across_split_lines():
    a = _mk_assistant("m1", 0, [{"type": "tool_use", "id": "t1", "name": "Bash", "input": {}}])
    b = _mk_assistant("m1", 1, [{"type": "tool_use", "id": "t2", "name": "Edit", "input": {}}])
    calls = extract_tool_calls([a, b], [])
    assert len(calls) == 2
    assert sorted(c.tool_name for c in calls) == ["Bash", "Edit"]
    assert {c.turn_index for c in calls} == {0}
