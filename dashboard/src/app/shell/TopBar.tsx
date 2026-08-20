import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

export type Crumb = string | { label: string; to: string };

export function TopBar({ crumbs, children }: { crumbs: Crumb[]; children?: ReactNode }) {
  return (
    <div className="h-12 shrink-0 border-b border-line flex items-center gap-3 px-5 bg-bg-1">
      <span className="text-[13px] text-ink-1 flex items-center gap-1.5 min-w-0">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && <span>/</span>}
            {typeof c === 'string' ? (
              i === crumbs.length - 1 ? <b className="text-ink-0 font-semibold truncate">{c}</b> : <span>{c}</span>
            ) : (
              <Link to={c.to} className="text-ink-1 hover:text-ink-0">{c.label}</Link>
            )}
          </span>
        ))}
      </span>
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </div>
  );
}

export const Page = ({ children, row = false }: { children: ReactNode; row?: boolean }) => (
  <div id="page-scroll" className={`p-5 flex ${row ? 'flex-row' : 'flex-col'} gap-4 flex-1 min-h-0 overflow-auto ${row ? '' : '[&>*]:shrink-0'}`}>{children}</div>
);
