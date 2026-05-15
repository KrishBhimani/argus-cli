import type { Hono } from 'hono';
import type { RawSessionHeader, RawTurnEvent, RawToolCall, RawSegment } from '../schema/types.js';
import type { Repository } from '../store/repository.js';

export interface AdapterIngestResult {
  header: RawSessionHeader;
  turns: RawTurnEvent[];
  parse_errors: ParseError[];
  // Slice 1 (Tools page). Adapters that don't populate this leave it empty
  // — the pipeline treats an empty array as "no tool data", not "delete
  // existing tool_calls", so adapters can opt in incrementally.
  tool_calls?: RawToolCall[];
  // Slice 2 (full-transcript search). Same opt-in rule.
  segments?: RawSegment[];
}

export interface ParseError {
  file: string;
  byte_offset: number;
  reason: string;
  raw_line_truncated: string;
}

// Adapter-declared capabilities. Read by the pipeline and the API layer so
// behavior derives from a single source of truth rather than `if agent ===
// 'openclaw'` branches scattered across the code.
export interface AdapterCapabilities {
  /** Adapter writes cost directly into turns; no pricing-table compute applies. */
  reportsNativeCost: boolean;
  /** Adapter emits tool_calls rows. */
  hasToolCalls: boolean;
  /** Adapter emits transcript_segments (FTS-indexable text blocks). */
  hasTranscriptSegments: boolean;
  /** Adapter emits prompts (history.jsonl-style typed-input log). */
  hasPrompts: boolean;
}

export interface Adapter {
  /** Stable wire-form identifier — used as the `agent` column in SQLite. */
  readonly agent: string;
  /** User-facing label, surfaced via /api/agents.display_name. */
  readonly displayName: string;
  readonly capabilities: AdapterCapabilities;

  rootPath(): string;
  discoverSessionFiles(): Promise<string[]>;
  ingestFile(filePath: string, fromOffset?: number): Promise<{
    result: AdapterIngestResult;
    new_offset: number;
  }>;

  /**
   * Decide whether the watcher should ingest a file path. Default behavior
   * is "ends with .jsonl and not under subagents/" — matches Claude Code.
   * OpenClaw overrides to allow `.jsonl.reset.<iso>` / `.jsonl.deleted.<iso>`
   * archives and reject `.bak.<iso>` / `.checkpoint.<uuid>.jsonl`.
   */
  shouldIngestPath?(filePath: string): boolean;

  /**
   * Optional: distinct sub-divisions of this backend that should appear in
   * the global filter and in /api/agents.backend_agents (OpenClaw's named
   * agents). Returns null/undefined for backends with no such dimension.
   */
  listBackendAgents?(): Promise<string[]>;

  /**
   * Optional: register per-agent GET routes under /api/agents/<name>/*.
   * Called once at server startup. The route handlers run with the
   * adapter's own closures, keeping per-agent code in the adapter folder.
   */
  registerRoutes?(app: Hono, repo: Repository): void;
}
