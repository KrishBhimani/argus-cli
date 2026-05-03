import { statSync } from 'node:fs';
import type { Db } from './db.js';
import type { Session, Turn, ToolCall, Prompt, TranscriptSegment } from '../schema/types.js';
import type { ParseError } from '../adapters/adapter.js';

// Same project_path normalization rule used by both the session ingest path
// and the history.jsonl ingest path. Lives here so the join target is
// guaranteed identical regardless of which side wrote first.
//
// Rule: replace backslashes with forward slashes; on Windows additionally
// lowercase the drive letter and the rest of the path. Trailing slash is
// stripped. Empty input is preserved.
export function normalizeProjectPath(p: string): string {
  if (!p) return '';
  let s = p.replace(/\\/g, '/').replace(/\/+$/, '');
  if (process.platform === 'win32') s = s.toLowerCase();
  return s;
}

// Convert an ISO-8601 timestamp string to milliseconds since epoch. Returns
// null for null/empty input or if the string fails to parse — null is what
// SQLite stores for "unknown end".
function isoToMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

// SQLite row → Session. Strips the denormalized started_at_ms / ended_at_ms
// columns that exist in the table but not on the interface (used internally
// for fast prompt → session linkage joins; consumers don't need them).
function rowToSession(row: any): Session {
  const { started_at_ms: _a, ended_at_ms: _b, ...rest } = row;
  return { ...rest, metadata: JSON.parse(rest.metadata) };
}

export class Repository {
  constructor(private readonly db: Db) {}

  upsertSession(s: Session): void {
    const startedMs = isoToMs(s.started_at);
    const endedMs = isoToMs(s.ended_at);
    this.db.prepare(`
      INSERT INTO sessions (id, agent, agent_version, project_path, started_at, ended_at, duration_sec,
        total_fresh_input_tokens, total_output_tokens, total_cache_read_tokens, total_cache_write_tokens,
        total_cost_usd, primary_model, turn_count, pricing_table_version, computed_at,
        agent_reported_cost_usd, metadata, started_at_ms, ended_at_ms)
      VALUES (@id, @agent, @agent_version, @project_path, @started_at, @ended_at, @duration_sec,
        @total_fresh_input_tokens, @total_output_tokens, @total_cache_read_tokens, @total_cache_write_tokens,
        @total_cost_usd, @primary_model, @turn_count, @pricing_table_version, @computed_at,
        @agent_reported_cost_usd, @metadata, @started_at_ms, @ended_at_ms)
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
        metadata=excluded.metadata,
        started_at_ms=excluded.started_at_ms, ended_at_ms=excluded.ended_at_ms
    `).run({
      ...s,
      // Project path is normalized on write so the prompt → session linkage
      // join (joins on equality) hits regardless of which slash direction the
      // upstream source used.
      project_path: normalizeProjectPath(s.project_path),
      metadata: JSON.stringify(s.metadata),
      started_at_ms: startedMs,
      ended_at_ms: endedMs,
    });
  }

  getSession(id: string): Session | null {
    const row = this.db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id) as any;
    if (!row) return null;
    return rowToSession(row);
  }

  listSessions(opts: { limit: number; offset?: number; agent?: string }): Session[] {
    const where = opts.agent ? `WHERE agent = ?` : '';
    const params = opts.agent ? [opts.agent, opts.limit, opts.offset ?? 0] : [opts.limit, opts.offset ?? 0];
    const rows = this.db.prepare(`SELECT * FROM sessions ${where} ORDER BY started_at DESC LIMIT ? OFFSET ?`).all(...params) as any[];
    return rows.map(rowToSession);
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

  // ─── Tool calls (Slice 1) ──────────────────────────────────────────────

  // Upsert each tool_call by composite id (`${session_id}:${tool_use_id}`).
  // Why upsert and not replace-by-session: ingest is byte-offset tail, so
  // each call here only carries tool_calls discovered in the NEW bytes —
  // wiping the session would lose every tool_call from prior tails. The
  // tool_use_id is stable (Claude assigns it once and it's identical across
  // re-reads of the same bytes), so repeated ingestion of the same lines
  // updates rows in place instead of producing duplicates.
  upsertToolCalls(calls: ToolCall[]): void {
    if (calls.length === 0) return;
    const insert = this.db.prepare(`
      INSERT INTO tool_calls (id, session_id, turn_index, tool_name, is_error, input_size, subagent_type, timestamp)
      VALUES (@id, @session_id, @turn_index, @tool_name, @is_error, @input_size, @subagent_type, @timestamp)
      ON CONFLICT(id) DO UPDATE SET
        turn_index=excluded.turn_index, tool_name=excluded.tool_name,
        is_error=excluded.is_error, input_size=excluded.input_size,
        subagent_type=excluded.subagent_type, timestamp=excluded.timestamp
    `);
    const tx = this.db.transaction((cs: ToolCall[]) => {
      for (const c of cs) insert.run(c);
    });
    tx(calls);
  }

  countToolCallsForSession(sessionId: string): number {
    const row = this.db.prepare(`SELECT COUNT(*) AS n FROM tool_calls WHERE session_id = ?`).get(sessionId) as any;
    return row?.n ?? 0;
  }

  // Aggregate query for /api/tools/overview. cutoffIso is the lower bound on
  // tool_calls.timestamp; pass '' (or anything sortable below all real
  // timestamps) for "all time".
  toolLeaderboard(cutoffIso: string, limit = 20): Array<{ name: string; calls: number; errors: number }> {
    return this.db.prepare(`
      SELECT tool_name AS name, COUNT(*) AS calls, SUM(is_error) AS errors
      FROM tool_calls
      WHERE timestamp >= ?
      GROUP BY tool_name
      ORDER BY calls DESC
      LIMIT ?
    `).all(cutoffIso, limit) as any[];
  }

  toolCallsTotal(cutoffIso: string): { total: number; errors: number } {
    const row = this.db.prepare(`
      SELECT COUNT(*) AS total, COALESCE(SUM(is_error), 0) AS errors
      FROM tool_calls WHERE timestamp >= ?
    `).get(cutoffIso) as any;
    return { total: row?.total ?? 0, errors: row?.errors ?? 0 };
  }

  // MCP rollup. Tool names matching the convention `mcp__<server>__<tool>`
  // are captured by the LIKE; the regex/split lives in JS so a server name
  // containing extra underscores doesn't fool the SQL.
  mcpToolCalls(cutoffIso: string): Array<{ tool_name: string; calls: number; errors: number }> {
    return this.db.prepare(`
      SELECT tool_name, COUNT(*) AS calls, SUM(is_error) AS errors
      FROM tool_calls
      WHERE timestamp >= ? AND tool_name LIKE 'mcp\\_\\_%' ESCAPE '\\'
      GROUP BY tool_name
    `).all(cutoffIso) as any[];
  }

  subagentCalls(cutoffIso: string): Array<{ type: string; calls: number; errors: number }> {
    return this.db.prepare(`
      SELECT subagent_type AS type, COUNT(*) AS calls, COALESCE(SUM(is_error), 0) AS errors
      FROM tool_calls
      WHERE timestamp >= ? AND subagent_type IS NOT NULL AND subagent_type <> ''
      GROUP BY subagent_type
      ORDER BY calls DESC
    `).all(cutoffIso) as any[];
  }

  sessionsMissingToolCalls(limit: number): Array<{ id: string }> {
    return this.db.prepare(`
      SELECT s.id FROM sessions s
      LEFT JOIN (SELECT DISTINCT session_id FROM tool_calls) t ON t.session_id = s.id
      WHERE t.session_id IS NULL
      ORDER BY s.started_at DESC
      LIMIT ?
    `).all(limit) as any[];
  }

  // ─── Prompts (Slice 1) ─────────────────────────────────────────────────

  insertPrompts(rows: Omit<Prompt, 'id'>[]): void {
    if (rows.length === 0) return;
    const insert = this.db.prepare(`
      INSERT INTO prompts (timestamp_ms, project_path, display, pasted_chars, is_slash)
      VALUES (@timestamp_ms, @project_path, @display, @pasted_chars, @is_slash)
    `);
    const tx = this.db.transaction((rs: Omit<Prompt, 'id'>[]) => {
      for (const r of rs) insert.run(r);
    });
    tx(rows);
  }

  // Search and recent are the same call shape; an empty/null `q` means
  // "chronological recents". Returning the snippet column lets the API
  // ship FTS5-highlighted excerpts without a second query.
  searchPrompts(opts: {
    q?: string;
    limit: number;
    project?: string;
    includeSlash?: boolean;
  }): { total: number; rows: Array<Prompt & { snippet: string }> } {
    const slashClause = opts.includeSlash ? '1=1' : 'is_slash = 0';
    const projectClause = opts.project ? 'AND p.project_path = ?' : '';
    const projectParam = opts.project ? [opts.project] : [];

    if (opts.q && opts.q.trim()) {
      // FTS5 path. snippet() emits <mark>…</mark> around match terms; the
      // delimiters are static (not user-controlled) so the rendered HTML is
      // safe to pass through after escaping the rest of the field.
      const fts = opts.q.trim();
      const sql = `
        SELECT p.*, snippet(prompts_fts, 0, '<mark>', '</mark>', '…', 16) AS snippet
        FROM prompts_fts
        JOIN prompts p ON p.id = prompts_fts.rowid
        WHERE prompts_fts MATCH ? AND ${slashClause} ${projectClause}
        ORDER BY bm25(prompts_fts)
        LIMIT ?
      `;
      const countSql = `
        SELECT COUNT(*) AS n FROM prompts_fts
        JOIN prompts p ON p.id = prompts_fts.rowid
        WHERE prompts_fts MATCH ? AND ${slashClause} ${projectClause}
      `;
      const params = [fts, ...projectParam];
      const rows = this.db.prepare(sql).all(...params, opts.limit) as any[];
      const total = (this.db.prepare(countSql).get(...params) as any)?.n ?? 0;
      return { total, rows };
    }

    // Recents path — no FTS, just chronological.
    const sql = `
      SELECT p.*, p.display AS snippet
      FROM prompts p
      WHERE ${slashClause} ${projectClause}
      ORDER BY p.timestamp_ms DESC
      LIMIT ?
    `;
    const countSql = `
      SELECT COUNT(*) AS n FROM prompts p
      WHERE ${slashClause} ${projectClause}
    `;
    const rows = this.db.prepare(sql).all(...projectParam, opts.limit) as any[];
    const total = (this.db.prepare(countSql).get(...projectParam) as any)?.n ?? 0;
    return { total, rows };
  }

  promptStats(): { total: number; projects: number; oldest_ms: number | null } {
    const row = this.db.prepare(`
      SELECT COUNT(*) AS total,
             COUNT(DISTINCT project_path) AS projects,
             MIN(timestamp_ms) AS oldest_ms
      FROM prompts
    `).get() as any;
    return {
      total: row?.total ?? 0,
      projects: row?.projects ?? 0,
      oldest_ms: row?.oldest_ms ?? null,
    };
  }

  promptProjects(): string[] {
    const rows = this.db.prepare(`
      SELECT DISTINCT project_path FROM prompts ORDER BY project_path
    `).all() as any[];
    return rows.map(r => r.project_path);
  }

  // Find the session that "owns" a given (project_path, timestamp_ms) point.
  // Used for the linkage column in /api/prompts results. Closest started_at
  // wins when multiple sessions overlap in the same project.
  linkPromptToSession(projectPath: string, timestampMs: number): string | null {
    const row = this.db.prepare(`
      SELECT id FROM sessions
      WHERE project_path = ?
        AND started_at_ms IS NOT NULL
        AND started_at_ms <= ?
        AND (ended_at_ms IS NULL OR ended_at_ms >= ?)
      ORDER BY ABS(started_at_ms - ?)
      LIMIT 1
    `).get(projectPath, timestampMs, timestampMs, timestampMs) as any;
    return row?.id ?? null;
  }

  // ─── Transcript segments (Slice 2) ─────────────────────────────────────

  upsertTranscriptSegments(rows: TranscriptSegment[]): void {
    if (rows.length === 0) return;
    const insert = this.db.prepare(`
      INSERT INTO transcript_segments (uid, session_id, timestamp, role, text)
      VALUES (@uid, @session_id, @timestamp, @role, @text)
      ON CONFLICT(uid) DO UPDATE SET
        session_id=excluded.session_id, timestamp=excluded.timestamp,
        role=excluded.role, text=excluded.text
    `);
    const tx = this.db.transaction((rs: TranscriptSegment[]) => {
      for (const r of rs) insert.run(r);
    });
    tx(rows);
  }

  countSegmentsForSession(sessionId: string): number {
    const row = this.db.prepare(`SELECT COUNT(*) AS n FROM transcript_segments WHERE session_id = ?`).get(sessionId) as any;
    return row?.n ?? 0;
  }

  sessionsMissingSegments(limit: number): Array<{ id: string }> {
    return this.db.prepare(`
      SELECT s.id FROM sessions s
      LEFT JOIN (SELECT DISTINCT session_id FROM transcript_segments) t ON t.session_id = s.id
      WHERE t.session_id IS NULL
      ORDER BY s.started_at DESC
      LIMIT ?
    `).all(limit) as any[];
  }

  // Search the transcript_fts index. Same fall-back-on-syntax-error pattern
  // is applied in the API layer, not here. project filter joins through to
  // sessions (segments don't carry project directly).
  searchTranscripts(opts: {
    q: string;
    limit: number;
    project?: string;
    sessionId?: string;
    roles?: string[]; // e.g. ['user','assistant']
  }): { total: number; rows: Array<{
    uid: string; session_id: string; timestamp: string; role: string;
    text: string; snippet: string; project_path: string | null;
  }> } {
    const conds: string[] = ['transcript_fts MATCH ?'];
    const params: any[] = [opts.q];
    if (opts.project) {
      conds.push('s.project_path = ?');
      params.push(opts.project);
    }
    if (opts.sessionId) {
      conds.push('seg.session_id = ?');
      params.push(opts.sessionId);
    }
    if (opts.roles && opts.roles.length) {
      conds.push(`seg.role IN (${opts.roles.map(() => '?').join(',')})`);
      params.push(...opts.roles);
    }
    const where = `WHERE ${conds.join(' AND ')}`;

    const sql = `
      SELECT seg.uid, seg.session_id, seg.timestamp, seg.role, seg.text,
             snippet(transcript_fts, 0, '<mark>', '</mark>', '…', 16) AS snippet,
             s.project_path AS project_path
      FROM transcript_fts
      JOIN transcript_segments seg ON seg.rowid = transcript_fts.rowid
      LEFT JOIN sessions s ON s.id = seg.session_id
      ${where}
      ORDER BY bm25(transcript_fts)
      LIMIT ?
    `;
    const countSql = `
      SELECT COUNT(*) AS n FROM transcript_fts
      JOIN transcript_segments seg ON seg.rowid = transcript_fts.rowid
      LEFT JOIN sessions s ON s.id = seg.session_id
      ${where}
    `;
    const rows = this.db.prepare(sql).all(...params, opts.limit) as any[];
    const total = (this.db.prepare(countSql).get(...params) as any)?.n ?? 0;
    return { total, rows };
  }

  // Distinct projects that have at least one indexed segment. Used for the
  // unified search page's project filter.
  segmentProjects(): string[] {
    const rows = this.db.prepare(`
      SELECT DISTINCT s.project_path
      FROM transcript_segments seg
      JOIN sessions s ON s.id = seg.session_id
      WHERE s.project_path IS NOT NULL AND s.project_path <> ''
      ORDER BY s.project_path
    `).all() as any[];
    return rows.map(r => r.project_path);
  }

  // Total segment count and distinct sessions covered. Used by the
  // Settings page to show "what would you lose if you disable / clear".
  segmentStats(): { total: number; sessions: number } {
    const r = this.db.prepare(`
      SELECT COUNT(*) AS total, COUNT(DISTINCT session_id) AS sessions
      FROM transcript_segments
    `).get() as any;
    return { total: r?.total ?? 0, sessions: r?.sessions ?? 0 };
  }

  // Drop every segment row (and through the FTS5 sync trigger, every FTS
  // row). Used by the "Clear" button in Settings and `argus search clear`.
  clearAllSegments(): void {
    this.db.exec(`DELETE FROM transcript_segments;`);
  }

  // Total on-disk footprint in bytes — sum of the three files SQLite
  // maintains in WAL mode:
  //   * <db>          : the persistent data (pages)
  //   * <db>-wal      : pending writes not yet checkpointed into the main file
  //   * <db>-shm      : shared-memory coordination (~32 KB, fixed)
  //
  // We sum file sizes via stat() rather than pragma_page_count because
  // the user's mental model is "what does `ls -la` show". A pure
  // page-count would understate the cost during heavy writes (when the
  // WAL is balloon'd) and overstate the savings after a VACUUM (since
  // VACUUM writes the rewrite to WAL first; the on-disk truth includes
  // the WAL until it checkpoints).
  //
  // Falls back to the page-count formula for :memory: databases (used
  // in tests), where the path-stat approach has nothing to stat.
  dbSizeBytes(): number {
    const path = this.db.name;
    if (!path || path === ':memory:' || path === '') {
      const row = this.db.prepare(
        `SELECT (SELECT page_count FROM pragma_page_count()) *
                (SELECT page_size  FROM pragma_page_size()) AS bytes`,
      ).get() as any;
      return row?.bytes ?? 0;
    }
    let total = 0;
    for (const suffix of ['', '-wal', '-shm']) {
      try { total += statSync(path + suffix).size; }
      catch { /* file may not exist on a fresh / quiescent DB; treat as 0 */ }
    }
    return total;
  }

  // Reclaim free pages by rewriting the DB. SQLite's DELETE marks pages
  // as free but leaves them inside the file for reuse — the file only
  // shrinks once VACUUM runs. We invoke this from the "clear indexed
  // data" path so users see the freed bytes immediately on disk.
  //
  // WAL caveat: in WAL mode, VACUUM writes the rewrite into the
  // -wal sidecar first; without a checkpoint, the user sees the main
  // .db file shrink but the -wal file balloon, so total disk usage
  // looks barely changed. The TRUNCATE checkpoint merges WAL into the
  // main file and shrinks -wal back to zero, which is what users
  // actually want to see when they click "clear".
  vacuum(): void {
    this.db.exec('VACUUM');
    // Coerce a clean checkpoint. PASSIVE / FULL would leave a non-
    // empty -wal; TRUNCATE forces it to size 0 so the file listing
    // matches the user's expectation of "I freed space".
    this.db.pragma('wal_checkpoint(TRUNCATE)');
  }

  // ─── App-meta-backed settings ──────────────────────────────────────────

  // Search indexing is opt-in: a fresh install starts with it OFF so the
  // user doesn't get surprise disk usage. An EXISTING install where
  // segments are already present gets ON as the migration default — we
  // assume anyone who already had the feature wants to keep it.
  //
  // The setting lives in app_meta with key 'enable_transcript_search'
  // and value '1' or '0'. On first read after upgrade, if the key is
  // missing we synthesize a default from segmentStats() and persist it
  // so subsequent reads are direct.
  isSearchIndexingEnabled(): boolean {
    const row = this.db.prepare(`SELECT value FROM app_meta WHERE key = 'enable_transcript_search'`).get() as
      | { value: string }
      | undefined;
    if (row) return row.value === '1';
    // Migration default: ON if segments already exist, OFF otherwise.
    const hasData = this.segmentStats().total > 0;
    this.setSearchIndexingEnabled(hasData);
    return hasData;
  }

  setSearchIndexingEnabled(enabled: boolean): void {
    this.db.prepare(
      `INSERT OR REPLACE INTO app_meta (key, value) VALUES ('enable_transcript_search', ?)`,
    ).run(enabled ? '1' : '0');
  }
}
