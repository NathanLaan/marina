//! Filesystem locations. Mirrors Electron's `app.getPath('userData')` on
//! Linux (`$XDG_CONFIG_HOME/<ProductName>`) so the Tauri and Electron builds
//! share settings and data during the migration.

use std::path::PathBuf;

pub fn home_dir() -> PathBuf {
    std::env::var_os("HOME").map(PathBuf::from).unwrap_or_else(|| PathBuf::from("/"))
}

pub fn config_home() -> PathBuf {
    match std::env::var_os("XDG_CONFIG_HOME") {
        Some(p) if !p.is_empty() => PathBuf::from(p),
        _ => home_dir().join(".config"),
    }
}

/// `~/.config/<product_name>`, e.g. `~/.config/NoteLiner`.
pub fn user_data_dir(product_name: &str) -> PathBuf {
    config_home().join(product_name)
}

/// Electron's `app.getPath('documents')`.
pub fn documents_dir() -> PathBuf {
    if let Ok(out) = std::process::Command::new("xdg-user-dir").arg("DOCUMENTS").output() {
        let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if out.status.success() && !s.is_empty() {
            return PathBuf::from(s);
        }
    }
    home_dir().join("Documents")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn user_data_dir_uses_product_name() {
        let p = user_data_dir("NoteLiner");
        assert!(p.ends_with("NoteLiner"));
    }
}
