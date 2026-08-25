from argus.adapters.claude_code.extract_turns import extract_turns
from argus.adapters.claude_code.schemas import AssistantLine
from tests.conftest import assistant_line


def _mk(msg_id: str, seq: int, usage=None, content_type="text") -> AssistantLine:
    return AssistantLine.model_validate(assistant_line(msg_id, seq, usage, content_type))


def test_dedupes_by_message_id():
    turns = extract_turns([_mk("m1", 0), _mk("m1", 1), _mk("m2", 2)])
    assert len(turns) == 2
    assert turns[0].native_turn_id == "m1"
    assert turns[1].native_turn_id == "m2"


def test_counts_tool_use_blocks_across_deduped_lines():
    a = _mk("m1", 0, content_type="text")
    b_raw = assistant_line("m1", 1)
    b_raw["message"]["content"] = [{"type": "tool_use", "id": "t1", "name": "Bash"}]
    b = AssistantLine.model_validate(b_raw)
    turns = extract_turns([a, b])
    assert len(turns) == 1
    assert turns[0].tool_calls_count == 1


def test_output_tokens_come_from_the_final_streamed_line():
    # REGRESSION: Claude Code appends one line per content block while a reply
    # streams. The early lines carry the API's `message_start` placeholder
    # usage (a handful of output tokens); only the final line (stop_reason set)
    # has the real count. Taking the first line under-counted output by ~13%
    # on real transcripts. Input/cache fields are identical across the group.
    def usage(out: int) -> dict:
        return {
            "input_tokens": 2,
            "output_tokens": out,
            "cache_read_input_tokens": 10_026,
            "cache_creation_input_tokens": 7_887,
        }

    thinking = _mk("m1", 0, usage=usage(7), content_type="thinking")
    text = _mk("m1", 1, usage=usage(7), content_type="text")
    final_raw = assistant_line("m1", 2, usage=usage(642))
    final_raw["message"]["content"] = [{"type": "tool_use", "id": "t1", "name": "Bash"}]
    final_raw["message"]["stop_reason"] = "tool_use"
    final = AssistantLine.model_validate(final_raw)

    turns = extract_turns([thinking, text, final])
    assert len(turns) == 1
    assert turns[0].output_tokens == 642
    assert turns[0].fresh_input_tokens == 2
    assert turns[0].cache_read_tokens == 10_026
    assert turns[0].cache_write_tokens == 7_887


def test_maps_cache_fields_correctly():
    usage = {
        "input_tokens": 100,
        "output_tokens": 200,
        "cache_read_input_tokens": 50,
        "cache_creation_input_tokens": 30,
    }
    turns = extract_turns([_mk("m1", 0, usage=usage)])
    assert turns[0].fresh_input_tokens == 100
    assert turns[0].cache_read_tokens == 50
    assert turns[0].cache_write_tokens == 30


def test_extracts_5m_and_1h_breakdown_when_present():
    line = assistant_line("m1", 0)
    line["message"]["usage"] = {
        "input_tokens": 100,
        "output_tokens": 200,
        "cache_read_input_tokens": 50,
        "cache_creation_input_tokens": 10,
        "cache_creation": {
            "ephemeral_5m_input_tokens": 7,
            "ephemeral_1h_input_tokens": 3,
        },
    }
    turns = extract_turns([AssistantLine.model_validate(line)])
    assert turns[0].cache_write_5m_tokens == 7
    assert turns[0].cache_write_1h_tokens == 3
