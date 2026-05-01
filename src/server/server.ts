import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import type { Repository } from '../store/repository.js';
import type { IngestStatus } from '../collector/first_run.js';
import { buildApi } from './api.js';

export interface ServerOpts {
  pricingTableVersion: string;
  ingestStatus: () => IngestStatus;
  dashboardDir: string;
  port: number;
}

export async function startServer(repo: Repository, opts: ServerOpts): Promise<{ url: string; stop: () => Promise<void> }> {
  const root = new Hono();
  const api = buildApi(repo, { pricingTableVersion: opts.pricingTableVersion, ingestStatus: opts.ingestStatus });
  root.route('/', api);
  root.use('/*', serveStatic({ root: opts.dashboardDir }));

  return new Promise((resolve) => {
    const server = serve({ fetch: root.fetch, port: opts.port }, (info) => {
      const url = `http://localhost:${info.port}`;
      resolve({ url, stop: () => new Promise<void>(r => server.close(() => r())) });
    });
  });
}
