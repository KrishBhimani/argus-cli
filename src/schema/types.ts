export type AgentName = 'claude_code' | 'codex';

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
}
