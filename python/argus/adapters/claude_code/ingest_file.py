"""Parse one Claude Code JSONL file from a byte offset, return new offset."""
from __future__ import annotations

import json
from pathlib import Path

from pydantic import ValidationError

from ...schema.types import RawSessionHeader
from ..base import AdapterIngestResult, ParseError
from .extract_tool_calls import extract_tool_calls
from .extract_transcript import extract_transcript_segments
from .extract_turns import extract_turns
from .schemas import AssistantLine, UserLine

# Per-tick read cap to avoid OOM on a corrupt multi-GB JSONL.
MAX_TICK_BYTES = 64 * 1024 * 1024  # 64 MiB


def _empty_result(file_path: Path) -> AdapterIngestResult:
    return AdapterIngestResult(
        header=RawSessionHeader(
            native_session_id=file_path.stem,
            agent="claude_code",
            agent_version=None,
            project_path="",
            started_at="",
            ended_at=None,
            agent_reported_cost_usd=None,
            metadata={},
        ),
        turns=[],
        tool_calls=[],
        segments=[],
        parse_errors=[],
    )


def _seek_past_line(file_path: Path, start: int, chunk: int = 1 << 20) -> int:
    """Byte offset just past the next ``\\n`` at or after ``start``.

    Returns the file size if the oversized line runs to EOF (nothing more to
    parse), which still advances the offset and ends the stall.
    """
    with open(file_path, "rb") as fh:
        fh.seek(start)
        pos = start
        while True:
            buf = fh.read(chunk)
            if not buf:
                return pos
            nl = buf.find(b"\n")
            if nl != -1:
                return pos + nl + 1
            pos += len(buf)


def _result_with_error(file_path: Path, err: ParseError) -> AdapterIngestResult:
    result = _empty_result(file_path)
    result.parse_errors.append(err)
    return result


def ingest_claude_code_file(
    file_path: Path, from_offset: int = 0
) -> tuple[AdapterIngestResult, int]:
    """Read new bytes after ``from_offset``, parse, return (result, new_offset).

    Partial trailing lines are held back until the next call. Malformed
    lines are recorded as ParseErrors and skipped — surrounding lines
    still ingest successfully.
    """
    with open(file_path, "rb") as fh:
        fh.seek(0, 2)  # end
        size = fh.tell()
        if size <= from_offset:
            return _empty_result(file_path), from_offset
        read_len = min(size - from_offset, MAX_TICK_BYTES)
        fh.seek(from_offset)
        raw = fh.read(read_len)

    # Find the boundary in the RAW BYTES, never in the decoded text. Decoding
    # with errors="replace" turns each undecodable byte into U+FFFD, which
    # re-encodes to three bytes — so measuring consumed length on the decoded
    # string drifts the offset forward on any corrupt input. Drifting past EOF
    # is itself a permanent wedge: `size <= from_offset` then holds forever and
    # the file silently stops ingesting.
    last_nl_b = raw.rfind(b"\n")

    # A line longer than the per-tick cap has no newline anywhere in the window.
    # Holding it back as a "partial trailing line" would leave the offset where
    # it was, so every future tick re-reads the same MAX_TICK_BYTES and makes no
    # progress — the file stalls forever, silently, while burning I/O. Skip past
    # the oversized line instead and record why.
    if last_nl_b == -1 and read_len >= MAX_TICK_BYTES:
        skip_to = _seek_past_line(file_path, from_offset + read_len)
        return (
            _result_with_error(
                file_path,
                ParseError(
                    file=str(file_path),
                    byte_offset=from_offset,
                    reason=(
                        f"line exceeds the {MAX_TICK_BYTES}-byte per-tick read cap; "
                        "skipped so ingestion can continue"
                    ),
                    raw_line_truncated=raw[:200].decode("utf-8", errors="replace"),
                ),
            ),
            skip_to,
        )

    consumable_bytes = raw[: last_nl_b + 1] if last_nl_b != -1 else b""
    consumed_bytes = len(consumable_bytes)  # exact: measured on the real bytes
    consumable = consumable_bytes.decode("utf-8", errors="replace")
    new_offset = from_offset + consumed_bytes

    assistant_lines: list[AssistantLine] = []
    user_lines: list[UserLine] = []
    parse_errors: list[ParseError] = []
    line_offset = from_offset

    for line in consumable.split("\n"):
        if not line:
            line_offset += 1
            continue
        line_bytes = len(line.encode("utf-8"))
        try:
            obj = json.loads(line)
        # Not just JSONDecodeError. json.loads also raises plain ValueError for
        # an integer over CPython's 4300-digit str->int limit, and
        # RecursionError for deeply nested arrays/objects. Both escaped the
        # narrower except and killed the whole file's ingest — permanently,
        # since the offset never advanced past the line.
        except (ValueError, RecursionError) as e:
            parse_errors.append(
                ParseError(
                    file=str(file_path),
                    byte_offset=line_offset,
                    reason=str(e),
                    raw_line_truncated=line[:200],
                )
            )
            line_offset += line_bytes + 1
            continue

        otype = obj.get("type") if isinstance(obj, dict) else None
        try:
            if otype == "assistant":
                assistant_lines.append(AssistantLine.model_validate(obj))
            elif otype == "user":
                # User-line schema failure is non-fatal (loose schema) — skip
                # without recording, otherwise parse_errors would flood.
                try:
                    user_lines.append(UserLine.model_validate(obj))
                except ValidationError:
                    pass
        except ValidationError as e:
            parse_errors.append(
                ParseError(
                    file=str(file_path),
                    byte_offset=line_offset,
                    reason=str(e),
                    raw_line_truncated=line[:200],
                )
            )
        line_offset += line_bytes + 1

    turns = extract_turns(assistant_lines)
    tool_calls = extract_tool_calls(assistant_lines, user_lines)
    segments = extract_transcript_segments(assistant_lines, user_lines)

    session_id = file_path.stem
    cwd = assistant_lines[0].cwd if assistant_lines else ""
    version = assistant_lines[-1].version if assistant_lines else None
    started_at = (
        assistant_lines[0].timestamp if assistant_lines else "1970-01-01T00:00:00.000Z"
    )
    ended_at = assistant_lines[-1].timestamp if assistant_lines else None

    result = AdapterIngestResult(
        header=RawSessionHeader(
            native_session_id=session_id,
            agent="claude_code",
            agent_version=version,
            project_path=cwd,
            started_at=started_at,
            ended_at=ended_at,
            agent_reported_cost_usd=None,
            metadata={},
        ),
        turns=turns,
        tool_calls=tool_calls,
        segments=segments,
        parse_errors=parse_errors,
    )
    return result, new_offset
