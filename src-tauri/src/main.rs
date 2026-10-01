#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Manager, State};
use tauri_plugin_dialog::DialogExt;
use timeline_core::{
    auth::load_or_create_secret,
    export::ExportFormat,
    models::*,
    Store,
};

struct AppState {
    store: Store,
    secret: Vec<u8>,
}

type Cmd<T> = Result<T, String>;
fn err(e: timeline_core::CoreError) -> String {
    e.to_string()
}
fn tok(t: Option<String>) -> Option<String> {
    t
}

// ---------- auth ----------

#[tauri::command(rename_all = "snake_case")]
fn init_admin(state: State<'_, AppState>, username: String, password: String) -> Cmd<LoginResponse> {
    state.store.init_admin(&state.secret, &username, &password).map_err(err)
}

#[tauri::command(rename_all = "snake_case")]
fn login(state: State<'_, AppState>, username: String, password: String) -> Cmd<LoginResponse> {
    state.store.login(&state.secret, &username, &password).map_err(err)
}

#[tauri::command(rename_all = "snake_case")]
fn change_password(
    state: State<'_, AppState>,
    current_password: String,
    new_password: String,
    token: Option<String>,
) -> Cmd<()> {
    state
        .store
        .change_password(&state.secret, tok(token).as_deref(), &current_password, &new_password)
        .map_err(err)
}

// ---------- projects ----------

#[tauri::command(rename_all = "snake_case")]
fn list_projects(state: State<'_, AppState>, token: Option<String>) -> Cmd<Vec<Project>> {
    state.store.list_projects(&state.secret, tok(token).as_deref()).map_err(err)
}

#[tauri::command(rename_all = "snake_case")]
fn get_project_by_code(
    state: State<'_, AppState>,
    code: String,
    token: Option<String>,
) -> Cmd<Project> {
    state
        .store
        .get_project_by_code(&state.secret, &code, tok(token).as_deref())
        .map_err(err)
}

#[tauri::command(rename_all = "snake_case")]
fn create_project(
    state: State<'_, AppState>,
    name: String,
    code: String,
    token: Option<String>,
) -> Cmd<Project> {
    state
        .store
        .create_project(&state.secret, tok(token).as_deref(), &name, &code)
        .map_err(err)
}

#[tauri::command(rename_all = "snake_case")]
fn update_project(
    state: State<'_, AppState>,
    id: String,
    name: Option<String>,
    code: Option<String>,
    token: Option<String>,
) -> Cmd<Project> {
    state
        .store
        .update_project(&state.secret, tok(token).as_deref(), &id, name.as_deref(), code.as_deref())
        .map_err(err)
}

#[tauri::command(rename_all = "snake_case")]
fn delete_project(state: State<'_, AppState>, id: String, token: Option<String>) -> Cmd<()> {
    state.store.delete_project(&state.secret, tok(token).as_deref(), &id).map_err(err)
}

// ---------- items ----------

#[tauri::command(rename_all = "snake_case")]
fn list_timeline_items(
    state: State<'_, AppState>,
    project_id: String,
    token: Option<String>,
) -> Cmd<Vec<TimelineItem>> {
    state.store.list_items(&state.secret, tok(token).as_deref(), &project_id).map_err(err)
}

#[tauri::command(rename_all = "snake_case")]
fn create_timeline_item(
    state: State<'_, AppState>,
    project_id: String,
    name: String,
    start_date: String,
    end_date: String,
    color: Option<String>,
    is_milestone: Option<bool>,
    token: Option<String>,
) -> Cmd<TimelineItem> {
    state
        .store
        .create_item(
            &state.secret,
            tok(token).as_deref(),
            &project_id,
            &name,
            &start_date,
            &end_date,
            color.as_deref(),
            is_milestone,
        )
        .map_err(err)
}

#[tauri::command(rename_all = "snake_case")]
fn update_timeline_item(
    state: State<'_, AppState>,
    id: String,
    name: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
    color: Option<String>,
    position: Option<i64>,
    is_milestone: Option<bool>,
    token: Option<String>,
) -> Cmd<TimelineItem> {
    state
        .store
        .update_item(
            &state.secret,
            tok(token).as_deref(),
            &id,
            name.as_deref(),
            start_date.as_deref(),
            end_date.as_deref(),
            color.as_deref(),
            position,
            is_milestone,
        )
        .map_err(err)
}

#[tauri::command(rename_all = "snake_case")]
fn delete_timeline_item(state: State<'_, AppState>, id: String, token: Option<String>) -> Cmd<()> {
    state.store.delete_item(&state.secret, tok(token).as_deref(), &id).map_err(err)
}

// ---------- notes ----------

#[tauri::command(rename_all = "snake_case")]
fn list_notes(
    state: State<'_, AppState>,
    item_id: String,
    code: Option<String>,
    token: Option<String>,
) -> Cmd<Vec<Note>> {
    state
        .store
        .list_notes(&state.secret, &item_id, code.as_deref(), tok(token).as_deref())
        .map_err(err)
}

#[tauri::command(rename_all = "snake_case")]
fn create_note(
    state: State<'_, AppState>,
    item_id: String,
    date: String,
    content: String,
    note_type: String,
    created_by: Option<String>,
    evidence_url: Option<String>,
    code: Option<String>,
    token: Option<String>,
) -> Cmd<Note> {
    // Commands use rename_all = "snake_case": the TS side sends `note_type`, `evidence_url`, ...
    state
        .store
        .create_note(
            &state.secret,
            &item_id,
            &date,
            &content,
            &note_type,
            created_by.as_deref(),
            evidence_url.as_deref(),
            code.as_deref(),
            tok(token).as_deref(),
        )
        .map_err(err)
}

#[tauri::command(rename_all = "snake_case")]
fn create_note_reply(
    state: State<'_, AppState>,
    note_id: String,
    content: String,
    created_by: Option<String>,
    code: Option<String>,
    token: Option<String>,
) -> Cmd<NoteReply> {
    state
        .store
        .create_reply(
            &state.secret,
            &note_id,
            &content,
            created_by.as_deref(),
            code.as_deref(),
            tok(token).as_deref(),
        )
        .map_err(err)
}

#[tauri::command(rename_all = "snake_case")]
fn delete_note_reply(
    state: State<'_, AppState>,
    note_id: String,
    reply_id: String,
    token: Option<String>,
) -> Cmd<()> {
    state
        .store
        .delete_reply(&state.secret, tok(token).as_deref(), &note_id, &reply_id)
        .map_err(err)
}

#[tauri::command(rename_all = "snake_case")]
fn set_note_evidence(
    state: State<'_, AppState>,
    id: String,
    evidence_url: Option<String>,
    token: Option<String>,
) -> Cmd<Note> {
    state
        .store
        .set_note_evidence(&state.secret, tok(token).as_deref(), &id, evidence_url.as_deref())
        .map_err(err)
}

#[tauri::command(rename_all = "snake_case")]
fn set_note_resolved(
    state: State<'_, AppState>,
    id: String,
    resolved: bool,
    token: Option<String>,
) -> Cmd<Note> {
    state
        .store
        .set_note_resolved(&state.secret, tok(token).as_deref(), &id, resolved)
        .map_err(err)
}

#[tauri::command(rename_all = "snake_case")]
fn delete_note(state: State<'_, AppState>, id: String, token: Option<String>) -> Cmd<()> {
    state.store.delete_note(&state.secret, tok(token).as_deref(), &id).map_err(err)
}

// ---------- progress ----------

#[tauri::command(rename_all = "snake_case")]
fn list_progress(
    state: State<'_, AppState>,
    item_id: String,
    code: Option<String>,
    token: Option<String>,
) -> Cmd<Vec<ProgressEntry>> {
    state
        .store
        .list_progress(&state.secret, &item_id, code.as_deref(), tok(token).as_deref())
        .map_err(err)
}

#[tauri::command(rename_all = "snake_case")]
fn upsert_progress(
    state: State<'_, AppState>,
    item_id: String,
    date: String,
    percentage: i64,
    token: Option<String>,
) -> Cmd<ProgressEntry> {
    state
        .store
        .upsert_progress(&state.secret, tok(token).as_deref(), &item_id, &date, percentage)
        .map_err(err)
}

#[tauri::command(rename_all = "snake_case")]
fn delete_progress(state: State<'_, AppState>, id: String, token: Option<String>) -> Cmd<()> {
    state.store.delete_progress(&state.secret, tok(token).as_deref(), &id).map_err(err)
}

// ---------- dependencies ----------

#[tauri::command(rename_all = "snake_case")]
fn list_dependencies(
    state: State<'_, AppState>,
    project_id: String,
    token: Option<String>,
) -> Cmd<Vec<ItemDependency>> {
    state
        .store
        .list_dependencies(&state.secret, tok(token).as_deref(), &project_id)
        .map_err(err)
}

#[tauri::command(rename_all = "snake_case")]
fn create_dependency(
    state: State<'_, AppState>,
    predecessor_id: String,
    successor_id: String,
    token: Option<String>,
) -> Cmd<ItemDependency> {
    state
        .store
        .create_dependency(&state.secret, tok(token).as_deref(), &predecessor_id, &successor_id)
        .map_err(err)
}

#[tauri::command(rename_all = "snake_case")]
fn delete_dependency(state: State<'_, AppState>, id: String, token: Option<String>) -> Cmd<()> {
    state.store.delete_dependency(&state.secret, tok(token).as_deref(), &id).map_err(err)
}

// ---------- export ----------

/// Builds the report first (so access errors surface before any dialog), then asks
/// where to save. Async so the blocking native dialog stays off the main thread.
/// Returns the saved path, or None if the user cancelled.
#[tauri::command(rename_all = "snake_case")]
async fn export_project(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    project_id: String,
    format: String,
    code: Option<String>,
    token: Option<String>,
) -> Cmd<Option<String>> {
    let format = ExportFormat::parse(&format).map_err(err)?;
    let file = state
        .store
        .export_project(&state.secret, &project_id, format, code.as_deref(), tok(token).as_deref())
        .map_err(err)?;
    let label = match format {
        ExportFormat::Xlsx => "Excel workbook",
        ExportFormat::Pdf => "PDF document",
    };
    let Some(target) = app
        .dialog()
        .file()
        .set_title("Save timeline report")
        .set_file_name(&file.filename)
        .add_filter(label, &[format.ext()])
        .blocking_save_file()
    else {
        return Ok(None);
    };
    let path = target.into_path().map_err(|e| format!("EXPORT: {e}"))?;
    std::fs::write(&path, &file.bytes).map_err(|e| format!("EXPORT: {e}"))?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

// ---------- audit + seed ----------

#[tauri::command(rename_all = "snake_case")]
fn list_audit_logs(
    state: State<'_, AppState>,
    project_id: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
    token: Option<String>,
) -> Cmd<AuditPage> {
    state
        .store
        .list_audit_logs(&state.secret, tok(token).as_deref(), project_id.as_deref(), limit, offset)
        .map_err(err)
}

#[tauri::command(rename_all = "snake_case")]
fn seed_demo(state: State<'_, AppState>, token: Option<String>) -> Cmd<Vec<String>> {
    let t = tok(token).ok_or_else(|| "UNAUTH: admin sign-in required".to_string())?;
    timeline_core::seed::seed_demo(&state.store, &state.secret, &t).map_err(err)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let dir = app.path().app_data_dir().expect("app data dir");
            std::fs::create_dir_all(&dir).expect("create app data dir");
            let store = Store::open(dir.join("timeline.db").to_string_lossy().as_ref())
                .expect("open sqlite db");
            let secret = load_or_create_secret(&dir.join("jwt.secret")).expect("jwt secret");
            // Dev convenience: `--seed` creates a default admin + demo data on first run.
            if std::env::args().any(|a| a == "--seed") && store.user_count().unwrap_or(1) == 0 {
                if let Ok(login) = store.init_admin(&secret, "admin", "admin123456") {
                    let _ = timeline_core::seed::seed_demo(&store, &secret, &login.access_token);
                }
            }
            app.manage(AppState { store, secret });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            init_admin,
            login,
            change_password,
            list_projects,
            get_project_by_code,
            create_project,
            update_project,
            delete_project,
            list_timeline_items,
            create_timeline_item,
            update_timeline_item,
            delete_timeline_item,
            list_notes,
            create_note,
            create_note_reply,
            delete_note_reply,
            set_note_evidence,
            set_note_resolved,
            delete_note,
            list_progress,
            upsert_progress,
            delete_progress,
            list_dependencies,
            create_dependency,
            delete_dependency,
            export_project,
            list_audit_logs,
            seed_demo
        ])
        .run(tauri::generate_context!())
        .expect("run tauri app");
}
