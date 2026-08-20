import { AreaLine, type LineSeries } from './AreaLine';

export const MultiLine = (p: { labels: string[]; series: LineSeries[]; share?: boolean; format?: (n: number) => string; height?: number }) => (
  <AreaLine {...p} fill={false} />
);
