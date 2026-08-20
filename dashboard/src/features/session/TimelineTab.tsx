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

const Code = ({ children }: { children: string }) => <span className="font-mono text-[11.5px] text-ink-1 bg-bg-3 px-1.5 rounded-sm">{children}</span>;

function ToolOutput({ sessionId, toolUseId }: { sessionId: string; toolUseId: string }) {
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ['toolOutput', sessionId, toolUseId], queryFn: () => api.toolOutput(sessionId, toolUseId), enabled: open });
  return (
    <div className="mx-3.5 mb-2.5 ml-[140px]">
      {!open ? (
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>Show output</Button>
      ) : q.data ? (
        q.data.found && q.data.text ? (
          <pre className="p-2.5 bg-bg-0 border border-line rounded-md text-[11px] text-ink-1 leading-relaxed overflow-auto max-h-64 whitespace-pre-wrap">{q.data.text}</pre>
        ) : (
          <span className="text-[11px] text-ink-2">{q.data.search_enabled ? 'Output not indexed for this call.' : 'Enable transcript indexing in Settings to keep tool output.'}</span>
        )
      ) : (
        <span className="text-[11px] text-ink-2">loading…</span>
      )}
    </div>
  );
}

export function TimelineTab({ id, turns, active }: { id: string; turns: TimelineTurn[]; active?: number }) {
  const [errOnly, setErrOnly] = useState(false);
  const [expandAll, setExpandAll] = useState(false);
  const [q, setQ] = useState('');
  const find = useQuery({ queryKey: ['transcript', id, q], queryFn: () => api.sessionTranscriptSearch(id, q), enabled: q.trim().length >= 2 });
  const rows = useMemo(() => (errOnly ? turns.filter(turnHasError) : turns), [turns, errOnly]);
  const max = Math.max(1e-9, ...turns.map((t) => t.cost_usd));
  return (
    <Panel
      title="Turns"
      sub={`${turns.length} · tok = fresh input + output`}
      padded={false}
      right={
        <>
          <Chip active={errOnly} onClick={() => setErrOnly(!errOnly)}>Errors only</Chip>
          <Chip active={expandAll} onClick={() => setExpandAll(!expandAll)}>Expand all</Chip>
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
        const open = expandAll || err || active === t.sequence;
        const sub = t.tool_calls.find((c) => c.subagent_type);
        return (
          <div key={t.sequence} id={`turn-${t.sequence}`} className={`${err ? 'bg-crit/7 shadow-[inset_3px_0_0_var(--color-crit)]' : ''} ${active === t.sequence ? 'outline outline-1 outline-accent' : ''}`}>
            <div className="grid grid-cols-[44px_70px_1fr_200px_90px_80px] items-center gap-3 h-[38px] px-3.5 border-b border-line">
              <span className={`font-mono ${err ? 'text-crit-ink' : 'text-ink-2'}`}>#{t.sequence}</span>
              <span className="font-mono text-ink-2">{new Date(t.timestamp).toLocaleTimeString([], { hour12: false })}</span>
              <span className="flex gap-1.5 items-center min-w-0 overflow-hidden">
                {sub && <Pill kind="info" icon={false}>Agent</Pill>}
                {t.tool_calls.slice(0, 6).map((c, i) => (c.is_error ? <Pill key={i} kind="crit">{c.tool_name}</Pill> : <Code key={i}>{c.tool_name}</Code>))}
                {t.tool_calls.length > 6 && <span className="text-ink-2 text-[11px]">+{t.tool_calls.length - 6}</span>}
                <span className="font-mono text-[11px] text-ink-2 ml-1 truncate">{t.model}</span>
              </span>
              <div className="relative h-1.5 rounded-sm bg-bg-3 overflow-hidden"><i className="absolute inset-y-0 left-0 bg-s1 rounded-r-sm" style={{ width: `${(t.cost_usd / max) * 100}%` }} /></div>
              <span className="font-mono num text-right">{tok(turnTokens(t))} tok</span>
              <span className="font-mono num text-right text-ink-1">{usd(t.cost_usd)}</span>
            </div>
            {open && t.tool_calls.some((c) => c.error_text) && (
              <pre className="mx-3.5 mb-2.5 ml-[140px] p-2.5 bg-bg-0 border border-line rounded-md text-[11px] text-ink-1 leading-relaxed overflow-auto max-h-48 whitespace-pre-wrap">
                {t.tool_calls.filter((c) => c.error_text).map((c) => `${c.tool_name}: ${c.error_text}`).join('\n')}
              </pre>
            )}
            {open && t.tool_calls.filter((c) => c.is_error === 1).slice(0, 3).map((c) => <ToolOutput key={c.tool_use_id} sessionId={id} toolUseId={c.tool_use_id} />)}
          </div>
        );
      })}
      {rows.length === 0 && (
        <div className="text-center text-ink-2 py-8 flex items-center justify-center gap-2"><Icon name="check" size={12} />{turns.length ? 'No failing turns.' : 'No turns recorded.'}</div>
      )}
    </Panel>
  );
}
