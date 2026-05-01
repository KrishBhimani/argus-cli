import * as echarts from 'echarts/core';
import { LineChart, BarChart, HeatmapChart, PieChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, TitleComponent, LegendComponent, VisualMapComponent, MarkLineComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

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

export function lineCost(el: HTMLElement, days: { day: string; cost: number }[]) {
  const c = makeChart(el);
  c.setOption({
    ...THEME,
    tooltip: { ...THEME.tooltip, trigger: 'axis', valueFormatter: (v: number) => '$' + v.toFixed(2) },
    grid: { left: 50, right: 18, top: 18, bottom: 30 },
    xAxis: { type: 'category', data: days.map(d => d.day.slice(5)), ...AXIS },
    yAxis: { type: 'value', axisLabel: { ...AXIS.axisLabel, formatter: '${value}' }, splitLine: AXIS.splitLine, axisLine: { show: false } },
    series: [{
      type: 'line', data: days.map(d => +d.cost.toFixed(4)),
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

export function modelMix(el: HTMLElement, models: { name: string; cost: number }[]) {
  const c = makeChart(el);
  const top = models.slice(0, 8);
  c.setOption({
    ...THEME,
    tooltip: { ...THEME.tooltip, valueFormatter: (v: number) => '$' + v.toFixed(2) },
    grid: { left: 140, right: 30, top: 8, bottom: 24 },
    xAxis: { type: 'value', axisLabel: { ...AXIS.axisLabel, formatter: '${value}' }, splitLine: AXIS.splitLine, axisLine: { show: false } },
    yAxis: { type: 'category', data: top.map(m => m.name).reverse(), axisLabel: { ...AXIS.axisLabel, fontSize: 11 }, axisLine: { show: false }, axisTick: { show: false } },
    series: [{
      type: 'bar', data: top.map(m => +m.cost.toFixed(4)).reverse(),
      itemStyle: { color: '#f0883e', borderRadius: [0, 4, 4, 0] },
      barWidth: '60%',
    }],
  });
  return c;
}

export function calendarHeatmap(el: HTMLElement, days: { day: string; cost: number }[], lookbackDays = 90) {
  const c = makeChart(el);
  const lookup = Object.fromEntries(days.map(d => [d.day, d.cost]));
  const today = new Date();
  const cells: [number, number, number][] = [];
  let max = 0;
  for (let i = lookbackDays - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    const v = lookup[key] ?? 0;
    if (v > max) max = v;
    const dayOfWeek = d.getDay();
    const weekIdx = Math.floor((lookbackDays - 1 - i) / 7);
    cells.push([weekIdx, dayOfWeek, +v.toFixed(4)]);
  }
  const weeks = Math.ceil(lookbackDays / 7);
  c.setOption({
    ...THEME,
    tooltip: {
      ...THEME.tooltip,
      formatter: (p: any) => {
        const [wk, _dow, v] = p.data;
        const offsetDays = lookbackDays - 1 - (wk * 7 + (6 - p.data[1]));
        const d = new Date(today.getTime() - offsetDays * 86_400_000);
        return `${d.toISOString().slice(0, 10)}<br>$${v.toFixed(2)}`;
      },
    },
    grid: { left: 30, right: 10, top: 8, bottom: 22 },
    xAxis: {
      type: 'category', data: Array.from({ length: weeks }, (_, i) => String(i)),
      axisLabel: { show: false }, axisLine: { show: false }, axisTick: { show: false },
      splitArea: { show: false },
    },
    yAxis: {
      type: 'category', data: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      axisLabel: { ...AXIS.axisLabel, fontSize: 9 }, axisLine: { show: false }, axisTick: { show: false },
      splitArea: { show: false },
    },
    visualMap: {
      min: 0, max: Math.max(0.01, max),
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
