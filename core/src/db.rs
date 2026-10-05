use crate::error::{CoreError, Result};
use rusqlite::Connection;
use std::sync::Mutex;

const SCHEMA: &str = r#"
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS timeline_items (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#4F46E5',
  position INTEGER NOT NULL DEFAULT 0,
  is_milestone INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_project ON timeline_items(project_id, position, start_date);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES timeline_items(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('note','issue')),
  created_by TEXT,
  evidence_url TEXT,
  resolved INTEGER NOT NULL DEFAULT 0,
  resolved_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notes_item ON notes(item_id, date);

CREATE TABLE IF NOT EXISTS note_replies (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS progress_entries (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES timeline_items(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  percentage INTEGER NOT NULL CHECK (percentage BETWEEN 0 AND 100),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (item_id, date)
);

CREATE TABLE IF NOT EXISTS item_dependencies (
  id TEXT PRIMARY KEY,
  predecessor_id TEXT NOT NULL REFERENCES timeline_items(id) ON DELETE CASCADE,
  successor_id TEXT NOT NULL REFERENCES timeline_items(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  UNIQUE (predecessor_id, successor_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  project_id TEXT,
  actor TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_project ON audit_logs(project_id, created_at);
"#;

/// Single-connection store behind a mutex.
/// ponytail: global lock, fine for a local single-user app; split pools if throughput matters.
pub struct Store {
    pub(crate) conn: Mutex<Connection>,
}

impl Store {
    pub fn open(path: &str) -> Result<Self> {
        let conn = Connection::open(path)?;
        Self::from_conn(conn)
    }

    pub fn open_in_memory() -> Result<Self> {
        Self::from_conn(Connection::open_in_memory()?)
    }

    fn from_conn(conn: Connection) -> Result<Self> {
        conn.execute_batch(SCHEMA)?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub(crate) fn lock(
        &self,
    ) -> Result<std::sync::MutexGuard<'_, Connection>> {
        self.conn.lock().map_err(|e| CoreError::Db(e.to_string()))
    }
}

pub fn now_iso() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
}

pub fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}
