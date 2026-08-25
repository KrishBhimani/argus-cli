import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

const STYLE = {
  warn: 'text-warn bg-warn/10 border-warn/25',
  crit: 'text-crit-ink bg-crit/12 border-crit/30',
  info: 'text-s1 bg-s1/12 border-s1/30',
  good: 'text-good bg-good/12 border-good/30',
  mute: 'text-ink-1 bg-bg-3 border-line-2',
} as const;
const ICON: Partial<Record<keyof typeof STYLE, IconName>> = { warn: 'warn', crit: 'x', info: 'info', good: 'check' };

export type PillKind = keyof typeof STYLE;

/** Status pills always pair an icon with a text label — colour is never the only signal. */
export function Pill({ kind, children, icon = true, className = '' }: { kind: PillKind; children: ReactNode; icon?: boolean; className?: string }) {
  const ic = ICON[kind];
  return (
    <span className={`inline-flex items-center gap-1.5 h-5 px-2 rounded-sm text-[11px] font-medium font-mono border whitespace-nowrap ${STYLE[kind]} ${className}`}>
      {icon && ic && <Icon name={ic} size={11} />}
      {children}
    </span>
  );
}
