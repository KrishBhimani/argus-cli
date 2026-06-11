export interface Session {
  id: string;
  agent: 'claude_code' | 'codex';
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

export interface Turn {
  id: string;
  session_id: string;
  sequence: number;
  timestamp: string;
  model: string;
  fresh_input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  tool_calls_count: number;
  cost_usd: number;
  metadata: Record<string, unknown>;
}

export interface TimelineToolCall {
  tool_name: string;
  tool_use_id: string;
  is_error: 0 | 1;
  input_size: number;
  subagent_type: string | null;
  error_text: string | null;
}

export interface TimelineTurn {
  sequence: number;
  timestamp: string;
  model: string;
  fresh_input_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  output_tokens: number;
  cost_usd: number;
  tool_calls: TimelineToolCall[];
}

export interface Overview {
  window: string;
  total_cost_usd: number;
  total_tokens: number;
  session_count: number;
  agent_split: Record<string, { cost: number; sessions: number; tokens: number }>;
  cost_by_day: Record<string, number>;
}

export interface ToolsOverview {
  window: string;
  total_calls: number;
  total_errors: number;
  tool_leaderboard: { name: string; calls: number; errors: number; error_rate: number }[];
  mcp_servers: { server: string; calls: number; errors: number; tools_used: number }[];
  subagents: { type: string; calls: number; errors: number }[];
}

export interface PromptHit {
  id: number;
  timestamp_ms: number;
  project_path: string;
  display: string;
  snippet: string;
  pasted_chars: number;
  session_id: string | null;
}

export interface Alert {
  id: number;
  detector: string;
  dedup_key: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  first_seen_at: string;
  last_seen_at: string;
  seen_at: string | null;
}

export const api = {
  sessions: (q = '') => fetch('/api/sessions' + q).then(r => r.json() as Promise<{ sessions: Session[] }>),
  session: (id: string) => fetch('/api/sessions/' + encodeURIComponent(id)).then(r => r.ok ? r.json() as Promise<{ session: Session; turns: Turn[] }> : null),
  sessionTimeline: (id: string) =>
    fetch(`/api/sessions/${encodeURIComponent(id)}/timeline`)
      .then(r => r.ok ? r.json() as Promise<{ search_enabled: boolean; turns: TimelineTurn[] }> : null),
  sessionToolOutput: (id: string, toolUseId: string) =>
    fetch(`/api/sessions/${encodeURIComponent(id)}/tool-output/${encodeURIComponent(toolUseId)}`)
      .then(r => r.ok ? r.json() as Promise<{ search_enabled: boolean; found: boolean; text: string | null }> : null),
  overview: (window: string) => fetch('/api/overview?window=' + window).then(r => r.json() as Promise<Overview>),
  trends: (granularity: string, groupBy: string) => fetch(`/api/trends?granularity=${granularity}&groupBy=${groupBy}`).then(r => r.json() as Promise<{ points: { bucket: string; groups: Record<string, { cost: number; tokens: number; sessions: number }> }[] }>),
  pricing: () => fetch('/api/pricing').then(r => r.json() as Promise<{ version: string }>),
  parseErrors: () => fetch('/api/parse-errors').then(r => r.json() as Promise<{ errors: { file: string; reason: string; raw_line_truncated: string }[] }>),
  toolsOverview: (window: string) => fetch('/api/tools/overview?window=' + window).then(r => r.json() as Promise<ToolsOverview>),
  prompts: (params: { q?: string; limit?: number; project?: string; includeSlash?: boolean }) => {
    const sp = new URLSearchParams();
    if (params.q) sp.set('q', params.q);
    if (params.limit) sp.set('limit', String(params.limit));
    if (params.project) sp.set('project', params.project);
    if (params.includeSlash) sp.set('include_slash', '1');
    return fetch('/api/prompts?' + sp.toString()).then(r => r.json() as Promise<{ total: number; prompts: PromptHit[] }>);
  },
  promptStats: () => fetch('/api/prompts/stats').then(r => r.json() as Promise<{ total: number; projects: number; oldest_ms: number | null }>),
  promptProjects: () => fetch('/api/prompts/projects').then(r => r.json() as Promise<{ projects: string[] }>),
  search: (params: { q?: string; limit?: number; project?: string; includeSlash?: boolean; roles?: string[] }) => {
    const sp = new URLSearchParams();
    if (params.q) sp.set('q', params.q);
    if (params.limit) sp.set('limit', String(params.limit));
    if (params.project) sp.set('project', params.project);
    if (params.includeSlash) sp.set('include_slash', '1');
    if (params.roles && params.roles.length) sp.set('roles', params.roles.join(','));
    return fetch('/api/search?' + sp.toString()).then(r => r.json() as Promise<{
      total: number;
      prompt_total: number;
      transcript_total: number;
      results: Array<{
        kind: 'prompt' | 'transcript';
        role: string;
        timestamp_ms: number;
        project_path: string | null;
        text: string;
        snippet: string;
        pasted_chars: number;
        session_id: string | null;
      }>;
    }>);
  },
  sessionTranscriptSearch: (id: string, q: string, limit = 100) => {
    const sp = new URLSearchParams({ q, limit: String(limit) });
    return fetch(`/api/sessions/${encodeURIComponent(id)}/transcript?${sp.toString()}`).then(r => r.json() as Promise<{
      total: number;
      segments: Array<{ uid: string; timestamp: string; role: string; text: string; snippet: string }>;
      search_indexing_enabled?: boolean;
    }>);
  },
  searchIndexStatus: () => fetch('/api/search-index/status').then(r => r.json() as Promise<{
    enabled: boolean;
    segment_count: number;
    indexed_sessions: number;
    backfill: { in_progress: boolean; processed: number; total: number; started_at_ms: number | null; finished_at_ms: number | null };
  }>),
  searchIndexEnable: () => fetch('/api/search-index/enable', { method: 'POST' }).then(r => r.json()),
  searchIndexDisable: () => fetch('/api/search-index/disable', { method: 'POST' }).then(r => r.json()),
  searchIndexClear: () => fetch('/api/search-index/clear', { method: 'POST' }).then(r => r.json() as Promise<{
    enabled: boolean;
    cleared: boolean;
    freed_bytes: number;
    db_size_bytes: number;
  }>),
  alerts: (limit = 50) =>
    fetch('/api/alerts?limit=' + limit).then(r => r.json() as Promise<{ alerts: Alert[] }>),
  unseenAlerts: (severity?: 'info' | 'warning' | 'critical') => {
    const sp = new URLSearchParams();
    if (severity) sp.set('severity', severity);
    const q = sp.toString();
    return fetch('/api/alerts/unseen' + (q ? '?' + q : ''))
      .then(r => r.json() as Promise<{ alerts: Alert[] }>);
  },
  markAlertSeen: (id: number) =>
    fetch(`/api/alerts/${id}/seen`, { method: 'POST' }).then(r => r.json()),
};
