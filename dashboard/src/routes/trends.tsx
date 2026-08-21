import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

export const Route = createFileRoute('/trends')({ component: lazyRouteComponent(() => import('@/features/trends/TrendsPage')) });
