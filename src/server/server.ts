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
  // Network bind. Defaults to 127.0.0.1 — Argus is a local-first tool
  // that exposes prompt history, transcripts, and project paths. Any
  // other interface (especially 0.0.0.0) means anyone on the LAN can
  // read every conversation you've ever had with Claude. Keep the
  // default tight; force the user to opt in via `argus start --host
  // 0.0.0.0` if they really want LAN exposure.
  host?: string;
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

  const hostname = opts.host ?? '127.0.0.1';

  return new Promise((resolve, reject) => {
    const server = serve({ fetch: root.fetch, port: opts.port, hostname }, (info) => {
      // Build the URL with the actual bind host so a 0.0.0.0 opt-in
      // surfaces honestly instead of pretending to be localhost.
      const displayHost = hostname === '0.0.0.0' || hostname === '::' ? 'localhost' : hostname;
      const url = `http://${displayHost}:${info.port}`;
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
