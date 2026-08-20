import { TopBar, Page } from '@/app/shell/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';

export default function ToolsPage() {
  return (
    <>
      <TopBar crumbs={['Analyze', 'Tools']} />
      <Page>
        <EmptyState title="Tools" />
      </Page>
    </>
  );
}
