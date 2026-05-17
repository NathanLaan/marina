const { contextBridge, ipcRenderer } = require('electron');
const { exposeWindowApi, exposeUIPrefsApi } = require('@marina/desktop-ui/preload');

contextBridge.exposeInMainWorld('api', {
  ...exposeWindowApi(ipcRenderer),
  ...exposeUIPrefsApi(ipcRenderer),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
});
