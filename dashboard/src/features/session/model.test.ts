import type { TimelineTurn } from '@/lib/api/client';
import { cumulativeCost, toolMix, turnHasError, cacheRatio } from './model';

const t = (o: Partial<TimelineTurn>): TimelineTurn => ({
  sequence: 1, timestamp: '', model: 'm', fresh_input_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0, output_tokens: 0, cost_usd: 0, tool_calls: [], ...o,
});
const call = (tool_name: string, is_error: 0 | 1) => ({ tool_name, tool_use_id: '', is_error, input_size: 0, subagent_type: null, error_text: null });

it('cumulativeCost', () => expect(cumulativeCost([t({ cost_usd: 1 }), t({ cost_usd: 2 })])).toEqual([1, 3]));

it('toolMix counts calls and errors per tool', () => {
  const turns = [t({ tool_calls: [call('Bash', 1), call('Read', 0)] }), t({ tool_calls: [call('Bash', 0)] })];
  expect(toolMix(turns)).toEqual([{ name: 'Bash', value: 2, error: 1 }, { name: 'Read', value: 1, error: 0 }]);
  expect(turnHasError(turns[0])).toBe(true);
});

it('cacheRatio', () => expect(cacheRatio(t({ cache_read_tokens: 75, output_tokens: 25 }))).toBe(0.75));
