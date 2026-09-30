use crate::auth::require_admin;
use crate::db::{new_id, now_iso, Store};
use crate::error::{CoreError, Result};
use crate::models::{ItemDependency, Note, NoteReply, ProgressEntry, Project, TimelineItem};
use crate::validate::{validate_code, validate_name};
use rusqlite::{params, Connection, OptionalExtension};

/// Admin username if the token is valid, else None (guest path).
pub(crate) fn admin_or_none(secret: &[u8], token: Option<&str>) -> Option<String> {
    token.and_then(|t| crate::auth::decode_admin(secret, t).ok())
}

pub(crate) fn project_code_of(conn: &Connection, project_id: &str) -> Result<String> {
    conn.query_row("SELECT code FROM projects WHERE id = ?", params![project_id], |r| {
        r.get(0)
    })
    .optional()
    .map_err(CoreError::from)?
    .ok_or_else(|| CoreError::NotFound("project not found".into()))
}

pub(crate) fn item_project(conn: &Connection, item_id: &str) -> Result<(String, String)> {
    let project_id: Option<String> = conn
        .query_row("SELECT project_id FROM timeline_items WHERE id = ?", params![item_id], |r| {
            r.get(0)
        })
        .optional()
        .map_err(CoreError::from)?;
    match project_id {
        Some(pid) => {
            let code = project_code_of(conn, &pid)?;
            Ok((pid, code))
        }
        None => Err(CoreError::NotFound("item not found".into())),
    }
}

/// Admin token wins; otherwise the guest code must equal the item's project code.
/// Uniform message so item IDs can't be probed.
pub(crate) fn check_item_access(
    conn: &Connection,
    secret: &[u8],
    item_id: &str,
    token: Option<&str>,
    code: Option<&str>,
) -> Result<Option<String>> {
    if let Some(admin) = admin_or_none(secret, token) {
        // Still 404 on unknown items for admins.
        if conn
            .query_row("SELECT 1 FROM timeline_items WHERE id = ?", params![item_id], |_| Ok(1i64))
            .optional()
            .map_err(CoreError::from)?
            .is_none()
        {
            return Err(CoreError::NotFound("item not found".into()));
        }
        return Ok(Some(admin));
    }
    let (_, expected) = item_project(conn, item_id).map_err(|_| {
        CoreError::Unauth("A valid project code is required".into())
    })?;
    match code {
        Some(c) if c == expected => Ok(None),
        _ => Err(CoreError::Unauth("A valid project code is required".into())),
    }
}

fn row_project(r: &rusqlite::Row) -> rusqlite::Result<Project> {
    Ok(Project {
        id: r.get(0)?,
        name: r.get(1)?,
        code: r.get(2)?,
        created_at: r.get(3)?,
        items: None,
        dependencies: None,
    })
}

pub(crate) fn row_item(r: &rusqlite::Row) -> rusqlite::Result<TimelineItem> {
    Ok(TimelineItem {
        id: r.get(0)?,
        project_id: r.get(1)?,
        name: r.get(2)?,
        start_date: r.get(3)?,
        end_date: r.get(4)?,
        color: r.get(5)?,
        position: r.get(6)?,
        is_milestone: r.get::<_, i64>(7)? != 0,
        created_at: r.get(8)?,
        notes: None,
        progress_entries: None,
    })
}

pub(crate) fn list_items(conn: &Connection, project_id: &str) -> Result<Vec<TimelineItem>> {
    let mut stmt = conn.prepare(
        "SELECT id, project_id, name, start_date, end_date, color, position, is_milestone, created_at
         FROM timeline_items WHERE project_id = ? ORDER BY position, start_date",
    )?;
    let rows = stmt.query_map(params![project_id], row_item)?;
    let out = rows
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(CoreError::from)?;
    Ok(out)
}

pub(crate) fn list_dependencies(conn: &Connection, project_id: &str) -> Result<Vec<ItemDependency>> {
    let mut stmt = conn.prepare(
        "SELECT d.id, d.predecessor_id, d.successor_id, d.created_at FROM item_dependencies d
         JOIN timeline_items p ON p.id = d.predecessor_id WHERE p.project_id = ? ORDER BY d.created_at",
    )?;
    let rows = stmt.query_map(params![project_id], |r| {
        Ok(ItemDependency {
            id: r.get(0)?,
            predecessor_id: r.get(1)?,
            successor_id: r.get(2)?,
            created_at: r.get(3)?,
        })
    })?;
    let out = rows
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(CoreError::from)?;
    Ok(out)
}

pub(crate) fn load_notes(conn: &Connection, item_id: &str) -> Result<Vec<Note>> {
    let mut stmt = conn.prepare(
        "SELECT id, item_id, date, content, type, created_by, evidence_url, resolved, resolved_at, created_at
         FROM notes WHERE item_id = ? ORDER BY date, created_at",
    )?;
    let note_rows = stmt
        .query_map(params![item_id], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, String>(4)?,
                r.get::<_, Option<String>>(5)?,
                r.get::<_, Option<String>>(6)?,
                r.get::<_, i64>(7)? != 0,
                r.get::<_, Option<String>>(8)?,
                r.get::<_, String>(9)?,
            ))
        })?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(CoreError::from)?;
    let mut notes = Vec::new();
    for (id, item_id, date, content, note_type, created_by, evidence_url, resolved, resolved_at, created_at) in note_rows {
        let mut rstmt = conn.prepare(
            "SELECT id, note_id, content, created_by, created_at FROM note_replies WHERE note_id = ? ORDER BY created_at",
        )?;
        let rrows = rstmt.query_map(params![id], |r| {
            Ok(NoteReply {
                id: r.get(0)?,
                note_id: r.get(1)?,
                content: r.get(2)?,
                created_by: r.get(3)?,
                created_at: r.get(4)?,
            })
        })?;
        let replies = rrows.collect::<rusqlite::Result<Vec<_>>>().map_err(CoreError::from)?;
        notes.push(Note {
            id,
            item_id,
            date,
            content,
            note_type,
            created_by,
            evidence_url,
            resolved,
            resolved_at,
            replies: Some(replies),
            created_at,
        });
    }
    Ok(notes)
}

pub(crate) fn load_progress(conn: &Connection, item_id: &str) -> Result<Vec<ProgressEntry>> {
    let mut stmt = conn.prepare(
        "SELECT id, item_id, date, percentage, created_at, updated_at FROM progress_entries
         WHERE item_id = ? ORDER BY date DESC",
    )?;
    let rows = stmt.query_map(params![item_id], |r| {
        Ok(ProgressEntry {
            id: r.get(0)?,
            item_id: r.get(1)?,
            date: r.get(2)?,
            percentage: r.get(3)?,
            created_at: r.get(4)?,
            updated_at: r.get(5)?,
        })
    })?;
    let out = rows
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(CoreError::from)?;
    Ok(out)
}

fn unique_err(e: rusqlite::Error, msg: &str) -> CoreError {
    match e {
        rusqlite::Error::SqliteFailure(err, _) if err.code == rusqlite::ErrorCode::ConstraintViolation => {
            CoreError::Validation(msg.into())
        }
        other => CoreError::Db(other.to_string()),
    }
}

pub(crate) fn is_unique_violation(e: &rusqlite::Error) -> bool {    matches!(e, rusqlite::Error::SqliteFailure(err, _)
        if err.code == rusqlite::ErrorCode::ConstraintViolation)
}

impl Store {
    pub fn list_projects(&self, secret: &[u8], token: Option<&str>) -> Result<Vec<Project>> {
        require_admin(secret, token)?;
        let conn = self.lock()?;
        let mut stmt = conn.prepare("SELECT id, name, code, created_at FROM projects ORDER BY created_at")?;
        let rows = stmt.query_map([], row_project)?;
        let out = rows.collect::<rusqlite::Result<Vec<_>>>().map_err(CoreError::from)?;
        Ok(out)
    }

    pub fn get_project_by_code(
        &self,
        secret: &[u8],
        code: &str,
        token: Option<&str>,
    ) -> Result<Project> {
        let conn = self.lock()?;
        let mut proj: Project = conn
            .query_row("SELECT id, name, code, created_at FROM projects WHERE code = ?", params![code], row_project)
            .optional()
            .map_err(CoreError::from)?
            .ok_or_else(|| CoreError::NotFound("project not found".into()))?;
        // Guests must present the right code; admins (valid token) bypass.
        if admin_or_none(secret, token).is_none() && proj.code != code {
            return Err(CoreError::Unauth("A valid project code is required".into()));
        }
        let mut items = list_items(&conn, &proj.id)?;
        for item in &mut items {
            item.notes = Some(load_notes(&conn, &item.id)?);
            item.progress_entries = Some(load_progress(&conn, &item.id)?);
        }
        proj.items = Some(items);
        proj.dependencies = Some(list_dependencies(&conn, &proj.id)?);
        Ok(proj)
    }

    pub fn create_project(
        &self,
        secret: &[u8],
        token: Option<&str>,
        name: &str,
        code: &str,
    ) -> Result<Project> {
        let actor = require_admin(secret, token)?;
        validate_name(name, "name")?;
        validate_code(code)?;
        let conn = self.lock()?;
        let id = new_id();
        let created = now_iso();
        conn.execute(
            "INSERT INTO projects (id, name, code, created_at) VALUES (?,?,?,?)",
            params![id, name.trim(), code, created],
        )
        .map_err(|e| unique_err(e, "project code already used"))?;
        crate::audit::record(&conn, "create", "project", Some(&id), Some(&id), &actor, "admin",
            &format!("Project \"{}\" created", name.trim()));
        Ok(Project { id, name: name.trim().into(), code: code.into(), created_at: created, items: None, dependencies: None })
    }

    pub fn update_project(
        &self,
        secret: &[u8],
        token: Option<&str>,
        id: &str,
        name: Option<&str>,
        code: Option<&str>,
    ) -> Result<Project> {
        let actor = require_admin(secret, token)?;
        if let Some(n) = name { validate_name(n, "name")?; }
        if let Some(c) = code { validate_code(c)?; }
        let conn = self.lock()?;
        let cur: Option<(String, String)> = conn
            .query_row("SELECT name, code FROM projects WHERE id = ?", params![id], |r| {
                Ok((r.get(0)?, r.get(1)?))
            })
            .optional()
            .map_err(CoreError::from)?;
        let (old_name, old_code) = cur.ok_or_else(|| CoreError::NotFound("project not found".into()))?;
        let new_name = name.map(str::trim).unwrap_or(&old_name);
        let new_code = code.unwrap_or(&old_code);
        conn.execute("UPDATE projects SET name = ?, code = ? WHERE id = ?", params![new_name, new_code, id])
            .map_err(|e| unique_err(e, "project code already used"))?;
        let proj: Project = conn
            .query_row("SELECT id, name, code, created_at FROM projects WHERE id = ?", params![id], row_project)
            .map_err(CoreError::from)?;
        crate::audit::record(&conn, "update", "project", Some(id), Some(id), &actor, "admin",
            &format!("Project \"{old_name}\" ({old_code}) updated to \"{new_name}\" ({new_code})"));
        Ok(proj)
    }

    pub fn delete_project(&self, secret: &[u8], token: Option<&str>, id: &str) -> Result<()> {
        let actor = require_admin(secret, token)?;
        let conn = self.lock()?;
        let name: Option<String> = conn
            .query_row("SELECT name FROM projects WHERE id = ?", params![id], |r| r.get(0))
            .optional()
            .map_err(CoreError::from)?;
        let name = name.ok_or_else(|| CoreError::NotFound("project not found".into()))?;
        conn.execute("DELETE FROM projects WHERE id = ?", params![id])?;
        crate::audit::record(&conn, "delete", "project", Some(id), None, &actor, "admin",
            &format!("Project \"{name}\" deleted"));
        Ok(())
    }
}
