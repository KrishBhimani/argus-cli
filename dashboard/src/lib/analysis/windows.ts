import type { Window } from '@/lib/api/client';

export const windowDays = (w: Window): number | null => ({ '24h': 1, '7d': 7, '30d': 30, all: null })[w];

/** The window to fetch so that the *prior* equal-length range is present in the response. */
export const widerWindowFor = (w: Window): Window => ({ '24h': '7d', '7d': '30d', '30d': 'all', all: 'all' })[w] as Window;

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** n local-date keys (YYYY-MM-DD) ending at `end`. */
export function dayKeys(end: Date, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    out.push(iso(d));
  }
  return out;
}

export const sliceWindow = (byDay: Record<string, number>, keys: string[]): number =>
  keys.reduce((a, k) => a + (byDay[k] ?? 0), 0);

// candidate-endpoint: a server-side `prior_window` field on /api/overview would
// remove the need to fetch the wider window and slice days client-side.
export function priorWindowTotal(byDay: Record<string, number>, w: Window, today: Date): number | null {
  const n = windowDays(w);
  if (n == null) return null;
  const end = new Date(today);
  end.setDate(end.getDate() - n);
  return sliceWindow(byDay, dayKeys(end, n));
}
