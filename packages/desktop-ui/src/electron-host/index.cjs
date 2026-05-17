// Electron main-process helpers. Each function registers a slice of the
// IPC surface that the matching preload exposures (see ../preload/) and
// renderer components (TitleBar, Settings primitives) call into.
//
// Usage in an app's main.js:
//
//   const { registerWindowHandlers, registerUIPrefsHandlers,
//           registerRelaunchHandler, applyFrameFromPrefs }
//     = require('@marina/desktop-ui/electron-host');
//
//   const uiPrefs = readPrefsSync(); // app picks where this lives
//   const opts = applyFrameFromPrefs({ width: 1200, height: 800 }, uiPrefs);
//   const win = new BrowserWindow(opts);
//
//   registerWindowHandlers({ getWindow: () => win });
//   registerUIPrefsHandlers({ prefsPath, defaults: {...} });
//   registerRelaunchHandler();

const { app, ipcMain } = require('electron');
const fs = require('fs');

function registerWindowHandlers({ getWindow }) {
  ipcMain.handle('window:minimize', () => getWindow()?.minimize());
  ipcMain.handle('window:maximize', () => {
    const win = getWindow();
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.handle('window:close', () => getWindow()?.close());
  ipcMain.handle('window:isMaximized', () => !!getWindow()?.isMaximized());

  // Broadcast max/restore changes so the renderer can keep the icon in sync.
  // This wires onto whatever window getWindow() returns at the moment a new
  // BrowserWindow is created, which is the standard hook point.
  app.on('browser-window-created', (_e, win) => {
    win.on('maximize',   () => win.webContents.send('window:maximized-change', true));
    win.on('unmaximize', () => win.webContents.send('window:maximized-change', false));
  });
}

function registerUIPrefsHandlers({ prefsPath, defaults = {} }) {
  function load() {
    try {
      const raw = JSON.parse(fs.readFileSync(prefsPath, 'utf-8'));
      return { ...defaults, ...raw };
    } catch {
      return { ...defaults };
    }
  }
  function save(next) {
    fs.writeFileSync(prefsPath, JSON.stringify(next, null, 2), 'utf-8');
  }

  let prefs = load();

  ipcMain.handle('ui:getPrefs', () => prefs);
  ipcMain.handle('ui:setPrefs', (_e, patch) => {
    prefs = { ...prefs, ...(patch || {}) };
    save(prefs);
    return prefs;
  });

  return {
    read: () => prefs,
    reload: () => { prefs = load(); return prefs; },
  };
}

function registerRelaunchHandler() {
  ipcMain.handle('app:relaunch', () => {
    app.relaunch();
    app.exit(0);
  });
}

// BrowserWindow construction-time helper. `frame` can only be set at
// construction, so consumers must read prefs synchronously before calling
// `new BrowserWindow(...)`.
function applyFrameFromPrefs(opts, uiPrefs) {
  return { ...opts, frame: !uiPrefs?.customTitlebar };
}

module.exports = {
  registerWindowHandlers,
  registerUIPrefsHandlers,
  registerRelaunchHandler,
  applyFrameFromPrefs,
};
