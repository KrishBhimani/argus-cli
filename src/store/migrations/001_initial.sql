CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  agent TEXT NOT NULL,
  agent_version TEXT,
  project_path TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_sec INTEGER,
  total_fresh_input_tokens INTEGER NOT NULL DEFAULT 0,
  total_output_tokens INTEGER NOT NULL DEFAULT 0,
  total_cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  total_cache_write_tokens INTEGER NOT NULL DEFAULT 0,
  total_cost_usd REAL NOT NULL DEFAULT 0,
  primary_model TEXT NOT NULL,
  turn_count INTEGER NOT NULL DEFAULT 0,
  pricing_table_version TEXT NOT NULL,
  computed_at TEXT NOT NULL,
  agent_reported_cost_usd REAL,
  metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_agent ON sessions(agent);

CREATE TABLE IF NOT EXISTS turns (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  timestamp TEXT NOT NULL,
  model TEXT NOT NULL,
  model_raw TEXT NOT NULL,
  fresh_input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cache_write_tokens INTEGER NOT NULL DEFAULT 0,
  cache_write_5m_tokens INTEGER,
  cache_write_1h_tokens INTEGER,
  tool_calls_count INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_turns_session ON turns(session_id, sequence);

CREATE TABLE IF NOT EXISTS file_offsets (
  path TEXT PRIMARY KEY,
  byte_offset INTEGER NOT NULL,
  last_seen TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS parse_errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file TEXT NOT NULL,
  byte_offset INTEGER NOT NULL,
  reason TEXT NOT NULL,
  raw_line_truncated TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
