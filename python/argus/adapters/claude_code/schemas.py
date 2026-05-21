"""pydantic schemas for one line of a Claude Code JSONL session log.

Equivalents of the zod schemas in src/adapters/claude_code/schemas.ts.
``model_config = ConfigDict(extra='allow')`` mirrors zod's ``.passthrough()``
so unknown fields like ``attribution_agent`` survive parsing.
"""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class _Passthrough(BaseModel):
    model_config = ConfigDict(extra="allow")


class CacheCreation(_Passthrough):
    ephemeral_5m_input_tokens: int = 0
    ephemeral_1h_input_tokens: int = 0


class Usage(_Passthrough):
    input_tokens: int = Field(ge=0)
    output_tokens: int = Field(ge=0)
    cache_read_input_tokens: int = Field(default=0, ge=0)
    cache_creation_input_tokens: int = Field(default=0, ge=0)
    cache_creation: CacheCreation | None = None
    service_tier: str | None = None


class AssistantMessage(_Passthrough):
    id: str
    model: str
    role: Literal["assistant"]
    content: list[dict[str, Any]] = Field(default_factory=list)
    stop_reason: str | None = None
    usage: Usage


class UserMessage(_Passthrough):
    role: Literal["user"]
    # Either a plain string ("hello") or a list of content blocks
    # ([{type: 'tool_result', ...}, ...]).
    content: str | list[Any]


class AssistantLine(_Passthrough):
    type: Literal["assistant"]
    sessionId: str
    uuid: str
    timestamp: str
    cwd: str
    version: str | None = None
    userType: str | None = None
    entrypoint: str | None = None
    gitBranch: str | None = None
    isSidechain: bool | None = None
    agentId: str | None = None
    requestId: str | None = None
    attribution_agent: str | None = None
    message: AssistantMessage


class UserLine(_Passthrough):
    type: Literal["user"]
    sessionId: str
    uuid: str
    timestamp: str
    cwd: str
    version: str | None = None
    userType: str | None = None
    entrypoint: str | None = None
    gitBranch: str | None = None
    isSidechain: bool | None = None
    agentId: str | None = None
    message: UserMessage
