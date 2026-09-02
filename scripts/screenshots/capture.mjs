#!/usr/bin/env node
// Capture raw dashboard screenshots for the README and the docs site. Requires a
// running `uv run argus start --port 4243` (any port; pass --url). Playwright comes
// from dashboard/node_modules (run `npx playwright install chromium` there once).
//
//   node scripts/screenshots/capture.mjs --out <dir> [--url http://127.0.0.1:4243]
//                                        [--session <id>] [--query <text>] [--project <substr>]
//
// Raw output is 3200x2000 (1600x1000 @2x). Run frame.mjs afterwards to produce the
// framed 2880x1760 images that live in assets/.
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const pw = pathToFileURL(
  path.join(here, '..', '..', 'dashboard', 'node_modules', 'playwright', 'index.mjs'),
).href;
const { chromium } = await import(pw);

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[i + 1];
}
const url = (args.url ?? 'http://127.0.0.1:4243').replace(/\/$/, '');
const session = args.session ?? 'claude_code:d07cb127-cbd5-4741-8303-f71dfa2f36f9';
const query = args.query ?? 'refactor';
const project = args.project ?? null; // substring of a project path to filter search by
const out = args.out;
if (!out) {
  console.error('--out <dir> is required');
  process.exit(2);
}
fs.mkdirSync(out, { recursive: true });

const sid = encodeURIComponent(session);
const shots = [
  { name: 'overview', path: '/' },
  { name: 'sessions', path: '/sessions' },
  { name: 'session-detail', path: `/sessions/${sid}?tab=overview` },
  { name: 'session-timeline', path: `/sessions/${sid}?tab=timeline`, after: expandTurn },
  { name: 'subagents', path: `/sessions/${sid}?tab=subagents` },
  { name: 'models', path: '/models' },
  { name: 'trends', path: '/trends' },
  { name: 'tools', path: '/tools' },
  { name: 'alerts', path: '/alerts' },
  { name: 'search', path: '/search', after: typeQuery },
  { name: 'settings', path: '/settings' },
];

// Expand one turn row so the timeline shows a tool-call block. Prefer a turn with a
// failing call (its wrapper carries the critical wash) so the error text is visible.
async function expandTurn(page) {
  const wrappers = page.locator('[id^="turn-"]');
  const n = await wrappers.count();
  if (n === 0) return;
  let target = wrappers.first();
  for (let i = 0; i < n; i++) {
    const cls = (await wrappers.nth(i).getAttribute('class')) ?? '';
    if (cls.includes('crit')) {
      target = wrappers.nth(i);
      break;
    }
  }
  await target.locator('[role="button"]').first().click();
  await page.waitForTimeout(500);
}

async function typeQuery(page) {
  if (project) {
    const select = page.locator('select').first();
    const value = await select.locator('option').evaluateAll(
      (opts, needle) => opts.find((o) => o.textContent && o.textContent.includes(needle))?.value ?? null,
      project,
    );
    if (value != null) await select.selectOption(value);
  }
  const box = page.locator('input[type="search"], input[placeholder*="earch"]').first();
  await box.fill(query);
  await page.waitForTimeout(1200); // 250 ms debounce + fetch + render
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
for (const s of shots) {
  await page.goto(url + s.path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700); // let charts settle
  if (s.after) await s.after(page);
  const file = path.join(out, `${s.name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log('captured', s.name, '->', file);
}
await browser.close();
