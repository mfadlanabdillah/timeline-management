use crate::auth::require_admin;
use crate::db::{new_id, now_iso, Store};
use crate::error::{CoreError, Result};
use crate::models::{AuditLogEntry, AuditPage};
use rusqlite::{params, Connection};

/// Best-effort: a logging failure never blocks the action itself.
pub(crate) fn record(
    conn: &Connection,
    action: &str,
    entity_type: &str,
    entity_id: Option<&str>,
    project_id: Option<&str>,
    actor: &str,
    actor_type: &str,
    summary: &str,
) {
    let summary: String = summary.chars().take(500).collect();
    let _ = conn.execute(
        "INSERT INTO audit_logs (id, action, entity_type, entity_id, project_id, actor, actor_type, summary, created_at)
         VALUES (?,?,?,?,?,?,?,?,?)",
        params![new_id(), action, entity_type, entity_id, project_id, actor, actor_type, summary, now_iso()],
    );
}

impl Store {
    pub fn list_audit_logs(
        &self,
        secret: &[u8],
        token: Option<&str>,
        project_id: Option<&str>,
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> Result<AuditPage> {
        require_admin(secret, token)?;
        let limit = limit.unwrap_or(50).clamp(1, 200);
        let offset = offset.unwrap_or(0).max(0);
        let conn = self.lock()?;
        let (filter, param): (String, Option<String>) = match project_id {
            Some(pid) => ("WHERE project_id = ?".into(), Some(pid.into())),
            None => ("".into(), None),
        };
        let total: i64 = match &param {
            Some(p) => conn.query_row(
                &format!("SELECT COUNT(*) FROM audit_logs {filter}"),
                params![p],
                |r| r.get(0),
            )?,
            None => conn.query_row("SELECT COUNT(*) FROM audit_logs", [], |r| r.get(0))?,
        };
        let sql = format!(
            "SELECT id, action, entity_type, entity_id, project_id, actor, actor_type, summary, created_at
             FROM audit_logs {filter} ORDER BY created_at DESC LIMIT ? OFFSET ?"
        );
        let mut stmt = conn.prepare(&sql)?;
        let map_row = |r: &rusqlite::Row| -> rusqlite::Result<AuditLogEntry> {
            Ok(AuditLogEntry {
                id: r.get(0)?,
                action: r.get(1)?,
                entity_type: r.get(2)?,
                entity_id: r.get(3)?,
                project_id: r.get(4)?,
                actor: r.get(5)?,
                actor_type: r.get(6)?,
                summary: r.get(7)?,
                created_at: r.get(8)?,
            })
        };
        let out = match &param {
            Some(p) => {
                let rows = stmt.query_map(params![p, limit, offset], map_row)?;
                rows.collect::<rusqlite::Result<Vec<_>>>()
            }
            None => {
                let rows = stmt.query_map(params![limit, offset], map_row)?;
                rows.collect::<rusqlite::Result<Vec<_>>>()
            }
        }
        .map_err(CoreError::from)?;
        Ok(AuditPage { entries: out, total, limit, offset })
    }
}
