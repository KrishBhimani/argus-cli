import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

export const Route = createFileRoute('/budgets')({ component: lazyRouteComponent(() => import('@/features/budgets/BudgetsPage')) });
