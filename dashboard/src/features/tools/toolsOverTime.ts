import type { TimelineTurn } from '@/lib/api/client';

// candidate-endpoint: per-day tool call counts; today derived from session timelines client-side.
/** Tool calls per day, top-N tools + Other. */
export function toolCallsByDay(items: { day: string; turns: TimelineTurn[] }[], top = 5) {
  const labels = [...new Set(items.map((i) => i.day))].sort();
  const perDay = new Map<string, Map<string, number>>();
  const totals = new Map<string, number>();
  for (const it of items) {
    const m = perDay.get(it.day) ?? new Map<string, number>();
    for (const t of it.turns)
      for (const c of t.tool_calls) {
        m.set(c.tool_name, (m.get(c.tool_name) ?? 0) + 1);
        totals.set(c.tool_name, (totals.get(c.tool_name) ?? 0) + 1);
      }
    perDay.set(it.day, m);
  }
  const names = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  const head = names.slice(0, top), tail = names.slice(top);
  const series = head.map((n) => ({ name: n, values: labels.map((d) => perDay.get(d)?.get(n) ?? 0) }));
  if (tail.length) series.push({ name: 'Other', values: labels.map((d) => tail.reduce((a, n) => a + (perDay.get(d)?.get(n) ?? 0), 0)) });
  return { labels, series };
}
