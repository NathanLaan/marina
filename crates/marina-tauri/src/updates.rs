//! `update:*` channels. Electron used electron-updater; native Linux
//! packages (deb/rpm/Flatpak) are updated by the package manager, so this
//! only *checks* GitHub Releases and sends the user to the release page.
//! The renderer's state machine (idle → checking → available/unavailable/
//! error) is unchanged.

use std::sync::Mutex;

use anyhow::{anyhow, Result};
use serde::Deserialize;
use serde_json::{json as j, Value};
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

use crate::host::Host;
use crate::ipc::{json, Args, IpcResult};

#[derive(Deserialize)]
struct Release {
    tag_name: String,
    html_url: String,
    #[serde(default)]
    body: Option<String>,
    #[serde(default)]
    draft: bool,
}

pub struct Updater {
    /// GitHub `owner/repo` that publishes this app's releases, if any.
    repo: Option<&'static str>,
    state: Mutex<Value>,
    release_url: Mutex<Option<String>>,
}

fn parse_version(v: &str) -> Option<semver::Version> {
    semver::Version::parse(v.trim().trim_start_matches('v')).ok()
}

impl Updater {
    pub fn new(repo: Option<&'static str>) -> Self {
        Self { repo, state: Mutex::new(j!({ "state": "idle" })), release_url: Mutex::new(None) }
    }

    fn set(&self, host: &Host, app: &AppHandle, state: Value) {
        *self.state.lock().unwrap() = state.clone();
        host.send(app, "update:state", state);
    }

    async fn latest(repo: &str) -> Result<Release> {
        let client = reqwest::Client::builder()
            .user_agent(concat!("marina-updater/", env!("CARGO_PKG_VERSION")))
            .timeout(std::time::Duration::from_secs(15))
            .build()?;
        // Includes pre-releases (continuous builds), like allowPrerelease.
        let releases: Vec<Release> = client
            .get(format!("https://api.github.com/repos/{repo}/releases?per_page=10"))
            .send()
            .await?
            .error_for_status()?
            .json()
            .await?;
        releases.into_iter().find(|r| !r.draft).ok_or_else(|| anyhow!("No releases published"))
    }

    pub async fn check(&self, host: &Host, app: &AppHandle) -> bool {
        if cfg!(debug_assertions) {
            self.set(host, app, j!({ "state": "unavailable", "reason": "dev" }));
            return false;
        }
        let Some(repo) = self.repo else {
            self.set(host, app, j!({ "state": "unavailable" }));
            return false;
        };
        self.set(host, app, j!({ "state": "checking" }));
        match Self::latest(repo).await {
            Ok(rel) => {
                let current = parse_version(&app.package_info().version.to_string());
                let latest = parse_version(&rel.tag_name);
                let version = rel.tag_name.trim_start_matches('v').to_string();
                if matches!((&current, &latest), (Some(c), Some(l)) if l > c) {
                    *self.release_url.lock().unwrap() = Some(rel.html_url);
                    self.set(host, app, j!({ "state": "available", "version": version, "notes": rel.body }));
                } else {
                    self.set(host, app, j!({ "state": "unavailable", "version": version }));
                }
                true
            }
            Err(e) => {
                self.set(host, app, j!({ "state": "error", "error": e.to_string() }));
                false
            }
        }
    }

    pub async fn route(&self, host: &Host, app: &AppHandle, channel: &str, _args: &Args) -> Option<IpcResult> {
        Some(match channel {
            "update:getState" => json(self.state.lock().unwrap().clone()),
            "update:checkNow" => json(self.check(host, app).await),
            // No in-place install for system packages: open the release page.
            "update:downloadNow" | "update:installNow" => {
                let url = self.release_url.lock().unwrap().clone();
                match url {
                    Some(u) => json(app.opener().open_url(u, None::<&str>).is_ok()),
                    None => json(false),
                }
            }
            _ => return None,
        })
    }
}
