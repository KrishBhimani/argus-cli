import { render, screen, fireEvent } from '@testing-library/react';
import { Seg } from './Seg';

it('Seg marks the selected tab and reports changes', () => {
  const onChange = vi.fn();
  render(<Seg options={[{ value: '7d', label: '7d' }, { value: '30d', label: '30d' }]} value="7d" onChange={onChange} />);
  expect(screen.getByRole('tab', { name: '7d' })).toHaveAttribute('aria-selected', 'true');
  fireEvent.click(screen.getByRole('tab', { name: '30d' }));
  expect(onChange).toHaveBeenCalledWith('30d');
});
