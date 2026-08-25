export const ErrorPanel = ({ error }: { error: unknown }) => (
  <div role="alert" className="border border-crit/40 bg-crit/8 rounded-md p-3 text-xs text-ink-1">
    <span className="text-crit-ink font-medium">Could not load.</span> {error instanceof Error ? error.message : String(error)}
  </div>
);
