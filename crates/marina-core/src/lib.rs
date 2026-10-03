//! Framework-independent backend logic shared by the Marina apps.
//!
//! Nothing in this crate depends on Tauri (or GTK), so it carries over
//! unchanged from the Tauri port (plan Option A) to the native GTK port
//! (Option B). See `docs/plans/plan-native-linux.md`.

pub mod debounce;
pub mod git;
pub mod json;
pub mod paths;
