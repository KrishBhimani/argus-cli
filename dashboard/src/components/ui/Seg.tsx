export function Seg<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="inline-flex border border-line-2 rounded-md overflow-hidden font-mono text-[11px]">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={`px-2.5 py-[5px] whitespace-nowrap ${o.value === value ? 'bg-bg-3 text-ink-0' : 'text-ink-1 hover:text-ink-0'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
