// PageLiner — Tauri host. Port of src/main/main.js; the renderer and
// preload are shared with the Electron build.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use anyhow::{anyhow, Context};
use base64::Engine;
use marina_core::debounce::Debouncer;
use marina_core::git::{Git, OpResult, SyncStatus};
use marina_tauri::dialog::{self, Filter};
use marina_tauri::{bytes, json, null, Args, Host, HostConfig, IpcResult, WindowSpec};
use serde_json::{json as j, Value};
use tauri::{AppHandle, Manager, WebviewWindow};

use pageliner_core::library::Library;

const PRELOAD: &str = include_str!(concat!(env!("OUT_DIR"), "/preload.js"));

struct App {
    host: Arc<Host>,
    library: Mutex<Library>,
    git: Git,
    sync: Debouncer,
}

impl App {
    fn dir(&self) -> PathBuf {
        self.library.lock().unwrap().dir.clone()
    }

    fn sync_enabled(&self) -> bool {
        self.host.pref("gitSyncEnabled").as_bool().unwrap_or(false)
    }

    fn write_gitignore(&self) {
        let content = [
            "# PageLiner sync: the library index + reading state (positions, bookmarks,",
            "# highlights) are versioned; large book blobs and derived covers stay local.",
            "books/",
            "covers/",
            "*.tmp",
            "",
        ]
        .join("\n");
        let _ = std::fs::write(self.dir().join(".gitignore"), content);
    }

    /// Idempotent: init the repo if needed, ensure identity + .gitignore, and
    /// commit so there's a branch to push.
    async fn ensure_sync_repo(&self) -> anyhow::Result<()> {
        let dir = self.dir();
        if !self.git.is_installed().await {
            return Err(anyhow!("Git is not installed or not on PATH."));
        }
        if !self.git.is_repo(&dir).await {
            self.git.init_repo(&dir, None).await?;
        } else {
            self.git.configure_user(&dir).await?;
        }
        self.write_gitignore();
        self.git.commit_all(&dir, "Configure PageLiner sync").await?;
        Ok(())
    }

    /// Debounced commit + push. Never pulls — that's reserved for an
    /// explicit Sync Now to avoid surprise rebases mid-session.
    fn schedule_sync(self: &Arc<Self>) {
        if !self.sync_enabled() {
            return;
        }
        let me = self.clone();
        self.sync.schedule(Duration::from_secs(8), move || async move {
            let dir = me.dir();
            match me.git.commit_all(&dir, "Update library").await {
                Ok(true) => {
                    me.git.sync_push(&dir).await;
                }
                Ok(false) => {}
                Err(e) => eprintln!("[pageliner] auto-sync failed: {e}"),
            }
        });
    }

    async fn route(self: &Arc<Self>, app: &AppHandle, window: &WebviewWindow, channel: &str, args: &Args) -> IpcResult {
        match channel {
            // --- Library ---
            "library:list" => json(self.library.lock().unwrap().books()),
            "library:import" => {
                let picked = dialog::pick_files(
                    app,
                    Some(window),
                    Some("Import Books"),
                    &[
                        Filter { name: "E-Books & Documents", extensions: &["epub", "pdf"] },
                        Filter { name: "EPUB", extensions: &["epub"] },
                        Filter { name: "PDF", extensions: &["pdf"] },
                    ],
                );
                let mut added = Vec::new();
                for path in picked {
                    match self.library.lock().unwrap().add(&path) {
                        Ok(book) => added.push(book),
                        Err(e) => eprintln!("[pageliner] import failed: {} {e}", path.display()),
                    }
                }
                if !added.is_empty() {
                    self.schedule_sync();
                }
                json(added)
            }
            "library:delete" => {
                let ok = self.library.lock().unwrap().delete(&args.str(0)?)?;
                self.schedule_sync();
                json(j!({ "success": ok }))
            }
            "library:getBookData" => {
                let path = self.library.lock().unwrap().book_file(&args.str(0)?);
                match path.and_then(|p| std::fs::read(p).ok()) {
                    Some(data) => bytes(data),
                    None => null(),
                }
            }
            "library:coverDataUrl" => {
                let path = self.library.lock().unwrap().cover_file(&args.str(0)?);
                let Some(path) = path else { return null() };
                let Ok(data) = std::fs::read(&path) else { return null() };
                let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("png").to_lowercase();
                let mime = match ext.as_str() {
                    "jpg" => "image/jpeg".to_string(),
                    "svg" => "image/svg+xml".to_string(),
                    e => format!("image/{e}"),
                };
                let b64 = base64::engine::general_purpose::STANDARD.encode(data);
                json(format!("data:{mime};base64,{b64}"))
            }
            "library:getState" => json(self.library.lock().unwrap().get_state(&args.str(0)?)),
            "library:setState" => {
                let next = self.library.lock().unwrap().set_state(&args.str(0)?, args.value(1))?;
                self.schedule_sync();
                json(next)
            }

            // --- Git sync (opt-in) ---
            "git:getInfo" => {
                let dir = self.dir();
                let installed = self.git.is_installed().await;
                let (mut repo, mut remote_url, mut branch) = (false, None, None);
                if installed && self.git.is_repo(&dir).await {
                    repo = true;
                    remote_url = self.git.get_remote_url(&dir).await;
                    branch = self.git.get_branch(&dir).await;
                }
                json(j!({
                    "enabled": self.sync_enabled(),
                    "gitInstalled": installed,
                    "repo": repo,
                    "remoteUrl": remote_url,
                    "branch": branch,
                    "libraryDir": dir,
                }))
            }
            "git:getStatus" => {
                let dir = self.dir();
                if !self.git.is_repo(&dir).await {
                    return json(SyncStatus::NoRepo);
                }
                json(self.git.sync_status(&dir).await)
            }
            "git:enable" => match self.ensure_sync_repo().await {
                Ok(()) => json(j!({ "success": true })),
                Err(e) => json(j!({ "error": e.to_string() })),
            },
            "git:setRemote" => {
                let dir = self.dir();
                let res: anyhow::Result<()> = async {
                    if !self.git.is_repo(&dir).await {
                        self.ensure_sync_repo().await?;
                    }
                    match args.opt_str(0) {
                        Some(url) => self.git.set_remote_url(&dir, &url).await.map(|_| ())?,
                        None => {
                            let _ = self.git.remove_remote(&dir).await;
                        }
                    }
                    Ok(())
                }
                .await;
                match res {
                    Ok(()) => json(j!({ "success": true })),
                    Err(e) => json(j!({ "error": e.to_string() })),
                }
            }
            "git:syncNow" => {
                let dir = self.dir();
                if !self.git.is_repo(&dir).await {
                    return json(j!({ "error": "Sync is not set up." }));
                }
                let res: anyhow::Result<Value> = async {
                    self.git.configure_user(&dir).await?;
                    self.git.commit_all(&dir, "Sync library").await?;
                    let pulled = self.git.sync_pull(&dir).await;
                    if !pulled.success {
                        return Ok(j!({
                            "error": format!("Pull failed: {}", pulled.error.unwrap_or_default()),
                            "status": self.git.sync_status(&dir).await,
                        }));
                    }
                    let pushed: OpResult = self.git.sync_push(&dir).await;
                    if !pushed.success {
                        return Ok(j!({
                            "error": format!("Push failed: {}", pushed.error.unwrap_or_default()),
                            "status": self.git.sync_status(&dir).await,
                        }));
                    }
                    Ok(j!({ "success": true, "status": self.git.sync_status(&dir).await }))
                }
                .await;
                json(res.unwrap_or_else(|e| j!({ "error": e.to_string() })))
            }

            _ => self.host.route(app, window, channel, args).await,
        }
    }
}

#[tauri::command]
async fn ipc(
    app: AppHandle,
    window: WebviewWindow,
    state: tauri::State<'_, Arc<App>>,
    channel: String,
    args: Vec<Value>,
) -> Result<tauri::ipc::Response, String> {
    let me = state.inner().clone();
    marina_tauri::respond(me.route(&app, &window, &channel, &Args(args)).await)
}

fn main() {
    let host = Host::new(HostConfig {
        product_name: "PageLiner",
        preload: PRELOAD,
        main_window: WindowSpec {
            page: "index.html",
            title: "PageLiner",
            width: 1200.0,
            height: 800.0,
            min_width: 800.0,
            min_height: 500.0,
        },
        prefs_defaults: j!({
            "customTitlebar": false,
            "sidebarVisible": true,
            "statusBarVisible": true,
            "gitSyncEnabled": false,
        }),
        update_repo: None,
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(w) = app.state::<Arc<App>>().host.main_window(app) {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![ipc])
        .setup(move |app| {
            // Default library lives under userData (~/.config/PageLiner/library),
            // the same folder the Electron build uses.
            let library = Library::open(host.user_data.join("library")).context("opening library")?;
            let state = Arc::new(App {
                host: host.clone(),
                library: Mutex::new(library),
                git: Git::new().with_default_identity("PageLiner", "pageliner@localhost"),
                sync: Debouncer::new(),
            });
            app.manage(state.clone());

            if state.sync_enabled() {
                let s = state.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = s.ensure_sync_repo().await {
                        eprintln!("[pageliner] sync init failed: {e}");
                    }
                });
            }

            host.create_main_window(app.handle())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running PageLiner");
}
