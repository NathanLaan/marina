const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const db = require('./db');
const feedParser = require('./feed-parser');

let mainWindow;

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

function registerIpcHandlers() {
  // Feed handlers
  ipcMain.handle('feed:getAll', () => {
    return db.getAllFeeds();
  });

  ipcMain.handle('feed:add', async (_event, url) => {
    const parsed = await feedParser.fetchAndParse(url);
    const feed = db.addFeed(parsed.title || url, url, parsed.link || null, parsed.description || null);
    const entries = feedParser.normalizeEntries(parsed.items || []);
    db.insertEntries(feed.id, entries);
    return { ...feed, unread_count: entries.length };
  });

  ipcMain.handle('feed:edit', (_event, id, data) => {
    return db.editFeed(id, data);
  });

  ipcMain.handle('feed:remove', (_event, id) => {
    db.removeFeed(id);
    return { success: true };
  });

  ipcMain.handle('feed:refresh', async (_event, id) => {
    const feed = db.getFeedById(id);
    if (!feed) throw new Error('Feed not found');
    const parsed = await feedParser.fetchAndParse(feed.url);
    const entries = feedParser.normalizeEntries(parsed.items || []);
    const inserted = db.insertEntries(feed.id, entries);
    return { inserted };
  });

  // Entry handlers
  ipcMain.handle('entry:getByFeed', (_event, feedId) => {
    return db.getEntriesByFeed(feedId);
  });

  ipcMain.handle('entry:markRead', (_event, entryId) => {
    db.markEntryRead(entryId);
    return { success: true };
  });

  // Settings handlers
  ipcMain.handle('settings:get', (_event, key) => {
    return db.getSetting(key);
  });

  ipcMain.handle('settings:set', (_event, key, value) => {
    db.setSetting(key, value);
    return { success: true };
  });
}

app.whenReady().then(() => {
  db.init();
  registerIpcHandlers();
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
  db.close();
});
