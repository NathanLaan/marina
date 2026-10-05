//! Blocking native dialogs (Electron's `dialog.show*Dialog`). Call these
//! from async command handlers, never from the main thread.

use std::path::PathBuf;

use tauri::{AppHandle, Runtime, WebviewWindow};
use tauri_plugin_dialog::{DialogExt, FileDialogBuilder, MessageDialogButtons, MessageDialogKind};

pub struct Filter<'a> {
    pub name: &'a str,
    pub extensions: &'a [&'a str],
}

fn builder<R: Runtime>(
    app: &AppHandle<R>,
    parent: Option<&WebviewWindow<R>>,
    title: Option<&str>,
    filters: &[Filter],
) -> FileDialogBuilder<R> {
    let mut b = app.dialog().file();
    if let Some(w) = parent {
        b = b.set_parent(w);
    }
    if let Some(t) = title {
        b = b.set_title(t);
    }
    for f in filters {
        b = b.add_filter(f.name, f.extensions);
    }
    b
}

pub fn pick_files<R: Runtime>(
    app: &AppHandle<R>,
    parent: Option<&WebviewWindow<R>>,
    title: Option<&str>,
    filters: &[Filter],
) -> Vec<PathBuf> {
    builder(app, parent, title, filters)
        .blocking_pick_files()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|p| p.into_path().ok())
        .collect()
}

pub fn pick_file<R: Runtime>(
    app: &AppHandle<R>,
    parent: Option<&WebviewWindow<R>>,
    title: Option<&str>,
    filters: &[Filter],
) -> Option<PathBuf> {
    builder(app, parent, title, filters).blocking_pick_file().and_then(|p| p.into_path().ok())
}

pub fn pick_folder<R: Runtime>(
    app: &AppHandle<R>,
    parent: Option<&WebviewWindow<R>>,
    title: Option<&str>,
) -> Option<PathBuf> {
    builder(app, parent, title, &[]).blocking_pick_folder().and_then(|p| p.into_path().ok())
}

pub fn save_file<R: Runtime>(
    app: &AppHandle<R>,
    parent: Option<&WebviewWindow<R>>,
    title: Option<&str>,
    default_name: Option<&str>,
    filters: &[Filter],
) -> Option<PathBuf> {
    let mut b = builder(app, parent, title, filters);
    if let Some(n) = default_name {
        b = b.set_file_name(n);
    }
    b.blocking_save_file().and_then(|p| p.into_path().ok())
}

/// OK/Cancel confirmation. Returns true on OK.
pub fn confirm<R: Runtime>(
    app: &AppHandle<R>,
    parent: Option<&WebviewWindow<R>>,
    title: &str,
    message: &str,
    ok_label: &str,
) -> bool {
    let mut b = app
        .dialog()
        .message(message)
        .title(title)
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::OkCancelCustom(ok_label.into(), "Cancel".into()));
    if let Some(w) = parent {
        b = b.parent(w);
    }
    b.blocking_show()
}
