import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

export const Route = createFileRoute('/alerts')({ component: lazyRouteComponent(() => import('@/features/alerts/AlertsPage')) });
