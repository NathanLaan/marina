const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let dataDir = null;
let feedsCache = null;
let tagsCache = null;

// --- Initialization ---

function init(dir) {
  dataDir = dir;
  ensureDirectoryStructure();
  feedsCache = null;
  tagsCache = null;
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

  const tagsPath = getTagsIndexPath();
  if (!fs.existsSync(tagsPath)) {
    writeJsonAtomic(tagsPath, { tags: [] });
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

function getTagsIndexPath() {
  return path.join(dataDir, 'data', 'tags.json');
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

// --- Tag operations ---

function loadTagsIndex() {
  if (tagsCache) return tagsCache;
  const data = readJson(getTagsIndexPath());
  tagsCache = data && Array.isArray(data.tags) ? data.tags : [];
  return tagsCache;
}

function saveTagsIndex(tags) {
  tagsCache = tags;
  writeJsonAtomic(getTagsIndexPath(), { tags });
}

function getAllTags() {
  return loadTagsIndex();
}

function getTagById(id) {
  const tags = loadTagsIndex();
  return tags.find((t) => t.id === id) || null;
}

function addTag(name) {
  const tags = loadTagsIndex();
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Tag name cannot be empty');

  const existing = tags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) throw new Error('A tag with this name already exists');

  const tag = {
    id: crypto.randomUUID(),
    name: trimmed,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  tags.push(tag);
  saveTagsIndex(tags);
  return tag;
}

function editTag(id, data) {
  const tags = loadTagsIndex();
  const index = tags.findIndex((t) => t.id === id);
  if (index === -1) throw new Error('Tag not found');

  if (data.name !== undefined) {
    const trimmed = data.name.trim();
    if (!trimmed) throw new Error('Tag name cannot be empty');
    const duplicate = tags.find((t) => t.id !== id && t.name.toLowerCase() === trimmed.toLowerCase());
    if (duplicate) throw new Error('A tag with this name already exists');
    tags[index].name = trimmed;
  }

  tags[index].updatedAt = new Date().toISOString();
  saveTagsIndex(tags);
  return tags[index];
}

function removeTag(id) {
  let tags = loadTagsIndex();
  tags = tags.filter((t) => t.id !== id);
  saveTagsIndex(tags);

  // Cascade: strip this tagId from all feeds
  const feeds = loadFeedsIndex();
  let changed = false;
  for (const feed of feeds) {
    if (Array.isArray(feed.tagIds) && feed.tagIds.includes(id)) {
      feed.tagIds = feed.tagIds.filter((tid) => tid !== id);
      changed = true;
    }
  }
  if (changed) {
    saveFeedsIndex(feeds);
  }
}

function assignTagToFeed(feedId, tagId) {
  const feeds = loadFeedsIndex();
  const feed = feeds.find((f) => f.id === feedId);
  if (!feed) throw new Error('Feed not found');
  if (!getTagById(tagId)) throw new Error('Tag not found');

  if (!Array.isArray(feed.tagIds)) feed.tagIds = [];
  if (!feed.tagIds.includes(tagId)) {
    feed.tagIds.push(tagId);
    saveFeedsIndex(feeds);
  }
}

function unassignTagFromFeed(feedId, tagId) {
  const feeds = loadFeedsIndex();
  const feed = feeds.find((f) => f.id === feedId);
  if (!feed) throw new Error('Feed not found');

  if (Array.isArray(feed.tagIds) && feed.tagIds.includes(tagId)) {
    feed.tagIds = feed.tagIds.filter((tid) => tid !== tagId);
    saveFeedsIndex(feeds);
  }
}

function tagToRendererFormat(tag) {
  return {
    id: tag.id,
    name: tag.name,
    created_at: tag.createdAt,
    updated_at: tag.updatedAt,
  };
}

function getAllTagsForRenderer() {
  return getAllTags().map(tagToRendererFormat);
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
    tag_ids: Array.isArray(feed.tagIds) ? feed.tagIds : [],
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
  getAllTags: getAllTagsForRenderer,
  getTagById,
  addTag,
  editTag: editTag,
  removeTag,
  assignTagToFeed,
  unassignTagFromFeed,
  getSetting,
  setSetting,
};
