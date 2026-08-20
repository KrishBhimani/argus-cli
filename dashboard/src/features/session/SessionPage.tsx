import { TopBar, Page } from '@/app/shell/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';

export type Tab = 'overview' | 'timeline' | 'subagents';

export default function SessionPage() {
  return (
    <>
      <TopBar crumbs={['Analyze', { label: 'Sessions', to: '/sessions' }, 'Session']} />
      <Page>
        <EmptyState title="Session" />
      </Page>
    </>
  );
}
