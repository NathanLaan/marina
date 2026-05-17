const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const {
  registerWindowHandlers,
  registerUIPrefsHandlers,
  registerRelaunchHandler,
  applyFrameFromPrefs,
} = require('@marina/desktop-ui/electron-host');

let mainWindow;
let uiPrefsApi;

function createWindow() {
  // Read the persisted prefs synchronously so `frame:` is set correctly at
  // construction time — that's the only moment Electron will honour it.
  const uiPrefs = uiPrefsApi.read();
  const opts = applyFrameFromPrefs(
    {
      width: 1100,
      height: 720,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        // sandbox defaults to true when contextIsolation + !nodeIntegration,
        // which restricts preload requires to a small Electron allowlist —
        // we need a full Node require to pull in @marina/desktop-ui/preload.
        sandbox: false,
      },
    },
    uiPrefs,
  );

  mainWindow = new BrowserWindow(opts);

  // Forward renderer console + uncaught errors to the terminal so a blank
  // playground is debuggable without manually opening DevTools.
  mainWindow.webContents.on('console-message', (event) => {
    const level = ['debug', 'log', 'warn', 'error'][event.level] || 'log';
    console.log(`[renderer ${level}] ${event.message}`);
  });
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('[renderer gone]', details);
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5252');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }
}

app.whenReady().then(() => {
  // Register prefs first so createWindow() can read them.
  uiPrefsApi = registerUIPrefsHandlers({
    prefsPath: path.join(app.getPath('userData'), 'playground-ui-prefs.json'),
    defaults: { customTitlebar: false },
  });
  registerWindowHandlers({ getWindow: () => mainWindow });

  if (process.env.NODE_ENV === 'development') {
    // app.relaunch() + app.exit(0) takes scripts/dev.js (and therefore Vite)
    // down with it, so in dev we do a soft restart: open a new BrowserWindow
    // that re-reads prefs through uiPrefsApi.read(), then close the old one.
    // Production builds use the library's standard registerRelaunchHandler.
    console.log('[playground] registering dev-mode soft-relaunch handler');
    ipcMain.handle('app:relaunch', () => {
      console.log('[playground] app:relaunch invoked — soft restarting');
      const old = mainWindow;
      createWindow();
      if (old && !old.isDestroyed()) old.close();
      console.log('[playground] new window created with prefs:', uiPrefsApi.read());
    });
  } else {
    registerRelaunchHandler();
  }

  ipcMain.handle('shell:openExternal', (_e, url) => shell.openExternal(url));
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
