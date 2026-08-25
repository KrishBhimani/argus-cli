import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { CommandPalette } from './CommandPalette';

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full bg-bg-0 text-ink-0 min-h-0">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 min-h-0">{children}</div>
      <CommandPalette />
    </div>
  );
}
