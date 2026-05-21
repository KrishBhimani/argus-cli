"""Claude Code model-name canonicalization."""
from __future__ import annotations

import re

_DATED_SUFFIX_RE = re.compile(r"-(\d{8})$")


def canonicalize_claude_model(raw: str) -> str:
    """Strip a YYYYMMDD date suffix if present; leave aliases alone."""
    return _DATED_SUFFIX_RE.sub("", raw)
