import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { TopBar, Page } from '@/app/shell/TopBar';
import { Seg } from '@/components/ui/Seg';
import { Tile } from '@/components/ui/Tile';
import { Panel } from '@/components/ui/Panel';
import { ErrorPanel } from '@/components/ui/ErrorPanel';
import { Skeleton } from '@/components/ui/Skeleton';
import { Bars } from '@/components/charts/Bars';
import { StackedColumns } from '@/components/charts/StackedColumns';
import { ChartWithTable } from '@/components/charts/ChartTable';
import { api, WINDOWS, type Window } from '@/lib/api/client';
import { useSessions, useToolsOverview } from '@/lib/api/hooks';
import { inWindow } from '@/lib/analysis/rollups';
import { windowDays } from '@/lib/analysis/windows';
import { num, pct } from '@/lib/format/format';
import { toolCallsByDay } from './toolsOverTime';
import { toolLabel } from '@/features/session/TimelineTab';

const MAX_DERIVE_SESSIONS = 60;

export default function ToolsPage() {
  const [w, setW] = useState<Window>('7d');
  const t = useToolsOverview(w);
  const sessions = useSessions();
  const inW = useMemo(() => (sessions.data ? inWindow(sessions.data, w, new Date()) : []), [sessions.data, w]);
  const derive = (windowDays(w) ?? 31) <= 30 && inW.length <= MAX_DERIVE_SESSIONS;
  const tls = useQueries({ queries: derive ? inW.map((s) => ({ queryKey: ['timeline', s.id], queryFn: () => api.timeline(s.id), staleTime: 5 * 60_000 })) : [] });
  const loading = tls.some((q) => q.isLoading);
  const overTime = useMemo(
    () => {
      const r = toolCallsByDay(tls.flatMap((q) => q.data?.turns ?? []));
      return { labels: r.labels, series: r.series.map((x) => ({ ...x, name: toolLabel(x.name) })) };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loading, inW],
  );

  if (t.error) return (<><TopBar crumbs={['Analyze', 'Tools']} /><Page><ErrorPanel error={t.error} /></Page></>);
  const d = t.data;
  const top = d?.tool_leaderboard[0];
  const mcp = d?.mcp_servers[0];
  const rate = d && d.total_calls ? d.total_errors / d.total_calls : 0;
  return (
    <>
      <TopBar crumbs={['Analyze', 'Tools']}><Seg options={WINDOWS.map((v) => ({ value: v, label: v }))} value={w} onChange={setW} /></TopBar>
      <Page>
        <div className="grid grid-cols-4 gap-3">
          <Tile label="Tool calls" value={d ? num(d.total_calls) : '—'} sub={`last ${w}`} />
          <Tile label="Error rate" value={d ? pct(rate) : '—'} sub={d ? `${num(d.total_errors)} errors` : undefined} tone={d && rate > 0.05 ? 'crit' : 'default'} />
          <Tile label="Top tool" value={top?.name ?? '—'} sub={top ? `${num(top.calls)} calls` : undefined} />
          <Tile label="Top MCP" value={mcp?.server ?? '—'} sub={mcp ? `${num(mcp.calls)} calls` : 'no MCP calls'} />
        </div>
        <Panel title="Tool leaderboard" sub="calls · red segment = errors">
          {d ? (
            <ChartWithTable
              chart={<Bars rows={d.tool_leaderboard.slice(0, 15).map((r) => ({ name: r.name, value: r.calls, error: r.errors }))} format={num} />}
              table={{ columns: ['tool', 'calls', 'errors', 'error rate'], rows: d.tool_leaderboard.map((r) => [r.name, r.calls, r.errors, pct(r.error_rate)]) }}
            />
          ) : <Skeleton w="100%" h="200px" />}
        </Panel>
        <Panel title="Tool calls per day" sub={derive ? 'top 5 tools + other, by the day each call happened' : `available for windows ≤ 30 days with ≤ ${MAX_DERIVE_SESSIONS} sessions`}>
          {derive ? (
            loading ? <Skeleton w="100%" h="200px" /> : overTime.labels.length ? (
              <ChartWithTable
                chart={<StackedColumns labels={overTime.labels} series={overTime.series} />}
                table={{ columns: ['day', ...overTime.series.map((s) => s.name)], rows: overTime.labels.map((l, i) => [l, ...overTime.series.map((s) => s.values[i])]) }}
              />
            ) : <div className="text-ink-2 text-center py-6">No tool calls in window.</div>
          ) : <div className="text-ink-2 text-center py-6">Narrow the window to see this chart. (A server-side aggregate is planned.)</div>}
        </Panel>
        <div className="grid grid-cols-2 gap-3">
          <Panel title="MCP servers">{d?.mcp_servers.length ? <Bars rows={d.mcp_servers.map((m) => ({ name: m.server, value: m.calls, error: m.errors }))} format={num} /> : <div className="text-ink-2 text-center py-6">No MCP calls.</div>}</Panel>
          <Panel title="Sub-agent invocations">{d?.subagents.length ? <Bars rows={d.subagents.map((m) => ({ name: m.type, value: m.calls, error: m.errors }))} format={num} /> : <div className="text-ink-2 text-center py-6">No sub-agents.</div>}</Panel>
        </div>
      </Page>
    </>
  );
}
