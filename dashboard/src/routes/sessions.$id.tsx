import { createFileRoute } from '@tanstack/react-router';
import SessionPage, { type Tab } from '@/features/session/SessionPage';

const TABS: Tab[] = ['overview', 'timeline', 'subagents'];

export const Route = createFileRoute('/sessions/$id')({
  validateSearch: (s: Record<string, unknown>) => ({ tab: TABS.includes(s.tab as Tab) ? (s.tab as Tab) : 'overview' }),
  component: SessionPage,
});
