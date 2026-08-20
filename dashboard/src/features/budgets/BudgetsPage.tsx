import { TopBar, Page } from '@/app/shell/TopBar';
import { Panel } from '@/components/ui/Panel';
import { Pill } from '@/components/ui/Pill';

export default function BudgetsPage() {
  return (
    <>
      <TopBar crumbs={['Govern', 'Budgets']} />
      <Page>
        <Panel title="Budgets" sub="not yet available">
          <div className="flex flex-col gap-3 max-w-xl text-xs text-ink-1">
            <div><Pill kind="mute">PLANNED</Pill></div>
            <p className="m-0">
              Budgets will let you set a monthly token or dollar ceiling per project or overall. Argus will show progress against it here and on the
              Overview, and raise alerts at thresholds you choose (for example 80% and 100%).
            </p>
            <p className="m-0">
              It arrives together with the <span className="font-mono text-ink-0">cost_spike</span> and <span className="font-mono text-ink-0">cache_hit_drop</span> detectors
              listed on the Alerts page. Until then, the Overview tiles' "vs prior window" deltas are the quickest read on spend direction.
            </p>
          </div>
        </Panel>
      </Page>
    </>
  );
}
