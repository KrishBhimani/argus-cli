import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Shell } from '@/app/shell/Shell';

export const Route = createRootRoute({
  component: () => (
    <Shell>
      <Outlet />
    </Shell>
  ),
});
