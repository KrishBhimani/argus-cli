import { render, screen } from '@testing-library/react';
import { AreaLine } from './AreaLine';

it('mounts a uPlot chart and a legend for two series', () => {
  render(<AreaLine labels={['a', 'b']} series={[{ name: 'opus', values: [1, 2] }, { name: 'sonnet', values: [2, 1] }]} />);
  expect(document.querySelector('.uplot')).not.toBeNull();
  expect(screen.getByText('opus')).toBeInTheDocument();
  expect(screen.getByText('sonnet')).toBeInTheDocument();
});

it('omits the legend for one series', () => {
  render(<AreaLine labels={['a']} series={[{ name: 'tokens', values: [1] }]} />);
  expect(screen.queryByRole('list')).toBeNull();
});
