"""Extract searchable transcript segments from a session's lines."""
from __future__ import annotations

from ..base import RawSegment
from .schemas import AssistantLine, UserLine

# Per-segment byte cap. Tool_result content (a Read of a file, a Bash of a
# build log) can be enormous; indexing the entire body bloats FTS5 for
# very little search value.
SEGMENT_CAP_BYTES = 16 * 1024


def _sanitize(s: str) -> str:
    """Drop lone UTF-16 surrogates so the text can be encoded and stored.

    ``"\\ud800"`` is legal JSON, so ``json.loads`` hands back a str containing
    an unpaired surrogate — which has no UTF-8 encoding. Every later step
    (``str.encode`` here, and the SQLite insert) then raises
    ``UnicodeEncodeError``, and because that escaped the per-line handler it
    killed the entire ingest pass, not just the offending line.

    Replace rather than drop, so the corruption stays visible in search results
    instead of silently changing the text.
    """
    if s.isascii():  # fast path: the overwhelming majority of segments
        return s
    return s.encode("utf-8", errors="replace").decode("utf-8", errors="replace")


def _cap_text(s: str) -> str:
    """Truncate ``s`` to ``SEGMENT_CAP_BYTES`` UTF-8 bytes with an ellipsis."""
    s = _sanitize(s)
    encoded = s.encode("utf-8")
    if len(encoded) <= SEGMENT_CAP_BYTES:
        return s
    # Walk back to a unicode-safe boundary by decoding with errors='ignore'.
    truncated = encoded[:SEGMENT_CAP_BYTES].decode("utf-8", errors="ignore")
    return truncated + "…"


def extract_transcript_segments(
    assistant_lines: list[AssistantLine],
    user_lines: list[UserLine],
) -> list[RawSegment]:
    out: list[RawSegment] = []

    for line in assistant_lines:
        block_idx = 0
        for block in line.message.content:
            btype = block.get("type")
            if btype == "text":
                text = block.get("text")
                if isinstance(text, str) and text.strip():
                    out.append(
                        RawSegment(
                            uid_suffix=f"{line.uuid}:{block_idx}",
                            timestamp=line.timestamp,
                            role="assistant",
                            text=_cap_text(text),
                        )
                    )
            elif btype == "thinking":
                text = block.get("thinking")
                if isinstance(text, str) and text.strip():
                    out.append(
                        RawSegment(
                            uid_suffix=f"{line.uuid}:{block_idx}",
                            timestamp=line.timestamp,
                            role="thinking",
                            text=_cap_text(text),
                        )
                    )
            block_idx += 1

    for line in user_lines:
        c = line.message.content
        if isinstance(c, str):
            if c.strip():
                out.append(
                    RawSegment(
                        uid_suffix=f"{line.uuid}:0",
                        timestamp=line.timestamp,
                        role="user",
                        text=_cap_text(c),
                    )
                )
            continue
        if not isinstance(c, list):
            continue
        block_idx = 0
        for block in c:
            if not isinstance(block, dict):
                block_idx += 1
                continue
            btype = block.get("type")
            if btype == "text" and isinstance(block.get("text"), str) and block["text"].strip():
                out.append(
                    RawSegment(
                        uid_suffix=f"{line.uuid}:{block_idx}",
                        timestamp=line.timestamp,
                        role="user",
                        text=_cap_text(block["text"]),
                    )
                )
            elif btype == "tool_result":
                content = block.get("content")
                combined = ""
                if isinstance(content, str):
                    combined = content
                elif isinstance(content, list):
                    parts = []
                    for sub in content:
                        if isinstance(sub, dict):
                            t = sub.get("text")
                            if isinstance(t, str):
                                parts.append(t)
                    combined = "\n".join(p for p in parts if p)
                tu_id = block.get("tool_use_id")
                if combined.strip():
                    out.append(
                        RawSegment(
                            uid_suffix=f"{line.uuid}:{block_idx}",
                            timestamp=line.timestamp,
                            role="tool_result",
                            text=_cap_text(combined),
                            tool_use_id=tu_id if isinstance(tu_id, str) else None,
                        )
                    )
            block_idx += 1

    return out
