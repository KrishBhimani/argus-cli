import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import type { Repository } from '../store/repository.js';
import type { IngestStatus } from '../collector/first_run.js';
import type { Adapter } from '../adapters/adapter.js';
import type { PricingTable } from '../pricing/types.js';
import { buildApi } from './api.js';

export interface ServerOpts {
  pricingTableVersion: string;
  ingestStatus: () => IngestStatus;
  dashboardDir: string;
  port: number;
  // Slice 3 (opt-in indexing): the API needs access to the adapter list
  // and pricing table so the search-index/enable handler can fire an
  // on-demand backfill. Both stay process-local — handlers don't ship
  // them to the client.
  adapters: Adapter[];
  pricingTable: PricingTable;
}

export async function startServer(repo: Repository, opts: ServerOpts): Promise<{ url: string; stop: () => Promise<void> }> {
  const root = new Hono();
  const api = buildApi(repo, {
    pricingTableVersion: opts.pricingTableVersion,
    ingestStatus: opts.ingestStatus,
    adapters: opts.adapters,
    pricingTable: opts.pricingTable,
  });
  root.route('/', api);
  root.use('/*', serveStatic({ root: opts.dashboardDir }));

  return new Promise((resolve, reject) => {
    const server = serve({ fetch: root.fetch, port: opts.port }, (info) => {
      const url = `http://localhost:${info.port}`;
      resolve({ url, stop: () => new Promise<void>(r => server.close(() => r())) });
    });
    server.on('error', (e: NodeJS.ErrnoException) => {
      if (e.code === 'EADDRINUSE') {
        reject(new Error(`Port ${opts.port} is already in use. Another argus instance may be running. Try: argus start --port ${opts.port + 1}`));
      } else {
        reject(e);
      }
    });
  });
}
