import { useMemo, useState } from 'react';
import { TopBar, Page } from '@/app/shell/TopBar';
import { Seg } from '@/components/ui/Seg';
import { Panel } from '@/components/ui/Panel';
import { ErrorPanel } from '@/components/ui/ErrorPanel';
import { Skeleton } from '@/components/ui/Skeleton';
import { MultiLine } from '@/components/charts/MultiLine';
import { AreaLine } from '@/components/charts/AreaLine';
import { ChartTable } from '@/components/charts/ChartTable';
import { useTrends } from '@/lib/api/hooks';
import { periodDeltas, trendsToSeries } from '@/lib/analysis/series';
import { cumulative } from '@/lib/analysis/cumulative';
import { num, tok, usd } from '@/lib/format/format';

type G = 'day' | 'week' | 'month';
type By = 'model' | 'agent';
type Field = 'tokens' | 'cost';

export default function TrendsPage() {
  const [g, setG] = useState<G>('week');
  const [by, setBy] = useState<By>('model');
  const [field, setField] = useState<Field>('tokens');
  const q = useTrends(g, by);
  const s = useMemo(() => (q.data ? trendsToSeries(q.data.points, field) : null), [q.data, field]);
  const totals = useMemo(() => (s ? s.labels.map((_, i) => s.rows.reduce((a, r) => a + r[i], 0)) : []), [s]);
  const deltas = useMemo(() => periodDeltas(totals), [totals]);
  const cum = useMemo(() => cumulative(totals), [totals]);
  const fmt = field === 'tokens' ? tok : usd;
  const full = field === 'tokens' ? num : usd;
  const signed = (d: number | null) => (d == null ? '—' : (d >= 0 ? '+' : '−') + fmt(Math.abs(d)));
  const maxAbs = Math.max(1, ...deltas.map((x) => Math.abs(x ?? 0)));
  const lineSeries = useMemo(() => (s ? s.names.map((n, i) => ({ name: n, values: s.rows[i] })) : []), [s]);
  const cumSeries = useMemo(() => [{ name: 'cumulative', values: cum }], [cum]);

  if (q.error) return (<><TopBar crumbs={['Analyze', 'Trends']} /><Page><ErrorPanel error={q.error} /></Page></>);
  return (
    <>
      <TopBar crumbs={['Analyze', 'Trends']}>
        <Seg options={[{ value: 'day', label: 'day' }, { value: 'week', label: 'week' }, { value: 'month', label: 'month' }]} value={g} onChange={setG} />
        <Seg options={[{ value: 'model', label: 'by model' }, { value: 'agent', label: 'by agent' }]} value={by} onChange={setBy} />
        <Seg options={[{ value: 'tokens', label: 'tokens' }, { value: 'cost', label: 'cost' }]} value={field} onChange={setField} />
      </TopBar>
      <Page>
        <Panel title={field === 'tokens' ? 'Fresh + output tokens' : 'Estimated cost'} sub={`per ${g}`}>
          {s ? (s.labels.length ? <MultiLine labels={s.labels} series={lineSeries} format={fmt} height={260} /> : <div className="text-ink-2 text-center py-6">No data.</div>) : <Skeleton w="100%" h="260px" />}
        </Panel>
        <div className="grid grid-cols-2 gap-3">
          <Panel title="Change vs previous period" sub="total across groups · orange up, aqua down">
            {s ? (
              <div className="flex items-end gap-1 h-28">
                {deltas.map((d, i) => {
                  const h = d == null ? 0 : (Math.abs(d) / maxAbs) * 100;
                  return (
                    <div key={i} title={`${s.labels[i]}: ${signed(d)}`} className="flex-1 flex flex-col justify-end min-w-[3px] h-full">
                      <i className={`block rounded-t-sm ${d != null && d < 0 ? 'bg-s3' : 'bg-s2'}`} style={{ height: `${h}%` }} />
                    </div>
                  );
                })}
              </div>
            ) : <Skeleton w="100%" h="112px" />}
          </Panel>
          <Panel title="Cumulative" sub="running total">{s ? <AreaLine labels={s.labels} series={cumSeries} format={fmt} height={112} /> : <Skeleton w="100%" h="112px" />}</Panel>
        </div>
        <Panel title="Breakdown" padded={false}>
          {s && (
            <ChartTable
              columns={[g, ...s.names, 'total', 'Δ']}
              rows={s.labels.map((l, i) => [l, ...s.rows.map((r) => full(r[i])), full(totals[i]), signed(deltas[i])])}
            />
          )}
        </Panel>
      </Page>
    </>
  );
}
