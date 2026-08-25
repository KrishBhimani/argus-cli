import { render, screen, fireEvent } from '@testing-library/react';
import { CommandPalette } from './CommandPalette';

const nav = vi.fn();
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => nav }));
vi.mock('@/lib/api/hooks', () => ({
  useSessions: () => ({ data: [{ id: 'claude_code:abc', project_path: 'c:/proj/argus', primary_model: 'claude-opus-4-8', started_at: '2026-08-20T01:00:00' }] }),
}));

it('opens on Ctrl+K and navigates to a page', () => {
  render(<CommandPalette />);
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
  expect(screen.getByPlaceholderText(/jump to/i)).toBeInTheDocument();
  fireEvent.click(screen.getByText('Alerts'));
  expect(nav).toHaveBeenCalledWith({ to: '/alerts' });
});
