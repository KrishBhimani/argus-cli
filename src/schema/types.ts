// Open-ended so contributors don't have to edit this file every time they
// add a new adapter. Known adapters are listed below for documentation.
export type AgentName = string;

export const KNOWN_AGENTS = ['claude_code', 'openclaw'] as const;

export interface NormalizedCacheFields {
  fresh_input_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  cache_write_5m_tokens: number | null;
  cache_write_1h_tokens: number | null;
}

export interface Session {
  id: string;
  agent: AgentName;
  agent_version: string | null;
  project_path: string;
  started_at: string;
  ended_at: string | null;
  duration_sec: number | null;
  total_fresh_input_tokens: number;
  total_output_tokens: number;
  total_cache_read_tokens: number;
  total_cache_write_tokens: number;
  total_cost_usd: number;
  primary_model: string;
  turn_count: number;
  pricing_table_version: string;
  computed_at: string;
  agent_reported_cost_usd: number | null;
  metadata: Record<string, unknown>;
  /** Named-agent subdivision (OpenClaw 'admin' / 'dev' / …). NULL for Claude Code. */
  backend_agent: string | null;
}

export interface Turn extends NormalizedCacheFields {
  id: string;
  session_id: string;
  sequence: number;
  timestamp: string;
  model: string;
  model_raw: string;
  output_tokens: number;
  tool_calls_count: number;
  cost_usd: number;
  metadata: Record<string, unknown>;
  /** Provider id (kimi / anthropic / openai). NULL for Claude Code turns. */
  provider: string | null;
}

export interface RawTurnEvent extends NormalizedCacheFields {
  native_turn_id: string;
  sequence: number;
  timestamp: string;
  model: string;
  model_raw: string;
  output_tokens: number;
  tool_calls_count: number;
  metadata: Record<string, unknown>;
  /**
   * If set, the pipeline uses this verbatim instead of computing cost from
   * the pricing table. OpenClaw populates this from `usage.cost.total`;
   * Claude Code leaves it undefined so the pricing-table compute applies.
   */
  cost_usd_override?: number | null;
  /** Provider id (kimi / anthropic / openai). Null/undefined for Claude Code. */
  provider?: string | null;
}

export interface RawSessionHeader {
  native_session_id: string;
  agent: AgentName;
  agent_version: string | null;
  project_path: string;
  started_at: string;
  ended_at: string | null;
  agent_reported_cost_usd: number | null;
  metadata: Record<string, unknown>;
  /** Named-agent subdivision (OpenClaw 'admin' / 'dev' / …). Null for Claude Code. */
  backend_agent?: string | null;
  /**
   * If set, overrides pricing_table_version on the persisted session row.
   * OpenClaw uses 'openclaw-reported' so cost rows declare their source.
   */
  pricing_table_version_override?: string | null;
}

// Slice 1 (Tools page) — one row per tool_use block in any assistant turn.
// Composite id is `${session_id}:${turn_index}:${block_index}` so the same
// tool_use can be re-emitted on tail re-ingest without duplicating.
export interface ToolCall {
  id: string;
  session_id: string;
  turn_index: number;
  tool_name: string;
  is_error: 0 | 1;
  input_size: number;
  subagent_type: string | null;
  timestamp: string;
}

// Slice 1 (Prompts page) — one row per line of ~/.claude/history.jsonl.
// `display` is capped at 8 KB on ingest; `pasted_chars` is the JSON-stringified
// length of pastedContents (cheap upper bound, not the indexed body).
export interface Prompt {
  id: number;
  timestamp_ms: number;
  project_path: string;
  display: string;
  pasted_chars: number;
  is_slash: 0 | 1;
}

// Slice 2 (full-transcript search) — one row per indexable text block in
// any assistant or user JSONL line. The composite uid is
// "{session_id}:{line_uuid}:{block_index}" so re-ingest of the same bytes
// upserts in place. Roles are deliberately small for filterability.
export type SegmentRole = 'user' | 'assistant' | 'thinking' | 'tool_result';

export interface TranscriptSegment {
  uid: string;
  session_id: string;
  timestamp: string;
  role: SegmentRole;
  text: string;
}

// ─── Cross-adapter raw types ───────────────────────────────────────────────
// Emitted by adapters during ingest; the pipeline stamps session_id and
// composite ids before persisting. Hoisted here so adapters don't have to
// import from each other's folders.

export interface RawToolCall {
  native_turn_id: string;   // assistant message.id this tool_use belongs to
  turn_index: number;       // 0-based sequence of the parent assistant turn
  block_index: number;      // 0-based index within the assistant content[]
  tool_name: string;
  tool_use_id: string;      // matches a later user message's tool_result.tool_use_id
  is_error: 0 | 1;
  input_size: number;       // JSON.stringify(input).length
  subagent_type: string | null;  // populated only when tool_name === 'Task'
  timestamp: string;
}

export interface RawSegment {
  uid_suffix: string;       // "{line_uuid}:{block_index}" — pipeline prefixes session_id
  timestamp: string;
  role: SegmentRole;
  text: string;
}
