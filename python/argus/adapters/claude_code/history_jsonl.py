"""Ingest ``~/.claude/history.jsonl`` — the global prompt history file.

Byte-offset tail like sessions. Partial last line is held back until
newline. If the file shrinks below the recorded offset (rotation /
truncation), we reset to 0 and re-ingest.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING, Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from ...schema.types import Prompt
from ...store.repository import normalize_project_path

if TYPE_CHECKING:
    from ...store.repository import Repository

# Hard cap on the indexed body. 8 KB is past any realistic hand-typed
# prompt; longer values are almost always a paste-by-mistake.
DISPLAY_CAP_BYTES = 8 * 1024
MAX_TICK_BYTES = 64 * 1024 * 1024


class HistoryLine(BaseModel):
    """One line of ~/.claude/history.jsonl."""

    model_config = ConfigDict(extra="allow")

    display: str
    pastedContents: dict[str, Any] = Field(default_factory=dict)
    timestamp: int
    project: str


class HistoryIngestStats(BaseModel):
    inserted: int
    skipped_empty: int
    parse_errors: int
    new_offset: int


def line_to_prompt(line: HistoryLine) -> Prompt | None:
    """Pure transformation: history line → Prompt row, or None if skipped."""
    trimmed = line.display.strip()
    if trimmed == "":
        return None

    display = line.display
    if len(display.encode("utf-8")) > DISPLAY_CAP_BYTES:
        # Walk back to a unicode-safe boundary by decoding with errors='ignore'.
        truncated = display.encode("utf-8")[: DISPLAY_CAP_BYTES - 1].decode(
            "utf-8", errors="ignore"
        )
        display = truncated + "…"

    try:
        # Compact separators match JS ``JSON.stringify`` byte count, so
        # the pasted_chars upper bound is identical across stacks.
        pasted_chars = len(json.dumps(line.pastedContents or {}, separators=(",", ":")))
        if pasted_chars <= 2:  # "{}"
            pasted_chars = 0
    except (TypeError, ValueError):
        pasted_chars = 0

    return Prompt(
        timestamp_ms=line.timestamp,
        project_path=normalize_project_path(line.project),
        display=display,
        pasted_chars=pasted_chars,
        is_slash=1 if trimmed.startswith("/") else 0,
    )


def ingest_history_file(
    file_path: Path, repo: "Repository"
) -> HistoryIngestStats:
    """Read ``file_path`` from the stored offset, append new prompts."""
    offset_key = f"history:{file_path}"
    from_offset = repo.get_file_offset(offset_key)

    with open(file_path, "rb") as fh:
        fh.seek(0, 2)
        size = fh.tell()

        # Rotation / truncation: file smaller than the offset → re-ingest.
        if size < from_offset:
            from_offset = 0

        if size <= from_offset:
            return HistoryIngestStats(
                inserted=0, skipped_empty=0, parse_errors=0, new_offset=from_offset
            )

        read_len = min(size - from_offset, MAX_TICK_BYTES)
        fh.seek(from_offset)
        raw = fh.read(read_len)

    text = raw.decode("utf-8", errors="replace")
    last_nl = text.rfind("\n")
    consumable = text[: last_nl + 1] if last_nl != -1 else ""
    consumed_bytes = len(consumable.encode("utf-8"))
    new_offset = from_offset + consumed_bytes

    rows: list[Prompt] = []
    parse_errors = 0
    skipped_empty = 0

    for line in consumable.split("\n"):
        if not line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            parse_errors += 1
            continue
        try:
            parsed = HistoryLine.model_validate(obj)
        except ValidationError:
            parse_errors += 1
            continue
        row = line_to_prompt(parsed)
        if row is None:
            skipped_empty += 1
            continue
        rows.append(row)

    repo.insert_prompts(rows)
    repo.set_file_offset(offset_key, new_offset)

    return HistoryIngestStats(
        inserted=len(rows),
        skipped_empty=skipped_empty,
        parse_errors=parse_errors,
        new_offset=new_offset,
    )
