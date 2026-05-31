<script>
  import { onMount } from 'svelte';

  let { book, selected = false, onOpen, onDelete } = $props();

  let coverUrl = $state(null);

  onMount(async () => {
    if (book.cover && window.api?.getCoverDataUrl) {
      try { coverUrl = await window.api.getCoverDataUrl(book.id); }
      catch { coverUrl = null; }
    }
  });

  const formatIcon = $derived(book.format === 'pdf' ? 'fa-file-pdf' : 'fa-book');
</script>

<div
  class="card"
  class:selected
  role="button"
  tabindex="0"
  ondblclick={() => onOpen?.(book.id)}
  onclick={() => onOpen?.(book.id)}
  onkeydown={(e) => { if (e.key === 'Enter') onOpen?.(book.id); }}
  title={book.title}
>
  <div class="cover">
    {#if coverUrl}
      <img src={coverUrl} alt={`Cover of ${book.title}`} />
    {:else}
      <div class="cover-fallback">
        <i class="fas {formatIcon}"></i>
      </div>
    {/if}
    <span class="format-badge">{book.format}</span>
    <button
      class="delete-btn"
      title="Remove from library"
      onclick={(e) => { e.stopPropagation(); onDelete?.(book.id); }}
    >
      <i class="fas fa-trash"></i>
    </button>
  </div>
  <div class="meta">
    <div class="title">{book.title}</div>
    <div class="author">{book.author || 'Unknown author'}</div>
  </div>
</div>

<style>
  .card {
    display: flex;
    flex-direction: column;
    cursor: pointer;
    border-radius: 8px;
    padding: 8px;
    transition: background 0.12s;
    outline: none;
  }
  .card:hover { background: var(--bg-item-hover); }
  .card.selected { background: var(--bg-selected); outline: 1px solid var(--accent); }

  .cover {
    position: relative;
    aspect-ratio: 2 / 3;
    border-radius: 6px;
    overflow: hidden;
    background: var(--bg-button);
    border: 1px solid var(--border);
  }
  .cover img { width: 100%; height: 100%; object-fit: cover; display: block; }

  .cover-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-faint);
    font-size: 40px;
  }

  .format-badge {
    position: absolute;
    top: 6px;
    left: 6px;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 2px 6px;
    border-radius: 3px;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
  }

  .delete-btn {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.12s, background 0.12s;
    font-size: 11px;
  }
  .card:hover .delete-btn { opacity: 1; }
  .delete-btn:hover { background: #e0484d; }

  .meta { padding: 6px 2px 0; min-width: 0; }
  .title {
    font-size: 13px;
    color: var(--text-primary);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .author {
    font-size: 11px;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
