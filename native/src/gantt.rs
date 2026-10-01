//! Turns a project's items into Gantt geometry (pixels) for the Slint view.
use crate::{DayTick, GanttRow, MonthSpan};
use chrono::{Datelike, Duration, NaiveDate, Weekday};
use slint::{Color, SharedString};
use timeline_core::health::{duration_days, item_health, open_issue_count, parse_date, HealthStatus};
use timeline_core::models::TimelineItem;

pub struct Layout {
    pub rows: Vec<GanttRow>,
    pub days: Vec<DayTick>,
    pub months: Vec<MonthSpan>,
    pub day_width: f32,
    pub width: f32,
    pub today_x: f32,
}

pub fn day_width(zoom: i32) -> f32 {
    if zoom == 1 { 14.0 } else { 40.0 }
}

pub fn status_kind(s: HealthStatus) -> i32 {
    match s {
        HealthStatus::Done => 1,
        HealthStatus::OnTrack => 2,
        HealthStatus::AtRisk => 3,
        HealthStatus::Behind | HealthStatus::Overdue => 4,
        HealthStatus::NotStarted => 0,
    }
}

pub fn parse_hex(hex: &str) -> Color {
    let h = hex.trim_start_matches('#');
    match (h.len(), u32::from_str_radix(h, 16)) {
        (6, Ok(v)) => Color::from_rgb_u8((v >> 16) as u8, (v >> 8) as u8, v as u8),
        _ => Color::from_rgb_u8(0x6D, 0x5E, 0xF1),
    }
}

/// Same window as the web Gantt: today −14d … +30d, widened to fit every item, plus a week of slack.
fn range(items: &[TimelineItem], today: NaiveDate) -> (NaiveDate, NaiveDate) {
    let mut lo = today - Duration::days(14);
    let mut hi = today + Duration::days(30);
    for it in items {
        if let Some(s) = parse_date(&it.start_date) {
            lo = lo.min(s);
        }
        if let Some(e) = parse_date(&it.end_date) {
            hi = hi.max(e);
        }
    }
    (lo - Duration::days(7), hi + Duration::days(7))
}

const MONTHS: [&str; 12] = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];


/// "11 Sep → 11 Oct · 31d"; milestones get a single date. Years only when they differ from today's.
fn range_label(it: &TimelineItem, days: i64, today: NaiveDate) -> String {
    let fmt = |d: NaiveDate| {
        if d.year() == today.year() { d.format("%-d %b").to_string() } else { d.format("%-d %b %Y").to_string() }
    };
    match (parse_date(&it.start_date), parse_date(&it.end_date)) {
        (Some(s), _) if it.is_milestone => format!("Milestone · {}", fmt(s)),
        (Some(s), Some(e)) => format!("{} → {} · {days}d", fmt(s), fmt(e)),
        _ => format!("{} → {}", it.start_date, it.end_date),
    }
}

pub fn layout(items: &[TimelineItem], zoom: i32, today: NaiveDate) -> Layout {
    let dw = day_width(zoom);
    let (lo, hi) = range(items, today);
    let n = (hi - lo).num_days() + 1;
    let x_of = |d: NaiveDate| (d - lo).num_days() as f32 * dw;

    let mut days = Vec::with_capacity(n as usize);
    let mut months: Vec<MonthSpan> = Vec::new();
    for i in 0..n {
        let d = lo + Duration::days(i);
        let weekend = matches!(d.weekday(), Weekday::Sat | Weekday::Sun);
        // Weeks zoom only labels Mondays to keep the header readable.
        let label = if zoom == 0 || d.weekday() == Weekday::Mon { d.day().to_string() } else { String::new() };
        days.push(DayTick { left: i as f32 * dw, label: label.into(), weekend });
        if d.day() == 1 || i == 0 {
            months.push(MonthSpan { left: i as f32 * dw, span: 0.0, label: SharedString::new() });
        }
        let m = months.last_mut().expect("pushed above");
        m.span += dw;
        let full = format!("{} {}", MONTHS[d.month0() as usize], d.year());
        // Narrow spans (weeks zoom, partial months) get the short name.
        m.label = if m.span >= 110.0 { full.into() } else { MONTHS[d.month0() as usize][..3].into() };
    }

    let rows = items
        .iter()
        .map(|it| {
            let h = item_health(it, today);
            let start = parse_date(&it.start_date).unwrap_or(today);
            let days = duration_days(it);
            GanttRow {
                id: it.id.clone().into(),
                name: it.name.clone().into(),
                start: it.start_date.clone().into(),
                end: it.end_date.clone().into(),
                tint: parse_hex(&it.color),
                color_hex: it.color.clone().into(),
                milestone: it.is_milestone,
                left: x_of(start),
                span: if it.is_milestone { dw } else { days as f32 * dw },
                progress: h.actual as i32,
                status: h.status.label().into(),
                status_kind: status_kind(h.status),
                issues: open_issue_count(it.notes.as_deref()) as i32,
                days: days as i32,
                range_label: range_label(it, days, today).into(),
            }
        })
        .collect();

    Layout {
        rows,
        days,
        months,
        day_width: dw,
        width: n as f32 * dw,
        today_x: x_of(today),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item(start: &str, end: &str) -> TimelineItem {
        TimelineItem {
            id: "a".into(),
            project_id: "p".into(),
            name: "A".into(),
            start_date: start.into(),
            end_date: end.into(),
            color: "#123456".into(),
            position: 0,
            is_milestone: false,
            created_at: String::new(),
            notes: None,
            progress_entries: None,
        }
    }

    #[test]
    fn geometry_is_consistent() {
        let today = NaiveDate::from_ymd_opt(2026, 10, 1).unwrap();
        let l = layout(&[item("2026-10-05", "2026-10-09")], 0, today);
        let r = &l.rows[0];
        assert_eq!(r.span, 5.0 * 40.0);
        // Range starts 21 days before today; item starts 4 days after today.
        assert_eq!(l.today_x, 21.0 * 40.0);
        assert_eq!(r.left, 25.0 * 40.0);
        assert_eq!(l.days.len() as f32 * 40.0, l.width);
        let month_total: f32 = l.months.iter().map(|m| m.span).sum();
        assert_eq!(month_total, l.width);
        assert_eq!(parse_hex("#123456"), Color::from_rgb_u8(0x12, 0x34, 0x56));
    }

    #[test]
    fn weeks_zoom_labels_only_mondays() {
        let today = NaiveDate::from_ymd_opt(2026, 10, 1).unwrap();
        let l = layout(&[item("2026-10-05", "2026-10-09")], 1, today);
        assert_eq!(l.day_width, 14.0);
        assert_eq!(l.rows[0].span, 5.0 * 14.0);
        let labelled = l.days.iter().filter(|d| !d.label.is_empty()).count();
        let weeks = l.days.len() / 7;
        assert!(labelled == weeks || labelled == weeks + 1, "one label per week, got {labelled}");
        assert_eq!(l.rows[0].range_label, "5 Oct → 9 Oct · 5d");
    }
}
