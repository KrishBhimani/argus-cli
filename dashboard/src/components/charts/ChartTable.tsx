import { useState, type ReactNode } from 'react';
import { Chip } from '@/components/ui/Chip';

export type TableSpec = { columns: string[]; rows: (string | number)[][] };

export function ChartTable({ columns, rows }: TableSpec) {
  return (
    <div className="overflow-auto max-h-72">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={c} className={`text-[10px] tracking-[0.08em] text-ink-2 font-medium px-3 py-2 border-b border-line bg-bg-1 sticky top-0 whitespace-nowrap ${i ? 'text-right' : 'text-left'}`}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((v, j) => (
                <td key={j} className={`px-3 h-8 border-b border-line text-xs whitespace-nowrap ${j ? 'text-right font-mono num' : 'font-mono text-ink-1'}`}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Every chart has a table view: toggles between the two. */
export function ChartWithTable({ chart, table }: { chart: ReactNode; table: TableSpec }) {
  const [t, setT] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end"><Chip active={t} onClick={() => setT(!t)}>Table</Chip></div>
      {t ? <ChartTable {...table} /> : chart}
    </div>
  );
}
