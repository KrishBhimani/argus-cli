import type { RawSessionHeader, RawTurnEvent } from '../schema/types.js';

export interface AdapterIngestResult {
  header: RawSessionHeader;
  turns: RawTurnEvent[];
  parse_errors: ParseError[];
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
