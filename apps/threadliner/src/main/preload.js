const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Feed operations
  addFeed: (url) => ipcRenderer.invoke('feed:add', url),
  editFeed: (id, data) => ipcRenderer.invoke('feed:edit', id, data),
  removeFeed: (id) => ipcRenderer.invoke('feed:remove', id),
  getFeeds: () => ipcRenderer.invoke('feed:getAll'),
  refreshFeed: (id) => ipcRenderer.invoke('feed:refresh', id),

  // Entry operations
  getEntries: (feedId) => ipcRenderer.invoke('entry:getByFeed', feedId),
  markRead: (entryId) => ipcRenderer.invoke('entry:markRead', entryId),

  // Settings operations
  getSetting: (key) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
});
