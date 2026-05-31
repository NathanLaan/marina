<script>
  import { libraryState } from '../stores/library.svelte.js';
  import { themeState } from '@marina/desktop-ui/theme';

  const book = $derived(libraryState.selectedBook);
  const count = $derived(libraryState.counts.all);
</script>

<footer class="status-bar">
  <div class="zone left">
    {#if book}
      <span class="seg"><i class="fas {book.format === 'pdf' ? 'fa-file-pdf' : 'fa-book'}"></i> {book.title}</span>
    {:else}
      <span class="seg muted">{count} book{count === 1 ? '' : 's'}</span>
    {/if}
  </div>

  <div class="zone center">
    {#if book && libraryState.readingStatus}
      <span class="seg">{libraryState.readingStatus}</span>
    {/if}
  </div>

  <div class="zone right">
    {#if book}
      <span class="seg muted">{book.format.toUpperCase()}</span>
    {/if}
    <span class="seg muted">{themeState.scale}%</span>
  </div>
</footer>

<style>
  .status-bar {
    display: flex;
    align-items: center;
    height: 24px;
    flex-shrink: 0;
    padding: 0 10px;
    gap: 12px;
    font-size: 12px;
    line-height: 1;
    color: var(--text-secondary);
    background: var(--bg-surface);
    border-top: 1px solid var(--border);
    user-select: none;
    overflow: hidden;
    white-space: nowrap;
  }
  .zone { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .zone.left { flex: 0 1 auto; }
  .zone.center { flex: 1 1 auto; justify-content: center; }
  .zone.right { flex: 0 0 auto; }
  .seg {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .seg i { font-size: 11px; opacity: 0.8; }
  .muted { color: var(--text-muted); }
</style>
