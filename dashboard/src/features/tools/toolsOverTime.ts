import type { TimelineTurn } from '@/lib/api/client';

// candidate-endpoint: per-day tool call counts; today derived from session timelines client-side.
const localDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Tool calls per local day (by each turn's own timestamp, so multi-day sessions spread correctly), top-N tools + Other. */
export function toolCallsByDay(turns: TimelineTurn[], top = 5) {
  const perDay = new Map<string, Map<string, number>>();
  const totals = new Map<string, number>();
  for (const t of turns) {
    if (!t.tool_calls.length) continue;
    const day = localDay(t.timestamp);
    const m = perDay.get(day) ?? new Map<string, number>();
    for (const c of t.tool_calls) {
      m.set(c.tool_name, (m.get(c.tool_name) ?? 0) + 1);
      totals.set(c.tool_name, (totals.get(c.tool_name) ?? 0) + 1);
    }
    perDay.set(day, m);
  }
  const labels = [...perDay.keys()].sort();
  const names = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  const head = names.slice(0, top), tail = names.slice(top);
  const series = head.map((n) => ({ name: n, values: labels.map((d) => perDay.get(d)?.get(n) ?? 0) }));
  if (tail.length) series.push({ name: 'Other', values: labels.map((d) => tail.reduce((a, n) => a + (perDay.get(d)?.get(n) ?? 0), 0)) });
  return { labels, series };
}
