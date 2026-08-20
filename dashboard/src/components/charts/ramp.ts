/** One-hue blue ramp for magnitude (heatmaps). Index 0 = "nothing". */
export const RAMP = ['#141a24', '#1f3c63', '#285a95', '#3173c4', '#3987e5'];
export const rampColor = (v: number, max: number) => (v <= 0 ? RAMP[0] : RAMP[Math.min(4, 1 + Math.floor((v / max) * 3.999))]);
