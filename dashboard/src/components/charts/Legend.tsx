export function Legend({ names, colors }: { names: string[]; colors: string[] }) {
  return (
    <ul className="flex flex-wrap gap-x-3.5 gap-y-1 text-[11px] text-ink-1 list-none m-0 p-0">
      {names.map((n, i) => (
        <li key={n} className="inline-flex items-center gap-1.5">
          <b className="w-2 h-2 rounded-[2px] inline-block" style={{ background: colors[i] }} />
          {n}
        </li>
      ))}
    </ul>
  );
}
