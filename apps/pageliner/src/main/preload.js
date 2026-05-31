const { contextBridge, ipcRenderer } = require('electron');
const { exposeWindowApi, exposeUIPrefsApi } = require('@marina/desktop-ui/preload');

contextBridge.exposeInMainWorld('api', {
  // Window controls + UI prefs + relaunch, wired through the shared library so
  // renderer-side imports of @marina/desktop-ui talk to the same IPC surface
  // registered by registerWindowHandlers / registerUIPrefsHandlers in main.js.
  ...exposeWindowApi(ipcRenderer),
  ...exposeUIPrefsApi(ipcRenderer),

  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // Library
  listBooks: () => ipcRenderer.invoke('library:list'),
  importBooks: () => ipcRenderer.invoke('library:import'),
  deleteBook: (id) => ipcRenderer.invoke('library:delete', id),
  getBookData: (id) => ipcRenderer.invoke('library:getBookData', id),
  getCoverDataUrl: (id) => ipcRenderer.invoke('library:coverDataUrl', id),
  getBookState: (id) => ipcRenderer.invoke('library:getState', id),
  setBookState: (id, patch) => ipcRenderer.invoke('library:setState', id, patch),
});
