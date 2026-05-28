// Reactive project state using Svelte 5 runes via a class with $state fields.
// Exported as a singleton module-level instance.

import { SvelteSet } from 'svelte/reactivity';

// Sentinel used in `hiddenTags` to represent "files with no tags". A leading
// space can't appear in a real tag (FrontmatterService normalizes), so a
// collision with a real user tag is impossible.
export const UNTAGGED_KEY = ' __untagged__';

function sortKids(kids, mode) {
  const byName = (a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  const ts = (v) => Date.parse(v) || 0;

  switch (mode) {
    case 'name-asc':      return [...kids].sort(byName);
    case 'name-desc':     return [...kids].sort((a, b) => -byName(a, b));
    case 'modified-desc': return [...kids].sort((a, b) =>
        ts(b.modifiedAt) - ts(a.modifiedAt) || byName(a, b));
    case 'created-desc':  return [...kids].sort((a, b) =>
        ts(b.createdAt) - ts(a.createdAt) || byName(a, b));
    case 'user':
    default:              return [...kids].sort((a, b) => a.order - b.order);
  }
}

class ProjectState {
  isOpen = $state(false);
  folderPath = $state('');
  index = $state({ version: 2, files: [] });
  selectedFileId = $state(null);
  editorContent = $state('');
  scrollToLine = $state(null);
  cursorLine = $state(1);
  // 1-based caret column, surfaced in the status bar.
  cursorCol = $state(1);
  // Length (in characters) of the current editor selection; 0 when none.
  selectionLength = $state(0);
  // Autosave indicator for the status bar: 'saved' | 'saving' | 'unsaved'.
  // Editor.svelte drives the transitions; reset to 'saved' on file load.
  saveStatus = $state('saved');
  // Drives the Files-pane order. Persisted to UI prefs under filesSortMode.
  sortMode = $state('user');
  // Files-pane tag filter. Stores *un*-checked rows (real tag names plus the
  // UNTAGGED_KEY sentinel) so newly-added tags default to "checked"
  // (visible) — the opposite shape would silently hide a file the moment a
  // new tag was applied to it. Session-only; reset on project close.
  hiddenTags = $state(new SvelteSet());

  load(folderPath, index) {
    this.folderPath = folderPath;
    // Older project indexes pre-date tag metadata. Stamp an empty
    // `tagMeta` so reactive getters don't have to optional-chain on
    // every read, and `saveIndex` round-trips a stable shape on disk.
    if (!index.tagMeta || typeof index.tagMeta !== 'object') {
      index.tagMeta = {};
    }
    // tagPalette is the durable set of tags known to this project. A tag
    // stays in the palette after the last file unchecks it, so the chip
    // remains visible in the TAGS pane and can be re-applied. Seed from
    // file tags so legacy projects (pre-palette) start with the right set.
    if (!Array.isArray(index.tagPalette)) {
      const seed = new Set();
      for (const file of (index.files || [])) {
        if (file.tags) for (const t of file.tags) seed.add(t);
      }
      index.tagPalette = [...seed];
    }
    this.index = index;
    this.isOpen = true;
    this.selectedFileId = null;
    this.editorContent = '';
    this.scrollToLine = null;
  }

  close() {
    this.isOpen = false;
    this.folderPath = '';
    this.index = { version: 2, files: [] };
    this.selectedFileId = null;
    this.editorContent = '';
    this.scrollToLine = null;
    this.hiddenTags.clear();
  }

  addFile(entry) {
    this.index.files.push(entry);
  }

  removeFile(fileId) {
    this.index.files = this.index.files.filter(f => f.id !== fileId);
    if (this.selectedFileId === fileId) {
      this.selectedFileId = null;
      this.editorContent = '';
    }
  }

  updateFile(fileId, updates) {
    const file = this.index.files.find(f => f.id === fileId);
    if (file) {
      Object.assign(file, updates);
    }
  }

  async selectFile(fileId) {
    this.selectedFileId = fileId;
    // Freshly loaded content is by definition in sync with disk; reset the
    // status-bar caret/selection/save indicators so they don't carry over
    // stale values from the previously open file.
    this.cursorCol = 1;
    this.selectionLength = 0;
    this.saveStatus = 'saved';
    const file = this.index.files.find(f => f.id === fileId);
    if (file) {
      const content = await window.api.readFile(file.filename);
      this.editorContent = content;
    }
  }

  get selectedFile() {
    if (!this.selectedFileId) return null;
    return this.index.files.find(f => f.id === this.selectedFileId) || null;
  }

  get selectedFileAttachments() {
    const file = this.selectedFile;
    if (!file) return [];
    return file.attachments || [];
  }

  addAttachment(fileId, attachment) {
    const file = this.index.files.find(f => f.id === fileId);
    if (file) {
      if (!file.attachments) file.attachments = [];
      file.attachments.push(attachment);
    }
  }

  removeAttachment(fileId, attachmentId) {
    const file = this.index.files.find(f => f.id === fileId);
    if (file && file.attachments) {
      file.attachments = file.attachments.filter(a => a.id !== attachmentId);
    }
  }

  // Filtered + sorted — used by FileTree rendering and keyboard navigation.
  getChildren(parentId) {
    const kids = this.index.files
      .filter(f => f.parentId === parentId)
      .filter(f => this.passesTagFilter(f));
    return sortKids(kids, this.sortMode);
  }

  // Unfiltered, in user order — used by drag-reorder's renumber loop in
  // Sidebar.handleDrop. Renumbering must see hidden siblings or the
  // persisted `order` field gets corrupted relative to them.
  getAllChildren(parentId) {
    return this.index.files
      .filter(f => f.parentId === parentId)
      .sort((a, b) => a.order - b.order);
  }

  // OR-of-checked: a file is visible iff at least one of its tags is checked
  // (i.e. NOT in hiddenTags). Files with no tags are governed by the
  // synthetic UNTAGGED_KEY row at the top of the popover.
  passesTagFilter(file) {
    const tags = file.tags || [];
    if (tags.length === 0) return !this.hiddenTags.has(UNTAGGED_KEY);
    for (const t of tags) {
      if (!this.hiddenTags.has(t)) return true;
    }
    return false;
  }

  isChecked(key) {
    return !this.hiddenTags.has(key);
  }

  toggleChecked(key) {
    if (this.hiddenTags.has(key)) this.hiddenTags.delete(key);
    else this.hiddenTags.add(key);
  }

  // Used by the popover's footer buttons.
  showAllTags() {
    this.hiddenTags.clear();
  }
  hideAllTags() {
    for (const t of this.allTags) this.hiddenTags.add(t);
    this.hiddenTags.add(UNTAGGED_KEY);
  }

  // Count of files with no tags — drives the "No Tags" row's counter.
  get untaggedCount() {
    let n = 0;
    for (const f of this.index.files) {
      if (!f.tags || f.tags.length === 0) n++;
    }
    return n;
  }

  // Returns files flattened into display order (depth-first, following the tree)
  getFlatFileList() {
    const result = [];
    const walk = (parentId) => {
      for (const file of this.getChildren(parentId)) {
        result.push(file);
        walk(file.id);
      }
    };
    walk(null);
    return result;
  }

  selectPrevFile() {
    const list = this.getFlatFileList();
    if (list.length === 0) return;
    if (!this.selectedFileId) {
      this.selectFile(list[0].id);
      return;
    }
    const idx = list.findIndex(f => f.id === this.selectedFileId);
    if (idx > 0) this.selectFile(list[idx - 1].id);
  }

  selectNextFile() {
    const list = this.getFlatFileList();
    if (list.length === 0) return;
    if (!this.selectedFileId) {
      this.selectFile(list[0].id);
      return;
    }
    const idx = list.findIndex(f => f.id === this.selectedFileId);
    if (idx >= 0 && idx < list.length - 1) this.selectFile(list[idx + 1].id);
  }

  get allTags() {
    const tagSet = new Set(this.index.tagPalette || []);
    // Union with file tags so a tag introduced outside the palette flow
    // (frontmatter on disk, MCP write, import) still shows up.
    for (const file of this.index.files) {
      if (file.tags) {
        for (const tag of file.tags) tagSet.add(tag);
      }
    }
    // Case-insensitive, numeric-aware sort so 'archive' comes before 'Work'
    // and 'item2' before 'item10'. Default JS sort is case-sensitive
    // codepoint order, which surfaces uppercase tags ahead of lowercase ones.
    return [...tagSet].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
  }

  get selectedFileTags() {
    const file = this.selectedFile;
    if (!file) return [];
    return file.tags || [];
  }

  addTag(fileId, tag) {
    const file = this.index.files.find(f => f.id === fileId);
    if (!file) return;
    if (!file.tags) file.tags = [];
    const normalized = tag.trim();
    if (!normalized) return;
    if (!file.tags.includes(normalized)) {
      file.tags = [...file.tags, normalized];
    }
    if (!this.index.tagPalette) this.index.tagPalette = [];
    if (!this.index.tagPalette.includes(normalized)) {
      this.index.tagPalette = [...this.index.tagPalette, normalized];
    }
  }

  removeTag(fileId, tag) {
    const file = this.index.files.find(f => f.id === fileId);
    if (!file || !file.tags) return;
    file.tags = file.tags.filter(t => t !== tag);
    // Intentionally leave `tagPalette` alone — unchecking a tag must keep
    // its chip visible so the user can re-check it without retyping.
  }

  // Drop a tag from the palette and from every file. Use this for an
  // explicit "delete tag" action; the toggle-off in TagsPane does NOT
  // call this (see removeTag).
  deleteTagEntirely(tag) {
    if (this.index.tagPalette) {
      this.index.tagPalette = this.index.tagPalette.filter(t => t !== tag);
    }
    for (const file of this.index.files) {
      if (file.tags && file.tags.includes(tag)) {
        file.tags = file.tags.filter(t => t !== tag);
      }
    }
    if (this.index.tagMeta && this.index.tagMeta[tag]) {
      const { [tag]: _, ...rest } = this.index.tagMeta;
      this.index.tagMeta = rest;
    }
  }

  getFilesWithTag(tag) {
    return this.index.files
      .filter(f => f.tags && f.tags.includes(tag))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // ─── Tag metadata ─────────────────────────────────────────────────
  //
  // Tag colors live in `index.tagMeta[tag] = { color: 'Tomato' }`. Only
  // tags with explicit metadata appear in the map — absence means
  // "default chip styling", which is the desired UX (silent fallback,
  // not an entry per tag).
  //
  // The tag string is the key as-typed (case-sensitive). Tag names
  // themselves are case-sensitive everywhere else in the codebase, so
  // keeping that here too avoids surprise mismatches.

  getTagColor(tag) {
    const meta = this.index.tagMeta?.[tag];
    return meta?.color || null;
  }

  setTagColor(tag, color) {
    if (!this.index.tagMeta) this.index.tagMeta = {};
    if (!color) {
      // Clearing — drop the metadata entirely so the saved index stays
      // tidy and "no metadata" round-trips as "no metadata".
      if (this.index.tagMeta[tag]) {
        const { [tag]: _, ...rest } = this.index.tagMeta;
        this.index.tagMeta = rest;
      }
      return;
    }
    this.index.tagMeta = { ...this.index.tagMeta, [tag]: { ...(this.index.tagMeta[tag] || {}), color } };
  }
}

export const projectState = new ProjectState();
