use crate::auth::require_admin;
use crate::db::{new_id, now_iso, Store};
use crate::error::{CoreError, Result};
use crate::models::TimelineItem;
use crate::projects::row_item;
use crate::validate::{validate_color, validate_date, validate_name};
use rusqlite::{params, OptionalExtension};

impl Store {
    pub fn list_items(&self, secret: &[u8], token: Option<&str>, project_id: &str) -> Result<Vec<TimelineItem>> {
        require_admin(secret, token)?;
        let conn = self.lock()?;
        crate::projects::list_items(&conn, project_id)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn create_item(
        &self,
        secret: &[u8],
        token: Option<&str>,
        project_id: &str,
        name: &str,
        start_date: &str,
        end_date: &str,
        color: Option<&str>,
        is_milestone: Option<bool>,
    ) -> Result<TimelineItem> {
        let actor = require_admin(secret, token)?;
        validate_name(name, "name")?;
        validate_date(start_date)?;
        validate_date(end_date)?;
        if start_date > end_date {
            return Err(CoreError::Validation("startDate must be ≤ endDate".into()));
        }
        let color = color.unwrap_or("#4F46E5");
        validate_color(color)?;
        let conn = self.lock()?;
        if conn
            .query_row("SELECT 1 FROM projects WHERE id = ?", params![project_id], |_| Ok(1i64))
            .optional()
            .map_err(CoreError::from)?
            .is_none()
        {
            return Err(CoreError::NotFound("project not found".into()));
        }
        let pos: i64 = conn
            .query_row(
                "SELECT COALESCE(MAX(position), -1) + 1 FROM timeline_items WHERE project_id = ?",
                params![project_id],
                |r| r.get(0),
            )
            .map_err(CoreError::from)?;
        let id = new_id();
        let created = now_iso();
        conn.execute(
            "INSERT INTO timeline_items (id, project_id, name, start_date, end_date, color, position, is_milestone, created_at)
             VALUES (?,?,?,?,?,?,?,?,?)",
            params![id, project_id, name.trim(), start_date, end_date, color, pos, is_milestone.unwrap_or(false) as i64, created],
        )?;
        crate::audit::record(&conn, "create", "item", Some(&id), Some(project_id), &actor, "admin",
            &format!("Item \"{}\" created ({} → {})", name.trim(), start_date, end_date));
        Ok(TimelineItem {
            id, project_id: project_id.into(), name: name.trim().into(),
            start_date: start_date.into(), end_date: end_date.into(), color: color.into(),
            position: pos, is_milestone: is_milestone.unwrap_or(false), created_at: created,
            notes: None, progress_entries: None,
        })
    }

    #[allow(clippy::too_many_arguments)]
    pub fn update_item(
        &self,
        secret: &[u8],
        token: Option<&str>,
        id: &str,
        name: Option<&str>,
        start_date: Option<&str>,
        end_date: Option<&str>,
        color: Option<&str>,
        position: Option<i64>,
        is_milestone: Option<bool>,
    ) -> Result<TimelineItem> {
        let actor = require_admin(secret, token)?;
        if let Some(n) = name { validate_name(n, "name")?; }
        if let Some(d) = start_date { validate_date(d)?; }
        if let Some(d) = end_date { validate_date(d)?; }
        if let Some(c) = color { validate_color(c)?; }
        if let Some(p) = position {
            if p < 0 {
                return Err(CoreError::Validation("position must be ≥0".into()));
            }
        }
        let conn = self.lock()?;
        let cur: Option<TimelineItem> = conn
            .query_row(
                "SELECT id, project_id, name, start_date, end_date, color, position, is_milestone, created_at
                 FROM timeline_items WHERE id = ?",
                params![id],
                row_item,
            )
            .optional()
            .map_err(CoreError::from)?;
        let cur = cur.ok_or_else(|| CoreError::NotFound("item not found".into()))?;
        let ns = start_date.unwrap_or(&cur.start_date);
        let ne = end_date.unwrap_or(&cur.end_date);
        if ns > ne {
            return Err(CoreError::Validation("startDate must be ≤ endDate".into()));
        }
        conn.execute(
            "UPDATE timeline_items SET name = ?, start_date = ?, end_date = ?, color = ?, position = ?, is_milestone = ? WHERE id = ?",
            params![
                name.map(str::trim).unwrap_or(&cur.name),
                ns, ne,
                color.unwrap_or(&cur.color),
                position.unwrap_or(cur.position),
                is_milestone.unwrap_or(cur.is_milestone) as i64,
                id,
            ],
        )?;
        let updated: TimelineItem = conn
            .query_row(
                "SELECT id, project_id, name, start_date, end_date, color, position, is_milestone, created_at
                 FROM timeline_items WHERE id = ?",
                params![id],
                row_item,
            )
            .map_err(CoreError::from)?;
        if cur.start_date != updated.start_date || cur.end_date != updated.end_date {
            crate::audit::record(&conn, "update", "item", Some(id), Some(&cur.project_id), &actor, "admin",
                &format!("Item \"{}\": dates {} → {} changed to {} → {}",
                    cur.name, cur.start_date, cur.end_date, updated.start_date, updated.end_date));
        }
        Ok(updated)
    }

    pub fn delete_item(&self, secret: &[u8], token: Option<&str>, id: &str) -> Result<()> {
        let actor = require_admin(secret, token)?;
        let conn = self.lock()?;
        let cur: Option<(String, String)> = conn
            .query_row("SELECT name, project_id FROM timeline_items WHERE id = ?", params![id], |r| {
                Ok((r.get(0)?, r.get(1)?))
            })
            .optional()
            .map_err(CoreError::from)?;
        let (name, project_id) = cur.ok_or_else(|| CoreError::NotFound("item not found".into()))?;
        conn.execute("DELETE FROM timeline_items WHERE id = ?", params![id])?;
        crate::audit::record(&conn, "delete", "item", Some(id), Some(&project_id), &actor, "admin",
            &format!("Item \"{name}\" deleted"));
        Ok(())
    }
}
