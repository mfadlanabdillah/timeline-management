use crate::auth::require_admin;
use crate::db::{new_id, now_iso, Store};
use crate::error::{CoreError, Result};
use crate::models::ProgressEntry;
use crate::projects::{check_item_access, load_progress};
use crate::validate::{validate_date, validate_percentage};
use rusqlite::{params, OptionalExtension};

impl Store {
    pub fn list_progress(
        &self,
        secret: &[u8],
        item_id: &str,
        code: Option<&str>,
        token: Option<&str>,
    ) -> Result<Vec<ProgressEntry>> {
        let conn = self.lock()?;
        check_item_access(&conn, secret, item_id, token, code)?;
        load_progress(&conn, item_id)
    }

    /// Upsert on (item_id, date), mirroring `POST /progress`.
    pub fn upsert_progress(
        &self,
        secret: &[u8],
        token: Option<&str>,
        item_id: &str,
        date: &str,
        percentage: i64,
    ) -> Result<ProgressEntry> {
        let actor = require_admin(secret, token)?;
        validate_date(date)?;
        validate_percentage(percentage)?;
        let conn = self.lock()?;
        let (project_id, _) = crate::projects::item_project(&conn, item_id)?;
        let now = now_iso();
        let existing: Option<String> = conn
            .query_row(
                "SELECT id FROM progress_entries WHERE item_id = ? AND date = ?",
                params![item_id, date],
                |r| r.get(0),
            )
            .optional()
            .map_err(CoreError::from)?;
        let id = match existing {
            Some(eid) => {
                conn.execute(
                    "UPDATE progress_entries SET percentage = ?, updated_at = ? WHERE id = ?",
                    params![percentage, now, eid],
                )?;
                eid
            }
            None => {
                let nid = new_id();
                conn.execute(
                    "INSERT INTO progress_entries (id, item_id, date, percentage, created_at, updated_at)
                     VALUES (?,?,?,?,?,?)",
                    params![nid, item_id, date, percentage, now, now],
                )?;
                nid
            }
        };
        crate::audit::record(&conn, "update", "progress", Some(&id), Some(&project_id), &actor, "admin",
            &format!("Progress {date} set to {percentage}%"));
        conn.query_row(
            "SELECT id, item_id, date, percentage, created_at, updated_at FROM progress_entries WHERE id = ?",
            params![id],
            |r| {
                Ok(ProgressEntry {
                    id: r.get(0)?,
                    item_id: r.get(1)?,
                    date: r.get(2)?,
                    percentage: r.get(3)?,
                    created_at: r.get(4)?,
                    updated_at: r.get(5)?,
                })
            },
        )
        .map_err(CoreError::from)
    }

    pub fn delete_progress(&self, secret: &[u8], token: Option<&str>, id: &str) -> Result<()> {
        let actor = require_admin(secret, token)?;
        let conn = self.lock()?;
        let ctx: Option<(String, String)> = conn
            .query_row(
                "SELECT e.item_id, ti.project_id FROM progress_entries e
                 JOIN timeline_items ti ON ti.id = e.item_id WHERE e.id = ?",
                params![id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()
            .map_err(CoreError::from)?;
        let (item_id, project_id) = ctx.ok_or_else(|| CoreError::NotFound("progress not found".into()))?;
        conn.execute("DELETE FROM progress_entries WHERE id = ?", params![id])?;
        let _ = item_id;
        crate::audit::record(&conn, "delete", "progress", Some(id), Some(&project_id), &actor, "admin",
            "Progress entry deleted");
        Ok(())
    }
}
