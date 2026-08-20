import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from '@tanstack/react-router';
import type { SubagentSummary } from '@/lib/api/client';
import { useTimeline } from '@/lib/api/hooks';
import { Panel } from '@/components/ui/Panel';
import { Pill } from '@/components/ui/Pill';
import { Tile } from '@/components/ui/Tile';
import { Chip } from '@/components/ui/Chip';
import { Seg } from '@/components/ui/Seg';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { CopyId } from '@/components/ui/CopyId';
import { Bars } from '@/components/charts/Bars';
import { Minimap } from '@/components/charts/Minimap';
import { Legend } from '@/components/charts/Legend';
import { dur, num, pct, tok, usd } from '@/lib/format/format';
import { TimelineTab } from './TimelineTab';

const total = (s: SubagentSummary) => s.total_tokens ?? s.tokens.fresh_input + s.tokens.output + s.tokens.cache_read + s.tokens.cache_write;
const calls = (s: SubagentSummary) => s.tool_calls ?? s.tools.reduce((a, t) => a + t.count, 0);
type Sort = 'order' | 'tokens' | 'errors';

/** One bar per sub-agent (tokens), red when it had tool errors; click selects. */
function AgentStrip({ subs, selected, onPick }: { subs: SubagentSummary[]; selected: string; onPick: (id: string) => void }) {
  const W = 300, H = 40;
  const n = Math.max(1, subs.length);
  const step = W / n;
  const bw = Math.max(1, step - (n > 80 ? 0.5 : 1));
  const max = Math.max(1, ...subs.map(total));
  return (
    <svg className="block w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ aspectRatio: `${W} / ${H}` }} role="img" aria-label="Tokens per sub-agent">
      {subs.map((s, i) => {
        const h = Math.max(2, (total(s) / max) * (H - 4));
        const sel = s.id === selected;
        return (
          <g key={s.id} onClick={() => onPick(s.id)} className="cursor-pointer">
            <title>{`#${i + 1} · ${tok(total(s))} · ${s.errors} errors`}</title>
            <rect x={i * step} y={0} width={bw} height={H} fill={sel ? 'rgba(240,136,62,0.18)' : 'transparent'} />
            <rect x={i * step} y={H - h} width={bw} height={h} fill={s.errors ? '#d03b3b' : sel ? '#ffb177' : '#3987e5'} />
          </g>
        );
      })}
    </svg>
  );
}

function SubagentDetail({ sa, index }: { sa: SubagentSummary; index: number }) {
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
      <div className="flex items-center gap-2 text-xs text-ink-1">
        <span className="font-mono text-ink-2">#{index + 1}</span>
        <Pill kind={sa.status === 'ok' ? 'good' : 'crit'}>{sa.status === 'ok' ? 'OK' : `${sa.errors} ERR`}</Pill>
        <span className="font-mono text-[11px] text-ink-1 bg-bg-3 px-1.5 rounded-sm">{sa.model}</span>
        <CopyId value={sa.id} />
        <Link to="/sessions/$id" params={{ id: sa.id }} search={{ tab: 'timeline' }} className="ml-auto text-[11px]">Open as its own session →</Link>
      </div>
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
        <Panel title="Tools used" sub="calls · red = errors">
          {sa.tools.length ? <Bars rows={sa.tools.map((t) => ({ name: t.name, value: t.count, error: t.errors }))} format={num} /> : <div className="text-ink-2 text-center py-4">No tool calls recorded.</div>}
        </Panel>
        <Panel title="Sub-agent shape" sub="tokens per turn · click to jump" right={<Legend names={['fresh + output', 'cache read', 'tool error']} colors={['#3987e5', '#1f3c63', '#d03b3b']} />}>
          {turns.length ? <Minimap turns={turns} onPick={pick} active={active} /> : tl.isLoading ? <Skeleton w="100%" h="96px" /> : <div className="text-ink-2 text-center py-4">No turns recorded.</div>}
        </Panel>
      </div>
      <TimelineTab id={sa.id} turns={turns} active={active} />
    </div>
  );
}

export function SubagentsTab({ subs }: { subs: SubagentSummary[] }) {
  const [selId, setSelId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [errOnly, setErrOnly] = useState(false);
  const [sort, setSort] = useState<Sort>('order');
  const listRef = useRef<HTMLDivElement>(null);

  const indexOf = useMemo(() => new Map(subs.map((s, i) => [s.id, i])), [subs]);
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = subs.filter((s) => (!errOnly || s.errors > 0) && (!needle || (s.task_given ?? '').toLowerCase().includes(needle) || s.model.toLowerCase().includes(needle)));
    if (sort === 'tokens') rows.sort((a, b) => total(b) - total(a));
    if (sort === 'errors') rows.sort((a, b) => b.errors - a.errors || total(b) - total(a));
    return rows;
  }, [subs, q, errOnly, sort]);

  const cur = subs.find((s) => s.id === selId) ?? visible[0] ?? subs[0];
  const select = (id: string) => {
    setSelId(id);
    // Bring the detail (top of the page) into view; the list keeps its own scroll position.
    document.getElementById('page-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
    listRef.current?.querySelector<HTMLElement>(`[data-sa="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest' });
  };
  const onKey = (e: KeyboardEvent) => {
    if (!cur || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'j' && e.key !== 'k')) return;
    const i = visible.findIndex((s) => s.id === cur.id);
    const next = visible[Math.max(0, Math.min(visible.length - 1, i + (e.key === 'ArrowDown' || e.key === 'j' ? 1 : -1)))];
    if (next) select(next.id);
    e.preventDefault();
  };
  useEffect(() => { if (selId && !subs.some((s) => s.id === selId)) setSelId(null); }, [subs, selId]);

  if (!subs.length) return <Panel title="Sub-agents"><div className="text-ink-2 text-center py-6">This session did not spawn sub-agents.</div></Panel>;
  if (!cur) return null;
  const max = Math.max(1, ...subs.map(total));
  const errCount = subs.filter((s) => s.errors > 0).length;

  return (
    <div className="grid grid-cols-[340px_1fr] gap-3 items-start">
      <Panel
        title="Sub-agents"
        sub={`${subs.length}${errCount ? ` · ${errCount} with errors` : ''}`}
        padded={false}
        className="sticky top-0 max-h-[calc(100vh-7.5rem)]"
      >
        <div className="px-3.5 pt-3 pb-2 border-b border-line flex flex-col gap-2 shrink-0">
          <AgentStrip subs={subs} selected={cur.id} onPick={select} />
          <div className="flex items-center gap-1.5 flex-wrap">
            <label className="flex items-center gap-1.5 h-6 px-2 border border-line-2 rounded-md text-ink-2 flex-1 min-w-28">
              <Icon name="search" size={11} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter tasks" className="bg-transparent outline-none text-ink-0 text-[11px] w-full placeholder:text-ink-2" />
            </label>
            <Chip active={errOnly} onClick={() => setErrOnly(!errOnly)}>Errors</Chip>
          </div>
          <div className="flex items-center gap-2">
            <Seg options={[{ value: 'order', label: 'order' }, { value: 'tokens', label: 'tokens' }, { value: 'errors', label: 'errors' }]} value={sort} onChange={setSort} />
            <span className="ml-auto font-mono text-[10px] text-ink-2">↑↓ to step · {visible.length} shown</span>
          </div>
        </div>
        <div ref={listRef} tabIndex={0} onKeyDown={onKey} className="overflow-auto min-h-0 flex-1 outline-none focus-visible:shadow-[inset_0_0_0_1px_var(--color-accent)]">
          {visible.map((s) => {
            const i = indexOf.get(s.id) ?? 0;
            const sel = s.id === cur.id;
            return (
              <button
                key={s.id}
                type="button"
                data-sa={s.id}
                onClick={() => select(s.id)}
                title={s.task_given ?? undefined}
                className={`w-full text-left px-3.5 h-[34px] border-b border-line flex items-center gap-2 hover:bg-bg-2 ${sel ? 'bg-bg-2 shadow-[inset_2px_0_0_var(--color-accent)]' : ''}`}
              >
                <span className="font-mono text-[11px] text-ink-2 w-8 shrink-0">#{i + 1}</span>
                {s.errors ? (
                  <span className="text-crit-ink inline-flex items-center gap-0.5 font-mono text-[11px] w-8 shrink-0"><Icon name="x" size={9} />{s.errors}</span>
                ) : (
                  <span className="text-good inline-flex items-center w-8 shrink-0"><Icon name="check" size={10} /></span>
                )}
                <span className="text-[11px] text-ink-1 truncate flex-1 min-w-0">{s.task_given ? s.task_given.replace(/\s+/g, ' ') : <span className="text-ink-2">{s.model}</span>}</span>
                <span className="relative h-1.5 w-14 shrink-0 rounded-sm bg-bg-3 overflow-hidden"><i className="absolute inset-y-0 left-0 bg-s1 rounded-r-sm" style={{ width: `${(total(s) / max) * 100}%` }} /></span>
                <span className="font-mono num text-[11px] w-12 text-right shrink-0">{tok(total(s))}</span>
              </button>
            );
          })}
          {visible.length === 0 && <div className="text-ink-2 text-center py-6 text-xs">No sub-agents match.</div>}
        </div>
      </Panel>
      <SubagentDetail key={cur.id} sa={cur} index={indexOf.get(cur.id) ?? 0} />
    </div>
  );
}
