import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import type { SubagentSummary } from '@/lib/api/client';
import { useTimeline } from '@/lib/api/hooks';
import { Panel } from '@/components/ui/Panel';
import { Pill } from '@/components/ui/Pill';
import { Tile } from '@/components/ui/Tile';
import { Skeleton } from '@/components/ui/Skeleton';
import { Bars } from '@/components/charts/Bars';
import { Minimap } from '@/components/charts/Minimap';
import { Legend } from '@/components/charts/Legend';
import { dur, num, pct, tok, usd } from '@/lib/format/format';
import { TimelineTab } from './TimelineTab';

const total = (s: SubagentSummary) => s.total_tokens ?? s.tokens.fresh_input + s.tokens.output + s.tokens.cache_read + s.tokens.cache_write;
const calls = (s: SubagentSummary) => s.tool_calls ?? s.tools.reduce((a, t) => a + t.count, 0);

function SubagentDetail({ sa }: { sa: SubagentSummary }) {
  const tl = useTimeline(sa.id);
  const turns = useMemo(() => tl.data?.turns ?? [], [tl.data]);
  const [active, setActive] = useState<number | undefined>();
  const tot = total(sa);
  const pick = (seq: number) => {
    setActive(seq);
    requestAnimationFrame(() => document.getElementById(`turn-${seq}`)?.scrollIntoView({ block: 'center' }));
  };
  return (
    <div className="flex flex-col gap-3 min-w-0">
      <div className="grid grid-cols-5 gap-3">
        <Tile label="Tokens" value={tok(tot)} sub={`${pct(tot ? sa.tokens.cache_read / tot : 0, 0)} cache read`} />
        <Tile label="Estimated cost" value={usd(sa.cost_usd ?? 0)} />
        <Tile label="Turns" value={num(sa.turns)} sub={`${num(calls(sa))} tool calls`} />
        <Tile label="Duration" value={dur(sa.duration_sec ?? null)} />
        <Tile label="Tool errors" value={num(sa.errors)} tone={sa.errors ? 'crit' : 'default'} sub={sa.errors ? 'see red turns below' : 'none'} />
      </div>
      <Panel title="Task given" sub="first user message to the sub-agent">
        {sa.task_given ? (
          <p className="m-0 text-xs leading-relaxed whitespace-pre-wrap break-words max-h-40 overflow-auto">{sa.task_given}</p>
        ) : (
          <span className="text-ink-2 text-xs">Not available — enable transcript indexing in Settings to keep sub-agent prompts.</span>
        )}
      </Panel>
      <div className="grid grid-cols-[1fr_2fr] gap-3">
        <Panel title="Tools used" sub="calls · red segment = errors">
          {sa.tools.length ? <Bars rows={sa.tools.map((t) => ({ name: t.name, value: t.count, error: t.errors }))} format={num} /> : <div className="text-ink-2 text-center py-4">No tool calls recorded.</div>}
        </Panel>
        <Panel title="Sub-agent shape" sub="tokens per turn · click to jump" right={<Legend names={['fresh + output', 'cache read', 'tool error']} colors={['#3987e5', '#1f3c63', '#d03b3b']} />}>
          {turns.length ? <Minimap turns={turns} onPick={pick} active={active} /> : tl.isLoading ? <Skeleton w="100%" h="96px" /> : <div className="text-ink-2 text-center py-4">No turns recorded.</div>}
        </Panel>
      </div>
      <TimelineTab id={sa.id} turns={turns} active={active} />
      <div className="text-[11px]">
        <Link to="/sessions/$id" params={{ id: sa.id }} search={{ tab: 'timeline' }}>Open this sub-agent as its own session →</Link>
      </div>
    </div>
  );
}

export function SubagentsTab({ subs }: { subs: SubagentSummary[] }) {
  const [sel, setSel] = useState(0);
  if (!subs.length) return <Panel title="Sub-agents"><div className="text-ink-2 text-center py-6">This session did not spawn sub-agents.</div></Panel>;
  const max = Math.max(1, ...subs.map(total));
  const cur = subs[Math.min(sel, subs.length - 1)];
  return (
    <div className="grid grid-cols-[320px_1fr] gap-3 items-start">
      <Panel title="Sub-agents" sub={`${subs.length}`} padded={false}>
        {subs.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSel(i)}
            className={`w-full text-left px-3.5 py-2.5 border-b border-line flex flex-col gap-1.5 hover:bg-bg-2 ${i === sel ? 'bg-bg-2 shadow-[inset_2px_0_0_var(--color-accent)]' : ''}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Pill kind={s.status === 'ok' ? 'good' : 'crit'}>{s.status === 'ok' ? 'OK' : `${s.errors} ERR`}</Pill>
              <span className="font-mono text-[11px] text-ink-1 bg-bg-3 px-1.5 rounded-sm truncate">{s.model}</span>
              <span className="ml-auto font-mono text-[11px] text-ink-2">#{i + 1}</span>
            </div>
            <div className="text-[11px] text-ink-1 truncate">{s.task_given ? s.task_given.slice(0, 90) : <span className="text-ink-2">task not indexed</span>}</div>
            <div className="flex items-center gap-2">
              <div className="relative h-1.5 flex-1 rounded-sm bg-bg-3 overflow-hidden"><i className="absolute inset-y-0 left-0 bg-s1 rounded-r-sm" style={{ width: `${(total(s) / max) * 100}%` }} /></div>
              <span className="font-mono num text-[11px] w-14 text-right">{tok(total(s))}</span>
              <span className="font-mono text-[11px] text-ink-2 w-16 text-right">{num(s.turns)} turns</span>
            </div>
          </button>
        ))}
      </Panel>
      <SubagentDetail key={cur.id} sa={cur} />
    </div>
  );
}
