import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

export const Route = createFileRoute('/models')({ component: lazyRouteComponent(() => import('@/features/models/ModelsPage')) });
