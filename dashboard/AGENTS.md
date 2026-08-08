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

## Verification

`cd dashboard && npm run build` must succeed. After refreshing `dashboard-dist`,
optionally confirm the wheel ships it (`rm -rf dist && uv build`, then inspect the
`.whl`).
