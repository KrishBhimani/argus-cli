import type { WorkflowAgentDetail } from './api';
import { escapeHtml } from './format';

// Fixed order, validated against surface #0a0d12 (worst adjacent CVD dE 8.4,
// normal-vision dE 19.3, all >= 3:1 contrast). DO NOT REORDER: the same six
// hues in a different sequence drop aqua<->magenta to dE 1.6 for deuteranopes.
// Red and green are absent -- --bad/--good already mean failed/ok.
export const PHASE_COLORS = [
  '#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9',
] as const;
const OVERFLOW_COLOR = '#6b7585';

export function phaseColor(phaseIndex: number): string {
  const i = phaseIndex - 1; // 1-based in the run record
  if (i < 0 || i >= PHASE_COLORS.length) return OVERFLOW_COLOR;
  return PHASE_COLORS[i];
}

const ms = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : NaN;
};

function fmtMs(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return '0s';
  const s = Math.round(v / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

const usd = (n: number | null | undefined) =>
  n == null ? '—' : (n < 1 ? `$${n.toFixed(3)}` : `$${n.toFixed(2)}`);
const tok = (n: number | null | undefined) => {
  if (n == null) return '—';
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return `${n}`;
};

// ─── Concurrency sparkline ───────────────────────────────────────────
function agentStart(a: WorkflowAgentDetail): number {
  const s = ms(a.started_at);
  return Number.isFinite(s) ? s : ms(a.queued_at);
}
function agentEnd(a: WorkflowAgentDetail): number {
  const s = agentStart(a);
  if (!Number.isFinite(s)) return NaN;
  if (a.duration_ms > 0) return s + a.duration_ms;
  const p = ms(a.last_progress_at);
  return Number.isFinite(p) ? p : s;
}

export function renderConcurrency(el: HTMLElement, agents: WorkflowAgentDetail[]): void {
  const timed = agents.filter(a => Number.isFinite(agentStart(a)) && Number.isFinite(agentEnd(a)));
  if (timed.length < 2) { el.innerHTML = ''; return; }
  const t0 = Math.min(...timed.map(agentStart));
  const t1 = Math.max(...timed.map(agentEnd));
  const span = Math.max(1, t1 - t0);
  const B = 220;
  const series = new Array<number>(B).fill(0);
  for (const a of timed) {
    const b0 = Math.max(0, Math.floor(((agentStart(a) - t0) / span) * B));
    const b1 = Math.min(B - 1, Math.floor(((agentEnd(a) - t0) / span) * B));
    for (let i = b0; i <= b1; i++) series[i] += 1;
  }
  const peak = Math.max(1, ...series);
  const pts = series
    .map((v, i) => `${((i / (B - 1)) * 100).toFixed(3)},${(100 - (v / peak) * 100).toFixed(2)}`)
    .join(' ');
  el.innerHTML = `
    <span class="wf-spark-label">concurrency &middot; peak ${peak} &middot; ${fmtMs(span)} wall clock</span>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <polygon points="0,100 ${pts} 100,100" fill="var(--accent-dim)"></polygon>
      <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="0.6"
        vector-effect="non-scaling-stroke"></polyline>
    </svg>`;
}

// ─── Bloom ───────────────────────────────────────────────────────────
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~137.5 degrees
const R_MIN = 8, R_MAX = 20;
const SPIRAL_C = R_MAX * 1.5;    // ring spacing of the phyllotaxis
const VIEW_W = 820;              // logical width; SVG scales to its container
const COL_GAP = 26, ROW_GAP = 28, LABEL_H = 20;

interface Placed { a: WorkflowAgentDetail; x: number; y: number; r: number; }
interface Cluster { phaseIndex: number; title: string; nodes: Placed[]; radius: number; }

function weight(a: WorkflowAgentDetail): number {
  return (a.total_tokens ?? a.wf_tokens ?? 0);
}

/** Deterministic golden-angle (sunflower) packing within one phase cluster. */
function packCluster(agents: WorkflowAgentDetail[], radiusOf: (a: WorkflowAgentDetail) => number): Placed[] {
  const sorted = [...agents].sort((x, y) => radiusOf(y) - radiusOf(x)); // big in the centre
  return sorted.map((a, i) => {
    const rad = SPIRAL_C * Math.sqrt(i + 0.4);
    const theta = i * GOLDEN_ANGLE;
    return { a, x: rad * Math.cos(theta), y: rad * Math.sin(theta), r: radiusOf(a) };
  });
}

function bubbleSvg(p: Placed): string {
  const a = p.a;
  const color = phaseColor(a.phase_index);
  const done = a.state === 'done';
  const linked = a.linked;
  const stroke = done ? color : 'var(--bad)';
  const strokeW = done ? 1 : 2.5;
  const fillOpacity = linked ? 0.85 : 0.32;
  const dash = linked ? '' : ' stroke-dasharray="3 2"';
  const marks: string[] = [];
  if (a.attempt > 1) marks.push('retried');
  if (a.fallback_model) marks.push('model fallback');
  if (!done) marks.push('error');
  const aria = escapeHtml(`${a.label || a.agent_id}, ${a.phase_title}${marks.length ? ', ' + marks.join(', ') : ''}`);
  const retryMark = a.attempt > 1
    ? `<circle cx="${(p.x + p.r * 0.62).toFixed(2)}" cy="${(p.y - p.r * 0.62).toFixed(2)}" r="2.4" fill="var(--text-0)"></circle>`
    : '';
  return `<g class="wf-bubble" tabindex="0" role="button" data-agent="${escapeHtml(a.agent_id)}" aria-label="${aria}">
    <circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${p.r.toFixed(2)}"
      fill="${color}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeW}"${dash}></circle>
    ${retryMark}
  </g>`;
}

function tooltipHtml(a: WorkflowAgentDetail): string {
  // Every field here is model-authored text -- escape at this boundary.
  const rows: string[] = [
    `<strong>${escapeHtml(a.label || a.agent_id)}</strong>`,
    `${escapeHtml(a.phase_title)} &middot; ${escapeHtml(a.model || 'model n/a')}`,
    `${tok(a.total_tokens ?? a.wf_tokens)} tokens${a.linked ? ` &middot; ${usd(a.cost_usd)}` : ''}`,
    `ran ${fmtMs(a.duration_ms)}${a.queue_wait_ms > 0 ? ` &middot; queued ${fmtMs(a.queue_wait_ms)}` : ''}`,
  ];
  if (a.linked) rows.push(`${a.tool_calls} tool calls &middot; ${a.errors} errors`);
  else rows.push('<em>not linked to a session row</em>');
  if (a.last_tool_name) rows.push(`last: ${escapeHtml(a.last_tool_name)}`);
  if (a.attempt > 1) rows.push(`&#8635; attempt ${a.attempt}`);
  if (a.fallback_model) rows.push(`&#9660; fell back to ${escapeHtml(a.fallback_model)}`);
  if (a.state !== 'done') rows.push(`<span style="color:var(--bad)">&#10007; ${escapeHtml(a.state || 'error')}</span>`);
  return rows.join('<br>');
}

export function renderBloom(
  el: HTMLElement,
  agents: WorkflowAgentDetail[],
  onSelect: (a: WorkflowAgentDetail) => void,
): void {
  if (!agents.length) {
    el.innerHTML = '<p class="wf-agent-empty">No agents recorded for this run.</p>';
    return;
  }

  // Radius scale on sqrt(tokens) so bubble AREA tracks tokens.
  const sqs = agents.map(a => Math.sqrt(Math.max(0, weight(a))));
  const lo = Math.min(...sqs), hi = Math.max(...sqs);
  const radiusOf = (a: WorkflowAgentDetail) => {
    if (hi <= lo) return (R_MIN + R_MAX) / 2;
    return R_MIN + ((Math.sqrt(Math.max(0, weight(a))) - lo) / (hi - lo)) * (R_MAX - R_MIN);
  };

  // Group into phase clusters, ordered by phase index.
  const byPhase = new Map<number, WorkflowAgentDetail[]>();
  for (const a of agents) {
    if (!byPhase.has(a.phase_index)) byPhase.set(a.phase_index, []);
    byPhase.get(a.phase_index)!.push(a);
  }
  const clusters: Cluster[] = [...byPhase.entries()]
    .sort((x, y) => x[0] - y[0])
    .map(([phaseIndex, list]) => {
      const nodes = packCluster(list, radiusOf);
      const radius = Math.max(R_MAX, ...nodes.map(n => Math.hypot(n.x, n.y) + n.r)) + 4;
      return { phaseIndex, title: list[0].phase_title || `Phase ${phaseIndex}`, nodes, radius };
    });

  // Flow clusters left-to-right, wrapping rows when they exceed VIEW_W.
  let cx = 0, rowTop = 0, rowMaxH = 0, maxRight = 0;
  const layout: { c: Cluster; ox: number; oy: number }[] = [];
  for (const c of clusters) {
    const cw = c.radius * 2;
    if (cx > 0 && cx + cw > VIEW_W) { rowTop += rowMaxH + ROW_GAP; cx = 0; rowMaxH = 0; }
    const ox = cx + c.radius;
    const oy = rowTop + LABEL_H + c.radius;
    layout.push({ c, ox, oy });
    cx += cw + COL_GAP;
    rowMaxH = Math.max(rowMaxH, LABEL_H + c.radius * 2);
    maxRight = Math.max(maxRight, ox + c.radius);
  }
  const totalH = rowTop + rowMaxH + 6;
  const viewW = Math.max(VIEW_W, maxRight);

  const byId = new Map(agents.map(a => [a.agent_id, a]));
  const body = layout.map(({ c, ox, oy }) => {
    const bubbles = c.nodes.map(bubbleSvg).join('');
    const labelY = oy - c.radius - 6;
    return `<g transform="translate(${ox.toFixed(2)},${oy.toFixed(2)})">${bubbles}</g>
      <text class="wf-clabel" x="${(ox - c.radius).toFixed(2)}" y="${labelY.toFixed(2)}">
        ${escapeHtml(c.title)} <tspan class="wf-ccount">${c.nodes.length}</tspan></text>`;
  }).join('');

  el.innerHTML = `
    <svg viewBox="0 0 ${viewW.toFixed(0)} ${totalH.toFixed(0)}" role="group" aria-label="workflow agents by phase">
      ${body}
    </svg>
    <div class="wf-tip" role="tooltip" hidden></div>`;

  const tip = el.querySelector<HTMLElement>('.wf-tip')!;
  const bubbles = [...el.querySelectorAll<SVGGElement>('.wf-bubble')];

  const show = (g: SVGGElement) => {
    const a = byId.get(g.dataset.agent!);
    if (!a) return;
    tip.innerHTML = tooltipHtml(a);
    tip.hidden = false;
    const b = g.getBoundingClientRect();
    const host = el.getBoundingClientRect();
    let left = b.left - host.left + b.width / 2 + 12;
    left = Math.min(left, host.width - 258);
    tip.style.left = `${Math.max(4, left)}px`;
    tip.style.top = `${b.bottom - host.top + 8}px`;
  };
  const hide = () => { tip.hidden = true; };
  const select = (g: SVGGElement) => {
    for (const o of bubbles) o.classList.remove('sel');
    g.classList.add('sel');
    const a = byId.get(g.dataset.agent!);
    if (a) onSelect(a);
  };

  for (const g of bubbles) {
    g.addEventListener('mouseenter', () => show(g));
    g.addEventListener('mouseleave', hide);
    g.addEventListener('focus', () => show(g));
    g.addEventListener('blur', hide);
    g.addEventListener('click', () => select(g));
    g.addEventListener('keydown', (ev: KeyboardEvent) => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(g); return; }
      if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
      ev.preventDefault();
      const i = bubbles.indexOf(g);
      const next = bubbles[ev.key === 'ArrowRight' ? i + 1 : i - 1];
      if (next) next.focus();
    });
  }

  if (bubbles.length) select(bubbles[0]);
}
