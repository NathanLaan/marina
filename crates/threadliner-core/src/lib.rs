//! ThreadLiner's backend, independent of the UI shell. Used by the Tauri
//! build today and intended for the native GTK build (plan Option B).

pub mod feed;
pub mod store;
pub mod sync;
