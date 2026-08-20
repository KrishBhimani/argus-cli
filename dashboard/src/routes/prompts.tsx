import { createFileRoute, redirect } from '@tanstack/react-router';

/** Legacy `/prompts` URL from the Astro dashboard. */
export const Route = createFileRoute('/prompts')({
  beforeLoad: () => {
    throw redirect({ to: '/search' });
  },
});
