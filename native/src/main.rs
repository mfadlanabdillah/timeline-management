#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod gantt;

use chrono::{Datelike, Duration, NaiveDate};
use slint::{ComponentHandle, ModelRc, SharedString, VecModel, Weak};
use std::cell::RefCell;
use std::path::PathBuf;
use std::rc::Rc;
use timeline_core::auth::{decode_admin, load_or_create_secret};
use timeline_core::export::ExportFormat;
use timeline_core::health::{parse_date, summarise, Summary};
use timeline_core::models::Project;
use timeline_core::{CoreError, Store};

slint::include_modules!();

/// Same folder as the Tauri build (`%APPDATA%\id.po.timeline`), so both share one database.
/// Overrides: `PO_TIMELINE_DATA_DIR`, or portable mode — a file named `portable`
/// next to the exe keeps data in a `data` folder beside it (USB sticks, testing).
fn data_dir() -> PathBuf {
    if let Some(d) = std::env::var_os("PO_TIMELINE_DATA_DIR") {
        return PathBuf::from(d);
    }
    if let Some(exe_dir) = std::env::current_exe().ok().and_then(|p| p.parent().map(PathBuf::from)) {
        if exe_dir.join("portable").exists() {
            return exe_dir.join("data");
        }
    }
    dirs::data_dir().unwrap_or_else(|| PathBuf::from(".")).join("id.po.timeline")
}

struct Ctx {
    store: Store,
    secret: Vec<u8>,
    dir: PathBuf,
    token: Option<String>,
    project: Option<Project>,
    zoom: i32,
}

impl Ctx {
    fn tok(&self) -> Option<&str> {
        self.token.as_deref()
    }
    fn session_file(&self) -> PathBuf {
        self.dir.join("native-session.token")
    }
    fn settings_file(&self) -> PathBuf {
        self.dir.join("native-settings.txt")
    }
}

type Shared = Rc<RefCell<Ctx>>;

fn today() -> NaiveDate {
    chrono::Local::now().date_naive()
}

/// "VALIDATION: name too long" → "Name too long".
fn human(e: &CoreError) -> String {
    let s = e.to_string();
    let msg = s.split_once(": ").map_or(s.as_str(), |(_, m)| m);
    let mut c = msg.chars();
    match c.next() {
        Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
        None => String::new(),
    }
}

fn kpis(s: &Summary) -> Kpis {
    Kpis {
        progress: s.overall_progress as i32,
        total: s.total_items as i32,
        completed: s.completed as i32,
        at_risk: s.at_risk as i32,
        overdue: s.overdue as i32,
        issues: s.open_issues as i32,
    }
}

fn toast(app: &AppWindow, kind: i32, text: impl Into<SharedString>) {
    let d = app.global::<AppData>();
    d.set_toast_kind(kind);
    d.set_toast(text.into());
}

fn sign_out(app: &AppWindow, ctx: &mut Ctx) {
    ctx.token = None;
    ctx.project = None;
    let _ = std::fs::remove_file(ctx.session_file());
    let d = app.global::<AppData>();
    d.set_signed_in(false);
    d.set_needs_setup(ctx.store.user_count().unwrap_or(0) == 0);
    d.set_username(SharedString::new());
    d.set_page(0);
    d.set_projects(ModelRc::default());
    d.set_rows(ModelRc::default());
}

/// Session expired mid-use → back to the login page with a message.
fn handle_err(app: &AppWindow, ctx: &mut Ctx, e: &CoreError) -> String {
    if matches!(e, CoreError::Unauth(_)) {
        sign_out(app, ctx);
        toast(app, 3, "Your session has expired. Please sign in again.");
    }
    human(e)
}

fn refresh_portfolio(app: &AppWindow, ctx: &mut Ctx) {
    let projects = match ctx.store.list_projects(&ctx.secret, ctx.tok()) {
        Ok(p) => p,
        Err(e) => {
            let m = handle_err(app, ctx, &e);
            toast(app, 4, m);
            return;
        }
    };
    let now = today();
    let mut all_items = Vec::new();
    let mut cards = Vec::new();
    for p in projects {
        let full = ctx.store.get_project_by_code(&ctx.secret, &p.code, ctx.tok()).unwrap_or(p);
        let items = full.items.clone().unwrap_or_default();
        let s = summarise(&items, now);
        let health = if s.overdue > 0 || s.open_issues > 0 {
            4
        } else if s.at_risk > 0 {
            3
        } else {
            1
        };
        cards.push(ProjectCard {
            id: full.id.clone().into(),
            name: full.name.clone().into(),
            code: full.code.clone().into(),
            k: kpis(&s),
            health,
        });
        all_items.extend(items);
    }
    let d = app.global::<AppData>();
    d.set_portfolio(kpis(&summarise(&all_items, now)));
    d.set_projects(ModelRc::new(VecModel::from(cards)));
}

/// Pushes the cached project into the Gantt (no DB access) — used after zoom changes.
fn render_project(app: &AppWindow, ctx: &Ctx) {
    let Some(p) = &ctx.project else { return };
    let items = p.items.as_deref().unwrap_or(&[]);
    let now = today();
    let l = gantt::layout(items, ctx.zoom, now);
    let d = app.global::<AppData>();
    d.set_project_id(p.id.clone().into());
    d.set_project_name(p.name.clone().into());
    d.set_project_code(p.code.clone().into());
    d.set_project_kpis(kpis(&summarise(items, now)));
    d.set_zoom(ctx.zoom);
    d.set_day_width(l.day_width);
    d.set_gantt_width(l.width);
    d.set_today_x(l.today_x);
    d.set_days(ModelRc::new(VecModel::from(l.days)));
    d.set_months(ModelRc::new(VecModel::from(l.months)));
    d.set_rows(ModelRc::new(VecModel::from(l.rows)));
}

fn load_project(app: &AppWindow, ctx: &mut Ctx, id: &str) -> bool {
    let found = ctx
        .store
        .list_projects(&ctx.secret, ctx.tok())
        .map(|ps| ps.into_iter().find(|p| p.id == id));
    let result = match found {
        Ok(Some(p)) => ctx.store.get_project_by_code(&ctx.secret, &p.code, ctx.tok()),
        Ok(None) => Err(CoreError::NotFound("project not found".into())),
        Err(e) => Err(e),
    };
    match result {
        Ok(p) => {
            ctx.project = Some(p);
            render_project(app, ctx);
            true
        }
        Err(e) => {
            let m = handle_err(app, ctx, &e);
            toast(app, 4, m);
            false
        }
    }
}

/// Re-read the open project and the sidebar after a mutation.
fn reload(app: &AppWindow, ctx: &mut Ctx) {
    if let Some(id) = ctx.project.as_ref().map(|p| p.id.clone()) {
        load_project(app, ctx, &id);
    }
    refresh_portfolio(app, ctx);
}

fn enter(app: &AppWindow, ctx: &mut Ctx, token: String, username: String) {
    let _ = std::fs::write(ctx.session_file(), &token);
    ctx.token = Some(token);
    let d = app.global::<AppData>();
    d.set_username(username.into());
    d.set_signed_in(true);
    d.set_page(0);
    refresh_portfolio(app, ctx);
}

fn shift(date: &str, days: i64) -> String {
    parse_date(date)
        .map(|d| (d + Duration::days(days)).format("%Y-%m-%d").to_string())
        .unwrap_or_else(|| date.to_string())
}

fn wire(app: &AppWindow, ctx: Shared) {
    let api = app.global::<Api>();

    // Wraps a handler so it gets the upgraded window and a mutable context.
    macro_rules! with {
        (|$a:ident, $c:ident $(, $arg:ident : $t:ty)*| $body:expr) => {{
            let weak: Weak<AppWindow> = app.as_weak();
            let ctx = ctx.clone();
            move |$($arg: $t),*| {
                let $a = weak.unwrap();
                let mut guard = ctx.borrow_mut();
                let $c: &mut Ctx = &mut guard;
                $body
            }
        }};
    }

    api.on_login(with!(|app, c, user: SharedString, pass: SharedString| {
        match c.store.login(&c.secret, user.trim(), &pass) {
            Ok(r) => {
                enter(&app, c, r.access_token, r.username);
                SharedString::new()
            }
            Err(e) => human(&e).into(),
        }
    }));

    api.on_setup_admin(with!(|app, c, user: SharedString, pass: SharedString| {
        match c.store.init_admin(&c.secret, user.trim(), &pass) {
            Ok(r) => {
                app.global::<AppData>().set_needs_setup(false);
                enter(&app, c, r.access_token, r.username);
                SharedString::new()
            }
            Err(e) => human(&e).into(),
        }
    }));

    api.on_sign_out(with!(|app, c| sign_out(&app, c)));

    api.on_open_home(with!(|app, c| {
        c.project = None;
        refresh_portfolio(&app, c);
        app.global::<AppData>().set_page(0);
    }));

    api.on_open_project(with!(|app, c, id: SharedString| {
        if load_project(&app, c, &id) {
            let d = app.global::<AppData>();
            d.set_page(1);
            d.set_scroll_to_today(d.get_scroll_to_today() + 1);
        }
    }));

    api.on_save_project(with!(|app, c, id: SharedString, name: SharedString, code: SharedString| {
        let code = code.trim().to_uppercase();
        let res = if id.is_empty() {
            c.store.create_project(&c.secret, c.tok(), &name, &code)
        } else {
            c.store.update_project(&c.secret, c.tok(), &id, Some(&name), Some(&code))
        };
        match res {
            Ok(p) => {
                refresh_portfolio(&app, c);
                let d = app.global::<AppData>();
                if id.is_empty() || d.get_page() == 1 {
                    // New projects open straight away; edits refresh the open view.
                    load_project(&app, c, &p.id);
                    d.set_page(1);
                }
                toast(&app, 1, if id.is_empty() { "Project created." } else { "Project updated." });
                SharedString::new()
            }
            Err(e) => handle_err(&app, c, &e).into(),
        }
    }));

    api.on_delete_project(with!(|app, c, id: SharedString| {
        match c.store.delete_project(&c.secret, c.tok(), &id) {
            Ok(()) => {
                c.project = None;
                app.global::<AppData>().set_page(0);
                refresh_portfolio(&app, c);
                toast(&app, 1, "Project deleted.");
            }
            Err(e) => {
                let m = handle_err(&app, c, &e);
                toast(&app, 4, m);
            }
        }
    }));

    api.on_save_item(with!(|app, c, id: SharedString, name: SharedString, start: SharedString,
                           end: SharedString, color: SharedString, milestone: bool| {
        let Some(pid) = c.project.as_ref().map(|p| p.id.clone()) else {
            return SharedString::from("No project is open.");
        };
        let res = if id.is_empty() {
            c.store.create_item(&c.secret, c.tok(), &pid, name.trim(), &start, &end, Some(&color), Some(milestone))
        } else {
            c.store.update_item(&c.secret, c.tok(), &id, Some(name.trim()), Some(&start), Some(&end),
                Some(&color), None, Some(milestone))
        };
        match res {
            Ok(_) => {
                reload(&app, c);
                SharedString::new()
            }
            Err(e) => handle_err(&app, c, &e).into(),
        }
    }));

    api.on_delete_item(with!(|app, c, id: SharedString| {
        match c.store.delete_item(&c.secret, c.tok(), &id) {
            Ok(()) => {
                reload(&app, c);
                toast(&app, 1, "Item deleted.");
            }
            Err(e) => {
                let m = handle_err(&app, c, &e);
                toast(&app, 4, m);
            }
        }
    }));

    api.on_drag_item(with!(|app, c, id: SharedString, mode: i32, delta: i32| {
        let Some(item) = c
            .project
            .as_ref()
            .and_then(|p| p.items.as_ref()?.iter().find(|i| i.id == id.as_str()).cloned())
        else {
            return;
        };
        let d = i64::from(delta);
        let (mut start, mut end) = (item.start_date.clone(), item.end_date.clone());
        match (mode, item.is_milestone) {
            (1, _) | (_, true) => {
                start = shift(&start, d);
                end = shift(&end, d);
            }
            (2, _) => end = shift(&end, d),
            (3, _) => start = shift(&start, d),
            _ => return,
        }
        // Resizing past the other edge collapses to a one-day item.
        if start > end {
            if mode == 2 { end = start.clone() } else { start = end.clone() }
        }
        match c.store.update_item(&c.secret, c.tok(), &id, None, Some(&start), Some(&end), None, None, None) {
            Ok(_) => reload(&app, c),
            Err(e) => {
                let m = handle_err(&app, c, &e);
                toast(&app, 4, m);
            }
        }
    }));

    api.on_move_item(with!(|app, c, id: SharedString, dir: i32| {
        let Some(items) = c.project.as_ref().and_then(|p| p.items.clone()) else { return };
        let Some(i) = items.iter().position(|it| it.id == id.as_str()) else { return };
        let j = i as i64 + i64::from(dir);
        if j < 0 || j as usize >= items.len() {
            return;
        }
        let mut order: Vec<_> = items.iter().map(|it| (it.id.clone(), it.position)).collect();
        order.swap(i, j as usize);
        // Normalise to 0..n so ties from older data can't keep two rows stuck together.
        for (pos, (iid, old)) in order.iter().enumerate() {
            if *old != pos as i64 {
                if let Err(e) = c.store.update_item(&c.secret, c.tok(), iid, None, None, None, None, Some(pos as i64), None) {
                    let m = handle_err(&app, c, &e);
                    toast(&app, 4, m);
                    return;
                }
            }
        }
        reload(&app, c);
    }));

    api.on_set_zoom(with!(|app, c, zoom: i32| {
        c.zoom = zoom;
        render_project(&app, c);
        let d = app.global::<AppData>();
        d.set_scroll_to_today(d.get_scroll_to_today() + 1);
    }));

    {
        let weak = app.as_weak();
        let ctx = ctx.clone();
        api.on_export(move |fmt| {
            let app = weak.unwrap();
            let Ok(format) = ExportFormat::parse(&fmt) else { return };
            // Build first, then release the borrow before the modal dialog pumps events.
            let built = {
                let mut guard = ctx.borrow_mut();
                let c: &mut Ctx = &mut guard;
                let Some(pid) = c.project.as_ref().map(|p| p.id.clone()) else { return };
                match c.store.export_project(&c.secret, &pid, format, None, c.tok()) {
                    Ok(f) => f,
                    Err(e) => {
                        let m = handle_err(&app, c, &e);
                        toast(&app, 4, format!("Export failed: {m}"));
                        return;
                    }
                }
            };
            let (label, ext) = match format {
                ExportFormat::Xlsx => ("Excel workbook", "xlsx"),
                ExportFormat::Pdf => ("PDF document", "pdf"),
            };
            let Some(path) = rfd::FileDialog::new()
                .set_title("Save timeline report")
                .set_file_name(&built.filename)
                .add_filter(label, &[ext])
                .save_file()
            else {
                return;
            };
            match std::fs::write(&path, &built.bytes) {
                Ok(()) => toast(&app, 1, format!("Saved to {}", path.display())),
                Err(e) => toast(&app, 4, format!("Export failed: {e}")),
            }
        });
    }

    api.on_theme_changed(with!(|_app, c, mode: i32| {
        let _ = std::fs::write(c.settings_file(), format!("theme={mode}\n"));
    }));

    api.on_parse_date(|s| {
        let d = parse_date(&s).unwrap_or_else(today);
        Date { year: d.year(), month: d.month() as i32, day: d.day() as i32 }
    });
    api.on_format_date(|d| {
        NaiveDate::from_ymd_opt(d.year, d.month as u32, d.day as u32)
            .unwrap_or_else(today)
            .format("%Y-%m-%d")
            .to_string()
            .into()
    });
    api.on_today(|| today().format("%Y-%m-%d").to_string().into());
    api.on_parse_color(|hex| gantt::parse_hex(&hex));
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let dir = data_dir();
    std::fs::create_dir_all(&dir)?;
    let store = Store::open(dir.join("timeline.db").to_string_lossy().as_ref())?;
    let secret = load_or_create_secret(&dir.join("jwt.secret"))?;

    // Dev convenience, same as the Tauri build: default admin + demo data on first run.
    if std::env::args().any(|a| a == "--seed") && store.user_count().unwrap_or(1) == 0 {
        if let Ok(login) = store.init_admin(&secret, "admin", "admin123456") {
            let _ = timeline_core::seed::seed_demo(&store, &secret, &login.access_token);
        }
    }

    let app = AppWindow::new()?;
    let mut ctx = Ctx { store, secret, dir, token: None, project: None, zoom: 0 };

    let theme = std::fs::read_to_string(ctx.settings_file())
        .ok()
        .and_then(|s| s.trim().strip_prefix("theme=")?.parse::<i32>().ok())
        .unwrap_or(0);
    app.invoke_apply_theme(theme);

    // Resume a still-valid session.
    let saved = std::fs::read_to_string(ctx.session_file()).ok();
    match saved.and_then(|t| decode_admin(&ctx.secret, t.trim()).ok().map(|u| (t.trim().to_string(), u))) {
        Some((token, user)) => enter(&app, &mut ctx, token, user),
        None => sign_out(&app, &mut ctx),
    }

    wire(&app, Rc::new(RefCell::new(ctx)));
    app.run()?;
    Ok(())
}
