#!/usr/bin/env node
// Capture raw dashboard screenshots for the README and the docs site. Requires a
// running `uv run argus start --port 4243` (any port; pass --url). Playwright comes
// from dashboard/node_modules (run `npx playwright install chromium` there once).
//
//   node scripts/screenshots/capture.mjs --out <dir> [--url http://127.0.0.1:4243]
//                                        [--session <id>] [--query <text>] [--project <substr>]
//                                        [--only <name,name>]
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
const only = args.only ? new Set(args.only.split(',')) : null; // capture a subset by name
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
  { name: 'settings', path: '/settings', after: redactPaths },
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

// Replace local file paths in the Parse errors list with a generic form so the
// published screenshot does not carry a username or private project folder names.
async function redactPaths(page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('summary')) {
      if (/^[A-Za-z]:\\|^\//.test(el.textContent ?? '')) {
        el.textContent = String.raw`C:\Users\you\.claude\projects\<project>\<session>.jsonl`;
      }
    }
  });
  await page.waitForTimeout(150);
}

// Project-name redaction, applied to every screen. Any path under the user's profile or
// documents folder is rewritten to `~/projects/<alias>`, and bare mentions of the same
// project names in prose get the same alias. Aliases are stable across all screenshots
// (project-a, project-b, ...). Names in KEEP_PROJECT_NAMES are public and stay as-is.
const KEEP_PROJECT_NAMES = new Set(['argus-code']);
const aliases = new Map();
function aliasFor(name) {
  if (KEEP_PROJECT_NAMES.has(name)) return name;
  if (!aliases.has(name)) {
    // a, b, ..., z, aa, ab, ... so more than 26 projects still get readable aliases.
    let n = aliases.size;
    let suffix = '';
    do {
      suffix = String.fromCharCode(97 + (n % 26)) + suffix;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    aliases.set(name, `project-${suffix}`);
  }
  return aliases.get(name);
}
// A path segment may contain a space ("gen ai/argus-cli"), so a space is consumed only
// when the chunk after it still contains a slash; prose after a path is left alone.
const PATH_RE = String.raw`(?:[A-Za-z]:[\\/](?:Users[\\/][^\\/\s]+[\\/])?documents[\\/]|…[\\/])(?:[^\s"'\`)]+|[ ]+(?=[^\s"'\`)]*[\\/]))*`;

async function redactProjects(page) {
  // Pass 1: discover the last segment of every matching path so aliases are assigned in Node.
  const names = await page.evaluate((re) => {
    const rx = new RegExp(re, 'g');
    const found = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      for (const m of walker.currentNode.nodeValue.matchAll(rx)) {
        const parts = m[0].split(/[\\/]/).filter(Boolean);
        found.add(parts[parts.length - 1]);
      }
    }
    return [...found];
  }, PATH_RE);
  const mapping = Object.fromEntries(names.map((n) => [n, aliasFor(n)]));
  // Pass 2: rewrite paths, then user-profile paths, then bare project names.
  await page.evaluate(({ re, mapping }) => {
    const rx = new RegExp(re, 'g');
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      let t = node.nodeValue;
      t = t.replace(rx, (m) => {
        const parts = m.split(/[\\/]/).filter(Boolean);
        return `~/projects/${mapping[parts[parts.length - 1]] ?? 'project'}`;
      });
      t = t.replace(/[A-Za-z]:\\Users\\[^\\\s]+/g, 'C:\\Users\\you');
      // Longest names first, and hyphens/dots/underscores count as part of a name, so
      // "argus" never matches inside "argus-code".
      const entries = Object.entries(mapping).filter(([name, alias]) => name !== alias).sort((a, b) => b[0].length - a[0].length);
      for (const [name, alias] of entries) {
        t = t.replace(new RegExp(`(^|[^A-Za-z0-9._-])${esc(name)}(?![A-Za-z0-9._-])`, 'g'), `$1${alias}`);
      }
      if (t !== node.nodeValue) node.nodeValue = t;
    }
  }, { re: PATH_RE, mapping });
  await page.waitForTimeout(150);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
for (const s of shots) {
  if (only && !only.has(s.name)) continue;
  await page.goto(url + s.path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700); // let charts settle
  if (s.after) await s.after(page);
  await redactProjects(page);
  const file = path.join(out, `${s.name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log('captured', s.name, '->', file);
}
await browser.close();
