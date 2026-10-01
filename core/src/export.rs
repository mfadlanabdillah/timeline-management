use crate::db::Store;
use crate::error::{CoreError, Result};
use crate::models::{ItemDependency, Project, TimelineItem};
use crate::projects::{admin_or_none, list_dependencies, list_items, load_notes, load_progress};
use chrono::NaiveDate;
use rusqlite::{params, OptionalExtension};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExportFormat {
    Xlsx,
    Pdf,
}

impl ExportFormat {
    pub fn parse(s: &str) -> Result<Self> {
        match s {
            "xlsx" => Ok(Self::Xlsx),
            "pdf" => Ok(Self::Pdf),
            _ => Err(CoreError::Validation("format must be xlsx or pdf".into())),
        }
    }

    pub fn ext(self) -> &'static str {
        match self {
            Self::Xlsx => "xlsx",
            Self::Pdf => "pdf",
        }
    }
}

#[derive(Debug)]
pub struct ExportFile {
    pub filename: String,
    pub bytes: Vec<u8>,
}

fn export_err(e: impl std::fmt::Display) -> CoreError {
    CoreError::Export(e.to_string())
}

impl Store {
    /// Same access rule as reads: admin token, or guest code equal to the project's code.
    pub fn export_project(
        &self,
        secret: &[u8],
        project_id: &str,
        format: ExportFormat,
        code: Option<&str>,
        token: Option<&str>,
    ) -> Result<ExportFile> {
        let project = {
            let conn = self.lock()?;
            let mut proj: Project = conn
                .query_row(
                    "SELECT id, name, code, created_at FROM projects WHERE id = ?",
                    params![project_id],
                    |r| {
                        Ok(Project {
                            id: r.get(0)?,
                            name: r.get(1)?,
                            code: r.get(2)?,
                            created_at: r.get(3)?,
                            items: None,
                            dependencies: None,
                        })
                    },
                )
                .optional()
                .map_err(CoreError::from)?
                .ok_or_else(|| {
                    if admin_or_none(secret, token).is_some() {
                        CoreError::NotFound("project not found".into())
                    } else {
                        CoreError::Unauth("A valid project code is required".into())
                    }
                })?;
            if admin_or_none(secret, token).is_none() && code != Some(proj.code.as_str()) {
                return Err(CoreError::Unauth("A valid project code is required".into()));
            }
            let mut items = list_items(&conn, &proj.id)?;
            for item in &mut items {
                item.notes = Some(load_notes(&conn, &item.id)?);
                item.progress_entries = Some(load_progress(&conn, &item.id)?);
            }
            proj.items = Some(items);
            proj.dependencies = Some(list_dependencies(&conn, &proj.id)?);
            proj
        };
        let today = chrono::Local::now().date_naive();
        let bytes = match format {
            ExportFormat::Xlsx => build_xlsx(&project)?,
            ExportFormat::Pdf => build_pdf(&project, today)?,
        };
        let stem: String = project
            .code
            .chars()
            .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
            .collect();
        Ok(ExportFile {
            filename: format!("{stem}-timeline-{}.{}", today.format("%Y-%m-%d"), format.ext()),
            bytes,
        })
    }
}

// ---------- shared helpers ----------

fn items_of(p: &Project) -> &[TimelineItem] {
    p.items.as_deref().unwrap_or(&[])
}

fn deps_of(p: &Project) -> &[ItemDependency] {
    p.dependencies.as_deref().unwrap_or(&[])
}

/// Progress entries are loaded newest-first.
fn latest_progress(item: &TimelineItem) -> Option<i64> {
    item.progress_entries.as_ref()?.first().map(|e| e.percentage)
}

fn open_issues(item: &TimelineItem) -> usize {
    item.notes
        .as_deref()
        .unwrap_or(&[])
        .iter()
        .filter(|n| n.note_type == "issue" && !n.resolved)
        .count()
}

fn date(s: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(s, "%Y-%m-%d").ok()
}

/// Inclusive day count, matching the Gantt's bar width.
fn duration_days(item: &TimelineItem) -> i64 {
    match (date(&item.start_date), date(&item.end_date)) {
        (Some(s), Some(e)) => (e - s).num_days() + 1,
        _ => 0,
    }
}

fn hex_rgb(hex: &str) -> (u8, u8, u8) {
    let h = hex.trim_start_matches('#');
    if h.len() == 6 {
        if let Ok(v) = u32::from_str_radix(h, 16) {
            return ((v >> 16) as u8, (v >> 8) as u8, v as u8);
        }
    }
    (0x4F, 0x46, 0xE5)
}

// ---------- XLSX ----------

fn build_xlsx(p: &Project) -> Result<Vec<u8>> {
    use rust_xlsxwriter::{Color, ExcelDateTime, Format, FormatAlign, Workbook, Worksheet};

    let items = items_of(p);
    let name_of = |id: &str| {
        items.iter().find(|i| i.id == id).map(|i| i.name.clone()).unwrap_or_default()
    };
    let header = Format::new()
        .set_bold()
        .set_background_color(Color::RGB(0x1F2937))
        .set_font_color(Color::White);
    let date_fmt = Format::new().set_num_format("yyyy-mm-dd").set_align(FormatAlign::Left);
    let pct_fmt = Format::new().set_num_format("0\"%\"");
    let wrap = Format::new().set_text_wrap();

    fn head(ws: &mut Worksheet, fmt: &Format, cols: &[(&str, f64)]) -> std::result::Result<(), rust_xlsxwriter::XlsxError> {
        for (c, (title, width)) in cols.iter().enumerate() {
            ws.write_string_with_format(0, c as u16, *title, fmt)?;
            ws.set_column_width(c as u16, *width)?;
        }
        ws.set_freeze_panes(1, 0)?;
        Ok(())
    }
    fn put_date(ws: &mut Worksheet, row: u32, col: u16, s: &str, fmt: &Format) -> std::result::Result<(), rust_xlsxwriter::XlsxError> {
        match ExcelDateTime::parse_from_str(s) {
            Ok(d) => ws.write_datetime_with_format(row, col, &d, fmt).map(|_| ()),
            Err(_) => ws.write_string(row, col, s).map(|_| ()),
        }
    }

    let mut wb = Workbook::new();
    let build = |wb: &mut Workbook| -> std::result::Result<(), rust_xlsxwriter::XlsxError> {
        // Sheet 1: timeline
        let ws = wb.add_worksheet().set_name("Timeline")?;
        head(ws, &header, &[
            ("No", 5.0), ("Item", 36.0), ("Start", 12.0), ("End", 12.0), ("Days", 7.0),
            ("Milestone", 10.0), ("Progress", 10.0), ("Notes", 8.0), ("Open issues", 11.0), ("Color", 9.0),
        ])?;
        for (i, item) in items.iter().enumerate() {
            let r = i as u32 + 1;
            ws.write_number(r, 0, (i + 1) as f64)?;
            ws.write_string(r, 1, &item.name)?;
            put_date(ws, r, 2, &item.start_date, &date_fmt)?;
            put_date(ws, r, 3, &item.end_date, &date_fmt)?;
            ws.write_number(r, 4, duration_days(item) as f64)?;
            ws.write_string(r, 5, if item.is_milestone { "Yes" } else { "" })?;
            match latest_progress(item) {
                Some(pct) => ws.write_number_with_format(r, 6, pct as f64, &pct_fmt)?,
                None => ws.write_string(r, 6, "")?,
            };
            ws.write_number(r, 7, item.notes.as_ref().map_or(0, Vec::len) as f64)?;
            ws.write_number(r, 8, open_issues(item) as f64)?;
            let (cr, cg, cb) = hex_rgb(&item.color);
            let swatch = Format::new().set_background_color(Color::RGB(
                (u32::from(cr) << 16) | (u32::from(cg) << 8) | u32::from(cb),
            ));
            ws.write_blank(r, 9, &swatch)?;
        }
        ws.autofilter(0, 0, items.len().max(1) as u32, 9)?;

        // Sheet 2: notes & issues (replies inlined)
        let ws = wb.add_worksheet().set_name("Notes & Issues")?;
        head(ws, &header, &[
            ("Item", 28.0), ("Date", 12.0), ("Type", 8.0), ("Content", 60.0), ("By", 14.0),
            ("Status", 10.0), ("Evidence", 30.0), ("Replies", 50.0),
        ])?;
        let mut r = 1u32;
        for item in items {
            for n in item.notes.as_deref().unwrap_or(&[]) {
                ws.write_string(r, 0, &item.name)?;
                put_date(ws, r, 1, &n.date, &date_fmt)?;
                ws.write_string(r, 2, &n.note_type)?;
                ws.write_string_with_format(r, 3, &n.content, &wrap)?;
                ws.write_string(r, 4, n.created_by.as_deref().unwrap_or(""))?;
                let status = match (n.note_type.as_str(), n.resolved) {
                    ("issue", true) => "Resolved",
                    ("issue", false) => "Open",
                    _ => "",
                };
                ws.write_string(r, 5, status)?;
                ws.write_string(r, 6, n.evidence_url.as_deref().unwrap_or(""))?;
                let replies = n
                    .replies
                    .as_deref()
                    .unwrap_or(&[])
                    .iter()
                    .map(|rp| format!("{}: {}", rp.created_by.as_deref().unwrap_or("-"), rp.content))
                    .collect::<Vec<_>>()
                    .join("\n");
                ws.write_string_with_format(r, 7, &replies, &wrap)?;
                r += 1;
            }
        }
        ws.autofilter(0, 0, r.max(2) - 1, 7)?;

        // Sheet 3: progress history
        let ws = wb.add_worksheet().set_name("Progress")?;
        head(ws, &header, &[("Item", 36.0), ("Date", 12.0), ("Progress", 10.0)])?;
        let mut r = 1u32;
        for item in items {
            for e in item.progress_entries.as_deref().unwrap_or(&[]).iter().rev() {
                ws.write_string(r, 0, &item.name)?;
                put_date(ws, r, 1, &e.date, &date_fmt)?;
                ws.write_number_with_format(r, 2, e.percentage as f64, &pct_fmt)?;
                r += 1;
            }
        }

        // Sheet 4: dependencies
        let ws = wb.add_worksheet().set_name("Dependencies")?;
        head(ws, &header, &[("Predecessor", 36.0), ("Successor", 36.0)])?;
        for (i, d) in deps_of(p).iter().enumerate() {
            ws.write_string(i as u32 + 1, 0, name_of(&d.predecessor_id))?;
            ws.write_string(i as u32 + 1, 1, name_of(&d.successor_id))?;
        }
        Ok(())
    };
    build(&mut wb).map_err(export_err)?;
    wb.save_to_buffer().map_err(export_err)
}

// ---------- PDF ----------

/// Builtin Helvetica has no metrics in printpdf; ~0.5em average width is close enough to truncate.
fn fit(s: &str, max_mm: f32, size_pt: f32) -> String {
    let max_chars = (max_mm / (size_pt * 0.3528 * 0.5)).floor().max(1.0) as usize;
    let s = s.replace(['\n', '\r', '\t'], " ");
    if s.chars().count() <= max_chars {
        s
    } else {
        let mut t: String = s.chars().take(max_chars.saturating_sub(3)).collect();
        t.push_str("...");
        t
    }
}

fn wrap_lines(s: &str, max_mm: f32, size_pt: f32) -> Vec<String> {
    let max_chars = (max_mm / (size_pt * 0.3528 * 0.5)).floor().max(8.0) as usize;
    let mut lines = Vec::new();
    for para in s.lines() {
        let mut cur = String::new();
        for word in para.split_whitespace() {
            if !cur.is_empty() && cur.chars().count() + 1 + word.chars().count() > max_chars {
                lines.push(std::mem::take(&mut cur));
            }
            if !cur.is_empty() {
                cur.push(' ');
            }
            cur.push_str(word);
        }
        if !cur.is_empty() {
            lines.push(cur);
        }
    }
    lines
}

fn build_pdf(p: &Project, today: NaiveDate) -> Result<Vec<u8>> {
    use printpdf::path::PaintMode;
    use printpdf::{BuiltinFont, Color, Mm, PdfDocument, PdfLayerReference, Point, Polygon, Rect, Rgb};

    const W: f32 = 297.0;
    const H: f32 = 210.0;
    const M: f32 = 12.0;
    const ROW: f32 = 6.5;
    // Table columns (x positions in mm) and the Gantt area to their right.
    const X_NO: f32 = M;
    const X_NAME: f32 = M + 8.0;
    const X_START: f32 = M + 78.0;
    const X_END: f32 = M + 100.0;
    const X_PCT: f32 = M + 122.0;
    const X_ISS: f32 = M + 138.0;
    const G_LEFT: f32 = M + 152.0;
    const G_RIGHT: f32 = W - M;

    let rgb = |r: u8, g: u8, b: u8| Color::Rgb(Rgb::new(r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0, None));
    let rect = |layer: &PdfLayerReference, x0: f32, y0: f32, x1: f32, y1: f32, color: Color| {
        layer.set_fill_color(color);
        layer.add_rect(Rect::new(Mm(x0), Mm(y0), Mm(x1), Mm(y1)).with_mode(PaintMode::Fill));
    };

    let (doc, page, layer) = PdfDocument::new(format!("{} timeline", p.name), Mm(W), Mm(H), "main");
    let font = doc.add_builtin_font(BuiltinFont::Helvetica).map_err(export_err)?;
    let bold = doc.add_builtin_font(BuiltinFont::HelveticaBold).map_err(export_err)?;
    let mut layer = doc.get_page(page).get_layer(layer);
    let black = || rgb(0x11, 0x18, 0x27);
    let muted = || rgb(0x6B, 0x72, 0x80);

    let items = items_of(p);
    let total_issues: usize = items.iter().map(open_issues).sum();
    let tracked: Vec<i64> = items.iter().filter_map(latest_progress).collect();
    let avg = if tracked.is_empty() { None } else { Some(tracked.iter().sum::<i64>() / tracked.len() as i64) };

    // Header
    layer.set_fill_color(black());
    layer.use_text(fit(&p.name, W - 2.0 * M, 16.0), 16.0, Mm(M), Mm(H - M - 4.0), &bold);
    layer.set_fill_color(muted());
    let mut summary = format!(
        "Code {}  |  {} items  |  {} milestones  |  {} open issues",
        p.code,
        items.len(),
        items.iter().filter(|i| i.is_milestone).count(),
        total_issues
    );
    if let Some(a) = avg {
        summary.push_str(&format!("  |  avg progress {a}%"));
    }
    summary.push_str(&format!("  |  exported {}", today.format("%Y-%m-%d")));
    layer.use_text(summary, 9.0, Mm(M), Mm(H - M - 10.0), &font);

    // Gantt date range
    let starts = items.iter().filter_map(|i| date(&i.start_date));
    let ends = items.iter().filter_map(|i| date(&i.end_date));
    let lo = starts.min();
    let hi = ends.max();
    let span = match (lo, hi) {
        (Some(l), Some(h)) => Some((l, ((h - l).num_days() + 1).max(1) as f32)),
        _ => None,
    };
    let gx = |d: NaiveDate| -> f32 {
        let (l, days) = span.expect("span checked");
        G_LEFT + (d - l).num_days() as f32 / days * (G_RIGHT - G_LEFT)
    };

    let table_header = |layer: &PdfLayerReference, y: f32| {
        rect(layer, M, y - 1.8, W - M, y + 4.2, rgb(0x1F, 0x29, 0x37));
        layer.set_fill_color(rgb(0xFF, 0xFF, 0xFF));
        for (x, t) in [(X_NO, "#"), (X_NAME, "Item"), (X_START, "Start"), (X_END, "End"), (X_PCT, "Prog."), (X_ISS, "Iss.")] {
            layer.use_text(t, 8.0, Mm(x + 1.0), Mm(y), &bold);
        }
        if let (Some((l, _)), Some(h)) = (span, hi) {
            layer.use_text(l.format("%Y-%m-%d").to_string(), 7.0, Mm(G_LEFT + 1.0), Mm(y), &font);
            layer.use_text(h.format("%Y-%m-%d").to_string(), 7.0, Mm(G_RIGHT - 18.0), Mm(y), &font);
        }
    };

    let mut y = H - M - 20.0;
    table_header(&layer, y);
    y -= ROW;
    let mut page_top = y + ROW;

    let new_page = |doc: &printpdf::PdfDocumentReference| {
        let (pg, ly) = doc.add_page(Mm(W), Mm(H), "main");
        doc.get_page(pg).get_layer(ly)
    };
    let today_line = |layer: &PdfLayerReference, top: f32, bottom: f32| {
        if let (Some((l, _)), Some(h)) = (span, hi) {
            if today >= l && today <= h {
                let x = gx(today);
                rect(layer, x - 0.2, bottom, x + 0.2, top, rgb(0xEF, 0x44, 0x44));
            }
        }
    };

    if items.is_empty() {
        layer.set_fill_color(muted());
        layer.use_text("No timeline items yet.", 9.0, Mm(M + 1.0), Mm(y), &font);
        y -= ROW;
    }
    for (i, item) in items.iter().enumerate() {
        if y < M + 4.0 {
            today_line(&layer, page_top, y + ROW - 1.8);
            layer = new_page(&doc);
            y = H - M - 4.0;
            table_header(&layer, y);
            page_top = y;
            y -= ROW;
        }
        if i % 2 == 1 {
            rect(&layer, M, y - 1.8, W - M, y + ROW - 1.8, rgb(0xF3, 0xF4, 0xF6));
        }
        layer.set_fill_color(black());
        layer.use_text((i + 1).to_string(), 8.0, Mm(X_NO + 1.0), Mm(y), &font);
        let label = if item.is_milestone { format!("<> {}", item.name) } else { item.name.clone() };
        layer.use_text(fit(&label, X_START - X_NAME - 2.0, 8.0), 8.0, Mm(X_NAME + 1.0), Mm(y), &font);
        layer.use_text(&item.start_date, 8.0, Mm(X_START + 1.0), Mm(y), &font);
        layer.use_text(&item.end_date, 8.0, Mm(X_END + 1.0), Mm(y), &font);
        let pct = latest_progress(item);
        layer.use_text(pct.map_or("-".into(), |v| format!("{v}%")), 8.0, Mm(X_PCT + 1.0), Mm(y), &font);
        let iss = open_issues(item);
        if iss > 0 {
            layer.set_fill_color(rgb(0xDC, 0x26, 0x26));
        }
        layer.use_text(iss.to_string(), 8.0, Mm(X_ISS + 1.0), Mm(y), &font);

        if let (Some(_), Some(s), Some(e)) = (span, date(&item.start_date), date(&item.end_date)) {
            let (r, g, b) = hex_rgb(&item.color);
            if item.is_milestone {
                let cx = gx(s);
                let cy = y + 1.0;
                layer.set_fill_color(rgb(r, g, b));
                layer.add_polygon(Polygon {
                    rings: vec![vec![
                        (Point::new(Mm(cx), Mm(cy + 2.0)), false),
                        (Point::new(Mm(cx + 2.0), Mm(cy)), false),
                        (Point::new(Mm(cx), Mm(cy - 2.0)), false),
                        (Point::new(Mm(cx - 2.0), Mm(cy)), false),
                    ]],
                    mode: PaintMode::Fill,
                    ..Default::default()
                });
            } else {
                let x0 = gx(s);
                let x1 = gx(e + chrono::Duration::days(1)).max(x0 + 0.8);
                // Light track = planned, solid overlay = latest progress.
                let tint = |c: u8| c + ((255 - c) as f32 * 0.6) as u8;
                rect(&layer, x0, y - 0.6, x1, y + 2.8, rgb(tint(r), tint(g), tint(b)));
                let done = pct.unwrap_or(0).clamp(0, 100) as f32 / 100.0;
                if done > 0.0 {
                    rect(&layer, x0, y - 0.6, x0 + (x1 - x0) * done, y + 2.8, rgb(r, g, b));
                }
            }
        }
        y -= ROW;
    }
    today_line(&layer, page_top, y + ROW - 1.8);

    // Open issues section
    let issues: Vec<_> = items
        .iter()
        .flat_map(|it| {
            it.notes
                .as_deref()
                .unwrap_or(&[])
                .iter()
                .filter(|n| n.note_type == "issue" && !n.resolved)
                .map(move |n| (it, n))
        })
        .collect();
    if !issues.is_empty() {
        y -= 4.0;
        if y < M + 16.0 {
            layer = new_page(&doc);
            y = H - M - 4.0;
        }
        layer.set_fill_color(black());
        layer.use_text(format!("Open issues ({})", issues.len()), 11.0, Mm(M), Mm(y), &bold);
        y -= 7.0;
        for (item, n) in issues {
            let mut lines = wrap_lines(&n.content, W - 2.0 * M - 70.0, 8.0);
            if lines.is_empty() {
                lines.push(String::new());
            }
            for (li, line) in lines.iter().enumerate() {
                if y < M {
                    layer = new_page(&doc);
                    y = H - M - 4.0;
                }
                if li == 0 {
                    layer.set_fill_color(muted());
                    layer.use_text(&n.date, 8.0, Mm(M), Mm(y), &font);
                    layer.set_fill_color(black());
                    layer.use_text(fit(&item.name, 46.0, 8.0), 8.0, Mm(M + 20.0), Mm(y), &bold);
                }
                layer.use_text(line, 8.0, Mm(M + 70.0), Mm(y), &font);
                y -= 4.2;
            }
            y -= 1.5;
        }
    }

    doc.save_to_bytes().map_err(export_err)
}
