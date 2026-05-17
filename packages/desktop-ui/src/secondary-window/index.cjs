// Helper for opening a second non-modal BrowserWindow with shared chrome —
// dev/prod URL switching, sandbox-compatible webPreferences, and a
// singleton "focus if open, otherwise create" registry keyed by `id`.
//
// Useful for help windows, preferences-as-window, scratchpads — any
// content that's a sibling of the main window rather than a modal.
//
// Usage in an app's main.js:
//
//   const { createSecondaryWindow } = require('@marina/desktop-ui/secondary-window');
//
//   ipcMain.handle('help:open', () => {
//     return createSecondaryWindow({
//       id: 'help',
//       title: 'MyApp Help',
//       parent: mainWindow,
//       preload: path.join(__dirname, '..', '..', 'dist', 'preload.cjs'),
//       devUrl:  'http://localhost:5250/help.html',
//       prodFile: path.join(__dirname, '..', '..', 'dist', 'help.html'),
//       isDev:   process.env.NODE_ENV === 'development',
//       width: 1000, height: 720, minWidth: 560, minHeight: 360,
//     });
//   });

const { BrowserWindow } = require('electron');

// Singleton registry by id. Allows multiple distinct secondary windows
// (e.g. 'help' and 'preferences') to coexist while making each individual
// one focus-if-open.
const windows = new Map();

function createSecondaryWindow(opts) {
  const {
    id,
    title,
    preload,
    devUrl,
    prodFile,
    isDev = false,
    parent,
    width = 1000,
    height = 720,
    minWidth = 480,
    minHeight = 320,
    frame = true,
    autoHideMenuBar = true,
    icon,
    onCreate,
  } = opts || {};

  if (!id) throw new Error('createSecondaryWindow: id is required');
  if (!preload) throw new Error('createSecondaryWindow: preload path is required');

  const existing = windows.get(id);
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore();
    existing.focus();
    return existing;
  }

  const win = new BrowserWindow({
    width, height, minWidth, minHeight,
    title,
    icon,
    parent,
    modal: false,
    autoHideMenuBar,
    frame,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setMenu(null);

  if (isDev && devUrl) {
    win.loadURL(devUrl);
  } else if (prodFile) {
    win.loadFile(prodFile);
  } else {
    throw new Error('createSecondaryWindow: provide devUrl (with isDev:true) or prodFile');
  }

  win.on('closed', () => {
    if (windows.get(id) === win) windows.delete(id);
  });

  windows.set(id, win);

  if (typeof onCreate === 'function') {
    try { onCreate(win); } catch { /* swallow — don't block window creation */ }
  }

  return win;
}

function getSecondaryWindow(id) {
  const win = windows.get(id);
  return (win && !win.isDestroyed()) ? win : null;
}

function closeSecondaryWindow(id) {
  const win = windows.get(id);
  if (win && !win.isDestroyed()) win.close();
}

module.exports = {
  createSecondaryWindow,
  getSecondaryWindow,
  closeSecondaryWindow,
};
