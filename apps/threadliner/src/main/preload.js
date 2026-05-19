const { contextBridge, ipcRenderer } = require('electron');
const { exposeWindowApi, exposeUIPrefsApi } = require('@marina/desktop-ui/preload');

contextBridge.exposeInMainWorld('api', {
  // Window controls + UI prefs + relaunch come from the shared library so
  // renderer-side imports of @marina/desktop-ui talk to the same IPC surface
  // registered by registerWindowHandlers / registerUIPrefsHandlers in main.js.
  ...exposeWindowApi(ipcRenderer),
  ...exposeUIPrefsApi(ipcRenderer),

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

  // RSS auto-poller
  pollFeedsNow: () => ipcRenderer.invoke('poller:pollNow'),
  onFeedsUpdated: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('feeds:updated', listener);
    return () => ipcRenderer.removeListener('feeds:updated', listener);
  },

  // App info
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),

  // Sync operations
  getSyncStatus: (sinceLogId) => ipcRenderer.invoke('sync:getStatus', sinceLogId),
  getSyncLog: () => ipcRenderer.invoke('sync:getLog'),
  forcePush: () => ipcRenderer.invoke('sync:forcePush'),
  forcePull: () => ipcRenderer.invoke('sync:forcePull'),
  getSyncConfig: () => ipcRenderer.invoke('sync:getConfig'),

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

  // Help window
  openHelpWindow: () => ipcRenderer.invoke('help:open'),

  // Auto-updater. Mirrors NoteLiner's preload surface so the library's
  // AboutModal (which accepts an `updateState` prop) can drive both apps.
  getUpdateState:   () => ipcRenderer.invoke('update:getState'),
  checkForUpdates:  () => ipcRenderer.invoke('update:checkNow'),
  downloadUpdate:   () => ipcRenderer.invoke('update:downloadNow'),
  installUpdate:    () => ipcRenderer.invoke('update:installNow'),
  onUpdateState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('update:state', listener);
    return () => ipcRenderer.removeListener('update:state', listener);
  },
});
