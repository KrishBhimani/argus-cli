import type { TrendsResponse } from '@/lib/api/client';

const MAX = 5;

/** Aligned rows per group name (first-appearance order), top 5 by total + 'Other'. */
export function trendsToSeries(points: TrendsResponse['points'], field: 'tokens' | 'cost') {
  const labels = points.map((p) => p.bucket);
  const totals = new Map<string, number>();
  const order: string[] = [];
  for (const p of points)
    for (const [k, g] of Object.entries(p.groups)) {
      if (!totals.has(k)) order.push(k);
      totals.set(k, (totals.get(k) ?? 0) + g[field]);
    }
  const names = order.slice(0, MAX);
  const other = order.slice(MAX);
  const rows = names.map((n) => points.map((p) => p.groups[n]?.[field] ?? 0));
  if (other.length) {
    names.push('Other');
    rows.push(points.map((p) => other.reduce((a, k) => a + (p.groups[k]?.[field] ?? 0), 0)));
  }
  return { labels, names, rows };
}

export function shareOfTotal(rows: number[][]): number[][] {
  const cols = rows[0]?.length ?? 0;
  const sums = Array.from({ length: cols }, (_, i) => rows.reduce((a, r) => a + r[i], 0));
  return rows.map((r) => r.map((v, i) => (sums[i] ? v / sums[i] : 0)));
}

export const periodDeltas = (v: number[]): (number | null)[] => v.map((x, i) => (i === 0 ? null : x - v[i - 1]));
