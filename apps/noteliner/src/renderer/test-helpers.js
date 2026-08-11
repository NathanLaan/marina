// Test helpers exposed on window.__nlTest when the renderer is loaded with ?test=1.
// Driven by Playwright tests; a no-op in normal builds (the query param is only set
// by main.js when NODE_ENV=test).
//
// The helpers compose the same calls the UI makes (IPC + project store update),
// so tests exercise the real persistence and reactive paths without driving every
// modal click.

import { DEFAULT_PRESENTATION, slideAtLine } from './lib/slides.js';

// `hooks` lets App.svelte expose actions that live in component state rather
// than the store (opening a modal, for instance) without the tests having to
// simulate every click that leads there.
export function installTestHelpers(projectState, hooks = {}) {
  const params = new URLSearchParams(window.location.search);
  if (params.get('test') !== '1') return;

  window.__nlTest = {
    // Presentation helpers. These do the conversion only — the UI flow that
    // also opens Presentation Settings is covered by driving the real context
    // menu in tests/e2e/11-slide-management.spec.js.
    async convertToPresentation(fileId, presentation = null) {
      return projectState.setPresentation(fileId, presentation || { ...DEFAULT_PRESENTATION });
    },

    async convertToNote(fileId) {
      return projectState.setPresentation(fileId, null);
    },

    openPresentationSettings() {
      hooks.openPresentationSettings?.();
    },

    async initProject(folderPath, remoteUrl = null) {
      const result = await window.api.initProject(folderPath, remoteUrl);
      if (result?.status === 'loaded') {
        projectState.load(folderPath, result.index);
      }
      return result;
    },

    async openProject(folderPath) {
      const result = await window.api.openProject(folderPath);
      if (result?.status === 'loaded') {
        projectState.load(folderPath, result.index);
      }
      return result;
    },

    async createFile(name, tags = []) {
      const entry = await window.api.createFile(name, tags);
      if (entry && !entry.error) {
        projectState.addFile(entry);
        await projectState.selectFile(entry.id);
      }
      return entry;
    },

    async duplicateFile(sourceId, name, tags = [], parentId = null) {
      const entry = await window.api.duplicateFile(sourceId, name, tags, parentId);
      if (entry && !entry.error) {
        projectState.addFile(entry);
        await projectState.selectFile(entry.id);
      }
      return entry;
    },

    async moveFile(fileId, newParentId = null) {
      const file = projectState.index.files.find(f => f.id === fileId);
      if (!file) return null;
      const parentId = newParentId || null;
      if (file.parentId === parentId) return file;
      file.parentId = parentId;
      const siblings = projectState.getAllChildren(parentId).filter(f => f.id !== fileId);
      file.order = siblings.length;
      // Plain-object clone for IPC — this file is a plain .js module, so the
      // $state.snapshot rune the .svelte callers use isn't available here.
      await window.api.saveIndex(JSON.parse(JSON.stringify(projectState.index)));
      return file;
    },

    async selectFile(fileId) {
      await projectState.selectFile(fileId);
    },

    async writeBody(content) {
      const file = projectState.selectedFile;
      if (!file) throw new Error('No file selected');
      projectState.editorContent = content;
      await window.api.writeFile(file.filename, content);
    },

    async renameFile(fileId, newName) {
      const updated = await window.api.renameFile(fileId, newName);
      if (updated && !updated.error) {
        projectState.updateFile(fileId, {
          name: updated.name,
          filename: updated.filename,
        });
      }
      return updated;
    },

    async deleteFile(fileId) {
      const result = await window.api.deleteFile(fileId);
      if (!result || !result.error) {
        projectState.removeFile(fileId);
      }
      return result;
    },

    async addAttachment(buffer, originalName) {
      const file = projectState.selectedFile;
      if (!file) throw new Error('No file selected');
      const att = await window.api.addAttachment(file.id, buffer, originalName);
      if (att && !att.error) {
        projectState.addAttachment(file.id, att);
      }
      return att;
    },

    // Deck state for the presentation tests: whether the open note is a deck
    // and what the parser made of it, without reaching into the DOM.
    deckSnapshot() {
      const deck = projectState.deck;
      return {
        isDeck: projectState.isDeck,
        slideCount: deck?.slides.length ?? 0,
        titles: deck?.slides.map((s) => s.title) ?? [],
        layouts: deck?.slides.map((s) => s.layout) ?? [],
        activeIndex: deck ? slideAtLine(deck, projectState.cursorLine)?.index ?? null : null,
      };
    },

    snapshot() {
      return {
        isOpen: projectState.isOpen,
        folderPath: projectState.folderPath,
        selectedFileId: projectState.selectedFileId,
        editorContent: projectState.editorContent,
        saveStatus: projectState.saveStatus,
        files: projectState.index.files.map(f => ({
          id: f.id,
          name: f.name,
          filename: f.filename,
          parentId: f.parentId,
          tags: [...(f.tags || [])],
          attachments: (f.attachments || []).map(a => ({ ...a })),
        })),
      };
    },
  };
}
