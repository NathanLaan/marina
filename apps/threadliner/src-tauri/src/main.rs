// ThreadLiner — Tauri host. Port of src/main/main.js; the renderer and
// preload are shared with the Electron build.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use anyhow::anyhow;
use marina_core::git::SyncStatus;
use marina_tauri::dialog;
use marina_tauri::{json, null, Args, Host, HostConfig, IpcResult, WindowSpec};
use serde_json::{json as j, Map, Value};
use tauri::{AppHandle, Manager, WebviewWindow};
use tauri_plugin_notification::NotificationExt;
use tokio::sync::Notify;

use threadliner_core::feed;
use threadliner_core::store::Store;
use threadliner_core::sync::SyncManager;

const PRELOAD: &str = include_str!(concat!(env!("OUT_DIR"), "/preload.js"));

const ALLOWED_INTERVALS: [u64; 5] = [1, 5, 10, 30, 60];
const DEFAULT_INTERVAL_MIN: u64 = 10;

const HELP_WINDOW: WindowSpec = WindowSpec {
    page: "help.html",
    title: "ThreadLiner Help",
    width: 1000.0,
    height: 720.0,
    min_width: 560.0,
    min_height: 360.0,
};

struct App {
    host: Arc<Host>,
    store: Mutex<Option<Store>>,
    sync: Arc<SyncManager>,
    poll_minutes: AtomicU64,
    poll_reset: Notify,
    polling: AtomicBool,
}

fn no_dir() -> anyhow::Error {
    anyhow!("No data directory configured")
}

impl App {
    // --- App config (config.json in userData, outside the repo) -----------

    fn config_path(&self) -> PathBuf {
        self.host.user_data.join("config.json")
    }

    fn read_config(&self) -> Map<String, Value> {
        marina_core::json::read_object(&self.config_path())
    }

    fn write_config(&self, config: &Map<String, Value>) -> anyhow::Result<()> {
        marina_core::json::write(&self.config_path(), config)
    }

    fn configured_dir(&self) -> Option<PathBuf> {
        self.read_config().get("dataDir").and_then(Value::as_str).filter(|s| !s.is_empty()).map(PathBuf::from)
    }

    fn data_dir(&self) -> anyhow::Result<PathBuf> {
        self.configured_dir().ok_or_else(no_dir)
    }

    fn setup_complete(&self) -> bool {
        self.configured_dir().is_some_and(|d| d.exists())
    }

    fn with_store<T>(&self, f: impl FnOnce(&mut Store) -> anyhow::Result<T>) -> anyhow::Result<T> {
        let mut guard = self.store.lock().unwrap();
        let store = guard.as_mut().ok_or_else(|| anyhow!("Data store is not initialised"))?;
        f(store)
    }

    fn setting(&self, key: &str) -> Value {
        self.store.lock().unwrap().as_ref().map(|s| s.get_setting(key)).unwrap_or(Value::Null)
    }

    async fn init_data_and_sync(self: &Arc<Self>, app: &AppHandle, dir: &Path) -> anyhow::Result<()> {
        self.sync.git.configure_user(dir).await?;
        *self.store.lock().unwrap() = Some(Store::open(dir)?);
        let wait = match self.setting("syncWaitTime") {
            Value::Null => 10,
            v => parse_int(&v).unwrap_or(10),
        };
        self.sync.init(dir.to_path_buf(), wait);
        self.sync.notify_change("Initialize data store").await;
        self.set_poll_interval(&self.setting("pollInterval"));
        self.start_poller(app);
        Ok(())
    }

    // --- Feed poller (feed-poller.js) ----------------------------------------

    fn set_poll_interval(&self, minutes: &Value) {
        let n = parse_int(minutes).filter(|n| ALLOWED_INTERVALS.contains(n)).unwrap_or(DEFAULT_INTERVAL_MIN);
        self.poll_minutes.store(n, Ordering::SeqCst);
        self.poll_reset.notify_waiters();
    }

    fn start_poller(self: &Arc<Self>, app: &AppHandle) {
        static STARTED: AtomicBool = AtomicBool::new(false);
        if STARTED.swap(true, Ordering::SeqCst) {
            self.poll_reset.notify_waiters();
            return;
        }
        let me = self.clone();
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            loop {
                let wait = Duration::from_secs(me.poll_minutes.load(Ordering::SeqCst) * 60);
                tokio::select! {
                    _ = tokio::time::sleep(wait) => me.poll_once(&app).await,
                    _ = me.poll_reset.notified() => {}
                }
            }
        });
    }

    async fn poll_once(self: &Arc<Self>, app: &AppHandle) {
        if self.polling.swap(true, Ordering::SeqCst) {
            return;
        }
        let feeds = self.with_store(|s| Ok(s.all_feeds())).unwrap_or_default();
        let mut updated = Vec::new();
        let mut total = 0usize;
        for f in feeds {
            let (Some(id), Some(url)) = (f["id"].as_str(), f["url"].as_str()) else { continue };
            match feed::fetch_and_parse(url).await {
                Ok(parsed) => {
                    let entries = feed::normalize_entries(&parsed.items);
                    if let Ok(n) = self.with_store(|s| s.insert_entries(id, &entries)) {
                        if n > 0 {
                            total += n;
                            updated.push(j!({ "id": id, "title": f["title"], "inserted": n }));
                        }
                    }
                }
                Err(e) => eprintln!("[threadliner] poll failed for {url}: {e}"),
            }
        }
        self.polling.store(false, Ordering::SeqCst);
        if total == 0 {
            return;
        }

        let noun = if total == 1 { "entry" } else { "entries" };
        self.sync.notify_change(&format!("Poll: {total} new {noun}")).await;
        self.host.send(app, "feeds:updated", j!({ "totalInserted": total, "updatedFeeds": updated }));

        let enabled = self.setting("pollNotificationsEnabled");
        if enabled.is_null() || truthy(&enabled) {
            let summary = if updated.len() == 1 {
                updated[0]["title"].as_str().unwrap_or("").to_string()
            } else {
                format!("{} feeds", updated.len())
            };
            let _ = app
                .notification()
                .builder()
                .title("ThreadLiner")
                .body(format!("{total} new {noun} in {summary}"))
                .show();
        }
    }

    // --- IPC -----------------------------------------------------------------

    async fn route(self: &Arc<Self>, app: &AppHandle, window: &WebviewWindow, channel: &str, args: &Args) -> IpcResult {
        match channel {
            // Setup
            "setup:isComplete" => json(self.setup_complete()),
            "setup:openFolderDialog" => json(dialog::pick_folder(app, Some(window), Some("Select Data Folder"))),
            "setup:init" => {
                let dir = PathBuf::from(args.str(0)?);
                let remote = args.opt_str(1);
                std::fs::create_dir_all(&dir)?;
                let git = &self.sync.git;
                let is_repo = git.is_repo(&dir).await;
                match (&remote, is_repo) {
                    (Some(url), false) => {
                        if std::fs::read_dir(&dir)?.next().is_none() {
                            // Clone needs to create the directory itself.
                            std::fs::remove_dir(&dir)?;
                            git.clone_to(url, &dir).await?;
                        } else {
                            git.init_repo(&dir, Some(url)).await?;
                        }
                    }
                    (None, false) => git.init_repo(&dir, None).await?,
                    _ => {}
                }
                let mut config = Map::new();
                config.insert("dataDir".into(), j!(dir));
                config.insert("remoteUrl".into(), j!(remote));
                self.write_config(&config)?;
                self.init_data_and_sync(app, &dir).await?;
                json(j!({ "success": true }))
            }

            // Feeds
            "feed:getAll" => json(self.with_store(|s| Ok(s.all_feeds())).unwrap_or_default()),
            "feed:add" => {
                let url = args.str(0)?;
                let parsed = feed::fetch_and_parse(&url).await?;
                let title = parsed.title.clone().filter(|t| !t.is_empty()).unwrap_or_else(|| url.clone());
                let entries = feed::normalize_entries(&parsed.items);
                let mut feed = self.with_store(|s| {
                    let f = s.add_feed(&title, &url, parsed.link.clone(), parsed.description.clone())?;
                    s.insert_entries(f["id"].as_str().unwrap_or(""), &entries)?;
                    Ok(f)
                })?;
                self.sync.notify_change(&format!("Add feed: {title}")).await;
                feed.insert("unread_count".into(), j!(entries.len()));
                json(feed)
            }
            "feed:edit" => {
                let feed = self.with_store(|s| s.edit_feed(&args.str(0)?, args.value(1)))?;
                self.sync.notify_change(&format!("Edit feed: {}", feed["title"].as_str().unwrap_or(""))).await;
                json(feed)
            }
            "feed:remove" => {
                let id = args.str(0)?;
                let title = self.with_store(|s| {
                    let t = s.feed(&id).and_then(|f| f["title"].as_str().map(str::to_string));
                    s.remove_feed(&id)?;
                    Ok(t)
                })?;
                self.sync.notify_change(&format!("Remove feed: {}", title.unwrap_or(id))).await;
                json(j!({ "success": true }))
            }
            "feed:refresh" => {
                let id = args.str(0)?;
                let feed = self.with_store(|s| Ok(s.feed(&id)))?.ok_or_else(|| anyhow!("Feed not found"))?;
                let parsed = feed::fetch_and_parse(feed["url"].as_str().unwrap_or("")).await?;
                let entries = feed::normalize_entries(&parsed.items);
                let inserted = self.with_store(|s| s.insert_entries(&id, &entries))?;
                if inserted > 0 {
                    self.sync.notify_change(&format!("Refresh feed: {}", feed["title"].as_str().unwrap_or(""))).await;
                }
                json(j!({ "inserted": inserted }))
            }

            // Tags
            "tag:getAll" => json(self.with_store(|s| Ok(s.all_tags())).unwrap_or_default()),
            "tag:add" => {
                let tag = self.with_store(|s| s.add_tag(&args.str(0)?))?;
                self.sync.notify_change(&format!("Add tag: {}", tag["name"].as_str().unwrap_or(""))).await;
                json(tag)
            }
            "tag:edit" => {
                let tag = self.with_store(|s| s.edit_tag(&args.str(0)?, args.value(1)))?;
                self.sync.notify_change(&format!("Edit tag: {}", tag["name"].as_str().unwrap_or(""))).await;
                json(tag)
            }
            "tag:remove" => {
                let id = args.str(0)?;
                let name = self.with_store(|s| {
                    let n = s.tag(&id).and_then(|t| t["name"].as_str().map(str::to_string));
                    s.remove_tag(&id)?;
                    Ok(n)
                })?;
                self.sync.notify_change(&format!("Remove tag: {}", name.unwrap_or(id))).await;
                json(j!({ "success": true }))
            }
            "tag:assign" => {
                self.with_store(|s| s.assign_tag(&args.str(0)?, &args.str(1)?))?;
                self.sync.notify_change("Assign tag to feed").await;
                json(j!({ "success": true }))
            }
            "tag:unassign" => {
                self.with_store(|s| s.unassign_tag(&args.str(0)?, &args.str(1)?))?;
                self.sync.notify_change("Unassign tag from feed").await;
                json(j!({ "success": true }))
            }

            // Entries
            "entry:getByFeed" => json(self.with_store(|s| Ok(s.entries(&args.str(0)?)))?),
            "entry:markRead" | "entry:markUnread" => {
                let read = channel == "entry:markRead";
                self.with_store(|s| s.set_read(&args.str(0)?, &args.str(1)?, read))?;
                self.sync.notify_change(if read { "Mark entry read" } else { "Mark entry unread" }).await;
                json(j!({ "success": true }))
            }
            "entry:markAllRead" | "entry:markAllUnread" => {
                let read = channel == "entry:markAllRead";
                self.with_store(|s| s.set_all_read(&args.str(0)?, read))?;
                self.sync.notify_change(if read { "Mark all read" } else { "Mark all unread" }).await;
                json(j!({ "success": true }))
            }

            // Settings (in the synced repo; null before setup)
            "settings:get" => json(self.setting(&args.str(0)?)),
            "settings:set" => {
                let key = args.str(0)?;
                let value = args.value(1).clone();
                let saved = self.store.lock().unwrap().as_ref().map(|s| s.set_setting(&key, value.clone()));
                if let Some(r) = saved {
                    r?;
                }
                match key.as_str() {
                    "syncWaitTime" => self.sync.update_wait_time(parse_int(&value).filter(|n| *n > 0).unwrap_or(10)),
                    "pollInterval" => self.set_poll_interval(&value),
                    _ => {}
                }
                self.sync.notify_change(&format!("Update setting: {key}")).await;
                json(j!({ "success": true }))
            }

            "poller:pollNow" => {
                self.poll_once(app).await;
                json(j!({ "success": true }))
            }

            // Auto-sync engine
            "sync:getStatus" => json(self.sync.status(args.i64(0).map(|n| n.max(0) as u64))),
            "sync:getLog" => json(self.sync.full_log()),
            "sync:forcePush" => {
                self.sync.force_push().await;
                json(self.sync.status(None))
            }
            "sync:forcePull" => {
                let mut res = self.sync.force_pull().await;
                res["status"] = self.sync.status(None);
                json(res)
            }
            "sync:getConfig" => {
                let c = self.read_config();
                json(j!({
                    "dataDir": c.get("dataDir").filter(|v| truthy(v)).cloned().unwrap_or(Value::Null),
                    "remoteUrl": c.get("remoteUrl").filter(|v| truthy(v)).cloned().unwrap_or(Value::Null),
                }))
            }

            // Manual git operations (SyncModal)
            "git:getRemoteUrl" => match self.configured_dir() {
                Some(d) => json(self.sync.git.get_remote_url(&d).await),
                None => null(),
            },
            "git:setRemoteUrl" => {
                let dir = self.data_dir()?;
                let url = args.str(0)?;
                self.sync.git.set_remote_url(&dir, &url).await?;
                let mut c = self.read_config();
                c.insert("remoteUrl".into(), j!(url));
                self.write_config(&c)?;
                json(j!({ "success": true }))
            }
            "git:removeRemote" => {
                let dir = self.data_dir()?;
                let _ = self.sync.git.remove_remote(&dir).await;
                let mut c = self.read_config();
                c.insert("remoteUrl".into(), Value::Null);
                self.write_config(&c)?;
                json(j!({ "success": true }))
            }
            "git:getBranch" => match self.configured_dir() {
                Some(d) => json(self.sync.git.get_branch(&d).await),
                None => null(),
            },
            "git:getSyncStatus" => match self.configured_dir() {
                Some(d) => json(self.sync.git.sync_status(&d).await),
                None => json(SyncStatus::Error { message: "No data directory configured".into() }),
            },
            "git:pull" => {
                let r = self.sync.git.pull_merge(&self.data_dir()?).await;
                if !r.success {
                    return Err(anyhow!(r.error.unwrap_or_else(|| "Pull failed".into())));
                }
                json(r)
            }
            "git:pullRebase" => {
                let r = self.sync.git.sync_pull(&self.data_dir()?).await;
                if !r.success {
                    return Err(anyhow!(r.error.unwrap_or_else(|| "Pull failed".into())));
                }
                json(r)
            }
            "git:push" => {
                self.sync.force_push().await;
                json(j!({ "success": true }))
            }
            "git:pushUpstream" => {
                let r = self.sync.git.sync_push(&self.data_dir()?).await;
                if !r.success {
                    return Err(anyhow!(r.error.unwrap_or_else(|| "Push failed".into())));
                }
                json(r)
            }
            "git:resetToRemote" => {
                let dir = self.data_dir()?;
                self.sync.git.reset_to_remote(&dir, None).await?;
                json(j!({ "success": true }))
            }

            "help:open" => {
                self.host.open_secondary(app, "help", &HELP_WINDOW)?;
                json(true)
            }

            _ => self.host.route(app, window, channel, args).await,
        }
    }
}

/// `parseInt(value, 10)` for numbers and numeric strings.
fn parse_int(v: &Value) -> Option<u64> {
    match v {
        Value::Number(n) => n.as_f64().map(|f| f as u64),
        Value::String(s) => {
            let digits: String = s.trim().chars().take_while(|c| c.is_ascii_digit()).collect();
            digits.parse().ok()
        }
        _ => None,
    }
}

fn truthy(v: &Value) -> bool {
    match v {
        Value::Null => false,
        Value::Bool(b) => *b,
        Value::Number(n) => n.as_f64().is_some_and(|f| f != 0.0),
        Value::String(s) => !s.is_empty(),
        _ => true,
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
        product_name: "ThreadLiner",
        preload: PRELOAD,
        main_window: WindowSpec {
            page: "index.html",
            title: "ThreadLiner",
            width: 1200.0,
            height: 800.0,
            min_width: 800.0,
            min_height: 500.0,
        },
        prefs_defaults: j!({ "customTitlebar": false }),
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
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![ipc])
        .setup(move |app| {
            let state = Arc::new(App {
                host: host.clone(),
                store: Mutex::new(None),
                sync: SyncManager::new(("ThreadLiner", "threadliner@localhost")),
                poll_minutes: AtomicU64::new(DEFAULT_INTERVAL_MIN),
                poll_reset: Notify::new(),
                polling: AtomicBool::new(false),
            });
            app.manage(state.clone());

            if state.setup_complete() {
                let dir = state.configured_dir().unwrap();
                let handle = app.handle().clone();
                tauri::async_runtime::block_on(async {
                    if let Err(e) = state.init_data_and_sync(&handle, &dir).await {
                        eprintln!("[threadliner] init failed: {e}");
                    }
                });
            }

            host.create_main_window(app.handle())?;
            if !cfg!(debug_assertions) {
                let (h, a) = (host.clone(), app.handle().clone());
                tauri::async_runtime::spawn(async move {
                    h.updater.check(&h, &a).await;
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running ThreadLiner");
}
