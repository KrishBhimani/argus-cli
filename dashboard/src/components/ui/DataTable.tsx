import { useRef, useState, type KeyboardEvent } from 'react';
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';

export type ColMeta = { right?: boolean };

/** Virtualised, sortable table. Give every column an explicit `size` so head and body align. */
export function DataTable<T>({ columns, data, getRowId, onRowClick, initialSort = [], rowHeight = 34, emptyText = 'Nothing to show.' }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<T, any>[]; data: T[]; getRowId: (r: T) => string; onRowClick?: (r: T) => void;
  initialSort?: SortingState; rowHeight?: number; emptyText?: string;
}) {
  const [sorting, setSorting] = useState<SortingState>(initialSort);
  const [focus, setFocus] = useState(0);
  const table = useReactTable({ data, columns, getRowId, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });
  const rows = table.getRowModel().rows;
  const parent = useRef<HTMLDivElement>(null);
  const v = useVirtualizer({ count: rows.length, getScrollElement: () => parent.current, estimateSize: () => rowHeight, overscan: 12 });
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { setFocus((f) => Math.min(rows.length - 1, f + 1)); e.preventDefault(); }
    if (e.key === 'ArrowUp') { setFocus((f) => Math.max(0, f - 1)); e.preventDefault(); }
    if (e.key === 'Enter' && rows[focus]) onRowClick?.(rows[focus].original);
  };
  const cols = table.getAllLeafColumns();
  const widths = cols.map((c) => c.getSize());
  const total = widths.reduce((a, b) => a + b, 0);
  return (
    <div ref={parent} tabIndex={0} onKeyDown={onKey} className="overflow-auto flex-1 min-h-0 outline-none" data-testid="datatable">
      <table className="border-collapse table-fixed" style={{ width: '100%', minWidth: total }}>
        <colgroup>{widths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
        <thead className="sticky top-0 z-[1] bg-bg-1">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => {
                const s = h.column.getIsSorted();
                const right = (h.column.columnDef.meta as ColMeta | undefined)?.right;
                return (
                  <th key={h.id} onClick={h.column.getToggleSortingHandler()} className={`text-[10px] tracking-[0.08em] text-ink-2 font-medium px-3 py-2 border-b border-line whitespace-nowrap cursor-pointer select-none hover:text-ink-0 ${right ? 'text-right' : 'text-left'}`}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {s && <span className="text-accent ml-1">{s === 'desc' ? '↓' : '↑'}</span>}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {v.getVirtualItems().length > 0 && v.getVirtualItems()[0].start > 0 && <tr><td colSpan={cols.length} style={{ height: v.getVirtualItems()[0].start, padding: 0, border: 0 }} /></tr>}
          {v.getVirtualItems().map((vi) => {
            const r = rows[vi.index];
            return (
              <tr key={r.id} data-index={vi.index} onClick={() => onRowClick?.(r.original)} className={`cursor-pointer hover:bg-bg-2 ${vi.index === focus ? 'bg-bg-2' : ''}`} style={{ height: rowHeight }}>
                {r.getVisibleCells().map((c) => {
                  const right = (c.column.columnDef.meta as ColMeta | undefined)?.right;
                  return (
                    <td key={c.id} className={`px-3 border-b border-line text-[12.5px] whitespace-nowrap overflow-hidden text-ellipsis ${right ? 'text-right font-mono num' : ''}`}>
                      {flexRender(c.column.columnDef.cell, c.getContext())}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {v.getVirtualItems().length > 0 && (() => { const last = v.getVirtualItems()[v.getVirtualItems().length - 1]; const rest = v.getTotalSize() - last.end; return rest > 0 ? <tr><td colSpan={cols.length} style={{ height: rest, padding: 0, border: 0 }} /></tr> : null; })()}
        </tbody>
      </table>
      {rows.length === 0 && <div className="text-center text-ink-2 py-10">{emptyText}</div>}
    </div>
  );
}
