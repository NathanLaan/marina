const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

let db;

function getDbPath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'threadline.db');
}

function init() {
  db = new Database(getDbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS feeds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      site_url TEXT,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feed_id INTEGER NOT NULL,
      guid TEXT NOT NULL,
      title TEXT,
      link TEXT,
      content TEXT,
      author TEXT,
      published_at TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (feed_id) REFERENCES feeds(id) ON DELETE CASCADE,
      UNIQUE(feed_id, guid)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  return db;
}

// --- Feed operations ---

function getAllFeeds() {
  const feeds = db.prepare(`
    SELECT f.*,
      (SELECT COUNT(*) FROM entries e WHERE e.feed_id = f.id AND e.is_read = 0) AS unread_count
    FROM feeds f
    ORDER BY f.title COLLATE NOCASE
  `).all();
  return feeds;
}

function getFeedById(id) {
  return db.prepare('SELECT * FROM feeds WHERE id = ?').get(id);
}

function addFeed(title, url, siteUrl, description) {
  const stmt = db.prepare(`
    INSERT INTO feeds (title, url, site_url, description)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(title, url, siteUrl || null, description || null);
  return getFeedById(result.lastInsertRowid);
}

function editFeed(id, data) {
  const fields = [];
  const values = [];

  if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title); }
  if (data.url !== undefined) { fields.push('url = ?'); values.push(data.url); }
  if (data.siteUrl !== undefined) { fields.push('site_url = ?'); values.push(data.siteUrl); }
  if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }

  if (fields.length === 0) return getFeedById(id);

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE feeds SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getFeedById(id);
}

function removeFeed(id) {
  db.prepare('DELETE FROM feeds WHERE id = ?').run(id);
}

// --- Entry operations ---

function getEntriesByFeed(feedId) {
  return db.prepare(`
    SELECT * FROM entries
    WHERE feed_id = ?
    ORDER BY published_at DESC, created_at DESC
  `).all(feedId);
}

function insertEntries(feedId, entries) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO entries (feed_id, guid, title, link, content, author, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((items) => {
    let inserted = 0;
    for (const entry of items) {
      const result = stmt.run(
        feedId,
        entry.guid,
        entry.title || null,
        entry.link || null,
        entry.content || null,
        entry.author || null,
        entry.publishedAt || null,
      );
      if (result.changes > 0) inserted++;
    }
    return inserted;
  });

  return insertMany(entries);
}

function markEntryRead(entryId) {
  db.prepare('UPDATE entries SET is_read = 1 WHERE id = ?').run(entryId);
}

// --- Settings operations ---

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

function close() {
  if (db) db.close();
}

module.exports = {
  init,
  getAllFeeds,
  getFeedById,
  addFeed,
  editFeed,
  removeFeed,
  getEntriesByFeed,
  insertEntries,
  markEntryRead,
  getSetting,
  setSetting,
  close,
};
