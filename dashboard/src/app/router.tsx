import { createRouter } from '@tanstack/react-router';
import { routeTree } from '../routeTree.gen';
import { Skeleton } from '@/components/ui/Skeleton';

const Pending = () => (
  <div className="p-5 flex flex-col gap-4">
    <Skeleton w="40%" h="28px" />
    <Skeleton w="100%" h="120px" />
  </div>
);

// Routes are code-split (lazyRouteComponent); `intent` preloading fetches a page's chunk on hover.
export const router = createRouter({ routeTree, defaultPreload: 'intent', defaultPendingComponent: Pending, defaultPendingMs: 150 });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
