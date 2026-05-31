<script>
  import { libraryState } from '../stores/library.svelte.js';
  import BookCard from './BookCard.svelte';

  let { onOpen } = $props();

  async function handleImport() {
    await libraryState.importBooks();
  }

  async function handleDelete(id) {
    const book = libraryState.books.find((b) => b.id === id);
    const name = book ? book.title : 'this book';
    // Window.confirm is sufficient for a destructive single action here; a
    // styled modal can replace it later if desired.
    if (confirm(`Remove "${name}" from the library? The file will be deleted.`)) {
      await libraryState.removeBook(id);
    }
  }
</script>

<div class="library">
  <header class="lib-header">
    <h2>Library <span class="count">{libraryState.books.length}</span></h2>
    <div class="controls">
      <select bind:value={libraryState.sortMode} aria-label="Sort books">
        <option value="addedAt-desc">Recently added</option>
        <option value="title-asc">Title (A–Z)</option>
        <option value="author-asc">Author (A–Z)</option>
      </select>
      <button class="import-btn" onclick={handleImport}>
        <i class="fas fa-plus"></i> Import
      </button>
    </div>
  </header>

  {#if libraryState.loading}
    <div class="empty"><p>Loading…</p></div>
  {:else if libraryState.books.length === 0}
    <div class="empty">
      <i class="fas fa-book-open"></i>
      <p>Your library is empty.</p>
      <button class="import-btn" onclick={handleImport}>
        <i class="fas fa-plus"></i> Import a book…
      </button>
      <p class="hint">EPUB and PDF supported.</p>
    </div>
  {:else}
    <div class="grid">
      {#each libraryState.sortedBooks as book (book.id)}
        <BookCard
          {book}
          selected={libraryState.selectedId === book.id}
          onOpen={onOpen}
          onDelete={handleDelete}
        />
      {/each}
    </div>
  {/if}
</div>

<style>
  .library { height: 100%; display: flex; flex-direction: column; overflow: hidden; }

  .lib-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .lib-header h2 { font-size: 16px; color: var(--text-primary); }
  .count {
    font-size: 12px;
    color: var(--text-muted);
    background: var(--bg-button);
    border-radius: 10px;
    padding: 1px 8px;
    margin-left: 6px;
  }

  .controls { display: flex; align-items: center; gap: 8px; }
  .controls select {
    padding: 6px 10px;
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 12px;
  }

  .import-btn {
    padding: 6px 14px;
    background: var(--bg-selected);
    outline: 1px solid var(--accent);
    color: var(--accent);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .import-btn:hover { background: var(--accent); color: var(--accent-on); }

  .grid {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px;
    align-content: start;
  }

  .empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--text-muted);
    text-align: center;
  }
  .empty i { font-size: 40px; opacity: 0.5; }
  .empty .hint { font-size: 12px; color: var(--text-faint); }
</style>
