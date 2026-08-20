// Gzipped JS+CSS budget check for the built dashboard (fonts are separate assets and excluded).
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const BUDGET_KB = 350;
const dir = 'dist/assets';
let total = 0;
for (const f of readdirSync(dir)) {
  if (!/\.(js|css)$/.test(f)) continue;
  const gz = gzipSync(readFileSync(join(dir, f))).length;
  total += gz;
  console.log(f.padEnd(48), (gz / 1024).toFixed(1).padStart(7) + ' KB gz');
}
console.log('TOTAL'.padEnd(48), (total / 1024).toFixed(1).padStart(7) + ' KB gz', `(budget ${BUDGET_KB} KB)`);
if (total > BUDGET_KB * 1024) {
  console.error(`Bundle over the ${BUDGET_KB} KB gzipped budget`);
  process.exit(1);
}
