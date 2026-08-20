import { render, screen } from '@testing-library/react';
import { App } from './main';

test('renders the brand', () => {
  render(<App />);
  expect(screen.getByText('ARGUS')).toBeInTheDocument();
});
