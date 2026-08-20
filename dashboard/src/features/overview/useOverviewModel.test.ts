import type { Overview } from '@/lib/api/client';
import { overviewTiles } from './useOverviewModel';

const today = new Date('2026-08-21T12:00:00');
const ov = (byDay: Record<string, number>, costByDay: Record<string, number>, sessions: number): Overview => ({
  window: '7d',
  total_cost_usd: Object.values(costByDay).reduce((a, b) => a + b, 0),
  total_tokens: Object.values(byDay).reduce((a, b) => a + b, 0),
  session_count: sessions,
  agent_split: {},
  cost_by_day: costByDay,
  cost_by_model: {},
  tokens_by_day: byDay,
  tokens_by_model: {},
  top_sessions: [],
});

it('computes deltas against the prior equal window from the wider response', () => {
  const cur = ov({ '2026-08-21': 10 }, { '2026-08-21': 1 }, 2);
  const wider = ov({ '2026-08-21': 10, '2026-08-20': 5 }, { '2026-08-21': 1, '2026-08-20': 2 }, 3);
  const t = overviewTiles(cur, wider, '24h', today, { total_calls: 10, total_errors: 1 }, { total_calls: 30, total_errors: 2 });
  expect(t.tokens).toEqual({ abs: 5, pct: 1, dir: 'up' });
  expect(t.cost?.dir).toBe('down');
  expect(t.sessions).toEqual({ abs: 1, pct: 1, dir: 'up' });
  expect(t.errorRate?.dir).toBe('up'); // 10% now vs 5% before (1/20)
});

it('returns null deltas for the all window', () => {
  const cur = ov({ '2026-08-21': 10 }, {}, 1);
  expect(overviewTiles(cur, cur, 'all', today, undefined, undefined)).toEqual({ tokens: null, cost: null, sessions: null, errorRate: null });
});
