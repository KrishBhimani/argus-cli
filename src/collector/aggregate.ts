import type { Session, Turn } from '../schema/types.js';
import type { AdapterIngestResult } from '../adapters/adapter.js';
import type { PricingTable } from '../pricing/types.js';
import { computeTurnCost } from '../pricing/compute.js';

export function aggregateAdapterResult(r: AdapterIngestResult, table: PricingTable): { session: Session; turns: Turn[] } {
  const sessionId = `${r.header.agent}:${r.header.native_session_id}`;
  const computedAt = new Date().toISOString();
  const turns: Turn[] = r.turns.map(t => ({
    id: `${sessionId}:${t.native_turn_id}`,
    session_id: sessionId,
    sequence: t.sequence,
    timestamp: t.timestamp,
    model: t.model,
    model_raw: t.model_raw,
    fresh_input_tokens: t.fresh_input_tokens,
    output_tokens: t.output_tokens,
    cache_read_tokens: t.cache_read_tokens,
    cache_write_tokens: t.cache_write_tokens,
    cache_write_5m_tokens: t.cache_write_5m_tokens,
    cache_write_1h_tokens: t.cache_write_1h_tokens,
    tool_calls_count: t.tool_calls_count,
    cost_usd: computeTurnCost(t, table),
    metadata: t.metadata,
  }));

  const totals = turns.reduce((a, t) => ({
    fresh: a.fresh + t.fresh_input_tokens,
    out: a.out + t.output_tokens,
    cr: a.cr + t.cache_read_tokens,
    cw: a.cw + t.cache_write_tokens,
    cost: a.cost + t.cost_usd,
  }), { fresh: 0, out: 0, cr: 0, cw: 0, cost: 0 });

  const modelTokens = new Map<string, number>();
  for (const t of turns) modelTokens.set(t.model, (modelTokens.get(t.model) ?? 0) + t.fresh_input_tokens + t.output_tokens);
  const primary = [...modelTokens.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown';

  const startedAt = r.header.started_at || turns[0]?.timestamp || computedAt;
  const endedAt = r.header.ended_at;
  const duration = endedAt ? Math.max(0, Math.floor((Date.parse(endedAt) - Date.parse(startedAt)) / 1000)) : null;

  const session: Session = {
    id: sessionId,
    agent: r.header.agent,
    agent_version: r.header.agent_version,
    project_path: r.header.project_path,
    started_at: startedAt,
    ended_at: endedAt,
    duration_sec: duration,
    total_fresh_input_tokens: totals.fresh,
    total_output_tokens: totals.out,
    total_cache_read_tokens: totals.cr,
    total_cache_write_tokens: totals.cw,
    total_cost_usd: totals.cost,
    primary_model: primary,
    turn_count: turns.length,
    pricing_table_version: table.version,
    computed_at: computedAt,
    agent_reported_cost_usd: r.header.agent_reported_cost_usd,
    metadata: r.header.metadata,
  };

  return { session, turns };
}
