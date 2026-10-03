//! Tauri host shared by the Marina apps.
//!
//! The Electron builds talk to their main process through named IPC
//! channels (`ipcRenderer.invoke('library:list')`). Under Tauri, each app's
//! unchanged `preload.js` is bundled against `@marina/desktop-ui/tauri-shim`
//! and injected as an initialization script; every `invoke` arrives at the
//! app's single `ipc` command with the same channel name and arguments.
//! This crate supplies the plumbing for that ([`ipc`]) and the channels
//! every app shares — window controls, UI prefs, relaunch ([`host`]).

pub mod dialog;
pub mod host;
pub mod ipc;
pub mod updates;

pub use host::{Host, HostConfig, WindowSpec};
pub use ipc::{bytes, bytes_value, json, null, respond, Args, IpcResult, Reply};
