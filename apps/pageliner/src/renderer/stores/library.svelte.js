// Reactive library state (Svelte 5 runes). Mirrors NoteLiner's project store
// pattern: a thin reactive layer over the main-process library-service, which
// owns the on-disk source of truth.

class LibraryState {
  books = $state([]);
  selectedId = $state(null);
  loading = $state(false);
  sortMode = $state('addedAt-desc'); // addedAt-desc | title-asc | author-asc

  async load() {
    if (!window.api?.listBooks) return;
    this.loading = true;
    try {
      this.books = await window.api.listBooks();
    } catch {
      this.books = [];
    } finally {
      this.loading = false;
    }
  }

  async importBooks() {
    if (!window.api?.importBooks) return [];
    const added = await window.api.importBooks();
    if (added && added.length) {
      this.books = [...this.books, ...added];
      // Jump selection to the first newly-imported book.
      this.selectedId = added[0].id;
    }
    return added || [];
  }

  async removeBook(id) {
    if (!window.api?.deleteBook) return;
    await window.api.deleteBook(id);
    this.books = this.books.filter((b) => b.id !== id);
    if (this.selectedId === id) this.selectedId = null;
  }

  select(id) { this.selectedId = id; }
  clearSelection() { this.selectedId = null; }

  get selectedBook() {
    return this.books.find((b) => b.id === this.selectedId) || null;
  }

  get sortedBooks() {
    const list = [...this.books];
    switch (this.sortMode) {
      case 'title-asc':
        return list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      case 'author-asc':
        return list.sort((a, b) => (a.author || '~').localeCompare(b.author || '~'));
      case 'addedAt-desc':
      default:
        return list.sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''));
    }
  }
}

export const libraryState = new LibraryState();
