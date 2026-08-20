import { TopBar, Page } from '@/app/shell/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';

export default function BudgetsPage() {
  return (
    <>
      <TopBar crumbs={['Govern', 'Budgets']} />
      <Page>
        <EmptyState title="Budgets" />
      </Page>
    </>
  );
}
