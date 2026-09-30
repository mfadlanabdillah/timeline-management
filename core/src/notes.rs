use crate::auth::require_admin;
use crate::db::{new_id, now_iso, Store};
use crate::error::{CoreError, Result};
use crate::models::{Note, NoteReply};
use crate::projects::{check_item_access, load_notes};
use crate::validate::{validate_content, validate_created_by, validate_date, validate_evidence};
use rusqlite::{params, OptionalExtension};

fn row_reply(r: &rusqlite::Row) -> rusqlite::Result<NoteReply> {
    Ok(NoteReply {
        id: r.get(0)?,
        note_id: r.get(1)?,
        content: r.get(2)?,
        created_by: r.get(3)?,
        created_at: r.get(4)?,
    })
}

impl Store {
    pub fn list_notes(
        &self,
        secret: &[u8],
        item_id: &str,
        code: Option<&str>,
        token: Option<&str>,
    ) -> Result<Vec<Note>> {
        let conn = self.lock()?;
        check_item_access(&conn, secret, item_id, token, code)?;
        load_notes(&conn, item_id)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn create_note(
        &self,
        secret: &[u8],
        item_id: &str,
        date: &str,
        content: &str,
        note_type: &str,
        created_by: Option<&str>,
        evidence_url: Option<&str>,
        code: Option<&str>,
        token: Option<&str>,
    ) -> Result<Note> {
        validate_date(date)?;
        validate_content(content)?;
        validate_created_by(created_by)?;
        if note_type != "note" && note_type != "issue" {
            return Err(CoreError::Validation("type must be note or issue".into()));
        }
        let conn = self.lock()?;
        let admin = check_item_access(&conn, secret, item_id, token, code)?;
        if admin.is_none() {
            // Guests must sign their name; only admins may attach evidence.
            match created_by {
                Some(n) if !n.trim().is_empty() => {}
                _ => return Err(CoreError::Validation("name is required".into())),
            }
            if evidence_url.is_some() {
                return Err(CoreError::Unauth("only admins may set evidence".into()));
            }
        }
        validate_evidence(evidence_url)?;
        let (project_id, _) = crate::projects::item_project(&conn, item_id).map_err(|_| {
            CoreError::Unauth("A valid project code is required".into())
        })?;
        let id = new_id();
        let created = now_iso();
        conn.execute(
            "INSERT INTO notes (id, item_id, date, content, type, created_by, evidence_url, resolved, created_at)
             VALUES (?,?,?,?,?,?,?,?,?)",
            params![id, item_id, date, content.trim(), note_type, created_by, evidence_url, 0, created],
        )?;
        let (actor, actor_type) = match admin {
            Some(a) => (a, "admin"),
            None => (created_by.unwrap_or("Guest").trim().to_string(), "guest"),
        };
        crate::audit::record(&conn, "create", "note", Some(&id), Some(&project_id), &actor, actor_type,
            &format!("{note_type} added: \"{}\"", content.trim().chars().take(80).collect::<String>()));
        Ok(Note {
            id, item_id: item_id.into(), date: date.into(), content: content.trim().into(),
            note_type: note_type.into(), created_by: created_by.map(str::to_string),
            evidence_url: evidence_url.map(str::to_string), resolved: false, resolved_at: None,
            replies: Some(vec![]), created_at: created,
        })
    }

    pub fn create_reply(
        &self,
        secret: &[u8],
        note_id: &str,
        content: &str,
        created_by: Option<&str>,
        code: Option<&str>,
        token: Option<&str>,
    ) -> Result<NoteReply> {
        validate_content(content)?;
        validate_created_by(created_by)?;
        let conn = self.lock()?;
        let item_id: Option<String> = conn
            .query_row("SELECT item_id FROM notes WHERE id = ?", params![note_id], |r| r.get(0))
            .optional()
            .map_err(CoreError::from)?;
        let item_id = match item_id {
            Some(v) => v,
            None => {
                // Disguise 404 as 403 for guests probing note IDs.
                if crate::projects::admin_or_none(secret, token).is_none() {
                    return Err(CoreError::Unauth("A valid project code is required".into()));
                }
                return Err(CoreError::NotFound("note not found".into()));
            }
        };
        let admin = check_item_access(&conn, secret, &item_id, token, code)?;
        if admin.is_none() {
            match created_by {
                Some(n) if !n.trim().is_empty() => {}
                _ => return Err(CoreError::Validation("name is required".into())),
            }
        }
        let (project_id, _) = crate::projects::item_project(&conn, &item_id).map_err(|_| {
            CoreError::Unauth("A valid project code is required".into())
        })?;
        let id = new_id();
        let created = now_iso();
        conn.execute(
            "INSERT INTO note_replies (id, note_id, content, created_by, created_at) VALUES (?,?,?,?,?)",
            params![id, note_id, content.trim(), created_by, created],
        )?;
        let (actor, actor_type) = match admin {
            Some(a) => (a, "admin"),
            None => (created_by.unwrap_or("Guest").trim().to_string(), "guest"),
        };
        crate::audit::record(&conn, "create", "reply", Some(&id), Some(&project_id), &actor, actor_type,
            &format!("Reply added"));
        Ok(NoteReply {
            id, note_id: note_id.into(), content: content.trim().into(),
            created_by: created_by.map(str::to_string), created_at: created,
        })
    }

    pub fn delete_reply(
        &self,
        secret: &[u8],
        token: Option<&str>,
        note_id: &str,
        reply_id: &str,
    ) -> Result<()> {
        let actor = require_admin(secret, token)?;
        let conn = self.lock()?;
        let project_id: Option<String> = conn
            .query_row(
                "SELECT ti.project_id FROM note_replies r JOIN notes n ON n.id = r.note_id
                 JOIN timeline_items ti ON ti.id = n.item_id WHERE r.id = ? AND r.note_id = ?",
                params![reply_id, note_id],
                |r| r.get(0),
            )
            .optional()
            .map_err(CoreError::from)?;
        let project_id = project_id.ok_or_else(|| CoreError::NotFound("reply not found".into()))?;
        conn.execute("DELETE FROM note_replies WHERE id = ?", params![reply_id])?;
        crate::audit::record(&conn, "delete", "reply", Some(reply_id), Some(&project_id), &actor, "admin",
            &format!("Reply deleted"));
        Ok(())
    }

    pub fn set_note_evidence(
        &self,
        secret: &[u8],
        token: Option<&str>,
        id: &str,
        evidence_url: Option<&str>,
    ) -> Result<Note> {
        let actor = require_admin(secret, token)?;
        validate_evidence(evidence_url)?;
        let conn = self.lock()?;
        let item_id: Option<String> = conn
            .query_row("SELECT item_id FROM notes WHERE id = ?", params![id], |r| r.get(0))
            .optional()
            .map_err(CoreError::from)?;
        let item_id = item_id.ok_or_else(|| CoreError::NotFound("note not found".into()))?;
        conn.execute("UPDATE notes SET evidence_url = ? WHERE id = ?", params![evidence_url, id])?;
        let (project_id, _) = crate::projects::item_project(&conn, &item_id)?;
        crate::audit::record(&conn, "update", "note", Some(id), Some(&project_id), &actor, "admin",
            &format!("Note evidence updated"));
        Ok(load_notes(&conn, &item_id)?.into_iter().find(|n| n.id == id)
            .ok_or_else(|| CoreError::NotFound("note not found".into()))?)
    }

    pub fn set_note_resolved(
        &self,
        secret: &[u8],
        token: Option<&str>,
        id: &str,
        resolved: bool,
    ) -> Result<Note> {
        let actor = require_admin(secret, token)?;
        let conn = self.lock()?;
        let item_id: Option<String> = conn
            .query_row("SELECT item_id FROM notes WHERE id = ?", params![id], |r| r.get(0))
            .optional()
            .map_err(CoreError::from)?;
        let item_id = item_id.ok_or_else(|| CoreError::NotFound("note not found".into()))?;
        let now = now_iso();
        conn.execute(
            "UPDATE notes SET resolved = ?, resolved_at = CASE WHEN ? THEN ? ELSE NULL END WHERE id = ?",
            params![resolved as i64, resolved, now, id],
        )?;
        let (project_id, _) = crate::projects::item_project(&conn, &item_id)?;
        let action = if resolved { "resolve" } else { "reopen" };
        crate::audit::record(&conn, action, "note", Some(id), Some(&project_id), &actor, "admin",
            &format!("Note {action}d"));
        Ok(load_notes(&conn, &item_id)?.into_iter().find(|n| n.id == id)
            .ok_or_else(|| CoreError::NotFound("note not found".into()))?)
    }

    pub fn delete_note(&self, secret: &[u8], token: Option<&str>, id: &str) -> Result<()> {
        let actor = require_admin(secret, token)?;
        let conn = self.lock()?;
        let project_id: Option<String> = conn
            .query_row(
                "SELECT ti.project_id FROM notes n JOIN timeline_items ti ON ti.id = n.item_id WHERE n.id = ?",
                params![id],
                |r| r.get(0),
            )
            .optional()
            .map_err(CoreError::from)?;
        let project_id = project_id.ok_or_else(|| CoreError::NotFound("note not found".into()))?;
        conn.execute("DELETE FROM notes WHERE id = ?", params![id])?;
        crate::audit::record(&conn, "delete", "note", Some(id), Some(&project_id), &actor, "admin",
            "Note deleted");
        Ok(())
    }

    #[allow(dead_code)]
    pub(crate) fn _row_reply(r: &rusqlite::Row) -> rusqlite::Result<NoteReply> {
        row_reply(r)
    }
}
