export const Skeleton = ({ w = '4em', h = '1em' }: { w?: string; h?: string }) => (
  <span aria-busy="true" className="inline-block rounded-sm bg-bg-3 animate-pulse" style={{ width: w, height: h }} />
);
