import { TopBar, Page } from '@/app/shell/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';

export default function SessionsPage() {
  return (
    <>
      <TopBar crumbs={['Analyze', 'Sessions']} />
      <Page>
        <EmptyState title="Sessions" />
      </Page>
    </>
  );
}
