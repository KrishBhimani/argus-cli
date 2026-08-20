# Chart rules (binding for everything under `components/charts` and its callers)

Colour roles
- Orange `--color-accent` is brand + UI accent only (active nav, active filter, focus). Never chart data.
- Single-series data uses series slot 1 `#3987e5`. Multi-series use `SERIES` from `uplotTheme.ts` in fixed
  order, never cycled; beyond five series fold into "Other" (`trendsToSeries`, `topNPlusOther`).
- Magnitude (heatmaps) uses the one-hue ramp in `ramp.ts`.
- Status colours (good / warning / critical) are reserved for state and always ship with an icon + text
  label (`Pill`). Error counts in tables carry the ✕ glyph. Colour is never the only signal.
- Text wears ink tokens, never a series colour; identity comes from a swatch beside the text.

Form
- One y-axis per chart. Two measures of different scale → two charts (see Models page).
- 2 px lines, ≤ 8 px markers with a 2 px surface ring, area fills at ~10 %, 6–8 px bar tracks.
- A legend whenever there are ≥ 2 series (`Legend`); none for one (the panel title names it).
- Every chart has a table view: wrap in `ChartWithTable` or place a `ChartTable` beside it.
- Hover layer by default (uPlot cursor; `<title>` on SVG marks).

Components
- `Bars` (horizontal, optional error segment), `Meter` (composition), `CalendarHeatmap`, `GridHeatmap`,
  `Sparkline`, `AlertStrip`, `Minimap` — hand-rolled SVG.
- `AreaLine` / `MultiLine` / `Scatter` — uPlot wrappers via `UPlotChart` (owns instance + resize).
