import type { Db } from './db.js';
import type { Session, Turn } from '../schema/types.js';
import type { ParseError } from '../adapters/adapter.js';

export class Repository {
  constructor(private readonly db: Db) {}

  upsertSession(s: Session): void {
    this.db.prepare(`
      INSERT INTO sessions (id, agent, agent_version, project_path, started_at, ended_at, duration_sec,
        total_fresh_input_tokens, total_output_tokens, total_cache_read_tokens, total_cache_write_tokens,
        total_cost_usd, primary_model, turn_count, pricing_table_version, computed_at,
        agent_reported_cost_usd, metadata)
      VALUES (@id, @agent, @agent_version, @project_path, @started_at, @ended_at, @duration_sec,
        @total_fresh_input_tokens, @total_output_tokens, @total_cache_read_tokens, @total_cache_write_tokens,
        @total_cost_usd, @primary_model, @turn_count, @pricing_table_version, @computed_at,
        @agent_reported_cost_usd, @metadata)
      ON CONFLICT(id) DO UPDATE SET
        agent_version=excluded.agent_version, project_path=excluded.project_path,
        ended_at=excluded.ended_at, duration_sec=excluded.duration_sec,
        total_fresh_input_tokens=excluded.total_fresh_input_tokens,
        total_output_tokens=excluded.total_output_tokens,
        total_cache_read_tokens=excluded.total_cache_read_tokens,
        total_cache_write_tokens=excluded.total_cache_write_tokens,
        total_cost_usd=excluded.total_cost_usd, primary_model=excluded.primary_model,
        turn_count=excluded.turn_count, pricing_table_version=excluded.pricing_table_version,
        computed_at=excluded.computed_at, agent_reported_cost_usd=excluded.agent_reported_cost_usd,
        metadata=excluded.metadata
    `).run({ ...s, metadata: JSON.stringify(s.metadata) });
  }

  getSession(id: string): Session | null {
    const row = this.db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id) as any;
    if (!row) return null;
    return { ...row, metadata: JSON.parse(row.metadata) };
  }

  listSessions(opts: { limit: number; offset?: number; agent?: string }): Session[] {
    const where = opts.agent ? `WHERE agent = ?` : '';
    const params = opts.agent ? [opts.agent, opts.limit, opts.offset ?? 0] : [opts.limit, opts.offset ?? 0];
    const rows = this.db.prepare(`SELECT * FROM sessions ${where} ORDER BY started_at DESC LIMIT ? OFFSET ?`).all(...params) as any[];
    return rows.map(r => ({ ...r, metadata: JSON.parse(r.metadata) }));
  }

  upsertTurn(t: Turn): void {
    this.db.prepare(`
      INSERT INTO turns (id, session_id, sequence, timestamp, model, model_raw,
        fresh_input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
        cache_write_5m_tokens, cache_write_1h_tokens, tool_calls_count, cost_usd, metadata)
      VALUES (@id, @session_id, @sequence, @timestamp, @model, @model_raw,
        @fresh_input_tokens, @output_tokens, @cache_read_tokens, @cache_write_tokens,
        @cache_write_5m_tokens, @cache_write_1h_tokens, @tool_calls_count, @cost_usd, @metadata)
      ON CONFLICT(id) DO UPDATE SET
        sequence=excluded.sequence, timestamp=excluded.timestamp, model=excluded.model,
        model_raw=excluded.model_raw, fresh_input_tokens=excluded.fresh_input_tokens,
        output_tokens=excluded.output_tokens, cache_read_tokens=excluded.cache_read_tokens,
        cache_write_tokens=excluded.cache_write_tokens,
        cache_write_5m_tokens=excluded.cache_write_5m_tokens,
        cache_write_1h_tokens=excluded.cache_write_1h_tokens,
        tool_calls_count=excluded.tool_calls_count, cost_usd=excluded.cost_usd,
        metadata=excluded.metadata
    `).run({ ...t, metadata: JSON.stringify(t.metadata) });
  }

  getTurnsForSession(sessionId: string): Turn[] {
    const rows = this.db.prepare(`SELECT * FROM turns WHERE session_id = ? ORDER BY sequence`).all(sessionId) as any[];
    return rows.map(r => ({ ...r, metadata: JSON.parse(r.metadata) }));
  }

  setFileOffset(path: string, offset: number): void {
    this.db.prepare(`
      INSERT INTO file_offsets (path, byte_offset, last_seen) VALUES (?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET byte_offset=excluded.byte_offset, last_seen=excluded.last_seen
    `).run(path, offset, new Date().toISOString());
  }

  getFileOffset(path: string): number {
    const row = this.db.prepare(`SELECT byte_offset FROM file_offsets WHERE path = ?`).get(path) as any;
    return row?.byte_offset ?? 0;
  }

  recordParseError(e: ParseError): void {
    this.db.prepare(`
      INSERT INTO parse_errors (file, byte_offset, reason, raw_line_truncated, occurred_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(e.file, e.byte_offset, e.reason, e.raw_line_truncated, new Date().toISOString());
  }

  recentParseErrors(limit: number): ParseError[] {
    return this.db.prepare(`SELECT file, byte_offset, reason, raw_line_truncated FROM parse_errors ORDER BY id DESC LIMIT ?`).all(limit) as ParseError[];
  }
}
