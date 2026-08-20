import { createFileRoute } from '@tanstack/react-router';
import OverviewPage from '@/features/overview/OverviewPage';

export const Route = createFileRoute('/')({ component: OverviewPage });
