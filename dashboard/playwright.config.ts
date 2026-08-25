import { defineConfig } from '@playwright/test';

// Smoke test against the *shipped* form: `uv run argus start` serves dashboard-dist/
// from the repo root, so run `npm run build` and refresh dashboard-dist first.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  use: { baseURL: 'http://127.0.0.1:4343', headless: true },
  webServer: {
    command: 'uv run argus start --port 4343 --quiet --data-dir ./dashboard/.e2e-data',
    cwd: '..',
    url: 'http://127.0.0.1:4343/api/ingest/status',
    reuseExistingServer: false,
    timeout: 90_000,
  },
});
