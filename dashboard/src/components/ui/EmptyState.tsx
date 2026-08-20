export const EmptyState = ({ title, hint }: { title: string; hint?: string }) => (
  <div className="text-center text-ink-2 py-10 px-4">
    <div className="text-sm">{title}</div>
    {hint && <div className="text-[11px] mt-1">{hint}</div>}
  </div>
);
