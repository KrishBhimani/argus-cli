import * as echarts from 'echarts/core';
import { LineChart, BarChart, HeatmapChart, PieChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, TitleComponent, LegendComponent, VisualMapComponent, MarkLineComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { tok } from './format';

echarts.use([LineChart, BarChart, HeatmapChart, PieChart, GridComponent, TooltipComponent, TitleComponent, LegendComponent, VisualMapComponent, MarkLineComponent, CanvasRenderer]);

const THEME = {
  textStyle: { color: '#9ba6b3', fontFamily: '-apple-system, system-ui, sans-serif' },
  tooltip: {
    backgroundColor: '#1c222d',
    borderColor: '#262d3a',
    textStyle: { color: '#e6edf3', fontSize: 12 },
    extraCssText: 'border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.4);',
  },
};

const AXIS = {
  axisLine: { lineStyle: { color: '#262d3a' } },
  axisLabel: { color: '#6b7585', fontSize: 11 },
  splitLine: { lineStyle: { color: '#1c222d' } },
};

export function makeChart(el: HTMLElement) {
  return echarts.init(el, null, { renderer: 'canvas' });
}

export function lineTokens(el: HTMLElement, days: { day: string; value: number }[]) {
  const c = makeChart(el);
  c.setOption({
    ...THEME,
    tooltip: { ...THEME.tooltip, trigger: 'axis', valueFormatter: (v: number) => tok(v) + ' tokens' },
    grid: { left: 50, right: 18, top: 18, bottom: 30 },
    xAxis: { type: 'category', data: days.map(d => d.day.slice(5)), ...AXIS },
    yAxis: { type: 'value', axisLabel: { ...AXIS.axisLabel, formatter: (v: number) => tok(v) }, splitLine: AXIS.splitLine, axisLine: { show: false } },
    series: [{
      type: 'line', data: days.map(d => d.value),
      smooth: true, symbol: 'circle', symbolSize: 5,
      lineStyle: { color: '#f0883e', width: 2 },
      itemStyle: { color: '#f0883e' },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(240,136,62,0.35)' }, { offset: 1, color: 'rgba(240,136,62,0.02)' }] } },
    }],
  });
  return c;
}

export function agentSplit(el: HTMLElement, split: Record<string, { cost: number; sessions: number; tokens: number }>) {
  const c = makeChart(el);
  const data = Object.entries(split)
    .map(([name, v]) => ({ name: name === 'claude_code' ? 'Claude Code' : 'Codex', value: +v.cost.toFixed(4), itemStyle: { color: name === 'claude_code' ? '#f0883e' : '#58a6ff' } }))
    .filter(d => d.value > 0);
  c.setOption({
    ...THEME,
    tooltip: { ...THEME.tooltip, trigger: 'item', valueFormatter: (v: number) => '$' + v.toFixed(2) },
    series: [{
      type: 'pie',
      radius: ['58%', '78%'],
      avoidLabelOverlap: true,
      itemStyle: { borderColor: '#0a0d12', borderWidth: 2 },
      label: { show: true, color: '#9ba6b3', formatter: '{b}\n{d}%' },
      labelLine: { lineStyle: { color: '#262d3a' } },
      data: data.length ? data : [{ name: 'No data', value: 1, itemStyle: { color: '#1c222d' } }],
    }],
  });
  return c;
}

export function modelMix(el: HTMLElement, models: { name: string; value: number }[]) {
  const c = makeChart(el);
  const top = models.slice(0, 8);
  c.setOption({
    ...THEME,
    tooltip: { ...THEME.tooltip, valueFormatter: (v: number) => tok(v) + ' tokens' },
    grid: { left: 140, right: 30, top: 8, bottom: 24 },
    xAxis: { type: 'value', axisLabel: { ...AXIS.axisLabel, formatter: (v: number) => tok(v) }, splitLine: AXIS.splitLine, axisLine: { show: false } },
    yAxis: { type: 'category', data: top.map(m => m.name).reverse(), axisLabel: { ...AXIS.axisLabel, fontSize: 11 }, axisLine: { show: false }, axisTick: { show: false } },
    series: [{
      type: 'bar', data: top.map(m => m.value).reverse(),
      itemStyle: { color: '#f0883e', borderRadius: [0, 4, 4, 0] },
      barWidth: '60%',
    }],
  });
  return c;
}

export function calendarHeatmap(el: HTMLElement, days: { day: string; value: number }[], lookbackDays = 90) {
  const c = makeChart(el);
  const lookup = Object.fromEntries(days.map(d => [d.day, d.value]));
  // Anchor at UTC midnight so lookup keys align with the API's started_at.slice(0,10)
  // bucketing. Stepping by exactly 86400000 ms from a UTC-midnight anchor is robust against
  // local-timezone hour-of-day skew.
  const now = new Date();
  const todayUtcMidnightMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const cells: [number, number, number][] = [];
  // Side-map from (weekIdx,dayOfWeek) -> ISO date so the tooltip doesn't have to
  // reverse-derive it from cell coords. The previous reverse formula was buggy and
  // produced wrong dates for almost every cell. ECharts cell data must remain a
  // 3-tuple [x, y, value] or it conflicts with the heatmap series' default dimensions.
  const cellDate = new Map<string, string>();
  let max = 0;

  // Each column in the heatmap is a CALENDAR week (Mon→Sun). The previous
  // implementation bucketed by "every 7 days from the oldest day in the
  // lookback," which only coincidentally produced Mon-Sun columns when the
  // window happened to start on a Monday. For any other start day, each
  // column straddled two calendar weeks and Mon/Tue would end up showing
  // dates from a DIFFERENT week than Wed-Sun in the same column — visible
  // in the screenshot from 2026-05-11 where col 0 was Mon=Feb16, Tue=Feb17,
  // Wed-Sun=Feb11-15.
  //
  // Fix: compute each day's calendar-week-start (Monday at UTC 00:00) and
  // derive weekIdx from that. Columns now always represent a single
  // Mon-Sun week. Cells before the lookback window or after today are
  // simply omitted (ECharts renders missing cells as blank grid slots),
  // which is the right UX — a partial first/last week reads cleanly.
  const monOfWeek = (ms: number): number => {
    const dow = new Date(ms).getUTCDay();         // 0=Sun..6=Sat
    const daysSinceMon = (dow + 6) % 7;            // Mon→0, Tue→1, ..., Sun→6
    return ms - daysSinceMon * 86_400_000;
  };
  const oldestDayMs = todayUtcMidnightMs - (lookbackDays - 1) * 86_400_000;
  const firstWeekMonMs = monOfWeek(oldestDayMs);

  for (let i = lookbackDays - 1; i >= 0; i--) {
    const dayMs = todayUtcMidnightMs - i * 86_400_000;
    const d = new Date(dayMs);
    const key = d.toISOString().slice(0, 10);
    const v = lookup[key] ?? 0;
    if (v > max) max = v;
    // Remap JS dayOfWeek (0=Sun..6=Sat) to row index for our Mon-first axis
    // ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']: Sun→6, Mon→0, Tue→1, ..., Sat→5
    const rowIdx = (d.getUTCDay() + 6) % 7;
    const weekIdx = Math.round((monOfWeek(dayMs) - firstWeekMonMs) / (7 * 86_400_000));
    cells.push([weekIdx, rowIdx, v]);
    cellDate.set(`${weekIdx}-${rowIdx}`, key);
  }
  // Total columns spans first calendar week containing oldest day through
  // the calendar week containing today.
  const weeks = Math.round((monOfWeek(todayUtcMidnightMs) - firstWeekMonMs) / (7 * 86_400_000)) + 1;
  c.setOption({
    ...THEME,
    tooltip: {
      ...THEME.tooltip,
      formatter: (p: any) => {
        const wk = p.data[0];
        const dow = p.data[1];
        const v = p.data[2];
        const key = cellDate.get(`${wk}-${dow}`) ?? '';
        return `${key}<br>${v > 0 ? tok(v) + ' tokens' : '<span style="color:#6b7585;">no activity</span>'}`;
      },
    },
    grid: { left: 30, right: 10, top: 8, bottom: 22 },
    xAxis: {
      type: 'category', data: Array.from({ length: weeks }, (_, i) => String(i)),
      axisLabel: { show: false }, axisLine: { show: false }, axisTick: { show: false },
      splitArea: { show: false },
    },
    yAxis: {
      type: 'category', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      inverse: true, // Mon at the top, Sun at the bottom
      axisLabel: { ...AXIS.axisLabel, fontSize: 9 }, axisLine: { show: false }, axisTick: { show: false },
      splitArea: { show: false },
    },
    visualMap: {
      min: 0, max: Math.max(1, max),
      calculable: true, orient: 'horizontal', left: 'center', bottom: 0,
      inRange: { color: ['#1c222d', '#7a3e1e', '#c2622e', '#f0883e'] },
      textStyle: { color: '#6b7585', fontSize: 10 },
      itemWidth: 12, itemHeight: 100,
    },
    series: [{
      type: 'heatmap', data: cells,
      itemStyle: { borderRadius: 2, borderColor: '#0a0d12', borderWidth: 1 },
      emphasis: { itemStyle: { borderColor: '#f0883e', borderWidth: 1 } },
    }],
  });
  return c;
}

export function turnTokensBar(
  el: HTMLElement,
  turns: { sequence: number; tokens: number; hasError: boolean }[],
  onBarClick: (sequence: number) => void,
) {
  const c = makeChart(el);
  c.setOption({
    ...THEME,
    tooltip: {
      ...THEME.tooltip,
      trigger: 'item',
      formatter: (p: any) => {
        const t = turns[p.dataIndex];
        return `Turn #${t.sequence}<br>${tok(t.tokens)} tokens${t.hasError ? '<br><span style="color:#f85149;">contains a failed tool call</span>' : ''}`;
      },
    },
    grid: { left: 50, right: 18, top: 12, bottom: 26 },
    xAxis: { type: 'category', data: turns.map(t => '#' + t.sequence), ...AXIS },
    yAxis: { type: 'value', axisLabel: { ...AXIS.axisLabel, formatter: (v: number) => tok(v) }, splitLine: AXIS.splitLine, axisLine: { show: false } },
    series: [{
      type: 'bar',
      barMaxWidth: 26,
      data: turns.map(t => ({
        value: t.tokens,
        itemStyle: { color: t.hasError ? '#f85149' : '#58a6ff', borderRadius: [3, 3, 0, 0] },
      })),
    }],
  });
  c.on('click', (p: any) => onBarClick(turns[p.dataIndex].sequence));
  return c;
}

export function trendsLine(el: HTMLElement, points: { bucket: string; groups: Record<string, { cost: number }> }[]) {
  const c = makeChart(el);
  const allKeys = [...new Set(points.flatMap(p => Object.keys(p.groups)))];
  const palette = ['#f0883e', '#58a6ff', '#7ee787', '#d29922', '#bc8cff', '#f85149'];
  c.setOption({
    ...THEME,
    tooltip: { ...THEME.tooltip, trigger: 'axis', valueFormatter: (v: number) => '$' + v.toFixed(2) },
    legend: { data: allKeys, textStyle: { color: '#9ba6b3', fontSize: 11 }, top: 0 },
    grid: { left: 50, right: 18, top: 38, bottom: 30 },
    xAxis: { type: 'category', data: points.map(p => p.bucket), ...AXIS },
    yAxis: { type: 'value', axisLabel: { ...AXIS.axisLabel, formatter: '${value}' }, splitLine: AXIS.splitLine, axisLine: { show: false } },
    series: allKeys.map((k, i) => ({
      type: 'line', name: k,
      smooth: true, symbol: 'circle', symbolSize: 5,
      lineStyle: { color: palette[i % palette.length], width: 2 },
      itemStyle: { color: palette[i % palette.length] },
      data: points.map(p => +(p.groups[k]?.cost ?? 0).toFixed(4)),
    })),
  });
  return c;
}
