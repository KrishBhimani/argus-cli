import type { Session, TrendsResponse } from '@/lib/api/client';

export type Granularity = 'day' | 'week' | 'month';
type Point = TrendsResponse['points'][number];

/** Same bucket key the server uses for /api/trends (UTC date; week = "YYYY-Www" counted from Jan 1 UTC). */
export function bucketKey(iso: string, g: Granularity): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const day = `${y}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  if (g === 'day') return day;
  if (g === 'month') return day.slice(0, 7);
  const start = Date.UTC(y, 0, 1);
  const diff = (Date.UTC(y, d.getUTCMonth(), d.getUTCDate()) - start) / 86_400_000;
  const jsDow = new Date(start).getUTCDay();
  return `${y}-W${String(Math.floor((diff + jsDow) / 7) + 1).padStart(2, '0')}`;
}

export type BucketTotals = { bucket: string; tokens: number; cost: number; sessions: number };

/** Totals across groups per bucket. `sessions` sums per-group counts, so a session that used two models counts twice. */
export function bucketTotals(points: Point[]): BucketTotals[] {
  return points.map((p) => {
    let tokens = 0, cost = 0, sessions = 0;
    for (const g of Object.values(p.groups)) { tokens += g.tokens; cost += g.cost; sessions += g.sessions; }
    return { bucket: p.bucket, tokens, cost, sessions };
  });
}

export const perSession = (t: BucketTotals[]) => t.map((b) => (b.sessions ? b.tokens / b.sessions : 0));
export const perMTokens = (t: BucketTotals[]) => t.map((b) => (b.tokens ? b.cost / (b.tokens / 1e6) : 0));

/** Cache-read share (cache_read ÷ all tokens) per bucket, from sessions bucketed by start time. */
export function cacheShareByBucket(sessions: Session[], labels: string[], g: Granularity): number[] {
  const read = new Map<string, number>(), all = new Map<string, number>();
  for (const s of sessions) {
    const k = bucketKey(s.started_at, g);
    const tot = s.total_fresh_input_tokens + s.total_output_tokens + s.total_cache_read_tokens + s.total_cache_write_tokens;
    read.set(k, (read.get(k) ?? 0) + s.total_cache_read_tokens);
    all.set(k, (all.get(k) ?? 0) + tot);
  }
  return labels.map((l) => (all.get(l) ? (read.get(l) ?? 0) / all.get(l)! : 0));
}

/** Average of the last `n` *complete* buckets (the final bucket is usually partial) — null when fewer than 2 buckets. */
export function runRate(values: number[], n = 4): number | null {
  const complete = values.slice(0, -1);
  if (complete.length === 0) return null;
  const tail = complete.slice(-n);
  return tail.reduce((a, b) => a + b, 0) / tail.length;
}

export const BUCKETS_PER_MONTH: Record<Granularity, number> = { day: 30.4, week: 4.35, month: 1 };
