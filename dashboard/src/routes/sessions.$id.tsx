import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';
import type { Tab } from '@/features/session/SessionPage';

const TABS: Tab[] = ['overview', 'timeline', 'subagents'];

export const Route = createFileRoute('/sessions/$id')({
  validateSearch: (s: Record<string, unknown>) => ({ tab: TABS.includes(s.tab as Tab) ? (s.tab as Tab) : 'overview' }),
  component: lazyRouteComponent(() => import('@/features/session/SessionPage')),
});
