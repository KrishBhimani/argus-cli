import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PricingTable } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BUNDLED_PATH = resolve(__dirname, '../../pricing/2026-05-02.json');

export async function loadPricingTable(path = BUNDLED_PATH): Promise<PricingTable> {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw) as PricingTable;
}
