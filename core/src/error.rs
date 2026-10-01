use thiserror::Error;

/// Errors are prefixed so the TS client can route them (`UNAUTH:` clears the session).
#[derive(Debug, Error)]
pub enum CoreError {
    #[error("UNAUTH: {0}")]
    Unauth(String),
    #[error("NOT_FOUND: {0}")]
    NotFound(String),
    #[error("VALIDATION: {0}")]
    Validation(String),
    #[error("DB: {0}")]
    Db(String),
    #[error("EXPORT: {0}")]
    Export(String),
}

impl From<rusqlite::Error> for CoreError {
    fn from(e: rusqlite::Error) -> Self {
        CoreError::Db(e.to_string())
    }
}

pub type Result<T> = std::result::Result<T, CoreError>;
