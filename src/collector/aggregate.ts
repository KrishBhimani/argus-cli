import type { Session, Turn, RawTurnEvent, RawSessionHeader } from '../schema/types.js';
import type { AdapterIngestResult } from '../adapters/adapter.js';
import type { PricingTable } from '../pricing/types.js';
import { computeTurnCost } from '../pricing/compute.js';

export function buildTurn(raw: RawTurnEvent, sessionId: string, table: PricingTable): Turn {
  // Adapters that emit native cost (OpenClaw via usage.cost.total) bypass
  // the LiteLLM pricing-table compute. Adapters that don't (Claude Code)
  // leave the override unset, so the pricing-table calculation applies.
  const cost = raw.cost_usd_override !== undefined && raw.cost_usd_override !== null
    ? raw.cost_usd_override
    : computeTurnCost(raw, table);
  return {
    id: `${sessionId}:${raw.native_turn_id}`,
    session_id: sessionId,
    sequence: raw.sequence,
    timestamp: raw.timestamp,
    model: raw.model,
    model_raw: raw.model_raw,
    fresh_input_tokens: raw.fresh_input_tokens,
    output_tokens: raw.output_tokens,
    cache_read_tokens: raw.cache_read_tokens,
    cache_write_tokens: raw.cache_write_tokens,
    cache_write_5m_tokens: raw.cache_write_5m_tokens,
    cache_write_1h_tokens: raw.cache_write_1h_tokens,
    tool_calls_count: raw.tool_calls_count,
    cost_usd: cost,
    metadata: raw.metadata,
    provider: raw.provider ?? null,
  };
}

export function buildSession(header: RawSessionHeader, sessionId: string, allTurns: Turn[], pricingVersion: string): Session {
  const computedAt = new Date().toISOString();
  const totals = allTurns.reduce((a, t) => ({
    fresh: a.fresh + t.fresh_input_tokens,
    out: a.out + t.output_tokens,
    cr: a.cr + t.cache_read_tokens,
    cw: a.cw + t.cache_write_tokens,
    cost: a.cost + t.cost_usd,
  }), { fresh: 0, out: 0, cr: 0, cw: 0, cost: 0 });

  const modelTokens = new Map<string, number>();
  for (const t of allTurns) modelTokens.set(t.model, (modelTokens.get(t.model) ?? 0) + t.fresh_input_tokens + t.output_tokens);
  const primary = [...modelTokens.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown';

  const startedAt = header.started_at || allTurns[0]?.timestamp || computedAt;
  const endedAt = header.ended_at ?? allTurns[allTurns.length - 1]?.timestamp ?? null;
  const duration = endedAt ? Math.max(0, Math.floor((Date.parse(endedAt) - Date.parse(startedAt)) / 1000)) : null;

  return {
    id: sessionId,
    agent: header.agent,
    agent_version: header.agent_version,
    project_path: header.project_path,
    started_at: startedAt,
    ended_at: endedAt,
    duration_sec: duration,
    total_fresh_input_tokens: totals.fresh,
    total_output_tokens: totals.out,
    total_cache_read_tokens: totals.cr,
    total_cache_write_tokens: totals.cw,
    total_cost_usd: totals.cost,
    primary_model: primary,
    turn_count: allTurns.length,
    pricing_table_version: header.pricing_table_version_override ?? pricingVersion,
    computed_at: computedAt,
    agent_reported_cost_usd: header.agent_reported_cost_usd,
    metadata: header.metadata,
    backend_agent: header.backend_agent ?? null,
  };
}

// Backward-compat wrapper: takes a full set of raw turns and produces a session+turns pair.
// Used in unit tests; the live pipeline uses buildTurn/buildSession directly so it can
// merge incrementally-ingested turns with previously stored ones.
export function aggregateAdapterResult(r: AdapterIngestResult, table: PricingTable): { session: Session; turns: Turn[] } {
  const sessionId = `${r.header.agent}:${r.header.native_session_id}`;
  const turns = r.turns.map(t => buildTurn(t, sessionId, table));
  const session = buildSession(r.header, sessionId, turns, table.version);
  return { session, turns };
}
