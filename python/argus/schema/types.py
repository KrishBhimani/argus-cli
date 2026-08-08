"""Core data model types — pydantic v2 BaseModels.

Same shape as the TS `interface`s in src/schema/types.ts. The `metadata`
field stays as a plain dict and is serialized to JSON on disk via
``json.dumps`` (not pydantic's serializer) to keep the byte representation
identical to what the TS version writes.
"""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

# `agent` is an open string (not a closed Literal) so future adapters
# (codex, openclaw, hermes) can self-register without editing this file.
# The Adapter registry enforces "must match a registered adapter" at the
# repository boundary.
AgentName = str

SegmentRole = Literal["user", "assistant", "thinking", "tool_result"]


class NormalizedCacheFields(BaseModel):
    model_config = ConfigDict(frozen=True)

    fresh_input_tokens: int
    cache_read_tokens: int
    cache_write_tokens: int
    cache_write_5m_tokens: int | None
    cache_write_1h_tokens: int | None


class Session(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    agent: AgentName
    agent_version: str | None
    project_path: str
    started_at: str
    ended_at: str | None
    duration_sec: int | None
    total_fresh_input_tokens: int = 0
    total_output_tokens: int = 0
    total_cache_read_tokens: int = 0
    total_cache_write_tokens: int = 0
    total_cost_usd: float = 0.0
    primary_model: str
    turn_count: int = 0
    pricing_table_version: str
    computed_at: str
    agent_reported_cost_usd: float | None
    metadata: dict[str, Any] = Field(default_factory=dict)


class Turn(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    session_id: str
    sequence: int
    timestamp: str
    model: str
    model_raw: str
    fresh_input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0
    cache_write_5m_tokens: int | None = None
    cache_write_1h_tokens: int | None = None
    tool_calls_count: int = 0
    cost_usd: float = 0.0
    metadata: dict[str, Any] = Field(default_factory=dict)


class RawTurnEvent(BaseModel):
    model_config = ConfigDict(frozen=True)

    native_turn_id: str
    sequence: int
    timestamp: str
    model: str
    model_raw: str
    fresh_input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0
    cache_write_5m_tokens: int | None = None
    cache_write_1h_tokens: int | None = None
    tool_calls_count: int = 0
    metadata: dict[str, Any] = Field(default_factory=dict)


class RawSessionHeader(BaseModel):
    model_config = ConfigDict(frozen=True)

    native_session_id: str
    agent: AgentName
    agent_version: str | None
    project_path: str
    started_at: str
    ended_at: str | None
    agent_reported_cost_usd: float | None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ToolCall(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    session_id: str
    turn_index: int
    tool_name: str
    is_error: int  # 0 | 1
    input_size: int
    subagent_type: str | None
    timestamp: str


class Prompt(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: int | None = None  # autoincrement; None on insert
    timestamp_ms: int
    project_path: str
    display: str
    pasted_chars: int = 0
    is_slash: int = 0  # 0 | 1


class TranscriptSegment(BaseModel):
    model_config = ConfigDict(frozen=True)

    uid: str
    session_id: str
    timestamp: str
    role: SegmentRole
    text: str
    tool_use_id: str | None = None


AlertSeverity = Literal["info", "warning", "critical"]


class Alert(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: int | None = None
    detector: str
    dedup_key: str
    severity: AlertSeverity
    title: str
    message: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    first_seen_at: str
    last_seen_at: str
    seen_at: str | None = None
    resolved_at: str | None = None


class WorkflowRun(BaseModel):
    """One orchestration run record (Workflow tool invocation)."""

    run_id: str
    session_id: str
    name: str = ""
    summary: str = ""
    status: str = ""
    task_id: str = ""
    started_at: str = ""
    duration_ms: int = 0
    agent_count: int = 0
    default_model: str = ""
    wf_total_tokens: int = 0
    wf_total_tools: int = 0
    phases_json: str = "[]"
    logs_json: str = "[]"
    script: str = ""
    raw_json: str = ""


class WorkflowAgent(BaseModel):
    """One agent() spawn inside a workflow run."""

    run_id: str
    agent_id: str
    sub_session_id: str
    seq: int = 0
    label: str = ""
    phase_index: int = 0
    phase_title: str = ""
    model: str = ""
    fallback_model: str = ""
    state: str = ""
    attempt: int = 1
    queued_at: str = ""
    started_at: str = ""
    last_progress_at: str = ""
    duration_ms: int = 0
    wf_tokens: int = 0
    wf_tool_calls: int = 0
    last_tool_name: str = ""
    last_tool_summary: str = ""
    prompt_preview: str = ""
    result_preview: str = ""


class ParsedWorkflowRun(BaseModel):
    """Parser output. ``truncated_bytes`` > 0 means raw_json was capped."""

    run: WorkflowRun
    agents: list[WorkflowAgent] = []
    truncated_bytes: int = 0
