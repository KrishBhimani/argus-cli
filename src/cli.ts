#!/usr/bin/env node
import { Command } from 'commander';
import { homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { existsSync, writeFileSync, rmSync } from 'node:fs';
import open from 'open';
import { fileURLToPath } from 'node:url';
import { openDb } from './store/db.js';
import { Repository } from './store/repository.js';
import { ClaudeCodeAdapter } from './adapters/claude_code/index.js';
import { runFirstPassIngest } from './collector/first_run.js';
import { startWatcher } from './collector/watcher.js';
import { startServer } from './server/server.js';
import { loadPricingTable } from './pricing/load.js';
import { fetchLiteLlmTable, diffPricing } from './pricing/refresh.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const program = new Command();
program.name('argus').description('Local-first dashboard for coding-agent costs').version('0.1.0');

program.command('start')
  .option('-p, --port <port>', 'port', '4242')
  .option('--data-dir <dir>', 'data dir', join(homedir(), '.argus'))
  .action(async ({ port, dataDir }) => {
    const db = openDb(join(dataDir, 'argus.db'));
    const repo = new Repository(db);
    const claudeRoot = join(homedir(), '.claude');
    if (!existsSync(claudeRoot)) {
      console.error('No Claude Code log directory found at ~/.claude');
      process.exit(1);
    }
    const adapters = [new ClaudeCodeAdapter(claudeRoot)];
    const table = await loadPricingTable();
    console.log('Argus: ingesting recent sessions...');
    const { foregroundDone, status } = runFirstPassIngest(adapters, repo, table, { recentDays: 30 });
    await foregroundDone;
    console.log(`Argus: foreground ingest complete (${status().processed}/${status().total} files), starting watcher...`);
    await startWatcher(adapters, repo, table);
    const dashDir = resolve(__dirname, '../dashboard-dist');
    const { url } = await startServer(repo, { pricingTableVersion: table.version, ingestStatus: status, dashboardDir: dashDir, port: Number(port) });
    console.log(`Argus running at ${url}`);
    try { await open(url); } catch { /* ignore */ }
  });

const pricingCmd = program.command('pricing').description('Pricing-table operations');
pricingCmd.command('refresh')
  .description('Fetch latest pricing from LiteLLM and apply on confirm')
  .action(async () => {
    const current = await loadPricingTable();
    console.log('Fetching latest pricing from LiteLLM...');
    const fresh = await fetchLiteLlmTable();
    const diff = diffPricing(current, fresh);
    console.log(`Added: ${diff.added.length}, Removed: ${diff.removed.length}, Changed: ${diff.changed.length}, Unchanged: ${diff.unchanged.length}`);
    for (const k of diff.changed) {
      console.log(`  ~ ${k}: ${JSON.stringify(current.models[k])} -> ${JSON.stringify(fresh.models[k])}`);
    }
    for (const k of diff.added) console.log(`  + ${k}: ${JSON.stringify(fresh.models[k])}`);
    for (const k of diff.removed) console.log(`  - ${k}`);
    if (diff.added.length === 0 && diff.changed.length === 0 && diff.removed.length === 0) {
      console.log('Nothing to update.');
      return;
    }
    process.stdout.write('Apply? [y/N] ');
    const ans = await new Promise<string>(r => process.stdin.once('data', d => r(d.toString().trim())));
    process.stdin.pause();
    if (ans.toLowerCase() === 'y') {
      const out = resolve(__dirname, '../pricing', `${fresh.version}.json`);
      writeFileSync(out, JSON.stringify(fresh, null, 2));
      console.log(`Wrote ${out}`);
    } else {
      console.log('Cancelled.');
    }
    process.exit(0);
  });

program.command('wipe')
  .option('--data-dir <dir>', 'data dir', join(homedir(), '.argus'))
  .option('-y, --yes', 'skip confirmation')
  .description('Delete all local Argus data')
  .action(async ({ dataDir, yes }) => {
    if (!yes) {
      process.stdout.write(`Delete ${dataDir}? [y/N] `);
      const ans = await new Promise<string>(r => process.stdin.once('data', d => r(d.toString().trim())));
      process.stdin.pause();
      if (ans.toLowerCase() !== 'y') { console.log('Cancelled.'); process.exit(0); }
    }
    rmSync(dataDir, { recursive: true, force: true });
    console.log(`Deleted ${dataDir}`);
    process.exit(0);
  });

program.parseAsync().catch(e => { console.error(e); process.exit(1); });
