const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let dataDir = null;
let feedsCache = null;

// --- Initialization ---

function init(dir) {
  dataDir = dir;
  ensureDirectoryStructure();
  feedsCache = null;
}

function getDataDir() {
  return dataDir;
}

function ensureDirectoryStructure() {
  const dirs = [
    path.join(dataDir, 'configuration'),
    path.join(dataDir, 'data'),
    path.join(dataDir, 'data', 'feeds'),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const feedsPath = getFeedsIndexPath();
  if (!fs.existsSync(feedsPath)) {
    writeJsonAtomic(feedsPath, { feeds: [] });
  }

  const settingsPath = getSettingsPath();
  if (!fs.existsSync(settingsPath)) {
    writeJsonAtomic(settingsPath, {});
  }
}

// --- Path helpers ---

function getFeedsIndexPath() {
  return path.join(dataDir, 'data', 'feeds.json');
}

function getFeedDirPath(feedId) {
  return path.join(dataDir, 'data', 'feeds', feedId);
}

function getEntriesPath(feedId) {
  return path.join(dataDir, 'data', 'feeds', feedId, 'entries.json');
}

function getSettingsPath() {
  return path.join(dataDir, 'configuration', 'settings.json');
}

// --- Atomic file I/O ---

function writeJsonAtomic(filePath, data) {
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

function readJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// --- Feed operations ---

function loadFeedsIndex() {
  if (feedsCache) return feedsCache;
  const data = readJson(getFeedsIndexPath());
  feedsCache = data && Array.isArray(data.feeds) ? data.feeds : [];
  return feedsCache;
}

function saveFeedsIndex(feeds) {
  feedsCache = feeds;
  writeJsonAtomic(getFeedsIndexPath(), { feeds });
}

function getAllFeeds() {
  const feeds = loadFeedsIndex();
  return feeds.map((feed) => {
    const entriesData = readJson(getEntriesPath(feed.id));
    const entries = entriesData && Array.isArray(entriesData.entries) ? entriesData.entries : [];
    const unreadCount = entries.filter((e) => !e.isRead).length;
    return { ...feed, unread_count: unreadCount };
  }).sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }));
}

function getFeedById(id) {
  const feeds = loadFeedsIndex();
  return feeds.find((f) => f.id === id) || null;
}

function addFeed(title, url, siteUrl, description) {
  const feeds = loadFeedsIndex();

  const existing = feeds.find((f) => f.url === url);
  if (existing) throw new Error('Feed with this URL already exists');

  const feed = {
    id: crypto.randomUUID(),
    title,
    url,
    siteUrl: siteUrl || null,
    description: description || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  feeds.push(feed);
  saveFeedsIndex(feeds);

  // Create feed directory and empty entries file
  const feedDir = getFeedDirPath(feed.id);
  if (!fs.existsSync(feedDir)) {
    fs.mkdirSync(feedDir, { recursive: true });
  }
  writeJsonAtomic(getEntriesPath(feed.id), { feedId: feed.id, entries: [] });

  return feed;
}

function editFeed(id, data) {
  const feeds = loadFeedsIndex();
  const index = feeds.findIndex((f) => f.id === id);
  if (index === -1) throw new Error('Feed not found');

  const feed = feeds[index];
  if (data.title !== undefined) feed.title = data.title;
  if (data.url !== undefined) feed.url = data.url;
  if (data.siteUrl !== undefined) feed.siteUrl = data.siteUrl;
  if (data.description !== undefined) feed.description = data.description;
  feed.updatedAt = new Date().toISOString();

  feeds[index] = feed;
  saveFeedsIndex(feeds);
  return feed;
}

function removeFeed(id) {
  let feeds = loadFeedsIndex();
  feeds = feeds.filter((f) => f.id !== id);
  saveFeedsIndex(feeds);

  // Remove feed directory
  const feedDir = getFeedDirPath(id);
  if (fs.existsSync(feedDir)) {
    fs.rmSync(feedDir, { recursive: true, force: true });
  }
}

// --- Entry operations ---

function loadEntries(feedId) {
  const data = readJson(getEntriesPath(feedId));
  return data && Array.isArray(data.entries) ? data.entries : [];
}

function saveEntries(feedId, entries) {
  const feedDir = getFeedDirPath(feedId);
  if (!fs.existsSync(feedDir)) {
    fs.mkdirSync(feedDir, { recursive: true });
  }
  writeJsonAtomic(getEntriesPath(feedId), { feedId, entries });
}

function getEntriesByFeed(feedId) {
  const entries = loadEntries(feedId);
  // Sort by publishedAt descending, then createdAt descending
  return entries.sort((a, b) => {
    const dateA = a.publishedAt || a.createdAt || '';
    const dateB = b.publishedAt || b.createdAt || '';
    return dateB.localeCompare(dateA);
  });
}

function insertEntries(feedId, newEntries) {
  const existing = loadEntries(feedId);
  const existingGuids = new Set(existing.map((e) => e.guid));

  let inserted = 0;
  for (const entry of newEntries) {
    if (!existingGuids.has(entry.guid)) {
      existing.push({
        id: crypto.randomUUID(),
        guid: entry.guid,
        title: entry.title || null,
        link: entry.link || null,
        content: entry.content || null,
        author: entry.author || null,
        publishedAt: entry.publishedAt || null,
        isRead: false,
        createdAt: new Date().toISOString(),
      });
      existingGuids.add(entry.guid);
      inserted++;
    }
  }

  if (inserted > 0) {
    saveEntries(feedId, existing);
  }
  return inserted;
}

function markEntryRead(entryId, feedId) {
  const entries = loadEntries(feedId);
  const entry = entries.find((e) => e.id === entryId);
  if (entry) {
    entry.isRead = true;
    saveEntries(feedId, entries);
  }
}

function markEntryUnread(entryId, feedId) {
  const entries = loadEntries(feedId);
  const entry = entries.find((e) => e.id === entryId);
  if (entry) {
    entry.isRead = false;
    saveEntries(feedId, entries);
  }
}

function markAllRead(feedId) {
  const entries = loadEntries(feedId);
  let changed = false;
  for (const entry of entries) {
    if (!entry.isRead) {
      entry.isRead = true;
      changed = true;
    }
  }
  if (changed) {
    saveEntries(feedId, entries);
  }
}

function markAllUnread(feedId) {
  const entries = loadEntries(feedId);
  let changed = false;
  for (const entry of entries) {
    if (entry.isRead) {
      entry.isRead = false;
      changed = true;
    }
  }
  if (changed) {
    saveEntries(feedId, entries);
  }
}

// --- Settings operations ---

function getAllSettings() {
  return readJson(getSettingsPath()) || {};
}

function getSetting(key) {
  const settings = getAllSettings();
  return settings[key] !== undefined ? settings[key] : null;
}

function setSetting(key, value) {
  const settings = getAllSettings();
  settings[key] = value;
  writeJsonAtomic(getSettingsPath(), settings);
}

// --- Compatibility layer ---
// Map JSON field names to the snake_case names the renderer expects

function feedToRendererFormat(feed) {
  return {
    id: feed.id,
    title: feed.title,
    url: feed.url,
    site_url: feed.siteUrl,
    description: feed.description,
    created_at: feed.createdAt,
    updated_at: feed.updatedAt,
    unread_count: feed.unread_count || 0,
  };
}

function entryToRendererFormat(entry) {
  return {
    id: entry.id,
    feed_id: entry.feedId,
    guid: entry.guid,
    title: entry.title,
    link: entry.link,
    content: entry.content,
    author: entry.author,
    published_at: entry.publishedAt,
    is_read: entry.isRead ? 1 : 0,
    created_at: entry.createdAt,
  };
}

function getAllFeedsForRenderer() {
  return getAllFeeds().map(feedToRendererFormat);
}

function getEntriesByFeedForRenderer(feedId) {
  return getEntriesByFeed(feedId).map((e) => ({ ...entryToRendererFormat(e), feed_id: feedId }));
}

module.exports = {
  init,
  getDataDir,
  getAllFeeds: getAllFeedsForRenderer,
  getFeedById,
  addFeed,
  editFeed,
  removeFeed,
  getEntriesByFeed: getEntriesByFeedForRenderer,
  insertEntries,
  markEntryRead,
  markEntryUnread,
  markAllRead,
  markAllUnread,
  getSetting,
  setSetting,
};
