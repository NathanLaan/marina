const { app, BrowserWindow, ipcMain, dialog, shell, Notification, powerMonitor } = require('electron');
const path = require('path');
const fs = require('fs');
const dataStore = require('./data-store');
const feedParser = require('./feed-parser');
const gitSync = require('./git-sync');
const syncManager = require('./sync-manager');
const feedPoller = require('./feed-poller');
const {
  registerWindowHandlers,
  registerUIPrefsHandlers,
} = require('@marina/desktop-ui/electron-host');
const { createSecondaryWindow } = require('@marina/desktop-ui/secondary-window');

// Set app name early so Linux WM_CLASS is correct (for dock icon in dev mode)
app.setName('ThreadLiner');

// Wayland + Vulkan is an incompatible combination in Chromium — GPU surfaces
// can't survive a screen-lock/unlock cycle, leaving a blank white screen.
// Disabling Vulkan lets Chromium fall back to OpenGL/GLES which handles
// Wayland surface lifecycle correctly.
//
// A deeper system suspend/resume (vs. a mere screen lock) tears down the GPU
// process's GL context entirely, and Chromium's compositor fails to re-create
// its surface on wake — the window comes back blank white with no UI and has
// to be killed. `render-process-gone` does not fire because the renderer is
// still alive; only its GPU surface is dead. Disabling GPU *compositing* keeps
// content GPU-rasterized but composites the final window frame on the CPU, so
// the surface no longer depends on a GL context that can't survive resume.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('disable-vulkan');
  app.commandLine.appendSwitch('disable-gpu-compositing');
}

let mainWindow;
let uiPrefsApi;

// --- Auto-updater ---

let autoUpdaterModule = null;
// Cached so the renderer can pick up the current update status when AboutModal
// mounts after a startup check has already fired its events.
let latestUpdateState = { state: 'idle' };

function getAutoUpdater() {
  if (autoUpdaterModule) return autoUpdaterModule;
  try {
    const { autoUpdater } = require('electron-updater');
    // User-driven: surface "Update available" before bytes move (matters on
    // metered connections). The renderer triggers downloadUpdate() explicitly.
    autoUpdater.autoDownload = false;
    // Continuous builds publish under the same `latest` channel as tagged
    // releases but with a SemVer pre-release token; without this, the
    // updater would skip them.
    autoUpdater.allowPrerelease = true;
    autoUpdaterModule = autoUpdater;
    return autoUpdater;
  } catch (err) {
    console.warn('electron-updater unavailable:', err.message);
    return null;
  }
}

function sendUpdateState(state) {
  latestUpdateState = state;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update:state', state);
  }
}

function initAutoUpdater() {
  // Only run in packaged builds — there's nothing to update against in dev.
  if (!app.isPackaged) return;
  const u = getAutoUpdater();
  if (!u) return;

  u.on('checking-for-update', () => sendUpdateState({ state: 'checking' }));
  u.on('update-available',    (i) => sendUpdateState({ state: 'available', version: i?.version, notes: i?.releaseNotes }));
  u.on('update-not-available',(i) => sendUpdateState({ state: 'unavailable', version: i?.version }));
  u.on('download-progress',   (p) => sendUpdateState({ state: 'downloading', percent: p?.percent || 0 }));
  u.on('update-downloaded',   (i) => sendUpdateState({ state: 'downloaded', version: i?.version }));
  u.on('error',               (err) => sendUpdateState({ state: 'error', error: err?.message || String(err) }));

  // Startup check drives the same state machine. The dedicated
  // checkForUpdatesAndNotify() native-notification path is intentionally not
  // used — the in-app About modal status block replaces it.
  u.checkForUpdates().catch((err) => sendUpdateState({ state: 'error', error: err?.message || String(err) }));
}

// --- App config (stored outside the git repo) ---

function getConfigPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(getConfigPath(), 'utf-8'));
  } catch {
    return {};
  }
}

function writeConfig(config) {
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
}

function isSetupComplete() {
  const config = readConfig();
  return !!(config.dataDir && fs.existsSync(config.dataDir));
}

// --- UI prefs path (loaded by the library helper in registerIpcHandlers) ---

function getUIPrefsPath() {
  return path.join(app.getPath('userData'), 'ui-preferences.json');
}

// --- Window ---

function createWindow() {
  const uiPrefs = uiPrefsApi.read();
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'),
    // frame can only be set at construction time — that's why the
    // customTitlebar toggle requires a restart.
    frame: !uiPrefs.customTitlebar,
    webPreferences: {
      // Bundled by `npm run bundle:preload` (esbuild). The bundle inlines
      // @marina/desktop-ui/preload, so the preload has no runtime require
      // of third-party packages and works in Electron's default sandbox.
      preload: path.join(__dirname, '../../dist/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // window:maximized-change broadcasts come from the library's
  // registerWindowHandlers via its app.on('browser-window-created') hook.

  // scripts/dev.js sets NODE_ENV=development when it spawns Electron after
  // Vite is ready; the renderer is then served from the dev server with HMR.
  // Anything else (npm run start, packaged builds) loads the built file.
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5251');
  } else {
    const indexPath = path.join(__dirname, '../../dist/renderer/index.html');
    mainWindow.loadFile(indexPath);
  }
}

// --- IPC Handlers ---

function registerIpcHandlers() {
  // Setup handlers
  ipcMain.handle('setup:isComplete', () => {
    return isSetupComplete();
  });

  ipcMain.handle('setup:openFolderDialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Data Folder',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('setup:init', async (_event, dataDir, remoteUrl) => {
    // Check if directory exists, if it's already a git repo, etc.
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const isRepo = await gitSync.isGitRepo(dataDir);

    if (remoteUrl && !isRepo) {
      // Check if directory is empty
      const contents = fs.readdirSync(dataDir);
      if (contents.length === 0) {
        // Clone into this directory
        // We need to clone into an empty dir — remove it first, then clone creates it
        fs.rmSync(dataDir, { recursive: true });
        await gitSync.cloneRepo(remoteUrl, dataDir);
      } else {
        // Non-empty, non-git directory — init and add remote
        await gitSync.initRepo(dataDir, remoteUrl);
      }
    } else if (!isRepo) {
      // Local only — just init
      await gitSync.initRepo(dataDir, null);
    }

    // Save config
    writeConfig({ dataDir, remoteUrl: remoteUrl || null });

    // Initialize data store and sync
    await initDataAndSync(dataDir);

    return { success: true };
  });

  // Feed handlers
  ipcMain.handle('feed:getAll', () => {
    return dataStore.getAllFeeds();
  });

  ipcMain.handle('feed:add', async (_event, url) => {
    const parsed = await feedParser.fetchAndParse(url);
    const feed = dataStore.addFeed(
      parsed.title || url,
      url,
      parsed.link || null,
      parsed.description || null
    );
    const entries = feedParser.normalizeEntries(parsed.items || []);
    dataStore.insertEntries(feed.id, entries);

    await syncManager.notifyChange('Add feed: ' + (parsed.title || url));

    return { ...feed, unread_count: entries.length };
  });

  ipcMain.handle('feed:edit', async (_event, id, data) => {
    const feed = dataStore.editFeed(id, data);
    await syncManager.notifyChange('Edit feed: ' + feed.title);
    return feed;
  });

  ipcMain.handle('feed:remove', async (_event, id) => {
    const feed = dataStore.getFeedById(id);
    dataStore.removeFeed(id);
    await syncManager.notifyChange('Remove feed: ' + (feed ? feed.title : id));
    return { success: true };
  });

  ipcMain.handle('feed:refresh', async (_event, id) => {
    const feed = dataStore.getFeedById(id);
    if (!feed) throw new Error('Feed not found');
    const parsed = await feedParser.fetchAndParse(feed.url);
    const entries = feedParser.normalizeEntries(parsed.items || []);
    const inserted = dataStore.insertEntries(feed.id, entries);

    if (inserted > 0) {
      await syncManager.notifyChange('Refresh feed: ' + feed.title);
    }

    return { inserted };
  });

  // Tag handlers
  ipcMain.handle('tag:getAll', () => {
    return dataStore.getAllTags();
  });

  ipcMain.handle('tag:add', async (_event, name) => {
    const tag = dataStore.addTag(name);
    await syncManager.notifyChange('Add tag: ' + tag.name);
    return tag;
  });

  ipcMain.handle('tag:edit', async (_event, id, data) => {
    const tag = dataStore.editTag(id, data);
    await syncManager.notifyChange('Edit tag: ' + tag.name);
    return tag;
  });

  ipcMain.handle('tag:remove', async (_event, id) => {
    const tag = dataStore.getTagById(id);
    dataStore.removeTag(id);
    await syncManager.notifyChange('Remove tag: ' + (tag ? tag.name : id));
    return { success: true };
  });

  ipcMain.handle('tag:assign', async (_event, feedId, tagId) => {
    dataStore.assignTagToFeed(feedId, tagId);
    await syncManager.notifyChange('Assign tag to feed');
    return { success: true };
  });

  ipcMain.handle('tag:unassign', async (_event, feedId, tagId) => {
    dataStore.unassignTagFromFeed(feedId, tagId);
    await syncManager.notifyChange('Unassign tag from feed');
    return { success: true };
  });

  // Entry handlers
  ipcMain.handle('entry:getByFeed', (_event, feedId) => {
    return dataStore.getEntriesByFeed(feedId);
  });

  ipcMain.handle('entry:markRead', async (_event, entryId, feedId) => {
    dataStore.markEntryRead(entryId, feedId);
    await syncManager.notifyChange('Mark entry read');
    return { success: true };
  });

  ipcMain.handle('entry:markUnread', async (_event, entryId, feedId) => {
    dataStore.markEntryUnread(entryId, feedId);
    await syncManager.notifyChange('Mark entry unread');
    return { success: true };
  });

  ipcMain.handle('entry:markAllRead', async (_event, feedId) => {
    dataStore.markAllRead(feedId);
    await syncManager.notifyChange('Mark all read');
    return { success: true };
  });

  ipcMain.handle('entry:markAllUnread', async (_event, feedId) => {
    dataStore.markAllUnread(feedId);
    await syncManager.notifyChange('Mark all unread');
    return { success: true };
  });

  // Settings handlers
  ipcMain.handle('settings:get', (_event, key) => {
    return dataStore.getSetting(key);
  });

  ipcMain.handle('settings:set', async (_event, key, value) => {
    dataStore.setSetting(key, value);
    if (key === 'syncWaitTime') {
      syncManager.updateWaitTime(parseInt(value, 10) || 10);
    } else if (key === 'pollInterval') {
      feedPoller.setIntervalMinutes(value);
    }
    await syncManager.notifyChange('Update setting: ' + key);
    return { success: true };
  });

  // RSS poller: manual trigger (used for "Refresh all").
  ipcMain.handle('poller:pollNow', async () => {
    await feedPoller.pollOnce();
    return { success: true };
  });

  // Sync handlers
  ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
  });

  ipcMain.handle('sync:getStatus', (_event, sinceLogId) => {
    return syncManager.getStatus(sinceLogId);
  });

  ipcMain.handle('sync:getLog', () => {
    return syncManager.getFullLog();
  });

  ipcMain.handle('sync:forcePush', async () => {
    await syncManager.forcePush();
    return syncManager.getStatus();
  });

  ipcMain.handle('sync:forcePull', async () => {
    const result = await syncManager.forcePull();
    return { ...result, status: syncManager.getStatus() };
  });

  ipcMain.handle('sync:getConfig', () => {
    const config = readConfig();
    return {
      dataDir: config.dataDir || null,
      remoteUrl: config.remoteUrl || null,
    };
  });

  // Window control, UI-prefs persistence, and the window:maximized-change
  // broadcast all come from the shared library.
  registerWindowHandlers({ getWindow: () => mainWindow });
  uiPrefsApi = registerUIPrefsHandlers({
    prefsPath: getUIPrefsPath(),
    defaults: { customTitlebar: false },
  });

  // The library's registerRelaunchHandler does `app.relaunch(); app.exit(0)`,
  // which in dev tears down scripts/dev.js (and therefore Vite) along with
  // Electron. Do a soft restart instead: open a new window that re-reads
  // prefs through uiPrefsApi.read(), then close the old one. Works the same
  // way in production builds — there's no orchestrator to confuse.
  ipcMain.handle('app:relaunch', () => {
    const old = mainWindow;
    createWindow();
    if (old && !old.isDestroyed()) old.close();
  });

  // Git operations (manual, NoteLiner-style sync UI).
  // These run alongside the auto-sync engine in sync-manager; in practice the
  // user can only invoke them while a modal is open, and races would at worst
  // surface as a transient error.
  function getDataDir() {
    const config = readConfig();
    return config.dataDir || null;
  }

  ipcMain.handle('git:getRemoteUrl', () => {
    const dir = getDataDir();
    if (!dir) return null;
    return gitSync.getRemoteUrl(dir);
  });

  ipcMain.handle('git:setRemoteUrl', async (_event, url) => {
    const dir = getDataDir();
    if (!dir) throw new Error('No data directory configured');
    await gitSync.setRemoteUrl(dir, url);
    // Mirror to config.json so getSyncConfig still returns it.
    const config = readConfig();
    writeConfig({ ...config, remoteUrl: url });
    return { success: true };
  });

  ipcMain.handle('git:removeRemote', async () => {
    const dir = getDataDir();
    if (!dir) throw new Error('No data directory configured');
    await gitSync.removeRemote(dir);
    const config = readConfig();
    writeConfig({ ...config, remoteUrl: null });
    return { success: true };
  });

  ipcMain.handle('git:getBranch', () => {
    const dir = getDataDir();
    if (!dir) return null;
    return gitSync.getBranch(dir);
  });

  ipcMain.handle('git:getSyncStatus', () => {
    const dir = getDataDir();
    if (!dir) return { status: 'error', message: 'No data directory configured' };
    return gitSync.getSyncStatus(dir);
  });

  // Plain merge-style pull (counterpart to git:pullRebase below).
  ipcMain.handle('git:pull', async () => {
    const dir = getDataDir();
    if (!dir) throw new Error('No data directory configured');
    const result = await gitSync.pullMerge(dir);
    if (!result.success) throw new Error(result.error || 'Pull failed');
    return result;
  });

  // Rebase-style pull — same engine that auto-sync uses internally.
  ipcMain.handle('git:pullRebase', async () => {
    const dir = getDataDir();
    if (!dir) throw new Error('No data directory configured');
    const result = await gitSync.pull(dir);
    if (!result.success) throw new Error(result.error || 'Pull failed');
    return result;
  });

  // Push routes through syncManager.forcePush so it serializes with the
  // background commit/push queue — avoids racing the auto-sync timer.
  ipcMain.handle('git:push', async () => {
    await syncManager.forcePush();
    return { success: true };
  });

  ipcMain.handle('git:pushUpstream', async () => {
    const dir = getDataDir();
    if (!dir) throw new Error('No data directory configured');
    const result = await gitSync.push(dir);
    if (!result.success) throw new Error(result.error || 'Push failed');
    return result;
  });

  ipcMain.handle('git:resetToRemote', async () => {
    const dir = getDataDir();
    if (!dir) throw new Error('No data directory configured');
    const branch = await gitSync.getBranch(dir);
    return gitSync.resetToRemote(dir, branch);
  });

  // Shell: route renderer-driven external links through Electron's shell so
  // they open in the user's browser instead of inside the Electron window.
  ipcMain.handle('shell:openExternal', (_event, url) => shell.openExternal(url));

  // --- Help window ---

  function createHelpWindow() {
    return createSecondaryWindow({
      id: 'help',
      title: 'ThreadLiner Help',
      icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'),
      parent: mainWindow,
      preload: path.join(__dirname, '..', '..', 'dist', 'preload.cjs'),
      devUrl: 'http://localhost:5251/help.html',
      prodFile: path.join(__dirname, '..', '..', 'dist', 'renderer', 'help.html'),
      isDev: process.env.NODE_ENV === 'development',
      width: 1000, height: 720, minWidth: 560, minHeight: 360,
    });
  }

  ipcMain.handle('help:open', () => {
    createHelpWindow();
    return true;
  });

  // --- Auto-update IPC ---

  ipcMain.handle('update:getState', () => latestUpdateState);

  ipcMain.handle('update:checkNow', async () => {
    if (!app.isPackaged) {
      sendUpdateState({ state: 'unavailable', reason: 'dev' });
      return false;
    }
    const u = getAutoUpdater();
    if (!u) {
      sendUpdateState({ state: 'error', error: 'Updater not available in this build' });
      return false;
    }
    try {
      await u.checkForUpdates();
      return true;
    } catch (err) {
      sendUpdateState({ state: 'error', error: err?.message || String(err) });
      return false;
    }
  });

  ipcMain.handle('update:downloadNow', async () => {
    const u = getAutoUpdater();
    if (!u) return false;
    try {
      await u.downloadUpdate();
      return true;
    } catch (err) {
      sendUpdateState({ state: 'error', error: err?.message || String(err) });
      return false;
    }
  });

  ipcMain.handle('update:installNow', () => {
    const u = getAutoUpdater();
    if (!u) return false;
    // quitAndInstall() exits the process — no further IPC will be served.
    u.quitAndInstall();
    return true;
  });
}

// --- Startup ---

async function initDataAndSync(dataDir) {
  // Ensure git user identity is configured (handles repos created before this fix)
  await gitSync.configureUser(dataDir);

  dataStore.init(dataDir);

  const waitTime = dataStore.getSetting('syncWaitTime');
  syncManager.init(dataDir, waitTime ? parseInt(waitTime, 10) : 10);

  // Commit any uncommitted data files (e.g., from initial setup)
  await syncManager.notifyChange('Initialize data store');

  initFeedPoller();
}

function initFeedPoller() {
  const stored = dataStore.getSetting('pollInterval');
  feedPoller.setIntervalMinutes(stored != null ? stored : feedPoller.DEFAULT_INTERVAL_MIN);

  feedPoller.addListener(async (event) => {
    if (event.type !== 'poll-updated') return;

    // Persist to git on the same debounce as user-driven changes.
    await syncManager.notifyChange(
      `Poll: ${event.totalInserted} new ${event.totalInserted === 1 ? 'entry' : 'entries'}`
    );

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('feeds:updated', {
        totalInserted: event.totalInserted,
        updatedFeeds: event.updatedFeeds,
      });
    }

    const enabled = dataStore.getSetting('pollNotificationsEnabled');
    const notificationsOn = enabled === null || enabled === undefined ? true : !!enabled;
    if (notificationsOn && Notification.isSupported()) {
      const count = event.totalInserted;
      const feedSummary =
        event.updatedFeeds.length === 1
          ? event.updatedFeeds[0].title
          : `${event.updatedFeeds.length} feeds`;
      new Notification({
        title: 'ThreadLiner',
        body: `${count} new ${count === 1 ? 'entry' : 'entries'} in ${feedSummary}`,
        silent: false,
      }).show();
    }
  });

  feedPoller.start();
}

app.whenReady().then(async () => {
  registerIpcHandlers();

  if (isSetupComplete()) {
    const config = readConfig();
    await initDataAndSync(config.dataDir);
  }

  createWindow();
  initAutoUpdater();

  // On Linux, a system suspend/resume (e.g. closing and reopening a laptop lid)
  // can leave the window's native compositor surface stale, so it wakes up as a
  // blank white window with no UI. Disabling GPU compositing alone doesn't
  // recover it on every WM. Forcing a hide/show cycle on resume makes Chromium
  // tear down and re-create the native surface, repainting a fresh frame —
  // without a content reload, so in-renderer state survives. A short delay lets
  // the compositor settle after wake before we nudge it.
  //
  // The hide/show re-creates the surface but can leave it mid-relayout, with
  // visual glitches that only clear once the window is manually resized.
  // webContents.invalidate() schedules a full repaint of the window directly,
  // clearing those glitches without the flicker or maximized-state juggling a
  // resize nudge would require.
  if (process.platform === 'linux') {
    powerMonitor.on('resume', () => {
      setTimeout(() => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        const wasMaximized = mainWindow.isMaximized();
        mainWindow.hide();
        mainWindow.show();
        if (wasMaximized && !mainWindow.isMaximized()) mainWindow.maximize();
        mainWindow.webContents.invalidate();
      }, 300);
    });
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  feedPoller.destroy();
  syncManager.destroy();
});
