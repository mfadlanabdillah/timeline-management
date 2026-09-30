use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub code: String,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub items: Option<Vec<TimelineItem>>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub dependencies: Option<Vec<ItemDependency>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineItem {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub start_date: String,
    pub end_date: String,
    pub color: String,
    pub position: i64,
    pub is_milestone: bool,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub notes: Option<Vec<Note>>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub progress_entries: Option<Vec<ProgressEntry>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemDependency {
    pub id: String,
    pub predecessor_id: String,
    pub successor_id: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressEntry {
    pub id: String,
    pub item_id: String,
    pub date: String,
    pub percentage: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteReply {
    pub id: String,
    pub note_id: String,
    pub content: String,
    pub created_by: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: String,
    pub item_id: String,
    pub date: String,
    pub content: String,
    #[serde(rename = "type")]
    pub note_type: String,
    pub created_by: Option<String>,
    pub evidence_url: Option<String>,
    pub resolved: bool,
    pub resolved_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub replies: Option<Vec<NoteReply>>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditLogEntry {
    pub id: String,
    pub action: String,
    pub entity_type: String,
    pub entity_id: Option<String>,
    pub project_id: Option<String>,
    pub actor: String,
    pub actor_type: String,
    pub summary: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditPage {
    pub entries: Vec<AuditLogEntry>,
    pub total: i64,
    pub limit: i64,
    pub offset: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginResponse {
    pub access_token: String,
    pub username: String,
}
