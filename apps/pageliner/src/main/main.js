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
    defaults: { customTitlebar: false, sidebarVisible: true, statusBarVisible: true },
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
    return added;
  });

  ipcMain.handle('library:delete', (_event, id) => libraryService.deleteBook(id));

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
  ipcMain.handle('library:setState', (_event, id, patch) => libraryService.setState(id, patch));
}

app.whenReady().then(() => {
  // Default library location lives under userData. A user-chosen / git-synced
  // library folder is an optional later concern (Phase 5); userData keeps
  // Phase 1 immediately usable with no setup step.
  libraryService.init(path.join(app.getPath('userData'), 'library'));

  registerIpcHandlers();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
