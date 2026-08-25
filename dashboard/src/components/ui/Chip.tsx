import type { ReactNode } from 'react';
import { Icon } from './Icon';

export function Chip({ active = false, onClick, children, caret = false }: { active?: boolean; onClick?: () => void; children: ReactNode; caret?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-md border text-[11px] whitespace-nowrap ${active ? 'border-accent text-accent-ink bg-accent/12' : 'border-line-2 text-ink-1 bg-bg-2 hover:text-ink-0'}`}
    >
      {children}
      {caret && <Icon name="chevron" size={10} />}
    </button>
  );
}
