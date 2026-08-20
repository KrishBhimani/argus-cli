import { createFileRoute, redirect } from '@tanstack/react-router';

/** Legacy `/session?id=…` URLs from the Astro dashboard. */
export const Route = createFileRoute('/session')({
  validateSearch: (s: Record<string, unknown>) => ({ id: typeof s.id === 'string' ? s.id : '' }),
  beforeLoad: ({ search }) => {
    if (search.id) throw redirect({ to: '/sessions/$id', params: { id: search.id }, search: { tab: 'overview' } });
    throw redirect({ to: '/sessions' });
  },
});
