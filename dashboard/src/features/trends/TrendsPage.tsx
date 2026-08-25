import { useMemo, useState } from 'react';
import { TopBar, Page } from '@/app/shell/TopBar';
import { Seg } from '@/components/ui/Seg';
import { Tile } from '@/components/ui/Tile';
import { Panel } from '@/components/ui/Panel';
import { ErrorPanel } from '@/components/ui/ErrorPanel';
import { Skeleton } from '@/components/ui/Skeleton';
import { MultiLine } from '@/components/charts/MultiLine';
import { AreaLine } from '@/components/charts/AreaLine';
import { ChartTable } from '@/components/charts/ChartTable';
import { useSessions, useTrends } from '@/lib/api/hooks';
import { trendsToSeries } from '@/lib/analysis/series';
import { cumulative } from '@/lib/analysis/cumulative';
import { delta } from '@/lib/analysis/deltas';
import { BUCKETS_PER_MONTH, bucketTotals, cacheShareByBucket, perMTokens, perSession, runRate, type Granularity } from '@/lib/analysis/trendsMetrics';
import { num, pct, tok, usd } from '@/lib/format/format';

type By = 'model' | 'agent';
type Field = 'tokens' | 'cost';
const LABEL: Record<Granularity, string> = { day: 'day', week: 'week', month: 'month' };

export default function TrendsPage() {
  const [g, setG] = useState<Granularity>('week');
  const [by, setBy] = useState<By>('model');
  const [field, setField] = useState<Field>('tokens');
  const q = useTrends(g, by);
  const sessions = useSessions();

  const s = useMemo(() => (q.data ? trendsToSeries(q.data.points, field) : null), [q.data, field]);
  const totals = useMemo(() => (q.data ? bucketTotals(q.data.points) : []), [q.data]);
  const labels = useMemo(() => totals.map((t) => t.bucket), [totals]);
  const tokPerSession = useMemo(() => perSession(totals), [totals]);
  const unitCost = useMemo(() => perMTokens(totals), [totals]);
  const cacheShare = useMemo(() => (sessions.data ? cacheShareByBucket(sessions.data, labels, g) : []), [sessions.data, labels, g]);
  const cumCost = useMemo(() => cumulative(totals.map((t) => t.cost)), [totals]);
  const cumTok = useMemo(() => cumulative(totals.map((t) => t.tokens)), [totals]);

  const lineSeries = useMemo(() => (s ? s.names.map((n, i) => ({ name: n, values: s.rows[i] })) : []), [s]);
  const cumSeries = useMemo(() => [{ name: 'cumulative', values: field === 'tokens' ? cumTok : cumCost }], [field, cumTok, cumCost]);
  const perSessionSeries = useMemo(() => [{ name: 'tokens / session', values: tokPerSession }], [tokPerSession]);
  const cacheSeries = useMemo(() => [{ name: 'cache-read share', values: cacheShare }], [cacheShare]);
  const unitSeries = useMemo(() => [{ name: '$ / M tokens', values: unitCost }], [unitCost]);

  const cur = totals[totals.length - 1];
  const prev = totals[totals.length - 2];
  const fmt = field === 'tokens' ? tok : usd;
  const full = field === 'tokens' ? num : usd;
  const rate = runRate(totals.map((t) => t.cost));
  const monthly = rate == null ? null : rate * BUCKETS_PER_MONTH[g];

  if (q.error) return (<><TopBar crumbs={['Analyze', 'Trends']} /><Page><ErrorPanel error={q.error} /></Page></>);
  return (
    <>
      <TopBar crumbs={['Analyze', 'Trends']}>
        <Seg options={[{ value: 'day', label: 'day' }, { value: 'week', label: 'week' }, { value: 'month', label: 'month' }]} value={g} onChange={setG} />
        <Seg options={[{ value: 'model', label: 'by model' }, { value: 'agent', label: 'by agent' }]} value={by} onChange={setBy} />
        <Seg options={[{ value: 'tokens', label: 'tokens' }, { value: 'cost', label: 'cost' }]} value={field} onChange={setField} />
      </TopBar>
      <Page>
        <div className="grid grid-cols-5 gap-3">
          <Tile label={`Tokens · this ${LABEL[g]}`} value={cur ? tok(cur.tokens) : '—'} delta={cur && prev ? delta(cur.tokens, prev.tokens) : null} sub={`vs previous ${LABEL[g]}`} />
          <Tile label={`Est. cost · this ${LABEL[g]}`} value={cur ? usd(cur.cost) : '—'} delta={cur && prev ? delta(cur.cost, prev.cost) : null} upIsBad sub={`vs previous ${LABEL[g]}`} />
          <Tile label={`Sessions · this ${LABEL[g]}`} value={cur ? num(cur.sessions) : '—'} delta={cur && prev ? delta(cur.sessions, prev.sessions) : null} sub={`vs previous ${LABEL[g]}`} />
          <Tile label="Tokens per session" value={cur && cur.sessions ? tok(cur.tokens / cur.sessions) : '—'} delta={cur && prev && cur.sessions && prev.sessions ? delta(cur.tokens / cur.sessions, prev.tokens / prev.sessions) : null} upIsBad sub="heavier sessions cost more" />
          <Tile label="Run rate" value={monthly == null ? '—' : `${usd(monthly)} / mo`} sub={rate == null ? 'needs 2+ periods' : `avg of last ${Math.min(4, totals.length - 1)} complete ${LABEL[g]}s: ${usd(rate)} / ${LABEL[g]}`} />
        </div>
        <p className="m-0 text-[11px] text-ink-2 -mt-2">The current {LABEL[g]} is partial; deltas compare it with the previous one as it stands. Sessions that used two models count once per model.</p>

        <Panel title={field === 'tokens' ? 'Fresh + output tokens' : 'Estimated cost'} sub={`per ${LABEL[g]}, ${by === 'model' ? 'by model' : 'by agent'}`}>
          {s ? (s.labels.length ? <MultiLine labels={s.labels} series={lineSeries} format={fmt} height={260} /> : <div className="text-ink-2 text-center py-6">No data.</div>) : <Skeleton w="100%" h="260px" />}
        </Panel>

        <div className="grid grid-cols-2 gap-3">
          <Panel title="Cumulative" sub={`running total of ${field}`}>{s ? <AreaLine labels={labels} series={cumSeries} format={fmt} height={160} /> : <Skeleton w="100%" h="160px" />}</Panel>
          <Panel title="Tokens per session" sub="rising with flat session counts = sessions getting heavier">{s ? <AreaLine labels={labels} series={perSessionSeries} fill={false} format={tok} height={160} /> : <Skeleton w="100%" h="160px" />}</Panel>
          <Panel title="Cache-read share" sub="share of all tokens served from cache · a drop means paying full price for context">
            {sessions.data && s ? <AreaLine labels={labels} series={cacheSeries} fill={false} share height={160} /> : <Skeleton w="100%" h="160px" />}
          </Panel>
          <Panel title="Unit cost" sub="$ per million tokens · moves with the model mix, not with volume">{s ? <AreaLine labels={labels} series={unitSeries} fill={false} format={(n) => usd(n)} height={160} /> : <Skeleton w="100%" h="160px" />}</Panel>
        </div>

        <Panel title="Breakdown" padded={false}>
          {s && (
            <ChartTable
              columns={[LABEL[g], ...s.names, 'total', 'sessions', 'tok / session', 'cache read', '$ / M tok']}
              rows={totals.map((t, i) => [
                t.bucket,
                ...s.rows.map((r) => full(r[i])),
                full(field === 'tokens' ? t.tokens : t.cost),
                num(t.sessions),
                tok(tokPerSession[i] ?? 0),
                pct(cacheShare[i] ?? 0, 0),
                usd(unitCost[i] ?? 0),
              ])}
            />
          )}
        </Panel>
      </Page>
    </>
  );
}
