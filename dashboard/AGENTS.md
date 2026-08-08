# AGENTS.md — dashboard (Astro frontend + ship chain)

Parent: repo-root `AGENTS.md`. The statically-built UI served by `server/`.

## Purpose

Astro + ECharts dashboard. Source pages live in `src/pages/*.astro`
(`session.astro`, `settings.astro`, `overview`, `timeline`, …) with shared
scripts in `src/scripts/`.

## Local Contracts

- **Three "dist" directories — don't conflate them:**
  - `dashboard/dist/` — raw Astro build output. **Gitignored.**
  - `dashboard-dist/` (repo root) — the **tracked** copy that ships in the wheel
    via `pyproject.toml` force-include (`"dashboard-dist" = "argus/dashboard-dist"`).
  - `dist/` (repo root) — `uv build` output uploaded to PyPI. **Gitignored.**
- **A dashboard source edit is invisible to the package until `dashboard-dist` is
  refreshed and committed.** After changing anything under `dashboard/src/`:
  ```sh
  cd dashboard && npm run build && cd ..
  git rm -r --quiet dashboard-dist && cp -r dashboard/dist dashboard-dist && git add -A dashboard-dist
  ```
  Commit the rebuilt `dashboard-dist` alongside the source change. Astro filenames
  are content-hashed, so a real change shows as new `_astro/*.js|css` plus updated
  `*/index.html` — verify the new asset (and absence of stale strings) in
  `dashboard-dist` before committing.
- Avoid em dashes / non-ASCII in strings that surface in the **terminal**
  (CLI/console) — they mojibake on the Windows console. (UI text is fine.)
- **The workflow swimlane is hand-built DOM, not ECharts.** `swimlane.ts` renders
  CSS-grid rows with absolutely-positioned bars (real hover/focus, text selection,
  no bundle growth); ECharts stays for the cost rollup only. This holds up to
  ~1000 bars (the workflow agent cap); past that, collapse phases to summary
  strips rather than reaching for a canvas `custom` series.
- **Phase colours are a fixed, CVD-validated order and must not be reordered:**
  `['#3987e5','#d95926','#199e70','#c98500','#d55181','#9085e9']`, 7th+ = neutral
  `#6b7585`. `--good`/`--bad` are reserved for ok/error and are never phase hues.
- **Model-authored workflow text is escaped at the HTML boundary — including
  inside tooltip strings.** `label`, `prompt_preview`, `result_preview`,
  `last_tool_summary`, `name`, `summary`, and every log line flow through
  `escapeHtml()` (the `/tools` stored-XSS fix in `444eabb` was a missed *tooltip*
  string). The orchestration script renders via `textContent` on a `<pre>`, never
  `innerHTML`.

## Verification

`cd dashboard && npm run build` must succeed. After refreshing `dashboard-dist`,
optionally confirm the wheel ships it (`rm -rf dist && uv build`, then inspect the
`.whl`).
