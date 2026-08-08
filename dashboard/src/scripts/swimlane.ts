import type { WorkflowAgentDetail } from './api';
import { escapeHtml } from './format';

// Fixed order, validated against surface #0a0d12 (worst adjacent CVD dE 8.4,
// normal-vision dE 19.3, all >= 3:1 contrast). DO NOT REORDER: the same six
// hues in a different sequence drop aqua<->magenta to dE 1.6 for deuteranopes.
// Red and green are deliberately absent -- --bad and --good already mean
// failed/ok in this theme, and spending them on a category would make an
// error indistinguishable from a phase.
export const PHASE_COLORS = [
  '#3987e5', // blue
  '#d95926', // orange
  '#199e70', // aqua
  '#c98500', // yellow
  '#d55181', // magenta
  '#9085e9', // violet
] as const;

const OVERFLOW_COLOR = '#6b7585'; // neutral; never a generated hue

export function phaseColor(phaseIndex: number): string {
  const i = phaseIndex - 1; // phaseIndex is 1-based in the run record
  if (i < 0 || i >= PHASE_COLORS.length) return OVERFLOW_COLOR;
  return PHASE_COLORS[i];
}

const ms = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : NaN;
};

function agentStart(a: WorkflowAgentDetail): number {
  const s = ms(a.started_at);
  return Number.isFinite(s) ? s : ms(a.queued_at);
}

function agentEnd(a: WorkflowAgentDetail): number {
  const s = agentStart(a);
  if (!Number.isFinite(s)) return NaN;
  if (a.duration_ms > 0) return s + a.duration_ms;
  const p = ms(a.last_progress_at); // in-flight agent
  return Number.isFinite(p) ? p : s;
}

/** Agents running at each of `buckets` slices across the run's span. */
function concurrency(
  agents: WorkflowAgentDetail[], t0: number, t1: number, buckets: number,
): number[] {
  const out = new Array<number>(buckets).fill(0);
  const span = Math.max(1, t1 - t0);
  for (const a of agents) {
    const s = agentStart(a);
    const e = agentEnd(a);
    if (!Number.isFinite(s) || !Number.isFinite(e)) continue;
    const b0 = Math.max(0, Math.floor(((s - t0) / span) * buckets));
    const b1 = Math.min(buckets - 1, Math.floor(((e - t0) / span) * buckets));
    for (let i = b0; i <= b1; i++) out[i] += 1;
  }
  return out;
}

function ribbonSvg(series: number[]): string {
  const peak = Math.max(1, ...series);
  const w = series.length;
  const pts = series
    .map((v, i) => `${((i / (w - 1)) * 100).toFixed(3)},${(100 - (v / peak) * 100).toFixed(2)}`)
    .join(' ');
  return `<svg class="wf-ribbon-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <polygon points="0,100 ${pts} 100,100" fill="var(--accent-dim)"></polygon>
    <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="0.6"
      vector-effect="non-scaling-stroke"></polyline>
  </svg>`;
}

function fmtMs(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return '0s';
  const s = Math.round(v / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

function tooltipHtml(a: WorkflowAgentDetail): string {
  // Every one of these is model-authored text. Escaping happens HERE, inside
  // the tooltip string -- that is exactly where the /tools stored-XSS bug hid.
  const rows: string[] = [
    `<strong>${escapeHtml(a.label || a.agent_id)}</strong>`,
    `${escapeHtml(a.phase_title)} &middot; ${escapeHtml(a.model)}`,
    `ran ${fmtMs(a.duration_ms)}${a.queue_wait_ms > 0 ? ` &middot; queued ${fmtMs(a.queue_wait_ms)}` : ''}`,
  ];
  if (a.linked) rows.push(`${a.tool_calls} tool calls &middot; ${a.errors} errors`);
  else rows.push('<em>not linked to a session row</em>');
  if (a.last_tool_name) rows.push(`last: ${escapeHtml(a.last_tool_name)}`);
  if (a.attempt > 1) rows.push(`attempt ${a.attempt}`);
  if (a.fallback_model) rows.push(`fell back to ${escapeHtml(a.fallback_model)}`);
  return rows.join('<br>');
}

export function renderSwimlane(
  el: HTMLElement,
  agents: WorkflowAgentDetail[],
  onSelect: (a: WorkflowAgentDetail) => void,
): void {
  const timed = agents.filter(a => Number.isFinite(agentStart(a)));
  if (!timed.length) {
    el.innerHTML = '<p class="empty">No agent timings recorded for this run.</p>';
    return;
  }

  const t0 = Math.min(...timed.map(a => Math.min(agentStart(a), ms(a.queued_at) || Infinity)));
  const t1 = Math.max(...timed.map(a => agentEnd(a)));
  const span = Math.max(1, t1 - t0);
  const pct = (t: number) => ((t - t0) / span) * 100;

  const series = concurrency(timed, t0, t1, 240);
  const peak = Math.max(...series);

  // Group into phase bands, each band ordered by start -- the ordering is what
  // makes the queueing staircase legible.
  const bands = new Map<number, WorkflowAgentDetail[]>();
  for (const a of timed) {
    if (!bands.has(a.phase_index)) bands.set(a.phase_index, []);
    bands.get(a.phase_index)!.push(a);
  }
  const ordered = [...bands.entries()].sort((x, y) => x[0] - y[0]);
  for (const [, list] of ordered) list.sort((x, y) => agentStart(x) - agentStart(y));

  const byId = new Map(timed.map(a => [a.agent_id, a]));

  const bandHtml = ordered.map(([phaseIndex, list]) => {
    const color = phaseColor(phaseIndex);
    const rows = list.map(a => {
      const s = agentStart(a);
      const e = agentEnd(a);
      const q = ms(a.queued_at);
      const queueSeg = (Number.isFinite(q) && s - q > 0)
        ? `<span class="wf-seg wf-seg-queue" style="left:${pct(q).toFixed(3)}%;width:${(pct(s) - pct(q)).toFixed(3)}%"></span>`
        : '';
      const cls = a.state === 'done' ? 'wf-row' : 'wf-row wf-row-err';
      const marks = [
        a.attempt > 1 ? '<span class="wf-mark" title="retried">&#8635;</span>' : '',
        a.fallback_model ? '<span class="wf-mark" title="model fallback">&#9660;</span>' : '',
        a.state !== 'done' ? '<span class="wf-mark wf-mark-err">&#10007;</span>' : '',
      ].join('');
      return `<button type="button" class="${cls}" data-agent="${escapeHtml(a.agent_id)}">
        <span class="wf-row-label" title="${escapeHtml(a.label || a.agent_id)}">${escapeHtml(a.label || a.agent_id)}</span>
        <span class="wf-row-track">
          ${queueSeg}
          <span class="wf-seg wf-seg-run" style="left:${pct(s).toFixed(3)}%;width:${Math.max(0, pct(e) - pct(s)).toFixed(3)}%;background:${color}"></span>
        </span>
        <span class="wf-row-marks">${marks}</span>
      </button>`;
    }).join('');
    return `<div class="wf-band">
      <div class="wf-band-head">
        <span class="wf-band-dot" style="background:${color}"></span>
        <span class="wf-band-name">${escapeHtml(list[0].phase_title || `Phase ${phaseIndex}`)}</span>
        <span class="wf-band-count">${list.length}</span>
      </div>
      ${rows}
    </div>`;
  }).join('');

  const ticks = [0, 0.25, 0.5, 0.75, 1]
    .map(f => `<span style="left:${(f * 100).toFixed(0)}%">${fmtMs(span * f)}</span>`)
    .join('');

  el.innerHTML = `
    <div class="wf-ribbon">
      <span class="wf-ribbon-label">concurrency &middot; peak ${peak}</span>
      ${ribbonSvg(series)}
    </div>
    <div class="wf-lanes">${bandHtml}</div>
    <div class="wf-axis">${ticks}</div>
    <div class="wf-tip" id="wf-tip" role="tooltip" hidden></div>`;

  const tip = el.querySelector<HTMLElement>('#wf-tip')!;
  const rows = [...el.querySelectorAll<HTMLElement>('.wf-row')];

  const show = (row: HTMLElement) => {
    const a = byId.get(row.dataset.agent!);
    if (!a) return;
    tip.innerHTML = tooltipHtml(a);
    tip.hidden = false;
    const box = row.getBoundingClientRect();
    const host = el.getBoundingClientRect();
    tip.style.top = `${box.bottom - host.top + 6}px`;
    tip.style.left = `${Math.min(box.left - host.left + 120, host.width - 260)}px`;
  };

  for (const row of rows) {
    row.addEventListener('mouseenter', () => show(row));
    row.addEventListener('focus', () => show(row));
    row.addEventListener('mouseleave', () => { tip.hidden = true; });
    row.addEventListener('blur', () => { tip.hidden = true; });
    row.addEventListener('click', () => {
      for (const r of rows) r.classList.remove('sel');
      row.classList.add('sel');
      const a = byId.get(row.dataset.agent!);
      if (a) onSelect(a);
    });
    row.addEventListener('keydown', (ev: KeyboardEvent) => {
      if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
      ev.preventDefault();
      const i = rows.indexOf(row);
      const next = rows[ev.key === 'ArrowDown' ? i + 1 : i - 1];
      if (next) next.focus();
    });
  }

  if (rows.length) rows[0].click();
}
