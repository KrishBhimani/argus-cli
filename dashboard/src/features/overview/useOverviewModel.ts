import { useMemo } from 'react';
import type { Overview, Session, Window } from '@/lib/api/client';
import { useOverview, useSessions, useToolsOverview } from '@/lib/api/hooks';
import { priorWindowTotal, widerWindowFor, windowDays } from '@/lib/analysis/windows';
import { delta, type Delta } from '@/lib/analysis/deltas';
import { inWindow, priorWindowSessions } from '@/lib/analysis/rollups';

type Tools = { total_calls: number; total_errors: number } | undefined;
export type Tiles = { tokens: Delta | null; cost: Delta | null; sessions: Delta | null; errorRate: Delta | null };
const NONE: Tiles = { tokens: null, cost: null, sessions: null, errorRate: null };

/** Deltas vs the previous equal-length window, derived from the wider window's per-day maps. */
export function overviewTiles(cur: Overview, wider: Overview, w: Window, today: Date, toolsCur: Tools, toolsWider: Tools, prevSessions: number | null): Tiles {
  if (windowDays(w) == null) return NONE;
  const prevTok = priorWindowTotal(wider.tokens_by_day, w, today);
  const prevCost = priorWindowTotal(wider.cost_by_day, w, today);
  // Session counts are not per-day in the API; the caller counts the prior window from the
  // session list (by start date). candidate-endpoint: prior_window on /api/overview.
  let errorRate: Delta | null = null;
  if (toolsCur && toolsWider) {
    const curRate = toolsCur.total_calls ? toolsCur.total_errors / toolsCur.total_calls : 0;
    const pc = toolsWider.total_calls - toolsCur.total_calls;
    const pe = toolsWider.total_errors - toolsCur.total_errors;
    // Prior rate = (wider − current): a longer span than the current window, but a ratio, so comparable.
    const prevRate = pc > 0 ? pe / pc : null;
    errorRate =
      prevRate == null
        ? null
        : { abs: curRate - prevRate, pct: prevRate ? (curRate - prevRate) / prevRate : null, dir: curRate > prevRate ? 'up' : curRate < prevRate ? 'down' : 'flat' };
  }
  return { tokens: delta(cur.total_tokens, prevTok), cost: delta(cur.total_cost_usd, prevCost), sessions: delta(cur.session_count, prevSessions), errorRate };
}

export function useOverviewModel(w: Window, today = new Date()) {
  const cur = useOverview(w);
  const wider = useOverview(widerWindowFor(w));
  const tools = useToolsOverview(w);
  const toolsWider = useToolsOverview(widerWindowFor(w));
  const sessions = useSessions();
  const tiles = useMemo(() => {
    if (!cur.data || !wider.data) return NONE;
    const prev = sessions.data ? priorWindowSessions(sessions.data, w, today)?.length ?? null : null;
    return overviewTiles(cur.data, wider.data, w, today, tools.data, toolsWider.data, prev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur.data, wider.data, tools.data, toolsWider.data, sessions.data, w]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sessionsInWindow = useMemo(() => (sessions.data ? inWindow(sessions.data, w, today) : []), [sessions.data, w]);
  return {
    cur: cur.data,
    tiles,
    tools: tools.data,
    sessionsInWindow,
    allSessions: sessions.data ?? ([] as Session[]),
    isLoading: cur.isLoading,
    error: cur.error ?? tools.error ?? sessions.error,
  };
}
