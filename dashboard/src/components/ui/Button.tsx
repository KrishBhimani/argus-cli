import type { ButtonHTMLAttributes } from 'react';

const V = {
  default: 'bg-bg-2 border-line-2 text-ink-0 hover:border-accent',
  primary: 'bg-accent border-accent text-[#1a0f06]',
  ghost: 'bg-transparent border-line-2 text-ink-0 hover:border-accent',
  danger: 'bg-transparent border-crit text-crit-ink',
} as const;

export function Button({ variant = 'default', size = 'md', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof V; size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      {...p}
      className={`inline-flex items-center gap-1.5 ${size === 'sm' ? 'h-6 px-2 text-[11px]' : 'h-7 px-2.5 text-xs'} rounded-md border font-medium whitespace-nowrap disabled:opacity-50 ${V[variant]} ${className}`}
    />
  );
}
