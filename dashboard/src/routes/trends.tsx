import { createFileRoute } from '@tanstack/react-router';
import TrendsPage from '@/features/trends/TrendsPage';

export const Route = createFileRoute('/trends')({ component: TrendsPage });
