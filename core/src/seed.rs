use crate::db::Store;
use crate::error::Result;

/// Demo data for dev/smoke tests. Idempotent: skips projects whose code exists.
pub fn seed_demo(store: &Store, secret: &[u8], admin_token: &str) -> Result<Vec<String>> {
    let existing: Vec<String> = store
        .list_projects(secret, Some(admin_token))?
        .into_iter()
        .map(|p| p.code)
        .collect();
    let mut made = Vec::new();

    let d = |off: i64| (chrono::Utc::now() + chrono::Duration::days(off)).format("%Y-%m-%d").to_string();

    if !existing.contains(&"DEMO-01".to_string()) {
        let p = store.create_project(secret, Some(admin_token), "Website Revamp", "DEMO-01")?;
        let a = store.create_item(secret, Some(admin_token), &p.id, "Desain UI", &d(-20), &d(10), Some("#6D5EF1"), Some(false))?;
        let b = store.create_item(secret, Some(admin_token), &p.id, "Frontend", &d(5), &d(30), Some("#0EA5E9"), Some(false))?;
        let m = store.create_item(secret, Some(admin_token), &p.id, "Go Live", &d(30), &d(30), Some("#10B981"), Some(true))?;
        store.create_dependency(secret, Some(admin_token), &a.id, &b.id)?;
        store.create_dependency(secret, Some(admin_token), &b.id, &m.id)?;
        store.upsert_progress(secret, Some(admin_token), &a.id, &d(-10), 60)?;
        store.upsert_progress(secret, Some(admin_token), &a.id, &d(-2), 80)?;
        store.upsert_progress(secret, Some(admin_token), &b.id, &d(6), 15)?;
        let n = store.create_note(secret, &a.id, &d(-5), "Revisi hero section disetujui klien.", "note",
            Some("Admin"), None, None, Some(admin_token))?;
        store.create_reply(secret, &n.id, "Siap, lanjut ke halaman pricing.", Some("Admin"), None, Some(admin_token))?;
        store.create_note(secret, &b.id, &d(6), "API auth belum siap dari tim backend.", "issue",
            Some("Admin"), None, None, Some(admin_token))?;
        made.push("DEMO-01".into());
    }

    if !existing.contains(&"GED-A".to_string()) {
        let p = store.create_project(secret, Some(admin_token), "Gedung A", "GED-A")?;
        let f = store.create_item(secret, Some(admin_token), &p.id, "Fondasi", &d(-45), &d(-15), Some("#F59E0B"), Some(false))?;
        let s = store.create_item(secret, Some(admin_token), &p.id, "Struktur", &d(-14), &d(20), Some("#EF4444"), Some(false))?;
        store.create_dependency(secret, Some(admin_token), &f.id, &s.id)?;
        store.upsert_progress(secret, Some(admin_token), &f.id, &d(-16), 100)?;
        store.upsert_progress(secret, Some(admin_token), &s.id, &d(0), 40)?;
        store.create_note(secret, &s.id, &d(-1), "Curah hujan tinggi, pengecoran dijadwal ulang.", "issue",
            Some("Admin"), None, None, Some(admin_token))?;
        made.push("GED-A".into());
    }

    Ok(made)
}
