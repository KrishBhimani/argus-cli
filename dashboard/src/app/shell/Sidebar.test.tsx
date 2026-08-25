import { render, screen } from '@testing-library/react';
import { Sidebar } from './Sidebar';

vi.mock('@tanstack/react-router', () => ({
  Link: (p: { to: string; children: React.ReactNode; 'data-active'?: boolean }) => (
    <a href={p.to} data-active={p['data-active']}>{p.children}</a>
  ),
  useRouterState: () => '/sessions',
}));
vi.mock('@/lib/api/hooks', () => ({
  useUnseenAlerts: () => ({ data: [{ id: 1 }] }),
  useIngestStatus: () => ({ data: { foregroundComplete: true, pending: 0, processed: 1, total: 1, sessionCount: 153 } }),
  usePricing: () => ({ data: { version: '2026-07-31' } }),
}));

it('groups navigation by job and shows the unseen-alert badge', () => {
  render(<Sidebar />);
  for (const g of ['MONITOR', 'ANALYZE', 'SEARCH', 'GOVERN']) expect(screen.getByText(g)).toBeInTheDocument();
  expect(screen.getByText('Alerts').parentElement).toHaveTextContent('1');
  expect(screen.getByText('tracking 153 sessions')).toBeInTheDocument();
});
