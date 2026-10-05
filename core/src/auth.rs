use crate::db::{new_id, now_iso, Store};
use crate::error::{CoreError, Result};
use crate::models::LoginResponse;
use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use rand_core::OsRng;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::path::Path;

const TOKEN_DAYS: i64 = 30;

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String,
    exp: usize,
}

/// Device-local JWT secret, created once and reused. Not synced anywhere.
pub fn load_or_create_secret(path: &Path) -> Result<Vec<u8>> {
    if path.exists() {
        return std::fs::read(path).map_err(|e| CoreError::Db(e.to_string()));
    }
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| CoreError::Db(e.to_string()))?;
    }
    let mut buf = vec![0u8; 32];
    getrandom_fill(&mut buf);
    std::fs::write(path, &buf).map_err(|e| CoreError::Db(e.to_string()))?;
    Ok(buf)
}

fn getrandom_fill(buf: &mut [u8]) {
    // No extra deps: UUID v4 randomness is good enough for a device secret.
    let mut i = 0;
    while i < buf.len() {
        let b = uuid::Uuid::new_v4().into_bytes();
        let n = (buf.len() - i).min(16);
        buf[i..i + n].copy_from_slice(&b[..n]);
        i += n;
    }
}

fn hash_password(password: &str) -> Result<String> {
    Argon2::default()
        .hash_password(password.as_bytes(), &SaltString::generate(&mut OsRng))
        .map(|h| h.to_string())
        .map_err(|e| CoreError::Db(e.to_string()))
}

fn verify_password(hash: &str, password: &str) -> bool {
    PasswordHash::new(hash)
        .map(|h| Argon2::default().verify_password(password.as_bytes(), &h).is_ok())
        .unwrap_or(false)
}

fn sign(secret: &[u8], username: &str) -> Result<String> {
    let exp = (chrono::Utc::now() + chrono::Duration::days(TOKEN_DAYS)).timestamp() as usize;
    encode(
        &Header::default(),
        &Claims { sub: username.into(), exp },
        &EncodingKey::from_secret(secret),
    )
    .map_err(|e| CoreError::Db(e.to_string()))
}

pub fn decode_admin(secret: &[u8], token: &str) -> Result<String> {
    decode::<Claims>(token, &DecodingKey::from_secret(secret), &Validation::default())
        .map(|d| d.claims.sub)
        .map_err(|_| CoreError::Unauth("invalid or expired session".into()))
}

/// Valid token → admin username. Anything else → UNAUTH (same message both ways).
pub fn require_admin(secret: &[u8], token: Option<&str>) -> Result<String> {
    match token {
        Some(t) => decode_admin(secret, t),
        None => Err(CoreError::Unauth("admin sign-in required".into())),
    }
}

impl Store {
    pub fn user_count(&self) -> Result<i64> {
        let conn = self.lock()?;
        conn.query_row("SELECT COUNT(*) FROM users", [], |r| r.get(0))
            .map_err(CoreError::from)
    }

    /// First-run setup only; refuses when an admin already exists.
    pub fn init_admin(&self, secret: &[u8], username: &str, password: &str) -> Result<LoginResponse> {
        let u = username.trim();
        if u.is_empty() || u.len() > 50 {
            return Err(CoreError::Validation("username must be 1-50 chars".into()));
        }
        if password.len() < 8 {
            return Err(CoreError::Validation("password must be ≥8 chars".into()));
        }
        if self.user_count()? > 0 {
            return Err(CoreError::Unauth("admin already exists".into()));
        }
        let conn = self.lock()?;
        let hash = hash_password(password)?;
        conn.execute(
            "INSERT INTO users (id, username, password_hash, created_at) VALUES (?,?,?,?)",
            rusqlite::params![new_id(), u, hash, now_iso()],
        )?;
        Ok(LoginResponse {
            access_token: sign(secret, u)?,
            username: u.into(),
        })
    }

    pub fn login(&self, secret: &[u8], username: &str, password: &str) -> Result<LoginResponse> {
        let conn = self.lock()?;
        let row: Option<(String, String)> = conn
            .query_row(
                "SELECT username, password_hash FROM users WHERE username = ?",
                rusqlite::params![username.trim()],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()
            .map_err(CoreError::from)?;
        match row {
            Some((name, hash)) if verify_password(&hash, password) => Ok(LoginResponse {
                access_token: sign(secret, &name)?,
                username: name,
            }),
            _ => {
                // Hash-and-discard so unknown-user timing matches a real check.
                let _ = hash_password(password);
                Err(CoreError::Unauth("invalid username or password".into()))
            }
        }
    }

    pub fn change_password(
        &self,
        secret: &[u8],
        token: Option<&str>,
        current: &str,
        new: &str,
    ) -> Result<()> {
        let username = require_admin(secret, token)?;
        if new.len() < 8 {
            return Err(CoreError::Validation("password must be ≥8 chars".into()));
        }
        let conn = self.lock()?;
        let hash: String = conn
            .query_row(
                "SELECT password_hash FROM users WHERE username = ?",
                rusqlite::params![username],
                |r| r.get(0),
            )
            .map_err(|_| CoreError::Unauth("invalid or expired session".into()))?;
        if !verify_password(&hash, current) {
            return Err(CoreError::Unauth("current password is wrong".into()));
        }
        conn.execute(
            "UPDATE users SET password_hash = ? WHERE username = ?",
            rusqlite::params![hash_password(new)?, username],
        )?;
        Ok(())
    }
}

use rusqlite::OptionalExtension;
