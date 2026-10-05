//! NoteLiner's backend, independent of the UI shell. Used by the Tauri
//! build today and intended for the native GTK build (plan Option B).

pub mod export;
pub mod frontmatter;
pub mod git;
pub mod import;
pub mod links;
pub mod mcp;
pub mod project;
pub mod templates;
pub mod window_state;
pub mod workspace;
pub mod yaml;
