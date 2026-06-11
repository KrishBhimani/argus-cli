from argus.adapters.claude_code.extract_transcript import extract_transcript_segments
from argus.adapters.claude_code.schemas import AssistantLine, UserLine


def _mk_assistant(uuid: str, content, ts="2026-05-01T00:00:00Z") -> AssistantLine:
    return AssistantLine.model_validate(
        {
            "type": "assistant",
            "sessionId": "s1",
            "uuid": uuid,
            "timestamp": ts,
            "cwd": "/p",
            "message": {
                "id": "m-" + uuid,
                "model": "claude-opus-4-7",
                "role": "assistant",
                "content": content,
                "usage": {
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "cache_read_input_tokens": 0,
                    "cache_creation_input_tokens": 0,
                },
            },
        }
    )


def _mk_user(uuid: str, content, ts="2026-05-01T00:00:00Z") -> UserLine:
    return UserLine.model_validate(
        {
            "type": "user",
            "sessionId": "s1",
            "uuid": uuid,
            "timestamp": ts,
            "cwd": "/p",
            "message": {"role": "user", "content": content},
        }
    )


def test_emits_one_segment_per_text_block_block_index_preserved():
    segs = extract_transcript_segments(
        [
            _mk_assistant(
                "a1",
                [
                    {"type": "text", "text": "first paragraph"},
                    {"type": "tool_use", "id": "t1", "name": "Bash", "input": {"command": "ls"}},
                    {"type": "text", "text": "second paragraph"},
                ],
            )
        ],
        [],
    )
    assert len(segs) == 2
    assert segs[0].role == "assistant"
    assert segs[0].text == "first paragraph"
    assert segs[1].text == "second paragraph"
    # block_index reflects original content[] position (text=0, tool_use=1
    # skipped, text=2).
    assert segs[0].uid_suffix == "a1:0"
    assert segs[1].uid_suffix == "a1:2"


def test_emits_thinking_blocks_with_thinking_role():
    segs = extract_transcript_segments(
        [
            _mk_assistant(
                "a1",
                [
                    {"type": "thinking", "thinking": "reasoning here"},
                    {"type": "text", "text": "visible reply"},
                ],
            )
        ],
        [],
    )
    assert len(segs) == 2
    by_role = {s.role: s for s in segs}
    assert by_role["thinking"].text == "reasoning here"
    assert by_role["assistant"].text == "visible reply"


def test_skips_empty_text_blocks():
    segs = extract_transcript_segments(
        [_mk_assistant("a1", [{"type": "text", "text": ""}, {"type": "text", "text": "   "}, {"type": "text", "text": "real"}])],
        [],
    )
    assert len(segs) == 1
    assert segs[0].text == "real"


def test_user_string_content_emits_one_segment():
    segs = extract_transcript_segments([], [_mk_user("u1", "hi there")])
    assert len(segs) == 1
    assert segs[0].role == "user"
    assert segs[0].text == "hi there"
    assert segs[0].uid_suffix == "u1:0"


def test_user_tool_result_string_captured_under_tool_result_role():
    segs = extract_transcript_segments(
        [],
        [_mk_user("u1", [{"type": "tool_result", "tool_use_id": "t1", "content": "command output"}])],
    )
    assert len(segs) == 1
    assert segs[0].role == "tool_result"
    assert segs[0].text == "command output"


def test_user_tool_result_array_content_flattened():
    segs = extract_transcript_segments(
        [],
        [
            _mk_user(
                "u1",
                [
                    {
                        "type": "tool_result",
                        "tool_use_id": "t1",
                        "content": [
                            {"type": "text", "text": "line one"},
                            {"type": "text", "text": "line two"},
                        ],
                    }
                ],
            )
        ],
    )
    assert len(segs) == 1
    assert "line one" in segs[0].text
    assert "line two" in segs[0].text


def test_caps_oversized_text_at_16kb_with_ellipsis():
    huge = "x" * 50_000
    segs = extract_transcript_segments(
        [_mk_assistant("a1", [{"type": "text", "text": huge}])],
        [],
    )
    assert len(segs[0].text) < len(huge)
    assert segs[0].text.endswith("…")


def test_preserves_chronological_pairing_across_both_lists():
    a1 = _mk_assistant("a1", [{"type": "text", "text": "reply"}], ts="2026-05-01T00:00:01Z")
    u1 = _mk_user("u1", "question", ts="2026-05-01T00:00:00Z")
    segs = extract_transcript_segments([a1], [u1])
    by_role = {s.role: s for s in segs}
    assert by_role["user"].timestamp == "2026-05-01T00:00:00Z"
    assert by_role["assistant"].timestamp == "2026-05-01T00:00:01Z"


def test_tool_result_segments_carry_tool_use_id():
    segs = extract_transcript_segments(
        [_mk_assistant("a1", [{"type": "text", "text": "reply"}])],
        [
            _mk_user(
                "u1",
                [
                    {
                        "type": "tool_result",
                        "tool_use_id": "toolu_abc",
                        "is_error": True,
                        "content": "FAILED: assertion error",
                    }
                ],
            )
        ],
    )
    by_role = {s.role: s for s in segs}
    assert by_role["tool_result"].tool_use_id == "toolu_abc"
    # Non-tool_result segments never carry a tool_use_id.
    assert by_role["assistant"].tool_use_id is None
