import { TopBar, Page } from '@/app/shell/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';

export default function OverviewPage() {
  return (
    <>
      <TopBar crumbs={['Monitor', 'Overview']} />
      <Page>
        <EmptyState title="Overview" />
      </Page>
    </>
  );
}
