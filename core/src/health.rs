//! Schedule health, ported from the web UI's `healthUtils.ts` so every front-end
//! (native, exports) classifies items the same way.
use crate::models::{Note, TimelineItem};
use chrono::NaiveDate;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HealthStatus {
    Done,
    OnTrack,
    AtRisk,
    Behind,
    Overdue,
    NotStarted,
}

impl HealthStatus {
    pub fn label(self) -> &'static str {
        match self {
            Self::Done => "Done",
            Self::OnTrack => "On track",
            Self::AtRisk => "At risk",
            Self::Behind => "Behind",
            Self::Overdue => "Overdue",
            Self::NotStarted => "Not started",
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct ItemHealth {
    pub status: HealthStatus,
    /// Latest reported completion, 0-100.
    pub actual: i64,
    /// Completion implied by elapsed time, 0-100.
    pub expected: i64,
    pub days_remaining: i64,
}

pub fn parse_date(s: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(s, "%Y-%m-%d").ok()
}

/// Percentage of the entry with the latest date (entries may come in any order).
pub fn current_progress(item: &TimelineItem) -> i64 {
    item.progress_entries
        .as_deref()
        .unwrap_or(&[])
        .iter()
        .max_by(|a, b| a.date.cmp(&b.date))
        .map_or(0, |e| e.percentage.clamp(0, 100))
}

/// Inclusive length in days (a one-day item is 1).
pub fn duration_days(item: &TimelineItem) -> i64 {
    match (parse_date(&item.start_date), parse_date(&item.end_date)) {
        (Some(s), Some(e)) => (e - s).num_days() + 1,
        _ => 1,
    }
}

pub fn item_health(item: &TimelineItem, today: NaiveDate) -> ItemHealth {
    let actual = current_progress(item);
    let (Some(start), Some(end)) = (parse_date(&item.start_date), parse_date(&item.end_date)) else {
        return ItemHealth { status: HealthStatus::NotStarted, actual, expected: 0, days_remaining: 0 };
    };
    let total = (end - start).num_days() + 1;
    let elapsed = (today - start).num_days() + 1;
    let days_remaining = (end - today).num_days();
    let expected = if elapsed <= 0 {
        0
    } else {
        ((elapsed as f64 / total as f64) * 100.0).round().min(100.0) as i64
    };
    let variance = actual - expected;
    let status = if actual >= 100 {
        HealthStatus::Done
    } else if days_remaining < 0 {
        HealthStatus::Overdue
    } else if elapsed <= 0 {
        HealthStatus::NotStarted
    } else if variance >= -5 {
        HealthStatus::OnTrack
    } else if variance >= -20 {
        HealthStatus::AtRisk
    } else {
        HealthStatus::Behind
    };
    ItemHealth { status, actual, expected, days_remaining }
}

pub fn open_issue_count(notes: Option<&[Note]>) -> usize {
    notes
        .unwrap_or(&[])
        .iter()
        .filter(|n| n.note_type == "issue" && !n.resolved)
        .count()
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Summary {
    pub total_items: usize,
    pub completed: usize,
    pub overdue: usize,
    /// At risk + behind.
    pub at_risk: usize,
    pub open_issues: usize,
    /// Completion weighted by each item's duration.
    pub overall_progress: i64,
}

pub fn summarise(items: &[TimelineItem], today: NaiveDate) -> Summary {
    let mut s = Summary { total_items: items.len(), ..Default::default() };
    let (mut weighted, mut total_days) = (0i64, 0i64);
    for item in items {
        let h = item_health(item, today);
        match h.status {
            HealthStatus::Done => s.completed += 1,
            HealthStatus::Overdue => s.overdue += 1,
            HealthStatus::AtRisk | HealthStatus::Behind => s.at_risk += 1,
            _ => {}
        }
        s.open_issues += open_issue_count(item.notes.as_deref());
        let days = duration_days(item);
        weighted += h.actual * days;
        total_days += days;
    }
    s.overall_progress = if total_days == 0 {
        0
    } else {
        (weighted as f64 / total_days as f64).round() as i64
    };
    s
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::ProgressEntry;

    fn item(start: &str, end: &str, progress: &[(&str, i64)]) -> TimelineItem {
        TimelineItem {
            id: "i".into(),
            project_id: "p".into(),
            name: "x".into(),
            start_date: start.into(),
            end_date: end.into(),
            color: "#000000".into(),
            position: 0,
            is_milestone: false,
            created_at: String::new(),
            notes: None,
            progress_entries: Some(
                progress
                    .iter()
                    .map(|(d, p)| ProgressEntry {
                        id: String::new(),
                        item_id: "i".into(),
                        date: (*d).into(),
                        percentage: *p,
                        created_at: String::new(),
                        updated_at: String::new(),
                    })
                    .collect(),
            ),
        }
    }

    #[test]
    fn classifies_like_the_web_ui() {
        let today = parse_date("2026-01-10").unwrap();
        let st = |i: &TimelineItem| item_health(i, today).status;
        // 10 of 20 days elapsed → expected 50%.
        assert_eq!(st(&item("2026-01-01", "2026-01-20", &[("2026-01-09", 48)])), HealthStatus::OnTrack);
        assert_eq!(st(&item("2026-01-01", "2026-01-20", &[("2026-01-09", 35)])), HealthStatus::AtRisk);
        assert_eq!(st(&item("2026-01-01", "2026-01-20", &[("2026-01-09", 10)])), HealthStatus::Behind);
        assert_eq!(st(&item("2026-01-01", "2026-01-05", &[])), HealthStatus::Overdue);
        assert_eq!(st(&item("2026-02-01", "2026-02-05", &[])), HealthStatus::NotStarted);
        // Latest date wins regardless of order.
        assert_eq!(
            st(&item("2026-01-01", "2026-01-05", &[("2026-01-05", 100), ("2026-01-02", 20)])),
            HealthStatus::Done
        );
    }

    #[test]
    fn summary_weights_by_duration() {
        let today = parse_date("2026-01-10").unwrap();
        let items = [
            item("2026-01-01", "2026-01-30", &[("2026-01-02", 100)]), // 30 days @100
            item("2026-01-01", "2026-01-10", &[]),                   // 10 days @0
        ];
        let s = summarise(&items, today);
        assert_eq!(s.overall_progress, 75);
        assert_eq!(s.completed, 1);
    }
}
