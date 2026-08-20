import type { TimelineTurn } from '@/lib/api/client';
import { cumulative } from '@/lib/analysis/cumulative';

export const turnTokens = (t: TimelineTurn) => t.fresh_input_tokens + t.output_tokens;
export const turnAll = (t: TimelineTurn) => turnTokens(t) + t.cache_read_tokens + t.cache_write_tokens;
export const turnHasError = (t: TimelineTurn) => t.tool_calls.some((c) => c.is_error === 1);
export const cumulativeCost = (turns: TimelineTurn[]) => cumulative(turns.map((t) => t.cost_usd));

export function toolMix(turns: TimelineTurn[]) {
  const m = new Map<string, { name: string; value: number; error: number }>();
  for (const t of turns)
    for (const c of t.tool_calls) {
      const r = m.get(c.tool_name) ?? { name: c.tool_name, value: 0, error: 0 };
      r.value++;
      if (c.is_error === 1) r.error++;
      m.set(c.tool_name, r);
    }
  return [...m.values()].sort((a, b) => b.value - a.value);
}

export const cacheRatio = (t: TimelineTurn) => {
  const a = turnAll(t);
  return a ? t.cache_read_tokens / a : 0;
};

export const firstToolLine = (t: TimelineTurn) => t.tool_calls.map((c) => c.tool_name).join(', ');
