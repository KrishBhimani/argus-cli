import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from '@tanstack/react-router';
import { useSessions } from '@/lib/api/hooks';
import { shortDate, shortPath } from '@/lib/format/format';

const PAGES = [
  ['Overview', '/'], ['Alerts', '/alerts'], ['Sessions', '/sessions'], ['Tools', '/tools'], ['Models', '/models'],
  ['Trends', '/trends'], ['Transcripts', '/search'], ['Settings', '/settings'],
] as const;
const HEADING = '[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:tracking-[0.12em] [&_[cmdk-group-heading]]:text-ink-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1';
const ITEM = 'px-2 h-8 flex items-center gap-3 rounded-md text-xs data-[selected=true]:bg-bg-3 cursor-pointer';

/** Ctrl/⌘+K: jump to a page or session. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const sessions = useSessions().data ?? [];
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  if (!open) return null;
  const goPage = (to: string) => { setOpen(false); nav({ to }); };
  const goSession = (id: string) => { setOpen(false); nav({ to: '/sessions/$id', params: { id }, search: { tab: 'overview' } }); };
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      <Command label="Jump to" className="w-[560px] bg-bg-1 border border-line-2 rounded-md shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <Command.Input autoFocus placeholder="Jump to a page, session or project…" className="w-full h-11 px-4 bg-transparent outline-none text-sm border-b border-line" />
        <Command.List className="max-h-80 overflow-auto p-1.5">
          <Command.Empty className="text-ink-2 text-center py-6 text-xs">No matches.</Command.Empty>
          <Command.Group heading="Pages" className={HEADING}>
            {PAGES.map(([l, to]) => <Command.Item key={to} value={l} onSelect={() => goPage(to)} className={ITEM}>{l}</Command.Item>)}
          </Command.Group>
          <Command.Group heading="Sessions" className={HEADING}>
            {sessions.slice(0, 200).map((s) => (
              <Command.Item key={s.id} value={`${s.project_path} ${s.primary_model} ${s.id}`} onSelect={() => goSession(s.id)} className={ITEM}>
                <span className="font-mono text-ink-2 w-16 shrink-0">{shortDate(s.started_at)}</span>
                <span className="font-mono truncate">{shortPath(s.project_path, 50)}</span>
                <span className="ml-auto font-mono text-[11px] text-ink-2 shrink-0">{s.primary_model}</span>
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
