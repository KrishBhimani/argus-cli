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
    const { url } = await startServer(repo, {
      pricingTableVersion: table.version,
      ingestStatus: status,
      dashboardDir: dashDir,
      port: Number(port),
      adapters,
      pricingTable: table,
    });
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

// ─── Slice 3: opt-in transcript indexing ────────────────────────────────
//
// Search indexing covers full-text search of every assistant response,
// every user reply, and tool output across every session — far more than
// the prompt history alone. It costs disk space, so we expose it as an
// explicit toggle here. The dashboard's Settings page wraps the same
// endpoints; both are equivalent.

const searchCmd = program.command('search').description('Manage transcript-search indexing');

searchCmd.command('status')
  .option('--data-dir <dir>', 'data dir', join(homedir(), '.argus'))
  .description('Show whether transcript indexing is on, and how much is indexed')
  .action(async ({ dataDir }) => {
    const db = openDb(join(dataDir, 'argus.db'));
    const repo = new Repository(db);
    const enabled = repo.isSearchIndexingEnabled();
    const segs = repo.segmentStats();
    console.log(`Status:   ${enabled ? 'ENABLED' : 'disabled'}`);
    console.log(`Indexed:  ${segs.total.toLocaleString()} segments across ${segs.sessions} sessions`);
    if (!enabled && segs.total > 0) {
      console.log(`Note:     existing segments stay on disk but are hidden from search`);
      console.log(`          until you re-enable. Use 'argus search clear' to wipe them.`);
    }
    process.exit(0);
  });

searchCmd.command('enable')
  .option('--data-dir <dir>', 'data dir', join(homedir(), '.argus'))
  .description('Turn on transcript indexing and backfill historical sessions')
  .action(async ({ dataDir }) => {
    const db = openDb(join(dataDir, 'argus.db'));
    const repo = new Repository(db);
    if (repo.isSearchIndexingEnabled()) {
      console.log('Already enabled.');
      const segs = repo.segmentStats();
      console.log(`Indexed: ${segs.total.toLocaleString()} segments across ${segs.sessions} sessions`);
      process.exit(0);
    }
    repo.setSearchIndexingEnabled(true);
    console.log('Enabled. Run `argus start` to backfill — historical sessions will');
    console.log('index in the background. New sessions are indexed automatically.');
    process.exit(0);
  });

searchCmd.command('disable')
  .option('--data-dir <dir>', 'data dir', join(homedir(), '.argus'))
  .description('Stop indexing new sessions; existing segments stay on disk but are hidden')
  .action(async ({ dataDir }) => {
    const db = openDb(join(dataDir, 'argus.db'));
    const repo = new Repository(db);
    repo.setSearchIndexingEnabled(false);
    const segs = repo.segmentStats();
    console.log('Disabled.');
    if (segs.total > 0) {
      console.log(`${segs.total.toLocaleString()} existing segments are still on disk but hidden`);
      console.log('from search. Run `argus search clear` to wipe them.');
    }
    process.exit(0);
  });

searchCmd.command('clear')
  .option('--data-dir <dir>', 'data dir', join(homedir(), '.argus'))
  .option('-y, --yes', 'skip confirmation')
  .description('Delete all indexed segments and turn off indexing')
  .action(async ({ dataDir, yes }) => {
    const db = openDb(join(dataDir, 'argus.db'));
    const repo = new Repository(db);
    const segs = repo.segmentStats();
    if (segs.total === 0) {
      console.log('Nothing to clear (0 indexed segments).');
      repo.setSearchIndexingEnabled(false);
      process.exit(0);
    }
    if (!yes) {
      process.stdout.write(`Delete ${segs.total.toLocaleString()} indexed segments? [y/N] `);
      const ans = await new Promise<string>(r => process.stdin.once('data', d => r(d.toString().trim())));
      process.stdin.pause();
      if (ans.toLowerCase() !== 'y') { console.log('Cancelled.'); process.exit(0); }
    }
    repo.clearAllSegments();
    repo.setSearchIndexingEnabled(false);
    console.log(`Deleted ${segs.total.toLocaleString()} segments.`);
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
