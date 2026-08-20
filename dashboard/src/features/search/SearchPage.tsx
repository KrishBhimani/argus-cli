import { TopBar, Page } from '@/app/shell/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';

export default function SearchPage() {
  return (
    <>
      <TopBar crumbs={['Search', 'Transcripts']} />
      <Page>
        <EmptyState title="Transcripts" />
      </Page>
    </>
  );
}
