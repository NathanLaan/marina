const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const dataStore = require('./data-store');
const feedParser = require('./feed-parser');
const gitSync = require('./git-sync');
const syncManager = require('./sync-manager');

let mainWindow;

// --- App config (stored outside the git repo) ---

function getConfigPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(getConfigPath(), 'utf-8'));
  } catch {
    return {};
  }
}

function writeConfig(config) {
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
}

function isSetupComplete() {
  const config = readConfig();
  return !!(config.dataDir && fs.existsSync(config.dataDir));
}

// --- Window ---

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const indexPath = path.join(__dirname, '../../dist/renderer/index.html');
  mainWindow.loadFile(indexPath);
}

// --- IPC Handlers ---

function registerIpcHandlers() {
  // Setup handlers
  ipcMain.handle('setup:isComplete', () => {
    return isSetupComplete();
  });

  ipcMain.handle('setup:openFolderDialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Data Folder',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('setup:init', async (_event, dataDir, remoteUrl) => {
    // Check if directory exists, if it's already a git repo, etc.
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const isRepo = await gitSync.isGitRepo(dataDir);

    if (remoteUrl && !isRepo) {
      // Check if directory is empty
      const contents = fs.readdirSync(dataDir);
      if (contents.length === 0) {
        // Clone into this directory
        // We need to clone into an empty dir — remove it first, then clone creates it
        fs.rmSync(dataDir, { recursive: true });
        await gitSync.cloneRepo(remoteUrl, dataDir);
      } else {
        // Non-empty, non-git directory — init and add remote
        await gitSync.initRepo(dataDir, remoteUrl);
      }
    } else if (!isRepo) {
      // Local only — just init
      await gitSync.initRepo(dataDir, null);
    }

    // Save config
    writeConfig({ dataDir, remoteUrl: remoteUrl || null });

    // Initialize data store and sync
    await initDataAndSync(dataDir);

    return { success: true };
  });

  // Feed handlers
  ipcMain.handle('feed:getAll', () => {
    return dataStore.getAllFeeds();
  });

  ipcMain.handle('feed:add', async (_event, url) => {
    const parsed = await feedParser.fetchAndParse(url);
    const feed = dataStore.addFeed(
      parsed.title || url,
      url,
      parsed.link || null,
      parsed.description || null
    );
    const entries = feedParser.normalizeEntries(parsed.items || []);
    dataStore.insertEntries(feed.id, entries);

    await syncManager.notifyChange('Add feed: ' + (parsed.title || url));

    return { ...feed, unread_count: entries.length };
  });

  ipcMain.handle('feed:edit', async (_event, id, data) => {
    const feed = dataStore.editFeed(id, data);
    await syncManager.notifyChange('Edit feed: ' + feed.title);
    return feed;
  });

  ipcMain.handle('feed:remove', async (_event, id) => {
    const feed = dataStore.getFeedById(id);
    dataStore.removeFeed(id);
    await syncManager.notifyChange('Remove feed: ' + (feed ? feed.title : id));
    return { success: true };
  });

  ipcMain.handle('feed:refresh', async (_event, id) => {
    const feed = dataStore.getFeedById(id);
    if (!feed) throw new Error('Feed not found');
    const parsed = await feedParser.fetchAndParse(feed.url);
    const entries = feedParser.normalizeEntries(parsed.items || []);
    const inserted = dataStore.insertEntries(feed.id, entries);

    if (inserted > 0) {
      await syncManager.notifyChange('Refresh feed: ' + feed.title);
    }

    return { inserted };
  });

  // Tag handlers
  ipcMain.handle('tag:getAll', () => {
    return dataStore.getAllTags();
  });

  ipcMain.handle('tag:add', async (_event, name) => {
    const tag = dataStore.addTag(name);
    await syncManager.notifyChange('Add tag: ' + tag.name);
    return tag;
  });

  ipcMain.handle('tag:edit', async (_event, id, data) => {
    const tag = dataStore.editTag(id, data);
    await syncManager.notifyChange('Edit tag: ' + tag.name);
    return tag;
  });

  ipcMain.handle('tag:remove', async (_event, id) => {
    const tag = dataStore.getTagById(id);
    dataStore.removeTag(id);
    await syncManager.notifyChange('Remove tag: ' + (tag ? tag.name : id));
    return { success: true };
  });

  ipcMain.handle('tag:assign', async (_event, feedId, tagId) => {
    dataStore.assignTagToFeed(feedId, tagId);
    await syncManager.notifyChange('Assign tag to feed');
    return { success: true };
  });

  ipcMain.handle('tag:unassign', async (_event, feedId, tagId) => {
    dataStore.unassignTagFromFeed(feedId, tagId);
    await syncManager.notifyChange('Unassign tag from feed');
    return { success: true };
  });

  // Entry handlers
  ipcMain.handle('entry:getByFeed', (_event, feedId) => {
    return dataStore.getEntriesByFeed(feedId);
  });

  ipcMain.handle('entry:markRead', async (_event, entryId, feedId) => {
    dataStore.markEntryRead(entryId, feedId);
    await syncManager.notifyChange('Mark entry read');
    return { success: true };
  });

  ipcMain.handle('entry:markUnread', async (_event, entryId, feedId) => {
    dataStore.markEntryUnread(entryId, feedId);
    await syncManager.notifyChange('Mark entry unread');
    return { success: true };
  });

  ipcMain.handle('entry:markAllRead', async (_event, feedId) => {
    dataStore.markAllRead(feedId);
    await syncManager.notifyChange('Mark all read');
    return { success: true };
  });

  ipcMain.handle('entry:markAllUnread', async (_event, feedId) => {
    dataStore.markAllUnread(feedId);
    await syncManager.notifyChange('Mark all unread');
    return { success: true };
  });

  // Settings handlers
  ipcMain.handle('settings:get', (_event, key) => {
    return dataStore.getSetting(key);
  });

  ipcMain.handle('settings:set', async (_event, key, value) => {
    dataStore.setSetting(key, value);
    if (key === 'syncWaitTime') {
      syncManager.updateWaitTime(parseInt(value, 10) || 10);
    }
    await syncManager.notifyChange('Update setting: ' + key);
    return { success: true };
  });

  // Sync handlers
  ipcMain.handle('sync:getStatus', () => {
    return syncManager.getStatus();
  });

  ipcMain.handle('sync:forcePush', async () => {
    await syncManager.forcePush();
    return syncManager.getStatus();
  });

  ipcMain.handle('sync:forcePull', async () => {
    const result = await syncManager.forcePull();
    return { ...result, status: syncManager.getStatus() };
  });

  ipcMain.handle('sync:getConfig', () => {
    const config = readConfig();
    return {
      dataDir: config.dataDir || null,
      remoteUrl: config.remoteUrl || null,
    };
  });
}

// --- Startup ---

async function initDataAndSync(dataDir) {
  // Ensure git user identity is configured (handles repos created before this fix)
  await gitSync.configureUser(dataDir);

  dataStore.init(dataDir);

  const waitTime = dataStore.getSetting('syncWaitTime');
  syncManager.init(dataDir, waitTime ? parseInt(waitTime, 10) : 10);

  // Commit any uncommitted data files (e.g., from initial setup)
  await syncManager.notifyChange('Initialize data store');
}

app.whenReady().then(async () => {
  registerIpcHandlers();

  if (isSetupComplete()) {
    const config = readConfig();
    await initDataAndSync(config.dataDir);
  }

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  syncManager.destroy();
});
