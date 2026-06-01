const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const {
  registerWindowHandlers,
  registerUIPrefsHandlers,
  registerRelaunchHandler,
  applyFrameFromPrefs,
} = require('@marina/desktop-ui/electron-host');
const { LibraryService } = require('./library-service');
const gitSync = require('./git-sync');

// Set app name early so Linux WM_CLASS is correct (for dock icon in dev mode).
app.setName('PageLiner');

const libraryService = new LibraryService();

// Same Wayland/Vulkan + suspend-resume workaround the other apps use on Linux:
// disabling Vulkan and GPU compositing avoids blank-white-window after a
// screen lock / suspend cycle. Safe no-op elsewhere.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('disable-vulkan');
  app.commandLine.appendSwitch('disable-gpu-compositing');
}

let mainWindow;
let uiPrefsApi;

function getUIPrefsPath() {
  return path.join(app.getPath('userData'), 'ui-preferences.json');
}

function createWindow() {
  // Read persisted prefs synchronously so `frame:` is correct at construction
  // time — the only moment Electron honours it (hence the titlebar restart).
  const uiPrefs = uiPrefsApi.read();
  const opts = applyFrameFromPrefs(
    {
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 500,
      icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'),
      webPreferences: {
        // Bundled by `npm run bundle:preload` (esbuild). The bundle inlines
        // @marina/desktop-ui/preload so the preload has no runtime require of
        // third-party packages and works in Electron's default sandbox.
        preload: path.join(__dirname, '..', '..', 'dist', 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    },
    uiPrefs,
  );

  mainWindow = new BrowserWindow(opts);

  // In dev, surface renderer warnings/errors + crashes in the terminal so a
  // blank window is debuggable without manually opening DevTools.
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.on('console-message', (e) => {
      if (e.level >= 2) console.log(`[renderer ${e.level}] ${e.message}`);
    });
    mainWindow.webContents.on('render-process-gone', (_e, d) => console.error('[renderer gone]', d));
  }

  // scripts/dev.js sets NODE_ENV=development after Vite is ready; the renderer
  // is then served from the dev server with HMR. Anything else (npm run start,
  // packaged builds) loads the built file.
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5253');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'renderer', 'index.html'));
  }
}

function registerIpcHandlers() {
  // Window control + UI-prefs persistence + the window:maximized-change
  // broadcast all come from the shared library.
  registerWindowHandlers({ getWindow: () => mainWindow });
  uiPrefsApi = registerUIPrefsHandlers({
    prefsPath: getUIPrefsPath(),
    defaults: { customTitlebar: false, sidebarVisible: true, statusBarVisible: true, gitSyncEnabled: false },
  });

  // The library's registerRelaunchHandler does `app.relaunch(); app.exit(0)`,
  // which in dev tears down scripts/dev.js (and therefore Vite). Do a soft
  // restart in dev instead: open a new window that re-reads prefs, then close
  // the old one. Production uses the library's standard handler.
  if (process.env.NODE_ENV === 'development') {
    ipcMain.handle('app:relaunch', () => {
      const old = mainWindow;
      createWindow();
      if (old && !old.isDestroyed()) old.close();
    });
  } else {
    registerRelaunchHandler();
  }

  ipcMain.handle('app:getVersion', () => app.getVersion());

  // Route renderer-driven external links through the OS browser.
  ipcMain.handle('shell:openExternal', (_event, url) => shell.openExternal(url));

  // --- Library ---

  ipcMain.handle('library:list', () => libraryService.listBooks());

  // Open a file picker, then copy + index the chosen document(s). Returns the
  // newly-added entries (empty array if cancelled).
  ipcMain.handle('library:import', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Books',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'E-Books & Documents', extensions: ['epub', 'pdf'] },
        { name: 'EPUB', extensions: ['epub'] },
        { name: 'PDF', extensions: ['pdf'] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) return [];
    const added = [];
    for (const filePath of result.filePaths) {
      try { added.push(await libraryService.addBook(filePath)); }
      catch (err) { console.error('[pageliner] import failed:', filePath, err.message); }
    }
    if (added.length) scheduleSync();
    return added;
  });

  ipcMain.handle('library:delete', (_event, id) => {
    const res = libraryService.deleteBook(id);
    scheduleSync();
    return res;
  });

  // Raw document bytes for the in-renderer readers (pdf.js / epub.js). Returns
  // a Buffer, which arrives in the renderer as a Uint8Array. Null if missing.
  ipcMain.handle('library:getBookData', (_event, id) => {
    const p = libraryService.bookFilePath(id);
    if (!p || !fs.existsSync(p)) return null;
    try { return fs.readFileSync(p); } catch { return null; }
  });

  // Cover image as a data URL — simplest way to render on-disk covers in the
  // renderer without a custom protocol. Fine for typical library sizes.
  ipcMain.handle('library:coverDataUrl', (_event, id) => {
    const p = libraryService.coverPath(id);
    if (!p || !fs.existsSync(p)) return null;
    try {
      const ext = path.extname(p).slice(1).toLowerCase();
      const mime = ext === 'jpg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
      return `data:${mime};base64,${fs.readFileSync(p).toString('base64')}`;
    } catch {
      return null;
    }
  });

  // Per-book reading state — wired now so the readers (Phase 2/3) can persist
  // position/bookmarks against a settled storage shape.
  ipcMain.handle('library:getState', (_event, id) => libraryService.getState(id));
  ipcMain.handle('library:setState', (_event, id, patch) => {
    const res = libraryService.setState(id, patch);
    scheduleSync(); // reading position / annotations changed
    return res;
  });

  // --- Git sync (opt-in; mirrors the ThreadLiner model) ---

  ipcMain.handle('git:getInfo', async () => {
    const dir = libraryService.libraryDir;
    const enabled = isSyncEnabled();
    const gitInstalled = await gitSync.isGitInstalled();
    let repo = false, remoteUrl = null, branch = null;
    if (gitInstalled && dir && await gitSync.isGitRepo(dir)) {
      repo = true;
      remoteUrl = await gitSync.getRemoteUrl(dir);
      branch = await gitSync.getBranch(dir);
    }
    return { enabled, gitInstalled, repo, remoteUrl, branch, libraryDir: dir };
  });

  // Live ahead/behind vs. the upstream (network fetch — only on demand).
  ipcMain.handle('git:getStatus', async () => {
    const dir = libraryService.libraryDir;
    if (!dir || !(await gitSync.isGitRepo(dir))) return { status: 'no-repo' };
    return gitSync.getSyncStatus(dir);
  });

  // Turn sync on/off. Enabling initialises the repo + .gitignore (blobs stay
  // local) and makes an initial commit. The gitSyncEnabled pref itself is owned
  // by the renderer (setUIPrefs); this just does the git-side work.
  ipcMain.handle('git:enable', async () => {
    try { await ensureSyncRepo(); return { success: true }; }
    catch (err) { return { error: err.message }; }
  });

  ipcMain.handle('git:setRemote', async (_event, url) => {
    const dir = libraryService.libraryDir;
    try {
      if (!(await gitSync.isGitRepo(dir))) await ensureSyncRepo();
      if (url) await gitSync.setRemoteUrl(dir, url);
      else await gitSync.removeRemote(dir);
      return { success: true };
    } catch (err) { return { error: err.message }; }
  });

  // Manual full sync: commit local changes, rebase-pull, push. Returns result + status.
  ipcMain.handle('git:syncNow', async () => {
    const dir = libraryService.libraryDir;
    if (!dir || !(await gitSync.isGitRepo(dir))) return { error: 'Sync is not set up.' };
    try {
      await gitSync.configureUser(dir);
      await gitSync.commitAll(dir, 'Sync library');
      const pulled = await gitSync.pull(dir);
      if (!pulled.success) return { error: `Pull failed: ${pulled.error}`, status: await gitSync.getSyncStatus(dir) };
      const pushed = await gitSync.push(dir);
      if (!pushed.success) return { error: `Push failed: ${pushed.error}`, status: await gitSync.getSyncStatus(dir) };
      return { success: true, status: await gitSync.getSyncStatus(dir) };
    } catch (err) { return { error: err.message }; }
  });
}

// --- Sync controller ---------------------------------------------------

function isSyncEnabled() {
  try { return !!uiPrefsApi?.read?.().gitSyncEnabled; } catch { return false; }
}

function writeGitignore(dir) {
  const p = path.join(dir, '.gitignore');
  const content = [
    '# PageLiner sync: the library index + reading state (positions, bookmarks,',
    '# highlights) are versioned; large book blobs and derived covers stay local.',
    'books/',
    'covers/',
    '*.tmp',
    '',
  ].join('\n');
  try { fs.writeFileSync(p, content, 'utf-8'); } catch { /* non-critical */ }
}

// Idempotent: initialise the repo if needed, ensure identity + .gitignore,
// and make a commit so there's a branch to push.
async function ensureSyncRepo() {
  const dir = libraryService.libraryDir;
  if (!dir) throw new Error('Library not initialised');
  if (!(await gitSync.isGitInstalled())) throw new Error('Git is not installed or not on PATH.');
  if (!(await gitSync.isGitRepo(dir))) await gitSync.initRepo(dir, null);
  else await gitSync.configureUser(dir);
  writeGitignore(dir);
  await gitSync.commitAll(dir, 'Configure PageLiner sync');
}

// Debounced commit + push on library changes. Auto-sync intentionally does NOT
// pull — that's reserved for the explicit "Sync Now" to avoid surprise rebases
// mid-session. No-op unless sync is enabled.
let syncTimer = null;
function scheduleSync() {
  if (!isSyncEnabled()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    const dir = libraryService.libraryDir;
    try {
      const changed = await gitSync.commitAll(dir, 'Update library');
      if (changed) await gitSync.push(dir);
    } catch (err) {
      console.error('[pageliner] auto-sync failed:', err.message);
    }
  }, 8000);
}

app.whenReady().then(() => {
  // Default library location lives under userData. A user-chosen / git-synced
  // library folder is an optional later concern (Phase 5); userData keeps
  // Phase 1 immediately usable with no setup step.
  libraryService.init(path.join(app.getPath('userData'), 'library'));

  registerIpcHandlers();

  // If sync was left enabled, make sure the repo/identity/.gitignore are intact.
  if (isSyncEnabled()) {
    ensureSyncRepo().catch((err) => console.error('[pageliner] sync init failed:', err.message));
  }

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
