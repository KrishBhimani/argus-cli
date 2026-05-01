import type { PricingTable } from './types.js';

export interface TurnCostInput {
  model: string;
  fresh_input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  cache_write_5m_tokens: number | null;
  cache_write_1h_tokens: number | null;
}

const PER_MTOK = 1_000_000;

export function computeTurnCost(t: TurnCostInput, table: PricingTable): number {
  const p = table.models[t.model];
  if (!p) return 0;
  const cw5 = p.cache_write_5m ?? p.input;
  const cw1 = p.cache_write_1h ?? p.input;
  const writeTier =
    t.cache_write_5m_tokens !== null && t.cache_write_1h_tokens !== null
      ? (t.cache_write_5m_tokens * cw5 + t.cache_write_1h_tokens * cw1) / PER_MTOK
      : (t.cache_write_tokens * cw5) / PER_MTOK;

  return (
    (t.fresh_input_tokens * p.input) / PER_MTOK +
    (t.output_tokens * p.output) / PER_MTOK +
    (t.cache_read_tokens * p.cache_read) / PER_MTOK +
    writeTier
  );
}
