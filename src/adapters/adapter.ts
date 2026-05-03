import type { RawSessionHeader, RawTurnEvent } from '../schema/types.js';
import type { RawToolCall } from './claude_code/extract_tool_calls.js';
import type { RawSegment } from './claude_code/extract_transcript.js';

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

export interface Adapter {
  readonly agent: 'claude_code' | 'codex';
  rootPath(): string;
  discoverSessionFiles(): Promise<string[]>;
  ingestFile(filePath: string, fromOffset?: number): Promise<{
    result: AdapterIngestResult;
    new_offset: number;
  }>;
}
