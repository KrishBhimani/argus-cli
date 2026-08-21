import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { TimelineTurn } from '@/lib/api/client';
import { api } from '@/lib/api/client';
import { Panel } from '@/components/ui/Panel';
import { Chip } from '@/components/ui/Chip';
import { Pill } from '@/components/ui/Pill';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { tok, usd } from '@/lib/format/format';
import { turnHasError, turnTokens } from './model';

/** `mcp__server__tool` → `server · tool`; plain tools unchanged. Full name goes in `title`. */
export const toolLabel = (name: string) => (name.startsWith('mcp__') ? name.slice(5).split('__').join(' · ') : name);
const MAX_CHIPS = 4;
const CHUNK = 150;
const kb = (n: number) => (n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`);

const Code = ({ children, title }: { children: string; title?: string }) => (
  <span title={title} className="font-mono text-[11.5px] text-ink-1 bg-bg-3 px-1.5 rounded-sm whitespace-nowrap shrink-0">{children}</span>
);

function ToolOutput({ sessionId, toolUseId, name }: { sessionId: string; toolUseId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ['toolOutput', sessionId, toolUseId], queryFn: () => api.toolOutput(sessionId, toolUseId), enabled: open });
  if (!open) return <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>Show output</Button>;
  if (!q.data) return <span className="text-[11px] text-ink-2">loading…</span>;
  if (q.data.found && q.data.text) {
    return <pre className="m-0 p-2.5 bg-bg-0 border border-line rounded-md text-[11px] text-ink-1 leading-relaxed overflow-auto max-h-64 whitespace-pre-wrap break-words">{q.data.text}</pre>;
  }
  return <span className="text-[11px] text-ink-2">{q.data.search_enabled ? `No stored output for ${toolLabel(name)}.` : 'Enable transcript indexing in Settings to keep tool output.'}</span>;
}

export function TimelineTab({ id, turns, active }: { id: string; turns: TimelineTurn[]; active?: number }) {
  const [errOnly, setErrOnly] = useState(false);
  const [expandAll, setExpandAll] = useState(false);
  const [toggled, setToggled] = useState<Set<number>>(new Set());
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(CHUNK);
  const find = useQuery({ queryKey: ['transcript', id, q], queryFn: () => api.sessionTranscriptSearch(id, q), enabled: q.trim().length >= 2 });
  const filtered = useMemo(() => (errOnly ? turns.filter(turnHasError) : turns), [turns, errOnly]);
  // Long sessions (hundreds of turns with large error payloads) are rendered in chunks to keep the page responsive.
  const rows = useMemo(() => filtered.slice(0, limit), [filtered, limit]);
  const remaining = filtered.length - rows.length;
  const max = Math.max(1e-9, ...turns.map((t) => t.cost_usd));
  const errors = useMemo(() => turns.filter(turnHasError).length, [turns]);

  const toggle = (seq: number) =>
    setToggled((s) => {
      const n = new Set(s);
      if (n.has(seq)) n.delete(seq);
      else n.add(seq);
      return n;
    });
  // A row is open when expand-all is on (unless toggled shut), or it was toggled open, or it is the jump target.
  const isOpen = (seq: number) => (expandAll ? !toggled.has(seq) : toggled.has(seq)) || active === seq;
  const setAll = (v: boolean) => { setExpandAll(v); setToggled(new Set()); };

  return (
    <Panel
      title="Turns"
      sub={`${turns.length}${errors ? ` · ${errors} with errors` : ''} · tok = fresh input + output`}
      padded={false}
      right={
        <>
          <Chip active={errOnly} onClick={() => setErrOnly(!errOnly)}>Errors only{errors ? ` · ${errors}` : ''}</Chip>
          <Chip active={expandAll} onClick={() => setAll(!expandAll)}>{expandAll ? 'Collapse all' : 'Expand all'}</Chip>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find in session" className="h-6 w-48 px-2 bg-bg-2 border border-line-2 rounded-md text-[11px] outline-none" />
        </>
      }
    >
      {q.trim().length >= 2 && (
        <div className="px-3.5 py-2 border-b border-line text-[11px] text-ink-1 font-mono flex flex-col gap-1">
          <span>{find.data ? `${find.data.total} matches` : 'searching…'}{find.data && find.data.search_indexing_enabled === false && ' · enable indexing in Settings for full-text search'}</span>
          {find.data?.segments.slice(0, 5).map((s) => <span key={s.uid} className="text-ink-2 truncate">{s.role}: {s.text.slice(0, 160)}</span>)}
        </div>
      )}
      {rows.map((t) => {
        const err = turnHasError(t);
        const open = isOpen(t.sequence);
        const sub = t.tool_calls.find((c) => c.subagent_type);
        const shown = t.tool_calls.slice(0, MAX_CHIPS);
        const rest = t.tool_calls.length - shown.length;
        return (
          <div key={t.sequence} id={`turn-${t.sequence}`} className={`${err ? 'bg-crit/7 shadow-[inset_3px_0_0_var(--color-crit)]' : ''} ${active === t.sequence ? 'outline outline-1 outline-accent' : ''}`}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => toggle(t.sequence)}
              onKeyDown={(e) => e.key === 'Enter' && toggle(t.sequence)}
              className="grid grid-cols-[16px_44px_70px_minmax(0,1fr)_200px_90px_80px] items-center gap-3 h-[38px] px-3.5 border-b border-line cursor-pointer hover:bg-bg-2/60"
            >
              <Icon name="chevron" size={10} className={`text-ink-2 transition-transform ${open ? '' : '-rotate-90'}`} />
              <span className={`font-mono ${err ? 'text-crit-ink' : 'text-ink-2'}`}>#{t.sequence}</span>
              <span className="font-mono text-ink-2">{new Date(t.timestamp).toLocaleTimeString([], { hour12: false })}</span>
              <span className="flex gap-1.5 items-center min-w-0 overflow-hidden">
                {sub && <Pill kind="info" icon={false}>Agent</Pill>}
                {shown.map((c, i) =>
                  c.is_error ? <Pill key={i} kind="crit" className="shrink-0" ><span title={c.tool_name}>{toolLabel(c.tool_name)}</span></Pill> : <Code key={i} title={c.tool_name}>{toolLabel(c.tool_name)}</Code>,
                )}
                {rest > 0 && <span className="text-ink-2 text-[11px] shrink-0">+{rest}</span>}
                <span className="font-mono text-[11px] text-ink-2 ml-1 truncate">{t.model}</span>
              </span>
              <div className="relative h-1.5 rounded-sm bg-bg-3 overflow-hidden"><i className="absolute inset-y-0 left-0 bg-s1 rounded-r-sm" style={{ width: `${(t.cost_usd / max) * 100}%` }} /></div>
              <span className="font-mono num text-right whitespace-nowrap">{tok(turnTokens(t))} tok</span>
              <span className="font-mono num text-right text-ink-1">{usd(t.cost_usd)}</span>
            </div>
            {open && (
              <div className="px-3.5 pb-3 pt-1 ml-[60px] border-b border-line flex flex-col gap-2">
                <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-[11px] font-mono text-ink-1 w-fit">
                  <span className="text-ink-2">fresh input</span><span className="num">{tok(t.fresh_input_tokens)}</span>
                  <span className="text-ink-2">output</span><span className="num">{tok(t.output_tokens)}</span>
                  <span className="text-ink-2">cache read / write</span><span className="num">{tok(t.cache_read_tokens)} / {tok(t.cache_write_tokens)}</span>
                </div>
                {t.tool_calls.length === 0 && <span className="text-[11px] text-ink-2">No tool calls in this turn.</span>}
                {t.tool_calls.map((c) => (
                  <div key={c.tool_use_id} className="flex flex-col gap-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {c.is_error ? <Pill kind="crit">ERROR</Pill> : <Pill kind="good">OK</Pill>}
                      <span className="font-mono text-[11.5px] text-ink-0 break-all">{c.tool_name}</span>
                      <span className="font-mono text-[11px] text-ink-2">{kb(c.input_size)} input</span>
                      {c.subagent_type && <Pill kind="info" icon={false}>{c.subagent_type}</Pill>}
                      <span className="ml-auto"><ToolOutput sessionId={id} toolUseId={c.tool_use_id} name={c.tool_name} /></span>
                    </div>
                    {c.error_text && (
                      <pre className="m-0 p-2.5 bg-bg-0 border border-crit/30 rounded-md text-[11px] text-ink-1 leading-relaxed overflow-auto max-h-48 whitespace-pre-wrap break-words">{c.error_text}</pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {remaining > 0 && (
        <button type="button" onClick={() => setLimit((l) => l + CHUNK)} className="w-full py-2.5 text-[11px] text-ink-1 hover:text-ink-0 hover:bg-bg-2 border-t border-line">
          Show {Math.min(CHUNK, remaining)} more turns · {remaining} remaining
        </button>
      )}
      {rows.length === 0 && (
        <div className="text-center text-ink-2 py-8 flex items-center justify-center gap-2"><Icon name="check" size={12} />{turns.length ? 'No failing turns.' : 'No turns recorded.'}</div>
      )}
    </Panel>
  );
}
