import { TopBar, Page } from '@/app/shell/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';

export default function SettingsPage() {
  return (
    <>
      <TopBar crumbs={['Govern', 'Settings']} />
      <Page>
        <EmptyState title="Settings" />
      </Page>
    </>
  );
}
