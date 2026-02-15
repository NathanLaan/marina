<script>
  import { entries, selectedEntryId, selectedFeedId, selectedFeed, isLoading, selectEntry } from '../stores/app.js';

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  }
</script>

<div class="entry-list">
  <div class="entry-list-header">
    <h2>
      {#if $selectedFeed}
        {$selectedFeed.title}
      {:else}
        Entries
      {/if}
    </h2>
  </div>
  <div class="entries">
    {#if $selectedFeedId === null}
      <div class="empty-state">
        <p class="empty-text">Select a feed to view entries.</p>
      </div>
    {:else if $isLoading}
      <div class="empty-state">
        <i class="fas fa-spinner fa-spin"></i>
        <p class="empty-text">Loading entries...</p>
      </div>
    {:else if $entries.length === 0}
      <div class="empty-state">
        <p class="empty-text">No entries in this feed.</p>
      </div>
    {:else}
      {#each $entries as entry (entry.id)}
        <button
          class="entry-item"
          class:active={$selectedEntryId === entry.id}
          class:unread={!entry.is_read}
          on:click={() => selectEntry(entry.id)}
        >
          <span class="entry-title">{entry.title || '(Untitled)'}</span>
          <span class="entry-meta">
            {#if entry.author}
              <span class="entry-author">{entry.author}</span>
            {/if}
            {#if entry.published_at}
              <span class="entry-date">{formatDate(entry.published_at)}</span>
            {/if}
          </span>
        </button>
      {/each}
    {/if}
  </div>
</div>

<style>
  .entry-list {
    display: flex;
    flex-direction: column;
    width: 320px;
    min-width: 250px;
    border-right: 1px solid var(--color-border);
    background-color: var(--color-surface);
    flex-shrink: 0;
    overflow: hidden;
  }

  .entry-list-header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-border);
  }

  .entry-list-header h2 {
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--color-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .entries {
    flex: 1;
    overflow-y: auto;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
    gap: 8px;
    color: var(--color-text-muted);
  }

  .empty-text {
    color: var(--color-text-muted);
    font-size: 13px;
    text-align: center;
  }

  .entry-item {
    display: flex;
    flex-direction: column;
    width: 100%;
    padding: 10px 16px;
    text-align: left;
    gap: 4px;
    border-bottom: 1px solid var(--color-border);
    transition: background-color 0.1s;
  }

  .entry-item:hover {
    background-color: var(--color-surface-hover);
  }

  .entry-item.active {
    background-color: var(--color-surface-active);
  }

  .entry-item.unread .entry-title {
    font-weight: 600;
    color: var(--color-text);
  }

  .entry-title {
    font-size: 13px;
    color: var(--color-text-muted);
    font-weight: 400;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.4;
  }

  .entry-meta {
    display: flex;
    gap: 8px;
    font-size: 11px;
    color: var(--color-text-muted);
    opacity: 0.7;
  }

  .entry-author {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 140px;
  }
</style>
