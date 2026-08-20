import { TopBar, Page } from '@/app/shell/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';

export default function ModelsPage() {
  return (
    <>
      <TopBar crumbs={['Analyze', 'Models']} />
      <Page>
        <EmptyState title="Models" />
      </Page>
    </>
  );
}
