import { basename } from 'node:path';
import type { Hono } from 'hono';
import type { Adapter, AdapterCapabilities } from '../adapter.js';
import type { Repository } from '../../store/repository.js';
import { discoverOpenClawSessionFiles, discoverOpenClawBackendAgents, openclawSessionIdFromFilename } from './discover.js';
import { ingestOpenClawFile } from './ingest_file.js';
import { registerOpenClawRoutes } from './api.js';

export class OpenClawAdapter implements Adapter {
  readonly agent = 'openclaw';
  readonly displayName = 'OpenClaw';
  readonly capabilities: AdapterCapabilities = {
    reportsNativeCost: true,
    hasToolCalls: true,
    hasTranscriptSegments: false,
    hasPrompts: false,
  };
  constructor(private readonly root: string) {}
  rootPath() { return this.root; }
  async discoverSessionFiles() {
    return discoverOpenClawSessionFiles(this.root);
  }
  async ingestFile(filePath: string, fromOffset = 0) {
    return ingestOpenClawFile(filePath, fromOffset);
  }
  async listBackendAgents() {
    return discoverOpenClawBackendAgents(this.root);
  }
  registerRoutes(app: Hono, repo: Repository) {
    return registerOpenClawRoutes(app, repo);
  }
  // Accept active sessions + .reset/.deleted archives; reject .bak/.checkpoint.
  shouldIngestPath(filePath: string): boolean {
    return openclawSessionIdFromFilename(basename(filePath)) !== null;
  }
}
