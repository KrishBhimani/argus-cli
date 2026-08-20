import type { ReactNode } from 'react';

export function Panel({ title, sub, right, children, className = '', padded = true }: {
  title?: string; sub?: string; right?: ReactNode; children: ReactNode; className?: string; padded?: boolean;
}) {
  return (
    <section className={`bg-bg-1 border border-line rounded-md flex flex-col overflow-hidden min-w-0 ${className}`}>
      {title && (
        <header className="flex items-center gap-2.5 h-9 px-3.5 border-b border-line shrink-0">
          <h3 className="m-0 text-xs font-semibold text-ink-0">{title}</h3>
          {sub && <span className="text-[11px] text-ink-2 font-mono">{sub}</span>}
          {right && <div className="ml-auto flex items-center gap-1.5">{right}</div>}
        </header>
      )}
      <div className={`${padded ? 'p-3.5' : ''} min-h-0 flex-1 flex flex-col`}>{children}</div>
    </section>
  );
}
