// Preload-side counterparts to ../electron-host/. Each factory returns an
// object you can merge into your `contextBridge.exposeInMainWorld('api', {...})`
// payload — that way the bindings live alongside whatever app-specific
// methods the consumer also exposes.
//
// SANDBOX NOTE: a sandboxed preload (Electron's default when
// `contextIsolation: true` + `nodeIntegration: false`) can only require()
// from a small allowlist (electron, events, timers, url). Plain
// `require('@marina/desktop-ui/preload')` fails there. Two ways to consume
// this module safely:
//
//   1. (Recommended) Bundle your preload — esbuild, electron-vite, or any
//      bundler that inlines third-party requires into a single file. The
//      Marina monorepo's apps and playground use esbuild via a
//      `bundle:preload` npm script; their main.js points at the bundled
//      output and the default sandbox stays on.
//
//   2. Set `webPreferences.sandbox: false` on every BrowserWindow that
//      loads a preload using this module. Simpler, but disables Chromium's
//      sandbox for that renderer process. Use for prototyping or when the
//      renderer can't run untrusted content.
//
// Usage in an app's preload.js (before bundling):
//
//   const { contextBridge, ipcRenderer } = require('electron');
//   const { exposeWindowApi, exposeUIPrefsApi }
//     = require('@marina/desktop-ui/preload');
//
//   contextBridge.exposeInMainWorld('api', {
//     ...exposeWindowApi(ipcRenderer),
//     ...exposeUIPrefsApi(ipcRenderer),
//     // ...app-specific methods
//   });

function exposeWindowApi(ipcRenderer) {
  return {
    windowMinimize:    () => ipcRenderer.invoke('window:minimize'),
    windowMaximize:    () => ipcRenderer.invoke('window:maximize'),
    windowClose:       () => ipcRenderer.invoke('window:close'),
    windowIsMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    onWindowMaximizedChange: (cb) => {
      const handler = (_e, v) => cb(v);
      ipcRenderer.on('window:maximized-change', handler);
      return () => ipcRenderer.removeListener('window:maximized-change', handler);
    },
    relaunchApp: () => ipcRenderer.invoke('app:relaunch'),
  };
}

function exposeUIPrefsApi(ipcRenderer) {
  return {
    getUIPrefs: () => ipcRenderer.invoke('ui:getPrefs'),
    setUIPrefs: (p) => ipcRenderer.invoke('ui:setPrefs', p),
    onSpellCheckChanged: (cb) => {
      const handler = (_e, v) => cb(v);
      ipcRenderer.on('ui:spellcheck-changed', handler);
      return () => ipcRenderer.removeListener('ui:spellcheck-changed', handler);
    },
  };
}

module.exports = {
  exposeWindowApi,
  exposeUIPrefsApi,
};
