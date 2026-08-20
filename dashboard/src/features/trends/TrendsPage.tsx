import { TopBar, Page } from '@/app/shell/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';

export default function TrendsPage() {
  return (
    <>
      <TopBar crumbs={['Analyze', 'Trends']} />
      <Page>
        <EmptyState title="Trends" />
      </Page>
    </>
  );
}
