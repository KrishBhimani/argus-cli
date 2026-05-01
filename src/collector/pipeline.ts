import { basename } from 'node:path';
import type { Adapter } from '../adapters/adapter.js';
import type { Repository } from '../store/repository.js';
import type { PricingTable } from '../pricing/types.js';
import { aggregateAdapterResult } from './aggregate.js';
import { rollupSubAgents } from './rollup_subagents.js';
import { ingestClaudeCodeFile } from '../adapters/claude_code/ingest_file.js';
import { subAgentFilesFor } from '../adapters/claude_code/discover.js';

export async function ingestFile(adapter: Adapter, filePath: string, repo: Repository, table: PricingTable): Promise<void> {
  const fromOffset = repo.getFileOffset(filePath);
  const { result, new_offset } = await adapter.ingestFile(filePath, fromOffset);

  for (const e of result.parse_errors) repo.recordParseError(e);
  if (result.turns.length === 0 && fromOffset === new_offset) return;

  let { session, turns } = aggregateAdapterResult(result, table);

  if (adapter.agent === 'claude_code' && !filePath.includes('subagents')) {
    const subs = subAgentFilesFor(filePath);
    const subSessions = [];
    for (const sub of subs) {
      const subResult = await ingestClaudeCodeFile(sub, repo.getFileOffset(sub));
      for (const e of subResult.result.parse_errors) repo.recordParseError(e);
      if (subResult.result.turns.length > 0) {
        const agg = aggregateAdapterResult(subResult.result, table);
        agg.session.id = `${session.id}/${basename(sub, '.jsonl')}`;
        for (const t of agg.turns) { t.session_id = agg.session.id; t.id = `${agg.session.id}:${t.id.split(':').pop()}`; }
        repo.upsertSession(agg.session);
        for (const t of agg.turns) repo.upsertTurn(t);
        repo.setFileOffset(sub, subResult.new_offset);
        subSessions.push(agg.session);
      }
    }
    session = rollupSubAgents(session, subSessions);
  }

  repo.upsertSession(session);
  for (const t of turns) repo.upsertTurn(t);
  repo.setFileOffset(filePath, new_offset);
}
