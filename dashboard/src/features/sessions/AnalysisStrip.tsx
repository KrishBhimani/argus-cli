import { useMemo, useState } from 'react';
import type { Session } from '@/lib/api/client';
import { Panel } from '@/components/ui/Panel';
import { Seg } from '@/components/ui/Seg';
import { Chip } from '@/components/ui/Chip';
import { Scatter } from '@/components/charts/Scatter';
import { Bars } from '@/components/charts/Bars';
import { ChartWithTable } from '@/components/charts/ChartTable';
import { byProject, sessionTokens } from '@/lib/analysis/rollups';
import { dur, num, shortDate, shortPath, tok, usd } from '@/lib/format/format';

const DUR_TICKS = [1, 10, 60, 600, 3600, 8 * 3600, 86400, 7 * 86400];
const TOK_TICKS = [1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9];
const tokTick = (n: number) => tok(n).replace(/\.0+(?=[kMB]$)/, '');
const durTick = (s: number) => (s >= 86400 ? `${Math.round(s / 86400)}d` : s >= 3600 ? `${Math.round(s / 3600)}h` : s >= 60 ? `${Math.round(s / 60)}m` : `${s}s`);

export function AnalysisStrip({ sessions }: { sessions: Session[] }) {
  const [open, setOpen] = useState(true);
  const [view, setView] = useState<'scatter' | 'project'>('scatter');
  const proj = useMemo(() => byProject(sessions), [sessions]);
  const points = useMemo(
    () =>
      sessions
        .filter((s) => (s.duration_sec ?? 0) > 0)
        .map((s) => ({
          x: s.duration_sec ?? 1,
          y: sessionTokens(s),
          label: shortPath(s.project_path, 48),
          detail: `${shortDate(s.started_at)} · ${dur(s.duration_sec)} · ${tok(sessionTokens(s))} · ${usd(s.total_cost_usd)} · ${num(s.turn_count)} turns`,
          group: s.primary_model,
        })),
    [sessions],
  );
  return (
    <Panel
      title="Analysis"
      sub={`${sessions.length} sessions`}
      right={
        <>
          <Seg options={[{ value: 'scatter', label: 'duration × tokens' }, { value: 'project', label: 'by project' }]} value={view} onChange={setView} />
          <Chip active={open} onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Show'}</Chip>
        </>
      }
    >
      {open &&
        (view === 'scatter' ? (
          <Scatter
            points={points}
            xLabel="duration"
            yLabel="tokens"
            logX
            logY
            formatX={durTick}
            formatY={tokTick}
            xTicks={DUR_TICKS}
            yTicks={TOK_TICKS}
            height={200}
          />
        ) : (
          <ChartWithTable
            chart={<Bars rows={proj.slice(0, 12).map((p) => ({ name: shortPath(p.project, 48), value: p.tokens }))} />}
            table={{ columns: ['project', 'sessions', 'tokens', 'est. cost'], rows: proj.map((p) => [p.project, p.sessions, num(p.tokens), usd(p.cost)]) }}
          />
        ))}
    </Panel>
  );
}
