import json
from pathlib import Path

from argus.adapters.claude_code.ingest_file import ingest_claude_code_file


def _jsonl(lines: list[dict]) -> str:
    return "\n".join(json.dumps(l) for l in lines) + "\n"


def _assistant(uid: str, msg_id: str) -> dict:
    return {
        "type": "assistant",
        "sessionId": "s1",
        "uuid": uid,
        "timestamp": "2026-05-01T00:00:00Z",
        "cwd": "C:/proj",
        "version": "2.1.94",
        "userType": "external",
        "entrypoint": "cli",
        "message": {
            "id": msg_id,
            "model": "claude-opus-4-7",
            "role": "assistant",
            "content": [],
            "usage": {
                "input_tokens": 10,
                "output_tokens": 20,
                "cache_read_input_tokens": 0,
                "cache_creation_input_tokens": 0,
            },
        },
    }


def test_parses_fresh_file_from_offset_zero(tmp_path: Path):
    f = tmp_path / "s1.jsonl"
    f.write_text(_jsonl([_assistant("u1", "m1"), _assistant("u2", "m2")]), encoding="utf-8")
    result, new_offset = ingest_claude_code_file(f)
    assert len(result.turns) == 2
    assert new_offset > 0
    assert len(result.parse_errors) == 0


def test_respects_from_offset_and_parses_only_new_tail(tmp_path: Path):
    f = tmp_path / "s1.jsonl"
    f.write_text(_jsonl([_assistant("u1", "m1")]), encoding="utf-8")
    _, off1 = ingest_claude_code_file(f)
    with f.open("a", encoding="utf-8") as fp:
        fp.write(_jsonl([_assistant("u2", "m2")]))
    result, _ = ingest_claude_code_file(f, off1)
    assert len(result.turns) == 1
    assert result.turns[0].native_turn_id == "m2"


def test_records_parse_error_for_malformed_line(tmp_path: Path):
    f = tmp_path / "s1.jsonl"
    f.write_text(
        json.dumps(_assistant("u1", "m1")) + "\n{ broken json\n" + json.dumps(_assistant("u2", "m2")) + "\n",
        encoding="utf-8",
    )
    result, _ = ingest_claude_code_file(f)
    assert len(result.turns) == 2
    assert len(result.parse_errors) == 1


def test_preserves_partial_trailing_line(tmp_path: Path):
    f = tmp_path / "s1.jsonl"
    f.write_text(json.dumps(_assistant("u1", "m1")) + "\n" + '{"type":"assist', encoding="utf-8")
    _, off1 = ingest_claude_code_file(f)
    with f.open("a", encoding="utf-8") as fp:
        fp.write(
            'ant","sessionId":"s1","uuid":"u2","timestamp":"2026-05-01T00:00:00Z",'
            '"cwd":"C:/proj","message":{"id":"m2","model":"claude-opus-4-7","role":"assistant",'
            '"content":[],"usage":{"input_tokens":1,"output_tokens":1,"cache_read_input_tokens":0,'
            '"cache_creation_input_tokens":0}}}\n'
        )
    result, _ = ingest_claude_code_file(f, off1)
    assert len(result.turns) == 1
    assert result.turns[0].native_turn_id == "m2"


def test_builds_session_header_from_cwd_field(tmp_path: Path):
    f = tmp_path / "s1.jsonl"
    f.write_text(_jsonl([_assistant("u1", "m1")]), encoding="utf-8")
    result, _ = ingest_claude_code_file(f)
    assert result.header.project_path == "C:/proj"
    assert result.header.agent == "claude_code"
