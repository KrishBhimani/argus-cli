import type { Session } from '../schema/types.js';

export function rollupSubAgents(parent: Session, subs: Session[]): Session {
  if (subs.length === 0) return parent;
  const sum = (key: keyof Session) => subs.reduce((a, s) => a + (s[key] as number), parent[key] as number);
  return {
    ...parent,
    total_fresh_input_tokens: sum('total_fresh_input_tokens'),
    total_output_tokens: sum('total_output_tokens'),
    total_cache_read_tokens: sum('total_cache_read_tokens'),
    total_cache_write_tokens: sum('total_cache_write_tokens'),
    total_cost_usd: sum('total_cost_usd'),
    turn_count: sum('turn_count'),
    metadata: { ...parent.metadata, sub_agent_session_ids: subs.map(s => s.id) },
  };
}
