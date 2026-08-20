import { useMemo, useState } from 'react';
import { TopBar, Page } from '@/app/shell/TopBar';
import { Seg } from '@/components/ui/Seg';
import { Tile } from '@/components/ui/Tile';
import { Panel } from '@/components/ui/Panel';
import { Chip } from '@/components/ui/Chip';
import { Kbd } from '@/components/ui/Kbd';
import { ErrorPanel } from '@/components/ui/ErrorPanel';
import { Skeleton } from '@/components/ui/Skeleton';
import { AreaLine } from '@/components/charts/AreaLine';
import { Bars } from '@/components/charts/Bars';
import { Meter } from '@/components/charts/Meter';
import { CalendarHeatmap } from '@/components/charts/CalendarHeatmap';
import { GridHeatmap } from '@/components/charts/GridHeatmap';
import { ChartWithTable } from '@/components/charts/ChartTable';
import { WINDOWS, type Window } from '@/lib/api/client';
import { useOverview, useTrends } from '@/lib/api/hooks';
import { useOverviewModel } from './useOverviewModel';
import { AttentionStrip } from './AttentionStrip';
import { TopSessions } from './TopSessions';
import { dayKeys, windowDays } from '@/lib/analysis/windows';
import { composition } from '@/lib/analysis/composition';
import { hourWeekday } from '@/lib/analysis/hourWeekday';
import { trendsToSeries } from '@/lib/analysis/series';
import { num, pct, tok, usd } from '@/lib/format/format';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

export default function OverviewPage() {
  const [w, setW] = useState<Window>('7d');
  const [stack, setStack] = useState(false);
  const m = useOverviewModel(w);
  const all = useOverview('all');
  const trends = useTrends('day', 'model');

  const keys = useMemo(() => {
    const n = windowDays(w);
    if (n) return dayKeys(new Date(), n);
    return Object.keys(m.cur?.tokens_by_day ?? {}).sort();
  }, [w, m.cur]);

  const line = useMemo(() => {
    if (stack && trends.data) {
      const pts = trends.data.points.filter((p) => keys.includes(p.bucket));
      const s = trendsToSeries(pts, 'tokens');
      return { labels: s.labels, series: s.names.map((n, i) => ({ name: n, values: s.rows[i] })) };
    }
    return { labels: keys, series: [{ name: 'tokens', values: keys.map((k) => m.cur?.tokens_by_day[k] ?? 0) }] };
  }, [stack, trends.data, keys, m.cur]);

  const models = useMemo(
    () => Object.entries(m.cur?.tokens_by_model ?? {}).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    [m.cur],
  );
  const comp = useMemo(() => composition(m.sessionsInWindow), [m.sessionsInWindow]);
  const hw = useMemo(() => hourWeekday(m.sessionsInWindow), [m.sessionsInWindow]);

  if (m.error) return (<><TopBar crumbs={['Monitor', 'Overview']} /><Page><ErrorPanel error={m.error} /></Page></>);

  const c = m.cur;
  const days = windowDays(w);
  const avg = c && c.session_count ? Math.round(c.total_tokens / c.session_count) : 0;
  const errRate = m.tools ? (m.tools.total_calls ? m.tools.total_errors / m.tools.total_calls : 0) : null;

  return (
    <>
      <TopBar crumbs={['Monitor', 'Overview']}>
        <Seg options={WINDOWS.map((v) => ({ value: v, label: v }))} value={w} onChange={setW} />
        <span className="text-ink-2 text-xs flex items-center gap-2">Jump anywhere <Kbd>Ctrl K</Kbd></span>
      </TopBar>
      <Page>
        <div className="grid grid-cols-4 gap-3">
          <Tile label="Tokens" value={c ? tok(c.total_tokens) : '—'} delta={m.tiles.tokens} sub="vs prior window" note={c ? `${tok(avg)} / session` : undefined} />
          <Tile label="Estimated cost" value={c ? usd(c.total_cost_usd) : '—'} delta={m.tiles.cost} upIsBad sub="vs prior window" note={c && days ? `${usd(c.total_cost_usd / days)} / day` : undefined} />
          <Tile label="Sessions" value={c ? num(c.session_count) : '—'} delta={m.tiles.sessions} sub="vs prior window" />
          <Tile label="Tool error rate" value={errRate == null ? '—' : pct(errRate)} delta={m.tiles.errorRate} upIsBad sub={m.tools ? `${num(m.tools.total_errors)} of ${num(m.tools.total_calls)} calls` : undefined} />
        </div>

        <AttentionStrip />

        <div className="grid grid-cols-[2fr_1fr] gap-3">
          <Panel title="Tokens per day" sub={stack ? 'fresh + output, by model' : 'all token kinds'} right={<Chip active={stack} onClick={() => setStack(!stack)}>Stack by model</Chip>}>
            {c ? (
              <ChartWithTable
                chart={<AreaLine labels={line.labels} series={line.series} stacked={stack} />}
                table={{ columns: ['day', ...line.series.map((s) => s.name)], rows: line.labels.map((l, i) => [l, ...line.series.map((s) => num(s.values[i] ?? 0))]) }}
              />
            ) : <Skeleton w="100%" h="220px" />}
          </Panel>
          <Panel title="Models" sub="share of tokens">
            {models.length ? <Bars rows={models} /> : <div className="text-ink-2 text-center py-6">No data.</div>}
            <div className="mt-auto pt-3 border-t border-line">
              <Meter parts={[
                { name: 'cache read', value: comp.cacheRead, color: '#3987e5' },
                { name: 'cache write', value: comp.cacheWrite, color: '#285a95' },
                { name: 'fresh', value: comp.fresh, color: '#1f3c63' },
                { name: 'output', value: comp.output, color: '#9ec5f4' },
              ]} />
            </div>
          </Panel>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Panel title="Activity" sub="last 90 days">{all.data ? <CalendarHeatmap byDay={all.data.tokens_by_day} days={90} /> : <Skeleton w="100%" h="100px" />}</Panel>
          <Panel title="When you work" sub="sessions started, by weekday × hour"><GridHeatmap matrix={hw} rowLabels={DOW} colLabels={HOURS} /></Panel>
        </div>

        <TopSessions rows={c?.top_sessions ?? []} />
      </Page>
    </>
  );
}
