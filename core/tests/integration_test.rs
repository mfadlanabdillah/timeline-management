use timeline_core::seed::seed_demo;
use timeline_core::Store;

const SECRET: &[u8] = b"test-secret-32-bytes-long!!!!!!!";

fn setup() -> (Store, String) {
    let store = Store::open_in_memory().unwrap();
    let res = store.init_admin(SECRET, "admin", "password123").unwrap();
    assert_eq!(res.username, "admin");
    (store, res.access_token)
}

#[test]
fn admin_lifecycle() {
    let (store, token) = setup();
    // Second init refuses.
    assert!(store.init_admin(SECRET, "admin2", "password123").is_err());
    // Login ok.
    let login = store.login(SECRET, "admin", "password123").unwrap();
    assert_eq!(login.username, "admin");
    // Wrong password vs unknown user: same message.
    let e1 = store.login(SECRET, "admin", "nope").unwrap_err().to_string();
    let e2 = store.login(SECRET, "ghost", "nope").unwrap_err().to_string();
    assert!(e1.starts_with("UNAUTH:"), "{e1}");
    assert_eq!(e1, e2);
    // Change password.
    store.change_password(SECRET, Some(&token), "password123", "newpass456").unwrap();
    assert!(store.login(SECRET, "admin", "password123").is_err());
    store.login(SECRET, "admin", "newpass456").unwrap();
    // Bad token rejected.
    assert!(store.list_projects(SECRET, Some("junk")).is_err());
}

#[test]
fn project_crud_and_guards() {
    let (store, token) = setup();
    let t = Some(token.as_str());
    let p = store.create_project(SECRET, t, "A", "PRJ-A").unwrap();
    // Duplicate + malformed codes.
    assert!(store.create_project(SECRET, t, "B", "PRJ-A").is_err());
    assert!(store.create_project(SECRET, t, "B", "bad code!").is_err());
    assert!(store.create_project(SECRET, None, "B", "PRJ-B").is_err());
    let u = store.update_project(SECRET, t, &p.id, Some("A2"), None).unwrap();
    assert_eq!(u.name, "A2");
    let full = store.get_project_by_code(SECRET, "PRJ-A", t).unwrap();
    assert_eq!(full.items.unwrap().len(), 0);
    assert!(store.get_project_by_code(SECRET, "NOPE", t).is_err());
    store.delete_project(SECRET, t, &p.id).unwrap();
    assert!(store.delete_project(SECRET, t, &p.id).is_err());
}

#[test]
fn items_notes_progress_deps_flow() {
    let (store, token) = setup();
    let t = Some(token.as_str());
    let p = store.create_project(SECRET, t, "P", "PP").unwrap();
    let a = store
        .create_item(SECRET, t, &p.id, "A", "2026-01-01", "2026-01-10", None, None)
        .unwrap();
    assert_eq!(a.position, 0);
    assert_eq!(a.color, "#4F46E5");
    let b = store
        .create_item(SECRET, t, &p.id, "B", "2026-01-11", "2026-01-20", Some("#FF0000"), Some(true))
        .unwrap();
    assert_eq!(b.position, 1);
    assert!(store
        .create_item(SECRET, t, &p.id, "X", "2026-02-01", "2026-01-01", None, None)
        .is_err());
    // Reorder via position update.
    let b2 = store.update_item(SECRET, t, &b.id, None, None, None, None, Some(0), None).unwrap();
    assert_eq!(b2.position, 0);

    // Guest note: name required, evidence rejected.
    let g = Some("PP");
    assert!(store.create_note(SECRET, &a.id, "2026-01-02", "halo", "note", None, None, g, None).is_err());
    assert!(store
        .create_note(SECRET, &a.id, "2026-01-02", "halo", "note", Some("Budi"), Some("https://x.test"), g, None)
        .is_err());
    let n = store
        .create_note(SECRET, &a.id, "2026-01-02", "ada issue", "issue", Some("Budi"), None, g, None)
        .unwrap();
    // Guest cannot resolve (admin-only, mirrors backend).
    assert!(store.set_note_resolved(SECRET, None, &n.id, true).is_err());
    let r = store.set_note_resolved(SECRET, t, &n.id, true).unwrap();
    assert!(r.resolved);
    // Replies + evidence.
    let rep = store.create_reply(SECRET, &n.id, "ok", Some("Budi"), g, None).unwrap();
    assert!(store.delete_reply(SECRET, None, &n.id, &rep.id).is_err());
    store.delete_reply(SECRET, t, &n.id, &rep.id).unwrap();
    let n2 = store.set_note_evidence(SECRET, t, &n.id, Some("https://drive.test/x")).unwrap();
    assert_eq!(n2.evidence_url.as_deref(), Some("https://drive.test/x"));

    // Progress upsert + guest read.
    store.upsert_progress(SECRET, t, &a.id, "2026-01-05", 30).unwrap();
    let e = store.upsert_progress(SECRET, t, &a.id, "2026-01-05", 55).unwrap();
    assert_eq!(e.percentage, 55);
    assert!(store.upsert_progress(SECRET, t, &a.id, "2026-01-06", 101).is_err());
    let list = store.list_progress(SECRET, &a.id, g, None).unwrap();
    assert_eq!(list.len(), 1);
    assert!(store.upsert_progress(SECRET, None, &a.id, "2026-01-07", 10).is_err());
    store.delete_progress(SECRET, t, &e.id).unwrap();

    // Dependencies.
    assert!(store.create_dependency(SECRET, t, &a.id, &a.id).is_err());
    let d = store.create_dependency(SECRET, t, &a.id, &b.id).unwrap();
    assert!(store.create_dependency(SECRET, t, &a.id, &b.id).is_err());
    let q = store.create_project(SECRET, t, "Q", "QQ").unwrap();
    let c = store.create_item(SECRET, t, &q.id, "C", "2026-01-01", "2026-01-02", None, None).unwrap();
    assert!(store.create_dependency(SECRET, t, &a.id, &c.id).is_err());
    store.delete_dependency(SECRET, t, &d.id).unwrap();

    // Full payload includes everything.
    let full = store.get_project_by_code(SECRET, "PP", t).unwrap();
    let items = full.items.unwrap();
    assert_eq!(items.len(), 2);
    assert_eq!(items.iter().map(|i| i.notes.as_ref().unwrap().len()).sum::<usize>(), 1);

    // Cascade on project delete.
    store.delete_project(SECRET, t, &p.id).unwrap();
    assert!(store.list_progress(SECRET, &a.id, g, None).is_err());
}

#[test]
fn seed_is_idempotent_and_audit_logged() {
    let (store, token) = setup();
    let t = Some(token.as_str());
    let made = seed_demo(&store, SECRET, &token).unwrap();
    assert_eq!(made.len(), 2);
    let made2 = seed_demo(&store, SECRET, &token).unwrap();
    assert!(made2.is_empty());
    let page = store.list_audit_logs(SECRET, t, None, Some(10), Some(0)).unwrap();
    assert!(page.total > 10);
    assert_eq!(page.entries.len(), 10);
    let p = store.get_project_by_code(SECRET, "DEMO-01", t).unwrap();
    assert_eq!(p.dependencies.unwrap().len(), 2);
}

#[test]
fn export_xlsx_and_pdf_with_access_rules() {
    use timeline_core::export::ExportFormat;
    let (store, token) = setup();
    let t = Some(token.as_str());
    seed_demo(&store, SECRET, &token).unwrap();
    let projects = store.list_projects(SECRET, t).unwrap();
    let p = &projects[0];

    let x = store.export_project(SECRET, &p.id, ExportFormat::Xlsx, None, t).unwrap();
    assert!(x.filename.ends_with(".xlsx"), "{}", x.filename);
    assert_eq!(&x.bytes[..2], b"PK");

    // Guest with the right code can export; wrong/missing code is UNAUTH.
    let pdf = store.export_project(SECRET, &p.id, ExportFormat::Pdf, Some(&p.code), None).unwrap();
    assert!(pdf.bytes.starts_with(b"%PDF"));
    let e = store.export_project(SECRET, &p.id, ExportFormat::Pdf, Some("WRONG-1"), None).unwrap_err();
    assert!(e.to_string().starts_with("UNAUTH:"), "{e}");
    let e = store.export_project(SECRET, "no-such-id", ExportFormat::Pdf, None, None).unwrap_err();
    assert!(e.to_string().starts_with("UNAUTH:"), "{e}");

    if let Ok(dir) = std::env::var("EXPORT_SAMPLE_DIR") {
        std::fs::write(format!("{dir}/{}", x.filename), &x.bytes).unwrap();
        std::fs::write(format!("{dir}/{}", pdf.filename), &pdf.bytes).unwrap();
    }
}
