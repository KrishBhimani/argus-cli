import { render, screen } from '@testing-library/react';
import { Bars } from './Bars';

it('draws one row per entry, scaled to the max, with error segments', () => {
  render(<Bars rows={[{ name: 'Bash', value: 772, error: 41 }, { name: 'Read', value: 368 }]} />);
  expect(screen.getByText('Bash')).toBeInTheDocument();
  const fills = screen.getAllByTestId('bar-fill');
  expect(fills[0]).toHaveStyle({ width: '100%' });
  expect(fills[1]).toHaveStyle({ width: '47.66839378238342%' });
  expect(screen.getByTestId('bar-error')).toBeInTheDocument();
  expect(screen.getByText(/41/)).toBeInTheDocument();
});
