const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Setup operations
  isSetupComplete: () => ipcRenderer.invoke('setup:isComplete'),
  openFolderDialog: () => ipcRenderer.invoke('setup:openFolderDialog'),
  setupInit: (dataDir, remoteUrl) => ipcRenderer.invoke('setup:init', dataDir, remoteUrl),

  // Feed operations
  addFeed: (url) => ipcRenderer.invoke('feed:add', url),
  editFeed: (id, data) => ipcRenderer.invoke('feed:edit', id, data),
  removeFeed: (id) => ipcRenderer.invoke('feed:remove', id),
  getFeeds: () => ipcRenderer.invoke('feed:getAll'),
  refreshFeed: (id) => ipcRenderer.invoke('feed:refresh', id),

  // Entry operations
  getEntries: (feedId) => ipcRenderer.invoke('entry:getByFeed', feedId),
  markRead: (entryId, feedId) => ipcRenderer.invoke('entry:markRead', entryId, feedId),
  markUnread: (entryId, feedId) => ipcRenderer.invoke('entry:markUnread', entryId, feedId),
  markAllRead: (feedId) => ipcRenderer.invoke('entry:markAllRead', feedId),
  markAllUnread: (feedId) => ipcRenderer.invoke('entry:markAllUnread', feedId),

  // Settings operations
  getSetting: (key) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),

  // Sync operations
  getSyncStatus: () => ipcRenderer.invoke('sync:getStatus'),
  forcePush: () => ipcRenderer.invoke('sync:forcePush'),
  forcePull: () => ipcRenderer.invoke('sync:forcePull'),
  getSyncConfig: () => ipcRenderer.invoke('sync:getConfig'),
});
