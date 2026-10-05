use crate::error::{CoreError, Result};
use regex::Regex;
use std::sync::OnceLock;

static CODE_RE: OnceLock<Regex> = OnceLock::new();
static COLOR_RE: OnceLock<Regex> = OnceLock::new();

fn code_re() -> &'static Regex {
    CODE_RE.get_or_init(|| Regex::new(r"^[A-Za-z0-9_-]{1,50}$").unwrap())
}

fn color_re() -> &'static Regex {
    COLOR_RE.get_or_init(|| Regex::new(r"^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$").unwrap())
}

pub fn validate_code(code: &str) -> Result<()> {
    if !code_re().is_match(code) {
        return Err(CoreError::Validation(
            "code must be 1-50 chars: letters, digits, _ or -".into(),
        ));
    }
    Ok(())
}

pub fn validate_name(name: &str, field: &str) -> Result<()> {
    let n = name.trim();
    if n.is_empty() || n.len() > 255 {
        return Err(CoreError::Validation(format!("{field} must be 1-255 chars")));
    }
    Ok(())
}

pub fn validate_content(content: &str) -> Result<()> {
    let n = content.trim();
    if n.is_empty() || n.len() > 2000 {
        return Err(CoreError::Validation("content must be 1-2000 chars".into()));
    }
    Ok(())
}

pub fn validate_created_by(name: Option<&str>) -> Result<()> {
    if let Some(n) = name {
        if n.len() > 100 {
            return Err(CoreError::Validation("name must be ≤100 chars".into()));
        }
    }
    Ok(())
}

pub fn validate_date(date: &str) -> Result<()> {
    chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .map(|_| ())
        .map_err(|_| CoreError::Validation("date must be YYYY-MM-DD".into()))
}

pub fn validate_color(color: &str) -> Result<()> {
    if !color_re().is_match(color) {
        return Err(CoreError::Validation("color must be #RGB or #RRGGBB".into()));
    }
    Ok(())
}

pub fn validate_evidence(url: Option<&str>) -> Result<()> {
    if let Some(u) = url {
        if u.len() > 2048 || !(u.starts_with("http://") || u.starts_with("https://")) {
            return Err(CoreError::Validation("evidenceUrl must be an http(s) URL".into()));
        }
    }
    Ok(())
}

pub fn validate_percentage(p: i64) -> Result<()> {
    if !(0..=100).contains(&p) {
        return Err(CoreError::Validation("percentage must be 0-100".into()));
    }
    Ok(())
}
