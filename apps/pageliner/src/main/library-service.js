const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const metadata = require('./metadata');

const INDEX_FILE = 'pageliner.json';
const BOOKS_DIR = 'books';
const COVERS_DIR = 'covers';
const STATE_DIR = 'state';

// Owns the on-disk library: the pageliner.json index plus the books/, covers/,
// and state/ subfolders. Mirrors the JSON-index-plus-files convention the other
// marina apps use. Git-sync is deliberately NOT wired here — it's an optional
// Phase 5 concern, and book blobs are expected to stay local by default.
class LibraryService {
  constructor() {
    this.libraryDir = null;
    this.index = null;
  }

  init(libraryDir) {
    this.libraryDir = libraryDir;
    fs.mkdirSync(this.booksDir(), { recursive: true });
    fs.mkdirSync(this.coversDir(), { recursive: true });
    fs.mkdirSync(this.stateDir(), { recursive: true });

    if (fs.existsSync(this.indexPath())) {
      try {
        this.index = JSON.parse(fs.readFileSync(this.indexPath(), 'utf-8'));
      } catch {
        this.index = { version: 1, books: [] };
      }
    } else {
      this.index = { version: 1, books: [] };
      this.save();
    }
    if (!Array.isArray(this.index.books)) this.index.books = [];
  }

  indexPath() { return path.join(this.libraryDir, INDEX_FILE); }
  booksDir()  { return path.join(this.libraryDir, BOOKS_DIR); }
  coversDir() { return path.join(this.libraryDir, COVERS_DIR); }
  stateDir()  { return path.join(this.libraryDir, STATE_DIR); }

  save() {
    fs.writeFileSync(this.indexPath(), JSON.stringify(this.index, null, 2), 'utf-8');
  }

  listBooks() {
    return this.index ? this.index.books : [];
  }

  getBook(id) {
    return this.index?.books.find((b) => b.id === id) || null;
  }

  // Copy a source document into the library, extract metadata + cover, and
  // append an index entry. Returns the new entry.
  async addBook(sourcePath) {
    if (!this.libraryDir) throw new Error('Library not initialized');
    if (!fs.existsSync(sourcePath)) throw new Error('Source file not found');

    const id = crypto.randomUUID();
    const format = metadata.formatFromExt(sourcePath);
    const ext = path.extname(sourcePath).toLowerCase() || `.${format}`;
    const storedFile = `${id}${ext}`;

    // Copy the document in.
    fs.copyFileSync(sourcePath, path.join(this.booksDir(), storedFile));

    // Extract metadata + cover (best-effort; never blocks the import).
    let title, author, coverFilename = null;
    try {
      const meta = await metadata.extract(sourcePath);
      title = meta.title;
      author = meta.author;
      if (meta.cover?.buffer) {
        coverFilename = `${id}.${meta.cover.ext}`;
        fs.writeFileSync(path.join(this.coversDir(), coverFilename), meta.cover.buffer);
      }
    } catch {
      title = metadata.titleFromFilename(sourcePath);
      author = null;
    }

    const entry = {
      id,
      title: title || metadata.titleFromFilename(sourcePath),
      author: author || null,
      format,
      file: storedFile,
      cover: coverFilename,
      tags: [],
      addedAt: new Date().toISOString(),
    };

    this.index.books.push(entry);
    this.save();
    return entry;
  }

  deleteBook(id) {
    const entry = this.getBook(id);
    if (!entry) return { success: false };
    const rm = (p) => { try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch { /* ignore */ } };
    rm(path.join(this.booksDir(), entry.file));
    if (entry.cover) rm(path.join(this.coversDir(), entry.cover));
    rm(path.join(this.stateDir(), `${id}.json`));
    this.index.books = this.index.books.filter((b) => b.id !== id);
    this.save();
    return { success: true };
  }

  bookFilePath(id) {
    const entry = this.getBook(id);
    return entry ? path.join(this.booksDir(), entry.file) : null;
  }

  coverPath(id) {
    const entry = this.getBook(id);
    return entry && entry.cover ? path.join(this.coversDir(), entry.cover) : null;
  }

  // Per-book reading state (position, bookmarks, highlights). Used by the
  // readers in later phases; exposed now so the storage shape is settled.
  getState(id) {
    const p = path.join(this.stateDir(), `${id}.json`);
    if (!fs.existsSync(p)) return {};
    try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return {}; }
  }

  setState(id, patch) {
    const current = this.getState(id);
    const next = { ...current, ...patch, lastOpenedAt: new Date().toISOString() };
    fs.writeFileSync(path.join(this.stateDir(), `${id}.json`), JSON.stringify(next, null, 2), 'utf-8');
    return next;
  }
}

module.exports = { LibraryService };
