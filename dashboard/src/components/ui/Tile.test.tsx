import { render, screen } from '@testing-library/react';
import { Tile } from './Tile';

it('renders value and a signed percentage delta with an arrow', () => {
  render(<Tile label="Estimated cost" value="$573" delta={{ abs: 60, pct: 0.12, dir: 'up' }} upIsBad />);
  expect(screen.getByText('$573')).toBeInTheDocument();
  const d = screen.getByTestId('delta');
  expect(d).toHaveTextContent('+12%');
  expect(d.querySelector('svg')).not.toBeNull();
  expect(d.className).toMatch(/crit/);
});

it('uses neutral colour when up is not bad and shows abs when pct is null', () => {
  render(<Tile label="Tokens" value="1" delta={{ abs: 3, pct: null, dir: 'up' }} />);
  const d = screen.getByTestId('delta');
  expect(d).toHaveTextContent('+3');
  expect(d.className).not.toMatch(/crit|good/);
});

it('omits the delta entirely when null', () => {
  render(<Tile label="Tokens" value="1" delta={null} />);
  expect(screen.queryByTestId('delta')).toBeNull();
});
