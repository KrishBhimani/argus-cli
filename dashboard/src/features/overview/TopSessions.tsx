import { Link } from '@tanstack/react-router';
import type { Overview } from '@/lib/api/client';
import { Panel } from '@/components/ui/Panel';
import { shortDate, shortPath, tok, usd } from '@/lib/format/format';

const HEAD = ['STARTED', 'PROJECT', 'MODEL', 'TOKENS', 'EST. COST'];

export function TopSessions({ rows }: { rows: Overview['top_sessions'] }) {
  const max = Math.max(1, ...rows.map((r) => r.window_tokens));
  return (
    <Panel title="Top sessions" sub="by tokens in window" right={<Link to="/sessions" className="text-[11px]">All sessions →</Link>} padded={false}>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {HEAD.map((h, i) => (
              <th key={h} className={`text-[10px] tracking-[0.08em] text-ink-2 font-medium px-3 py-2 border-b border-line ${i >= 3 ? 'text-right' : 'text-left'} ${i === 3 ? 'w-56' : ''}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 8).map((s) => (
            <tr key={s.id} className="hover:bg-bg-2">
              <td className="px-3 h-[34px] border-b border-line font-mono text-xs whitespace-nowrap">
                <Link to="/sessions/$id" params={{ id: s.id }} search={{ tab: 'overview' }} className="text-ink-0">{shortDate(s.started_at)}</Link>
                {s.days_active > 1 && <span className="text-ink-2 text-[10px] ml-1">+{s.days_active - 1}d</span>}
              </td>
              <td className="px-3 border-b border-line font-mono text-xs text-ink-1 truncate max-w-[360px]" title={s.project_path}>{shortPath(s.project_path)}</td>
              <td className="px-3 border-b border-line"><span className="font-mono text-[11.5px] text-ink-1 bg-bg-3 px-1.5 rounded-sm">{s.primary_model}</span></td>
              <td className="px-3 border-b border-line">
                <div className="flex items-center gap-2">
                  <div className="relative h-1.5 flex-1 rounded-sm bg-bg-3 overflow-hidden"><i className="absolute inset-y-0 left-0 bg-s1 rounded-r-sm" style={{ width: `${(s.window_tokens / max) * 100}%` }} /></div>
                  <span className="font-mono num text-xs w-14 text-right">{tok(s.window_tokens)}</span>
                </div>
              </td>
              <td className="px-3 border-b border-line text-right font-mono num text-xs">{usd(s.window_cost_usd)}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={5} className="text-center text-ink-2 py-8">No sessions in this window.</td></tr>}
        </tbody>
      </table>
    </Panel>
  );
}
