from argus.adapters.claude_code.schemas import AssistantLine, UserLine


def test_parses_assistant_line_with_usage():
    line = {
        "type": "assistant",
        "sessionId": "s1",
        "uuid": "u1",
        "timestamp": "2026-05-01T00:00:00Z",
        "cwd": "C:/proj",
        "version": "2.1.94",
        "userType": "external",
        "entrypoint": "cli",
        "message": {
            "id": "msg_abc",
            "model": "claude-opus-4-7",
            "role": "assistant",
            "content": [
                {"type": "text", "text": "..."},
                {"type": "tool_use", "id": "t1", "name": "Bash", "input": {}},
            ],
            "stop_reason": "end_turn",
            "usage": {
                "input_tokens": 10,
                "output_tokens": 20,
                "cache_read_input_tokens": 5,
                "cache_creation_input_tokens": 2,
            },
        },
    }
    parsed = AssistantLine.model_validate(line)
    assert parsed.message.usage.input_tokens == 10


def test_accepts_assistant_line_with_cache_creation_tier_breakdown():
    line = {
        "type": "assistant",
        "sessionId": "s1",
        "uuid": "u1",
        "timestamp": "2026-05-01T00:00:00Z",
        "cwd": "C:/proj",
        "version": "2.1.121",
        "userType": "external",
        "entrypoint": "cli",
        "message": {
            "id": "msg_abc",
            "model": "claude-opus-4-7",
            "role": "assistant",
            "content": [],
            "usage": {
                "input_tokens": 10,
                "output_tokens": 20,
                "cache_read_input_tokens": 5,
                "cache_creation_input_tokens": 7,
                "cache_creation": {
                    "ephemeral_5m_input_tokens": 4,
                    "ephemeral_1h_input_tokens": 3,
                },
            },
        },
    }
    AssistantLine.model_validate(line)  # must not raise


def test_parses_user_line():
    line = {
        "type": "user",
        "sessionId": "s1",
        "uuid": "u1",
        "timestamp": "2026-05-01T00:00:00Z",
        "cwd": "C:/proj",
        "version": "2.1.94",
        "userType": "external",
        "entrypoint": "cli",
        "message": {"role": "user", "content": "hello"},
    }
    UserLine.model_validate(line)  # must not raise


def test_passthrough_preserves_unknown_fields():
    line = {
        "type": "assistant",
        "sessionId": "s1",
        "uuid": "u1",
        "timestamp": "2026-05-01T00:00:00Z",
        "cwd": "C:/proj",
        "version": "2.1.94",
        "userType": "external",
        "entrypoint": "cli",
        "attribution_agent": "general-purpose",
        "isSidechain": True,
        "agentId": "a-xyz",
        "message": {
            "id": "msg",
            "model": "claude-opus-4-7",
            "role": "assistant",
            "content": [],
            "usage": {"input_tokens": 1, "output_tokens": 1},
        },
    }
    parsed = AssistantLine.model_validate(line)
    assert parsed.attribution_agent == "general-purpose"
