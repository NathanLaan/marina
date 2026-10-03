//! Window chrome, UI prefs, and the IPC channels every Marina app shares.
//! Rust counterpart of `@marina/desktop-ui/electron-host` and
//! `@marina/desktop-ui/secondary-window`.

use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex};

use anyhow::anyhow;
use serde::Serialize;
use serde_json::{Map, Value};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_opener::OpenerExt;

use crate::ipc::{json, null, Args, IpcResult};
use crate::updates::Updater;

#[derive(Debug, Clone)]
pub struct WindowSpec {
    /// Page relative to the frontend root, e.g. `index.html`.
    pub page: &'static str,
    pub title: &'static str,
    pub width: f64,
    pub height: f64,
    pub min_width: f64,
    pub min_height: f64,
}

pub struct HostConfig {
    /// Electron product name; picks the `~/.config/<name>` data directory
    /// so both builds share settings during the migration.
    pub product_name: &'static str,
    /// The app's preload bundled against the tauri-shim (see build.rs).
    pub preload: &'static str,
    pub main_window: WindowSpec,
    /// Defaults for `ui-preferences.json` (registerUIPrefsHandlers).
    pub prefs_defaults: Value,
    /// GitHub `owner/repo` whose releases the About dialog checks.
    pub update_repo: Option<&'static str>,
}

type PrefsHook = Box<dyn Fn(&AppHandle, &Value, &Map<String, Value>) + Send + Sync>;
type BuilderHook = Box<
    dyn for<'a> Fn(&Host, WebviewWindowBuilder<'a, tauri::Wry, AppHandle>) -> WebviewWindowBuilder<'a, tauri::Wry, AppHandle>
        + Send
        + Sync,
>;

pub struct Host {
    pub config: HostConfig,
    pub updater: Updater,
    pub user_data: PathBuf,
    prefs: Mutex<Map<String, Value>>,
    main_label: Mutex<String>,
    seq: AtomicU32,
    on_prefs_change: Mutex<Option<PrefsHook>>,
    configure_main: Mutex<Option<BuilderHook>>,
}

impl Host {
    pub fn new(config: HostConfig) -> Arc<Self> {
        marina_core::debounce::set_runtime(tauri::async_runtime::handle().inner().clone());
        let user_data = marina_core::paths::user_data_dir(config.product_name);
        std::fs::create_dir_all(&user_data).ok();
        let host = Self {
            updater: Updater::new(config.update_repo),
            config,
            user_data,
            prefs: Mutex::new(Map::new()),
            main_label: Mutex::new("main".into()),
            seq: AtomicU32::new(0),
            on_prefs_change: Mutex::new(None),
            configure_main: Mutex::new(None),
        };
        host.reload_prefs();
        Arc::new(host)
    }

    // --- UI prefs (ui-preferences.json) --------------------------------------

    pub fn prefs_path(&self) -> PathBuf {
        self.user_data.join("ui-preferences.json")
    }

    pub fn reload_prefs(&self) -> Map<String, Value> {
        let mut merged = self.config.prefs_defaults.as_object().cloned().unwrap_or_default();
        for (k, v) in marina_core::json::read_object(&self.prefs_path()) {
            merged.insert(k, v);
        }
        *self.prefs.lock().unwrap() = merged.clone();
        merged
    }

    pub fn prefs(&self) -> Map<String, Value> {
        self.prefs.lock().unwrap().clone()
    }

    pub fn pref(&self, key: &str) -> Value {
        self.prefs.lock().unwrap().get(key).cloned().unwrap_or(Value::Null)
    }

    pub fn set_prefs(&self, app: &AppHandle, patch: &Value) -> anyhow::Result<Map<String, Value>> {
        let next = {
            let mut prefs = self.prefs.lock().unwrap();
            marina_core::json::merge(&mut prefs, patch);
            prefs.clone()
        };
        marina_core::json::write(&self.prefs_path(), &next)?;
        if let Some(hook) = self.on_prefs_change.lock().unwrap().as_ref() {
            hook(app, patch, &next);
        }
        Ok(next)
    }

    /// Called after `ui:setPrefs` persists, with (patch, merged prefs).
    pub fn on_prefs_change(&self, f: impl Fn(&AppHandle, &Value, &Map<String, Value>) + Send + Sync + 'static) {
        *self.on_prefs_change.lock().unwrap() = Some(Box::new(f));
    }

    /// Customise the main window builder (initial bounds, etc.).
    pub fn configure_main_window(
        &self,
        f: impl for<'a> Fn(&Host, WebviewWindowBuilder<'a, tauri::Wry, AppHandle>) -> WebviewWindowBuilder<'a, tauri::Wry, AppHandle>
            + Send
            + Sync
            + 'static,
    ) {
        *self.configure_main.lock().unwrap() = Some(Box::new(f));
    }

    // --- Windows --------------------------------------------------------------

    pub fn main_window(&self, app: &AppHandle) -> Option<WebviewWindow> {
        app.get_webview_window(&self.main_label.lock().unwrap())
    }

    fn next_label(&self, base: &str) -> String {
        match self.seq.fetch_add(1, Ordering::SeqCst) {
            0 => base.to_string(),
            n => format!("{base}-{n}"),
        }
    }

    /// Build the main window. `customTitlebar` is read now because, as in
    /// Electron, decorations are fixed at construction.
    pub fn create_main_window(&self, app: &AppHandle) -> tauri::Result<WebviewWindow> {
        let spec = &self.config.main_window;
        let label = self.next_label("main");
        let custom_titlebar = self.pref("customTitlebar").as_bool().unwrap_or(false);
        let mut builder = WebviewWindowBuilder::new(app, &label, WebviewUrl::App(spec.page.into()))
            .title(spec.title)
            .inner_size(spec.width, spec.height)
            .min_inner_size(spec.min_width, spec.min_height)
            .decorations(!custom_titlebar)
            .initialization_script(self.config.preload)
            .disable_drag_drop_handler();
        builder = external_links(app, builder);
        if cfg!(debug_assertions) {
            builder = builder.initialization_script(DEV_CONSOLE_FORWARD);
            // Test hook: MARINA_SMOKE_SCRIPT=<file.js> runs a script in the
            // main window; it reports back through the `debug:log` channel.
            if let Some(script) = std::env::var_os("MARINA_SMOKE_SCRIPT").and_then(|p| std::fs::read_to_string(p).ok()) {
                builder = builder.initialization_script(script);
            }
        }
        if let Some(hook) = self.configure_main.lock().unwrap().as_ref() {
            builder = hook(self, builder);
        }
        let win = builder.build()?;
        broadcast_maximized_changes(&win);
        reload_on_web_process_crash(&win);
        *self.main_label.lock().unwrap() = label;
        Ok(win)
    }

    /// Focus-if-open, else create (createSecondaryWindow).
    pub fn open_secondary(&self, app: &AppHandle, id: &str, spec: &WindowSpec) -> tauri::Result<WebviewWindow> {
        if let Some(w) = app.get_webview_window(id) {
            w.unminimize().ok();
            w.set_focus().ok();
            return Ok(w);
        }
        let builder = WebviewWindowBuilder::new(app, id, WebviewUrl::App(spec.page.into()))
            .title(spec.title)
            .inner_size(spec.width, spec.height)
            .min_inner_size(spec.min_width, spec.min_height)
            .initialization_script(self.config.preload)
            .disable_drag_drop_handler();
        let win = external_links(app, builder).build()?;
        broadcast_maximized_changes(&win);
        Ok(win)
    }

    /// `mainWindow.webContents.send(channel, payload)`.
    pub fn send<S: Serialize + Clone>(&self, app: &AppHandle, channel: &str, payload: S) {
        if let Some(w) = self.main_window(app) {
            let _ = app.emit_to(w.label(), channel, payload);
        }
    }

    /// Restart so construction-time options (the titlebar) re-apply. Debug
    /// builds swap the window in-process so `tauri dev` keeps running.
    pub fn relaunch(&self, app: &AppHandle) -> anyhow::Result<()> {
        if cfg!(debug_assertions) {
            let old = self.main_window(app);
            self.create_main_window(app)?;
            if let Some(old) = old {
                old.destroy()?;
            }
            Ok(())
        } else {
            app.restart()
        }
    }

    // --- Shared channels -----------------------------------------------------

    /// Channels every app registers. Apps match their own channels first and
    /// fall through to this.
    pub async fn route(&self, app: &AppHandle, window: &WebviewWindow, channel: &str, args: &Args) -> IpcResult {
        if let Some(res) = self.updater.route(self, app, channel, args).await {
            return res;
        }
        match channel {
            "window:minimize" => {
                window.minimize()?;
                null()
            }
            "window:maximize" => {
                if window.is_maximized()? {
                    window.unmaximize()?;
                } else {
                    window.maximize()?;
                }
                null()
            }
            "window:close" => {
                window.close()?;
                null()
            }
            "window:isMaximized" => json(window.is_maximized().unwrap_or(false)),
            "window:startDragging" => {
                window.start_dragging()?;
                null()
            }
            "ui:getPrefs" => json(self.prefs()),
            "ui:setPrefs" => json(self.set_prefs(app, args.value(0))?),
            "app:relaunch" => {
                self.relaunch(app)?;
                null()
            }
            "app:getVersion" => json(app.package_info().version.to_string()),
            "debug:log" if cfg!(debug_assertions) => {
                let parts: Vec<String> = args
                    .0
                    .iter()
                    .map(|v| v.as_str().map(str::to_string).unwrap_or_else(|| v.to_string()))
                    .collect();
                println!("[renderer:{}] {}", window.label(), parts.join(" "));
                null()
            }
            "debug:exit" if cfg!(debug_assertions) => {
                app.exit(args.i64(0).unwrap_or(0) as i32);
                null()
            }
            "shell:openExternal" => {
                let url = args.str(0)?;
                app.opener().open_url(url, None::<&str>)?;
                null()
            }
            _ => Err(anyhow!("No handler registered for '{channel}'")),
        }
    }
}

fn is_app_url(url: &tauri::Url) -> bool {
    match url.scheme() {
        "http" | "https" => {
            matches!(url.host_str(), Some("localhost" | "tauri.localhost" | "ipc.localhost" | "127.0.0.1"))
        }
        _ => true, // tauri:, blob:, data:, about:, asset protocols
    }
}

/// Web links open in the user's browser rather than navigating the app
/// window or spawning a bare webview (Electron's setWindowOpenHandler +
/// will-navigate guard).
fn external_links<'a>(
    app: &AppHandle,
    builder: WebviewWindowBuilder<'a, tauri::Wry, AppHandle>,
) -> WebviewWindowBuilder<'a, tauri::Wry, AppHandle> {
    let nav_app = app.clone();
    let new_app = app.clone();
    builder
        .on_navigation(move |url| {
            if is_app_url(url) {
                return true;
            }
            let _ = nav_app.opener().open_url(url.as_str(), None::<&str>);
            false
        })
        .on_new_window(move |url, _features| {
            if matches!(url.scheme(), "http" | "https" | "mailto") {
                let _ = new_app.opener().open_url(url.as_str(), None::<&str>);
            }
            tauri::webview::NewWindowResponse::Deny
        })
}

/// Debug builds: surface renderer warnings/errors in the terminal, as the
/// Electron dev builds do with `console-message`.
const DEV_CONSOLE_FORWARD: &str = r#"(() => {
  const send = (level, args) => {
    try {
      const text = args.map((a) => a instanceof Error ? (a.stack || a.message) : typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
      window.__TAURI_INTERNALS__.invoke('ipc', { channel: 'debug:log', args: [level, text] });
    } catch {}
  };
  for (const level of ['warn', 'error']) {
    const orig = console[level].bind(console);
    console[level] = (...a) => { orig(...a); send(level, a); };
  }
  window.addEventListener('error', (e) => send('uncaught', [e.error || e.message]));
  window.addEventListener('unhandledrejection', (e) => send('unhandled-rejection', [e.reason]));
})();"#;

/// If WebKit's web process dies (GPU reset, OOM), reload instead of leaving
/// a blank window — the Electron builds did this on `render-process-gone`.
fn reload_on_web_process_crash(win: &WebviewWindow) {
    #[cfg(target_os = "linux")]
    let _ = win.with_webview(|wv| {
        use webkit2gtk::WebViewExt;
        wv.inner().connect_web_process_terminated(|view, reason| {
            eprintln!("[marina] web process terminated ({reason:?}); reloading");
            view.reload();
        });
    });
    #[cfg(not(target_os = "linux"))]
    let _ = win;
}

fn broadcast_maximized_changes(win: &WebviewWindow) {
    let w = win.clone();
    let last = Mutex::new(win.is_maximized().unwrap_or(false));
    win.on_window_event(move |ev| {
        if let WindowEvent::Resized(_) = ev {
            let now = w.is_maximized().unwrap_or(false);
            let mut last = last.lock().unwrap();
            if *last != now {
                *last = now;
                let _ = w.emit_to(w.label(), "window:maximized-change", now);
            }
        }
    });
}
