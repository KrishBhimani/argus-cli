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

    text = raw.decode("utf-8", errors="replace")
    last_nl = text.rfind("\n")
    consumable = text[: last_nl + 1] if last_nl != -1 else ""
    consumed_bytes = len(consumable.encode("utf-8"))
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
        except json.JSONDecodeError as e:
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
