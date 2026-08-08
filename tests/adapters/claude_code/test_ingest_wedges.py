"""One bad line must never stop a file — or every file — from ingesting.

docs/SECURITY_AUDIT_2026-07-31.md #11. Four independent ways a single hostile
or merely unlucky JSONL line permanently wedged ingestion. These are
availability bugs, not disclosure ones, and no attacker is required: a lone
surrogate or an absurd token count can arrive from ordinary use.

Wedged means *permanently*: the file offset never advances, so every subsequent
tick re-reads the same bytes and fails the same way. For the surrogate case the
exception escapes to the caller, so the whole ingest pass dies and no session
updates at all.

  1. Lone UTF-16 surrogate  -> UnicodeEncodeError in _cap_text
  2. json.loads raising something other than JSONDecodeError (RecursionError on
     deep nesting; plain ValueError on an integer over CPython's 4300-digit
     str->int limit) -> escapes the `except json.JSONDecodeError`
  3. Token count above 2**63-1 -> sqlite3 OverflowError on insert
  4. A single line longer than the 64 MiB tick cap -> no newline in the window,
     so consumed_bytes is 0 and the offset never moves
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from argus.adapters.claude_code import ingest_file as ingest_mod
from argus.adapters.claude_code.ingest_file import ingest_claude_code_file


_SEQ = [0]


def _assistant(text: str = "hi", *, usage: dict | None = None) -> dict:
    # Distinct uuid/message-id per line: turns dedupe on message.id and
    # segments key on uuid, so reusing them would silently collapse the very
    # lines these tests are checking survive.
    _SEQ[0] += 1
    n = _SEQ[0]
    return {
        "type": "assistant",
        "sessionId": "s1",
        "uuid": f"u{n}",
        "timestamp": f"2026-05-01T00:00:{n:02d}Z",
        "cwd": "/p",
        "version": "2.1.94",
        "message": {
            "id": f"m{n}",
            "model": "claude-opus-4-7",
            "role": "assistant",
            "content": [{"type": "text", "text": text}],
            "usage": usage
            or {
                "input_tokens": 10,
                "output_tokens": 20,
                "cache_read_input_tokens": 0,
                "cache_creation_input_tokens": 0,
            },
        },
    }


def _write(p: Path, lines: list[str]) -> None:
    p.write_bytes(("\n".join(lines) + "\n").encode("utf-8", errors="surrogatepass"))


# --- 1. lone surrogate -------------------------------------------------------


def test_lone_surrogate_does_not_kill_the_ingest(tmp_path: Path):
    """`"\\ud800"` is valid JSON but not encodable UTF-8 text."""
    f = tmp_path / "s1.jsonl"
    good_before = json.dumps(_assistant("before"))
    surrogate = json.dumps(_assistant("bad")).replace('"bad"', '"\\ud800"')
    good_after = json.dumps(_assistant("after"))
    _write(f, [good_before, surrogate, good_after])

    result, offset = ingest_claude_code_file(f, 0)

    assert offset == f.stat().st_size, "offset must advance past the bad line"
    texts = [s.text for s in result.segments]
    assert any("before" in t for t in texts)
    assert any("after" in t for t in texts), "a later line was lost"


# --- 2. json.loads raising something other than JSONDecodeError --------------


def test_absurdly_long_integer_does_not_kill_the_ingest(tmp_path: Path):
    """CPython caps str->int at 4300 digits and raises plain ValueError."""
    f = tmp_path / "s1.jsonl"
    huge = "1" * 5000
    _write(f, [json.dumps(_assistant("before")), f'{{"type":"assistant","n":{huge}}}',
               json.dumps(_assistant("after"))])

    result, offset = ingest_claude_code_file(f, 0)

    assert offset == f.stat().st_size
    assert any("after" in s.text for s in result.segments), "a later line was lost"
    assert result.parse_errors, "the bad line should be recorded, not silently dropped"


def test_deeply_nested_json_does_not_kill_the_ingest(tmp_path: Path):
    """Deep nesting overflows json.loads' recursion -> RecursionError."""
    f = tmp_path / "s1.jsonl"
    bomb = "[" * 60_000 + "]" * 60_000
    _write(f, [json.dumps(_assistant("before")), bomb, json.dumps(_assistant("after"))])

    result, offset = ingest_claude_code_file(f, 0)

    assert offset == f.stat().st_size
    assert any("after" in s.text for s in result.segments), "a later line was lost"


# --- 3. token counts beyond SQLite's integer range ---------------------------


@pytest.mark.parametrize("field", ["input_tokens", "output_tokens"])
def test_token_count_beyond_int64_is_rejected_not_stored(tmp_path: Path, field: str):
    """SQLite INTEGER tops out at 2**63-1; beyond that the insert raises."""
    f = tmp_path / "s1.jsonl"
    usage = {
        "input_tokens": 10,
        "output_tokens": 20,
        "cache_read_input_tokens": 0,
        "cache_creation_input_tokens": 0,
    }
    usage[field] = 2**64
    _write(f, [json.dumps(_assistant("before")),
               json.dumps(_assistant("huge", usage=usage)),
               json.dumps(_assistant("after"))])

    result, offset = ingest_claude_code_file(f, 0)

    assert offset == f.stat().st_size
    for t in result.turns:
        for v in (t.fresh_input_tokens, t.output_tokens,
                  t.cache_read_tokens, t.cache_write_tokens):
            assert v <= 2**63 - 1, f"{v} will overflow SQLite INTEGER"


# --- 5. offset drift on lossy decode -----------------------------------------


def test_offset_tracks_raw_bytes_not_re_encoded_text(tmp_path: Path):
    """The offset must be measured in the file's own bytes.

    Undecodable bytes become U+FFFD, which re-encodes to a *different* length,
    so measuring the decoded-then-re-encoded text drifts. Overshooting EOF is
    itself a permanent wedge: `size <= from_offset` becomes true forever and
    the file silently stops ingesting.
    """
    f = tmp_path / "s1.jsonl"
    surrogate = json.dumps(_assistant("bad")).replace('"bad"', '"\\ud800"')
    _write(f, [json.dumps(_assistant("before")), surrogate,
               json.dumps(_assistant("after"))])

    _, offset = ingest_claude_code_file(f, 0)

    assert offset == f.stat().st_size, (
        f"offset {offset} != file size {f.stat().st_size} — drifted on lossy decode"
    )

    # A follow-up tick on an unchanged file must be a clean no-op.
    result2, offset2 = ingest_claude_code_file(f, offset)
    assert offset2 == offset
    assert result2.turns == []


def test_raw_invalid_utf8_bytes_do_not_drift_the_offset(tmp_path: Path):
    """Same hazard from plain corrupt bytes, not just JSON surrogates."""
    f = tmp_path / "s1.jsonl"
    good = json.dumps(_assistant("after")).encode("utf-8")
    f.write_bytes(b'{"type":"assistant","x":"' + b"\xff\xfe\xfd" + b'"}\n' + good + b"\n")

    _, offset = ingest_claude_code_file(f, 0)

    assert offset == f.stat().st_size


# --- 4. a single line longer than the tick cap -------------------------------


def test_line_longer_than_the_tick_cap_does_not_stall_forever(
    tmp_path: Path, monkeypatch
):
    """The offset must advance past an oversized line instead of re-reading it.

    Shrinks the cap rather than writing 64 MiB, so the test stays fast; the
    logic under test is identical.
    """
    monkeypatch.setattr(ingest_mod, "MAX_TICK_BYTES", 1024)
    f = tmp_path / "s1.jsonl"
    _write(f, ["x" * 5000, json.dumps(_assistant("after"))])

    result, offset = ingest_claude_code_file(f, 0)

    assert offset > 0, "offset did not advance — every future tick re-reads this"
    assert result.parse_errors, "an oversized line should be reported"

    # Second tick must make further progress and eventually reach the good line.
    seen = list(result.segments)
    for _ in range(10):
        if offset >= f.stat().st_size:
            break
        result, new_offset = ingest_claude_code_file(f, offset)
        assert new_offset > offset, "stalled: offset stopped advancing"
        offset = new_offset
        seen.extend(result.segments)
    assert any("after" in s.text for s in seen), "never reached the line after it"
