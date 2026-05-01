import type { PricingTable } from './types.js';

export interface PricingDiff {
  added: string[];
  removed: string[];
  changed: string[];
  unchanged: string[];
}

export function diffPricing(oldT: PricingTable, newT: PricingTable): PricingDiff {
  const oldKeys = new Set(Object.keys(oldT.models));
  const newKeys = new Set(Object.keys(newT.models));
  const added = [...newKeys].filter(k => !oldKeys.has(k)).sort();
  const removed = [...oldKeys].filter(k => !newKeys.has(k)).sort();
  const changed: string[] = [];
  const unchanged: string[] = [];
  for (const k of newKeys) {
    if (!oldKeys.has(k)) continue;
    const a = oldT.models[k], b = newT.models[k];
    if (JSON.stringify(a) === JSON.stringify(b)) unchanged.push(k);
    else changed.push(k);
  }
  return { added, removed, changed: changed.sort(), unchanged: unchanged.sort() };
}

const LITELLM_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';

export async function fetchLiteLlmTable(url = LITELLM_URL): Promise<PricingTable> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`LiteLLM fetch failed: ${r.status}`);
  const raw = await r.json() as Record<string, any>;
  const models: Record<string, { input: number; output: number; cache_read: number; cache_write_5m?: number; cache_write_1h?: number }> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k === 'sample_spec' || typeof v !== 'object' || !('input_cost_per_token' in v)) continue;
    const input = (v.input_cost_per_token ?? 0) * 1_000_000;
    const output = (v.output_cost_per_token ?? 0) * 1_000_000;
    const cacheRead = (v.cache_read_input_token_cost ?? 0) * 1_000_000;
    const cacheWrite = (v.cache_creation_input_token_cost ?? 0) * 1_000_000;
    models[k] = {
      input, output, cache_read: cacheRead,
      ...(cacheWrite ? { cache_write_5m: cacheWrite, cache_write_1h: cacheWrite * 1.6 } : {}),
    };
  }
  return { version: new Date().toISOString().slice(0, 10), models };
}
