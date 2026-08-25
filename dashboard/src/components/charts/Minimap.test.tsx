import { render, fireEvent } from '@testing-library/react';
import type { TimelineTurn } from '@/lib/api/client';
import { Minimap } from './Minimap';

it('draws a bar per turn, flags errors, reports clicks', () => {
  const onPick = vi.fn();
  const base = { timestamp: '', model: 'm', cost_usd: 0, cache_write_tokens: 0 };
  const turns: TimelineTurn[] = [
    { ...base, sequence: 1, fresh_input_tokens: 5, output_tokens: 5, cache_read_tokens: 10, tool_calls: [] },
    { ...base, sequence: 2, fresh_input_tokens: 1, output_tokens: 1, cache_read_tokens: 1, tool_calls: [{ tool_name: 'Bash', tool_use_id: '', is_error: 1, input_size: 0, subagent_type: null, error_text: null }] },
  ];
  const { container } = render(<Minimap turns={turns} onPick={onPick} />);
  expect(container.querySelectorAll('g[data-turn]').length).toBe(2);
  expect(container.querySelector('g[data-turn="2"] rect[data-kind="top"]')?.getAttribute('fill')).toBe('#d03b3b');
  fireEvent.click(container.querySelector('g[data-turn="2"]')!);
  expect(onPick).toHaveBeenCalledWith(2);
});
