import { useState } from 'react';
import type { Session } from '@/lib/api/client';
import { Panel } from '@/components/ui/Panel';
import { Seg } from '@/components/ui/Seg';
import { Chip } from '@/components/ui/Chip';
import { Scatter } from '@/components/charts/Scatter';
import { Bars } from '@/components/charts/Bars';
import { ChartWithTable } from '@/components/charts/ChartTable';
import { byProject, sessionTokens } from '@/lib/analysis/rollups';
import { dur, num, shortPath, tok, usd } from '@/lib/format/format';

export function AnalysisStrip({ sessions }: { sessions: Session[] }) {
  const [open, setOpen] = useState(true);
  const [view, setView] = useState<'scatter' | 'project'>('scatter');
  const proj = byProject(sessions);
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
            points={sessions.filter((s) => (s.duration_sec ?? 0) > 0).map((s) => ({ x: s.duration_sec ?? 1, y: sessionTokens(s), label: `${shortPath(s.project_path)} · ${tok(sessionTokens(s))} · ${usd(s.total_cost_usd)}`, group: s.primary_model }))}
            xLabel="duration"
            yLabel="tokens"
            logX
            logY
            formatX={(n) => dur(Math.round(n))}
            formatY={tok}
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
