use crate::auth::require_admin;
use crate::db::{new_id, now_iso, Store};
use crate::error::{CoreError, Result};
use crate::models::ItemDependency;
use rusqlite::{params, OptionalExtension};

impl Store {
    pub fn list_dependencies(
        &self,
        secret: &[u8],
        token: Option<&str>,
        project_id: &str,
    ) -> Result<Vec<ItemDependency>> {
        require_admin(secret, token)?;
        let conn = self.lock()?;
        crate::projects::list_dependencies(&conn, project_id)
    }

    pub fn create_dependency(
        &self,
        secret: &[u8],
        token: Option<&str>,
        predecessor_id: &str,
        successor_id: &str,
    ) -> Result<ItemDependency> {
        let actor = require_admin(secret, token)?;
        if predecessor_id == successor_id {
            return Err(CoreError::Validation("an item cannot depend on itself".into()));
        }
        let conn = self.lock()?;
        let proj_of = |iid: &str| -> Result<String> {
            conn.query_row("SELECT project_id FROM timeline_items WHERE id = ?", params![iid], |r| {
                r.get(0)
            })
            .optional()
            .map_err(CoreError::from)?
            .ok_or_else(|| CoreError::NotFound("item not found".into()))
        };
        let pp = proj_of(predecessor_id)?;
        let sp = proj_of(successor_id)?;
        if pp != sp {
            return Err(CoreError::Validation("both items must be in the same project".into()));
        }
        let id = new_id();
        let created = now_iso();
        conn.execute(
            "INSERT INTO item_dependencies (id, predecessor_id, successor_id, created_at) VALUES (?,?,?,?)",
            params![id, predecessor_id, successor_id, created],
        )
        .map_err(|e| {
            if crate::projects::is_unique_violation(&e) {
                CoreError::Validation("dependency already exists".into())
            } else {
                CoreError::Db(e.to_string())
            }
        })?;
        crate::audit::record(&conn, "create", "dependency", Some(&id), Some(&pp), &actor, "admin",
            "Dependency added");
        Ok(ItemDependency { id, predecessor_id: predecessor_id.into(), successor_id: successor_id.into(), created_at: created })
    }

    pub fn delete_dependency(&self, secret: &[u8], token: Option<&str>, id: &str) -> Result<()> {
        let actor = require_admin(secret, token)?;
        let conn = self.lock()?;
        let project_id: Option<String> = conn
            .query_row(
                "SELECT ti.project_id FROM item_dependencies d
                 JOIN timeline_items ti ON ti.id = d.predecessor_id WHERE d.id = ?",
                params![id],
                |r| r.get(0),
            )
            .optional()
            .map_err(CoreError::from)?;
        let project_id = project_id.ok_or_else(|| CoreError::NotFound("dependency not found".into()))?;
        conn.execute("DELETE FROM item_dependencies WHERE id = ?", params![id])?;
        crate::audit::record(&conn, "delete", "dependency", Some(id), Some(&project_id), &actor, "admin",
            "Dependency deleted");
        Ok(())
    }
}
