import type { Session, TimelineTurn } from '@/lib/api/client';
import { Panel } from '@/components/ui/Panel';
import { Bars } from '@/components/charts/Bars';
import { fmtLocalDateTime, num } from '@/lib/format/format';
import { cacheRatio, toolMix } from './model';

export function OverviewTab({ session: s, turns }: { session: Session; turns: TimelineTurn[] }) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const meta: [string, string][] = [
    ['Project', s.project_path],
    ['Primary model', s.primary_model],
    ['Claude Code', s.agent_version ?? '—'],
    ['Started', `${fmtLocalDateTime(s.started_at)} (${tz})`],
    ['Ended', s.ended_at ? fmtLocalDateTime(s.ended_at) : 'running'],
    ['Fresh input', `${num(s.total_fresh_input_tokens)} tokens`],
    ['Output', `${num(s.total_output_tokens)} tokens`],
    ['Cache writes', `${num(s.total_cache_write_tokens)} tokens`],
    ['Cache reads', `${num(s.total_cache_read_tokens)} tokens`],
    ['Pricing version', s.pricing_table_version],
    ['Session id', s.id],
  ];
  const mix = toolMix(turns);
  return (
    <div className="grid grid-cols-[1fr_1fr] gap-3">
      <Panel title="Session" padded={false}>
        <dl className="grid grid-cols-[140px_1fr] text-xs m-0">
          {meta.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="px-3.5 py-2 border-b border-line text-ink-1">{k}</dt>
              <dd className="px-3.5 py-2 border-b border-line font-mono m-0 break-all">{v}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <div className="flex flex-col gap-3">
        <Panel title="Tool mix" sub="calls · red segment = errors">
          {mix.length ? <Bars rows={mix} format={num} /> : <div className="text-ink-2 text-center py-4">No tool calls.</div>}
        </Panel>
        <Panel title="Cache ratio per turn" sub="share of each turn read from cache">
          <div className="flex items-end gap-[2px] h-12">
            {turns.map((t) => (
              <div key={t.sequence} title={`#${t.sequence} · ${Math.round(cacheRatio(t) * 100)}%`} className="flex-1 bg-bg-3 relative min-w-[2px] h-full">
                <i className="absolute bottom-0 left-0 right-0 bg-s1" style={{ height: `${cacheRatio(t) * 100}%` }} />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
