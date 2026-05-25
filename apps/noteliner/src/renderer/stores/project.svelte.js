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
  // Drives the Files-pane order. Persisted to UI prefs under filesSortMode.
  sortMode = $state('user');
  // Files-pane tag filter. Stores *un*-checked rows (real tag names plus the
  // UNTAGGED_KEY sentinel) so newly-added tags default to "checked"
  // (visible) — the opposite shape would silently hide a file the moment a
  // new tag was applied to it. Session-only; reset on project close.
  hiddenTags = $state(new SvelteSet());

  load(folderPath, index) {
    this.folderPath = folderPath;
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
    const tagSet = new Set();
    for (const file of this.index.files) {
      if (file.tags) {
        for (const tag of file.tags) tagSet.add(tag);
      }
    }
    return [...tagSet].sort();
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
    if (normalized && !file.tags.includes(normalized)) {
      file.tags = [...file.tags, normalized];
    }
  }

  removeTag(fileId, tag) {
    const file = this.index.files.find(f => f.id === fileId);
    if (!file || !file.tags) return;
    file.tags = file.tags.filter(t => t !== tag);
  }

  getFilesWithTag(tag) {
    return this.index.files
      .filter(f => f.tags && f.tags.includes(tag))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}

export const projectState = new ProjectState();
