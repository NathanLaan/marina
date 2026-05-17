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

  // Tag operations
  getTags: () => ipcRenderer.invoke('tag:getAll'),
  addTag: (name) => ipcRenderer.invoke('tag:add', name),
  editTag: (id, data) => ipcRenderer.invoke('tag:edit', id, data),
  removeTag: (id) => ipcRenderer.invoke('tag:remove', id),
  assignTag: (feedId, tagId) => ipcRenderer.invoke('tag:assign', feedId, tagId),
  unassignTag: (feedId, tagId) => ipcRenderer.invoke('tag:unassign', feedId, tagId),

  // Settings operations
  getSetting: (key) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),

  // App info
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),

  // Sync operations
  getSyncStatus: (sinceLogId) => ipcRenderer.invoke('sync:getStatus', sinceLogId),
  getSyncLog: () => ipcRenderer.invoke('sync:getLog'),
  forcePush: () => ipcRenderer.invoke('sync:forcePush'),
  forcePull: () => ipcRenderer.invoke('sync:forcePull'),
  getSyncConfig: () => ipcRenderer.invoke('sync:getConfig'),

  // Window control (custom titlebar)
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
  windowIsMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onWindowMaximizedChange: (cb) => {
    const handler = (_e, v) => cb(v);
    ipcRenderer.on('window:maximized-change', handler);
    return () => ipcRenderer.removeListener('window:maximized-change', handler);
  },

  // UI prefs (device-local)
  getUIPrefs: () => ipcRenderer.invoke('ui:getPrefs'),
  setUIPrefs: (p) => ipcRenderer.invoke('ui:setPrefs', p),

  // App relaunch (used after toggling settings that require re-creating BrowserWindow)
  relaunchApp: () => ipcRenderer.invoke('app:relaunch'),

  // Manual git operations (used by the redesigned SyncModal)
  gitGetRemoteUrl: () => ipcRenderer.invoke('git:getRemoteUrl'),
  gitSetRemoteUrl: (url) => ipcRenderer.invoke('git:setRemoteUrl', url),
  gitRemoveRemote: () => ipcRenderer.invoke('git:removeRemote'),
  gitGetBranch: () => ipcRenderer.invoke('git:getBranch'),
  gitGetSyncStatus: () => ipcRenderer.invoke('git:getSyncStatus'),
  gitPull: () => ipcRenderer.invoke('git:pull'),
  gitPullRebase: () => ipcRenderer.invoke('git:pullRebase'),
  gitPush: () => ipcRenderer.invoke('git:push'),
  gitPushUpstream: () => ipcRenderer.invoke('git:pushUpstream'),
  gitResetToRemote: () => ipcRenderer.invoke('git:resetToRemote'),

  // Open an external URL in the user's default browser.
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
});
