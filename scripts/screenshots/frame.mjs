#!/usr/bin/env node
// Frame raw captures (from capture.mjs) into the branded browser-window look used by
// the README hero and every tour screenshot, then write them into assets/.
//
//   node scripts/screenshots/frame.mjs --in <dir>
//
// Output: assets/screenshots/<name>.png (2880x1760, i.e. 1440x880 @2x) for every raw
// PNG in <dir>, plus assets/hero.png = the framed overview.
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..');
const pw = pathToFileURL(path.join(root, 'dashboard', 'node_modules', 'playwright', 'index.mjs')).href;
const { chromium } = await import(pw);

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[i + 1];
}
const inDir = args.in;
if (!inDir) {
  console.error('--in <dir> is required');
  process.exit(2);
}
const outDir = path.join(root, 'assets', 'screenshots');
fs.mkdirSync(outDir, { recursive: true });

const html = (dataUrl) => `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0}
  body{width:1440px;height:880px;overflow:hidden;background:#0b0d11;
    background-image:
      radial-gradient(900px 520px at 12% 0%, rgba(240,136,62,.12), transparent 60%),
      radial-gradient(800px 480px at 95% 100%, rgba(240,136,62,.07), transparent 60%);
    font-family:'IBM Plex Mono','Cascadia Code',Consolas,monospace}
  .win{position:absolute;left:120px;top:42px;width:1200px;height:792px;border:1px solid #2c3340;
    border-radius:14px;overflow:hidden;background:#10131a;box-shadow:0 40px 100px -30px rgba(0,0,0,.85)}
  .bar{height:40px;display:flex;align-items:center;padding:0 16px;background:#161a22;
    border-bottom:1px solid #232934;position:relative}
  .dot{width:12px;height:12px;border-radius:50%;margin-right:8px}
  .url{position:absolute;left:50%;transform:translateX(-50%);color:#9aa4b2;font-size:12px;
    background:#0b0d11;border:1px solid #232934;border-radius:6px;padding:3px 14px}
  img{display:block;width:100%;height:auto}
</style></head><body><div class="win"><div class="bar">
  <span class="dot" style="background:#ff5f57"></span>
  <span class="dot" style="background:#febc2e"></span>
  <span class="dot" style="background:#28c840"></span>
  <span class="url">localhost:4242</span></div><img src="${dataUrl}"></div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 880 }, deviceScaleFactor: 2 });
const files = fs.readdirSync(inDir).filter((f) => f.endsWith('.png')).sort();
for (const file of files) {
  const name = path.basename(file, '.png');
  const dataUrl = 'data:image/png;base64,' + fs.readFileSync(path.join(inDir, file)).toString('base64');
  await page.setContent(html(dataUrl), { waitUntil: 'load' });
  const target = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: target, fullPage: false });
  console.log('framed', name, '->', path.relative(root, target));
  if (name === 'overview') {
    fs.copyFileSync(target, path.join(root, 'assets', 'hero.png'));
    console.log('copied overview -> assets/hero.png');
  }
}
await browser.close();
