import type uPlot from 'uplot';

/** Fixed categorical order (dataviz-validated dark steps); slot 6 is the "Other" grey. */
export const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#667184'];

export const AXIS: uPlot.Axis = {
  stroke: '#667184',
  font: '10px IBM Plex Mono, monospace',
  grid: { stroke: '#232934', width: 1 },
  ticks: { show: false },
  size: 40,
};

export const hexA = (hex: string, a: number) => `${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}`;
