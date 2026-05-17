// Preload-side counterparts to ../electron-host/. Each factory returns an
// object you can merge into your `contextBridge.exposeInMainWorld('api', {...})`
// payload — that way the bindings live alongside whatever app-specific
// methods the consumer also exposes.
//
// IMPORTANT: requires `webPreferences.sandbox: false` on the BrowserWindow.
// In modern Electron, sandbox defaults to `true` whenever
// `contextIsolation: true` + `nodeIntegration: false`, and a sandboxed
// preload's require() is restricted to a small allowlist (electron, events,
// timers, url) — third-party packages like this one won't resolve there.
// Explicit `sandbox: false` opts back into full Node require resolution.
//
// Usage in an app's preload.js:
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
  };
}

module.exports = {
  exposeWindowApi,
  exposeUIPrefsApi,
};
