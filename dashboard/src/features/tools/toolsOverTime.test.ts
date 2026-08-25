import type { TimelineTurn } from '@/lib/api/client';
import { toolCallsByDay } from './toolsOverTime';

const t = (names: string[], timestamp = '2026-08-20T10:00:00'): TimelineTurn => ({
  sequence: 1, timestamp, model: '', fresh_input_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0, output_tokens: 0, cost_usd: 0,
  tool_calls: names.map((n) => ({ tool_name: n, tool_use_id: '', is_error: 0 as const, input_size: 0, subagent_type: null, error_text: null })),
});

it('stacks tool calls per day with Other', () => {
  const r = toolCallsByDay([t(['Bash', 'Read'], '2026-08-20T10:00:00'), t(['Bash', 'Edit', 'Grep'], '2026-08-21T10:00:00')], 2);
  expect(r.labels).toEqual(['2026-08-20', '2026-08-21']);
  expect(r.series.map((s) => s.name)).toEqual(['Bash', 'Read', 'Other']);
  expect(r.series[0].values).toEqual([1, 1]);
  expect(r.series[2].values).toEqual([0, 2]);
});
