import { basename } from 'node:path';
import type { Adapter } from '../adapters/adapter.js';
import type { Repository } from '../store/repository.js';
import type { PricingTable } from '../pricing/types.js';
import type { Session, ToolCall } from '../schema/types.js';
import type { RawToolCall } from '../adapters/claude_code/extract_tool_calls.js';
import { buildSession, buildTurn } from './aggregate.js';
import { rollupSubAgents } from './rollup_subagents.js';
import { ingestClaudeCodeFile } from '../adapters/claude_code/ingest_file.js';
import { subAgentFilesFor } from '../adapters/claude_code/discover.js';

// Map adapter-local RawToolCall → persisted ToolCall. Composite id uses
// tool_use_id (stable per Claude assignment) so repeated tail ingests of
// the same bytes upsert in place rather than duplicate.
function toToolCall(r: RawToolCall, sessionId: string): ToolCall {
  return {
    id: `${sessionId}:${r.tool_use_id}`,
    session_id: sessionId,
    turn_index: r.turn_index,
    tool_name: r.tool_name,
    is_error: r.is_error,
    input_size: r.input_size,
    subagent_type: r.subagent_type,
    timestamp: r.timestamp,
  };
}

export async function ingestFile(adapter: Adapter, filePath: string, repo: Repository, table: PricingTable): Promise<void> {
  const fromOffset = repo.getFileOffset(filePath);
  const { result, new_offset } = await adapter.ingestFile(filePath, fromOffset);

  for (const e of result.parse_errors) repo.recordParseError(e);

  // No turn events in the bytes we just read. Three sub-cases:
  //   (a) re-ingest with no file growth — nothing to do.
  //   (b) first ingest of a file containing only metadata / user lines / hooks.
  //   (c) Codex stub session: the binary launched (writing session_meta)
  //       but no prompt was ever sent, so no token_count events exist.
  // For (b) and (c) we still record the new offset so we don't re-read those
  // bytes next time, but we MUST NOT create an empty session row — that
  // clutters the dashboard with $0 / 0-token entries that say nothing useful.
  if (result.turns.length === 0) {
    if (new_offset > fromOffset) repo.setFileOffset(filePath, new_offset);
    return;
  }

  const sessionId = `${result.header.agent}:${result.header.native_session_id}`;

  // Ensure a session row exists (FK target for turns and tool_calls). Stub
  // with header only; we'll recompute totals below from the full turn set.
  if (!repo.getSession(sessionId)) {
    repo.upsertSession(buildSession(result.header, sessionId, [], table.version));
  }

  // Upsert any new turns from this read.
  for (const raw of result.turns) repo.upsertTurn(buildTurn(raw, sessionId, table));

  // Upsert any new tool_calls from this read. Adapters that don't emit
  // tool_calls leave the field undefined; treat as empty.
  if (result.tool_calls && result.tool_calls.length) {
    repo.upsertToolCalls(result.tool_calls.map(r => toToolCall(r, sessionId)));
  }

  // Sub-agents: each sub-agent JSONL becomes its own session under <sessionId>/<filename>.
  let subSessions: Session[] = [];
  if (adapter.agent === 'claude_code' && !filePath.includes('subagents')) {
    for (const sub of subAgentFilesFor(filePath)) {
      const subSessionId = `${sessionId}/${basename(sub, '.jsonl')}`;
      const subFromOffset = repo.getFileOffset(sub);
      const subResult = await ingestClaudeCodeFile(sub, subFromOffset);

      for (const e of subResult.result.parse_errors) repo.recordParseError(e);

      // Only update offset and turns when we actually read something or have prior state
      if (!repo.getSession(subSessionId) && subResult.result.turns.length > 0) {
        repo.upsertSession(buildSession(subResult.result.header, subSessionId, [], table.version));
      }
      for (const raw of subResult.result.turns) repo.upsertTurn(buildTurn(raw, subSessionId, table));
      if (subResult.result.tool_calls && subResult.result.tool_calls.length) {
        repo.upsertToolCalls(subResult.result.tool_calls.map(r => toToolCall(r, subSessionId)));
      }

      // Recompute the sub-session totals from the FULL set of stored turns.
      const existingSub = repo.getSession(subSessionId);
      if (existingSub) {
        const allSubTurns = repo.getTurnsForSession(subSessionId);
        const recomputed = buildSession(subResult.result.header, subSessionId, allSubTurns, table.version);
        repo.upsertSession(recomputed);
        subSessions.push(recomputed);
      }
      repo.setFileOffset(sub, subResult.new_offset);
    }
  }

  // Recompute parent session totals from ALL stored turns (the new ones we just upserted
  // plus any previously stored from earlier ingests of this file). Then layer the
  // sub-agent rollup on top — buildSession only sums the parent's own turns, so this
  // is idempotent and never double-counts sub-agent totals on re-ingest.
  const allTurns = repo.getTurnsForSession(sessionId);
  let session = buildSession(result.header, sessionId, allTurns, table.version);
  if (subSessions.length > 0) session = rollupSubAgents(session, subSessions);

  repo.upsertSession(session);
  repo.setFileOffset(filePath, new_offset);
}
