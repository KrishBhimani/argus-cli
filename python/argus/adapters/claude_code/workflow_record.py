"""Parse a Claude Code workflow run record (`wf_*.json`)."""
from __future__ import annotations

from pathlib import Path

from ...schema.types import ParsedWorkflowRun


def parse_workflow_record(path: Path, session_id: str) -> ParsedWorkflowRun | None:
    raise NotImplementedError  # Task 4
