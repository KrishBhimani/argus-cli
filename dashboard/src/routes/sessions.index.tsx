import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

export const Route = createFileRoute('/sessions/')({ component: lazyRouteComponent(() => import('@/features/sessions/SessionsPage')) });
