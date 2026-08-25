import { render, screen } from '@testing-library/react';
import { Meter } from './Meter';

it('renders a legend entry per part with its share', () => {
  render(<Meter parts={[{ name: 'cache read', value: 88, color: '#3987e5' }, { name: 'fresh', value: 12, color: '#1f3c63' }]} />);
  expect(screen.getByText('cache read')).toBeInTheDocument();
  expect(screen.getByText('88%')).toBeInTheDocument();
});
