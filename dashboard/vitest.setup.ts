import '@testing-library/jest-dom/vitest';

// uPlot needs a canvas; jsdom has none. Stub getContext so mounts don't throw.
HTMLCanvasElement.prototype.getContext = (() => ({
  measureText: () => ({ width: 10 }),
  fillRect() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {},
  save() {}, restore() {}, translate() {}, scale() {}, setTransform() {}, arc() {}, rect() {}, clip() {},
  closePath() {}, fillText() {}, strokeRect() {}, setLineDash() {}, getLineDash: () => [],
  createLinearGradient: () => ({ addColorStop() {} }),
})) as unknown as typeof HTMLCanvasElement.prototype.getContext;

class RO { observe() {} unobserve() {} disconnect() {} }
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = RO;

window.matchMedia ??= ((q: string) => ({
  matches: false, media: q, onchange: null,
  addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;

window.scrollTo = (() => {}) as typeof window.scrollTo;

class P2D { moveTo() {} lineTo() {} rect() {} arc() {} closePath() {} addPath() {} }
(globalThis as unknown as { Path2D: unknown }).Path2D = P2D;

Element.prototype.scrollIntoView ??= () => {};
