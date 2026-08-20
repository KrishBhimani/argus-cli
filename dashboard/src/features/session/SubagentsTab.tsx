import type { SubagentSummary } from '@/lib/api/client';
import { Panel } from '@/components/ui/Panel';
import { Pill } from '@/components/ui/Pill';
import { Bars } from '@/components/charts/Bars';
import { num, tok } from '@/lib/format/format';

export function SubagentsTab({ subs }: { subs: SubagentSummary[] }) {
  if (!subs.length) return <Panel title="Sub-agents"><div className="text-ink-2 text-center py-6">This session did not spawn sub-agents.</div></Panel>;
  const tot = (s: SubagentSummary) => s.tokens.fresh_input + s.tokens.output + s.tokens.cache_read + s.tokens.cache_write;
  const max = Math.max(1, ...subs.map(tot));
  const tools = Object.values(
    subs.flatMap((s) => s.tools).reduce<Record<string, { name: string; value: number; error: number }>>((a, t) => {
      const r = a[t.name] ?? { name: t.name, value: 0, error: 0 };
      r.value += t.count;
      r.error += t.errors;
      a[t.name] = r;
      return a;
    }, {}),
  ).sort((a, b) => b.value - a.value);
  return (
    <div className="grid grid-cols-[1fr_1fr] gap-3">
      <Panel title="Sub-agents" sub={`${subs.length}`} padded={false}>
        {subs.map((s) => (
          <div key={s.id} className="px-3.5 py-2.5 border-b border-line flex items-center gap-3">
            <Pill kind={s.status === 'ok' ? 'good' : 'crit'}>{s.status.toUpperCase()}</Pill>
            <span className="font-mono text-xs">{s.id.slice(0, 8)}</span>
            <span className="font-mono text-[11px] text-ink-1 bg-bg-3 px-1.5 rounded-sm">{s.model}</span>
            <span className="text-ink-1 text-xs">{num(s.turns)} turns · {num(s.errors)} errors</span>
            <div className="relative h-1.5 w-40 rounded-sm bg-bg-3 overflow-hidden ml-auto"><i className="absolute inset-y-0 left-0 bg-s1 rounded-r-sm" style={{ width: `${(tot(s) / max) * 100}%` }} /></div>
            <span className="font-mono num text-xs w-14 text-right">{tok(tot(s))}</span>
          </div>
        ))}
      </Panel>
      <Panel title="Tools used by sub-agents">{tools.length ? <Bars rows={tools} format={num} /> : <div className="text-ink-2 text-center py-4">No tool calls.</div>}</Panel>
    </div>
  );
}
