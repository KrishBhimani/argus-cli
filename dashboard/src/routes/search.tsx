import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

export const Route = createFileRoute('/search')({ component: lazyRouteComponent(() => import('@/features/search/SearchPage')) });
