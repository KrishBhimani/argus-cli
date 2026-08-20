import { Link } from '@tanstack/react-router';
import { Panel } from '@/components/ui/Panel';
import { Pill } from '@/components/ui/Pill';
import { Button } from '@/components/ui/Button';
import { useAlerts, useMarkAlertSeen, useUnseenAlerts } from '@/lib/api/hooks';
import { shortDate } from '@/lib/format/format';
import type { Alert } from '@/lib/api/client';

const KIND = { info: 'info', warning: 'warn', critical: 'crit' } as const;
export const alertWhen = (a: Alert) => a.created_at ?? a.first_seen_at ?? '';

/** Always visible: unseen alerts (max 3) or an explicit "all clear". */
export function AttentionStrip() {
  const unseen = useUnseenAlerts().data ?? [];
  const all = useAlerts().data ?? [];
  const mark = useMarkAlertSeen();
  const top = unseen.slice(0, 3);
  const last = [...all].sort((x, y) => alertWhen(y).localeCompare(alertWhen(x)))[0];
  return (
    <Panel title="Needs attention" sub={`${unseen.length} unseen`} right={<Link to="/alerts" className="text-[11px]">All alerts →</Link>} padded={false}>
      {top.length === 0 ? (
        <div className="flex items-center gap-3 px-3.5 py-2.5 text-ink-1">
          <Pill kind="good">ALL CLEAR</Pill>
          {last ? <span>last alert {shortDate(alertWhen(last))}: {last.title}</span> : <span>no alerts recorded yet</span>}
        </div>
      ) : (
        top.map((a) => (
          <div key={a.id} className="flex items-center gap-3 px-3.5 py-2.5 border-b border-line last:border-b-0 min-w-0">
            <Pill kind={KIND[a.severity]}>{a.severity.toUpperCase()}</Pill>
            <span className="font-medium whitespace-nowrap">{a.title}</span>
            <span className="text-ink-1 truncate">{a.message}</span>
            <span className="ml-auto font-mono text-[11px] text-ink-1 bg-bg-3 px-1.5 rounded-sm whitespace-nowrap">{a.detector}</span>
            <span className="font-mono text-[11px] text-ink-2 whitespace-nowrap">{alertWhen(a) ? shortDate(alertWhen(a)) : ''}</span>
            <Button size="sm" variant="ghost" onClick={() => mark.mutate(a.id)}>Mark seen</Button>
          </div>
        ))
      )}
    </Panel>
  );
}
