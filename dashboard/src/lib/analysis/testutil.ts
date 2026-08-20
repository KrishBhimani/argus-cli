import type { Session } from '@/lib/api/client';

export const mk = (o: Partial<Session> = {}): Session => ({
  id: 'claude_code:x',
  agent: 'claude_code',
  agent_version: null,
  project_path: 'c:/proj/example',
  started_at: '2026-08-20T10:00:00',
  ended_at: null,
  duration_sec: 60,
  total_fresh_input_tokens: 0,
  total_output_tokens: 0,
  total_cache_read_tokens: 0,
  total_cache_write_tokens: 0,
  total_cost_usd: 0,
  primary_model: 'claude-opus-4-8',
  turn_count: 1,
  pricing_table_version: 'v',
  computed_at: '',
  agent_reported_cost_usd: null,
  metadata: {},
  ...o,
});
