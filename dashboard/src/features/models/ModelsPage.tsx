import { useMemo, useState } from 'react';
import { TopBar, Page } from '@/app/shell/TopBar';
import { Seg } from '@/components/ui/Seg';
import { Panel } from '@/components/ui/Panel';
import { ErrorPanel } from '@/components/ui/ErrorPanel';
import { Skeleton } from '@/components/ui/Skeleton';
import { Bars } from '@/components/charts/Bars';
import { StackedColumns } from '@/components/charts/StackedColumns';
import { MultiLine } from '@/components/charts/MultiLine';
import { ChartTable } from '@/components/charts/ChartTable';
import { WINDOWS, type Window } from '@/lib/api/client';
import { useOverview, useTrends } from '@/lib/api/hooks';
import { perMTokens } from '@/lib/analysis/rollups';
import { dayKeys, windowDays } from '@/lib/analysis/windows';
import { shareOfTotal, trendsToSeries } from '@/lib/analysis/series';
import { num, tok, usd } from '@/lib/format/format';

type ShareView = 'lines' | 'columns' | 'table';

export default function ModelsPage() {
  const [w, setW] = useState<Window>('30d');
  const [shareView, setShareView] = useState<ShareView>('lines');
  const ov = useOverview(w);
  const days = windowDays(w);
  const gran = days != null ? 'day' : 'week';
  const tr = useTrends(gran, 'model');
  const rows = useMemo(
    () =>
      Object.keys({ ...ov.data?.tokens_by_model, ...ov.data?.cost_by_model })
        .map((m) => ({ model: m, tokens: ov.data?.tokens_by_model[m] ?? 0, cost: ov.data?.cost_by_model[m] ?? 0 }))
        .sort((a, b) => b.cost - a.cost),
    [ov.data],
  );
  const share = useMemo(() => {
    if (!tr.data) return null;
    // Follow the page window: daily buckets inside the window, or the last 26 weeks for "all".
    const keys = days != null ? new Set(dayKeys(new Date(), days)) : null;
    const pts = keys ? tr.data.points.filter((pt) => keys.has(pt.bucket)) : tr.data.points.slice(-26);
    const s = trendsToSeries(pts, 'tokens');
    const norm = shareOfTotal(s.rows);
    return {
      labels: s.labels,
      raw: s.names.map((n, i) => ({ name: n, values: s.rows[i] })),
      pct: s.names.map((n, i) => ({ name: n, values: norm[i] })),
    };
  }, [tr.data, days]);
  const totalCost = rows.reduce((a, x) => a + x.cost, 0);

  if (ov.error) return (<><TopBar crumbs={['Analyze', 'Models']} /><Page><ErrorPanel error={ov.error} /></Page></>);
  return (
    <>
      <TopBar crumbs={['Analyze', 'Models']}><Seg options={WINDOWS.map((v) => ({ value: v, label: v }))} value={w} onChange={setW} /></TopBar>
      <Page>
        <div className="grid grid-cols-2 gap-3">
          <Panel title="Tokens by model">{ov.data ? (rows.length ? <Bars rows={rows.map((r) => ({ name: r.model, value: r.tokens }))} /> : <div className="text-ink-2 text-center py-6">No data.</div>) : <Skeleton w="100%" h="160px" />}</Panel>
          <Panel title="Estimated cost by model">{ov.data ? (rows.length ? <Bars rows={rows.map((r) => ({ name: r.model, value: r.cost }))} format={usd} color="#285a95" /> : <div className="text-ink-2 text-center py-6">No data.</div>) : <Skeleton w="100%" h="160px" />}</Panel>
        </div>
        <Panel title="Price efficiency" sub="$ per million tokens, as experienced in this window">
          {rows.some((r) => r.tokens > 0) ? <Bars rows={rows.filter((r) => r.tokens > 0).map((r) => ({ name: r.model, value: perMTokens(r.cost, r.tokens) ?? 0 }))} format={usd} color="#3173c4" /> : <div className="text-ink-2 text-center py-6">No data.</div>}
        </Panel>
        <Panel
          title={days != null ? 'Model share by day' : 'Model share by week'}
          sub={`% of each ${days != null ? 'day' : 'week'}'s fresh + output tokens · last ${w}`}
          right={<Seg options={[{ value: 'lines', label: 'lines' }, { value: 'columns', label: 'columns' }, { value: 'table', label: 'table' }]} value={shareView} onChange={setShareView} />}
        >
          {share ? (
            share.raw.length ? (
              shareView === 'lines' ? <MultiLine labels={share.labels} series={share.pct} share height={240} />
              : shareView === 'columns' ? <StackedColumns labels={share.labels} series={share.raw} share format={tok} />
              : <ChartTable columns={[days != null ? 'day' : 'week', ...share.raw.map((x) => x.name)]} rows={share.labels.map((l, i) => [l, ...share.pct.map((x) => `${Math.round((x.values[i] ?? 0) * 100)}%`)])} />
            ) : <div className="text-ink-2 text-center py-6">No data.</div>
          ) : <Skeleton w="100%" h="240px" />}
        </Panel>
        <Panel title="Per-model details" padded={false}>
          <ChartTable
            columns={['model', 'tokens', 'est. cost', '$ / M tokens', 'share of cost']}
            rows={rows.map((r) => { const pm = perMTokens(r.cost, r.tokens); return [r.model, num(r.tokens), usd(r.cost), pm == null ? '—' : usd(pm), totalCost ? `${Math.round((r.cost / totalCost) * 100)}%` : '—']; })}
          />
        </Panel>
      </Page>
    </>
  );
}
