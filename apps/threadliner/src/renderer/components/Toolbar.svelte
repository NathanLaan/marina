<script>
  import { createEventDispatcher } from 'svelte';
  import { selectedFeedId, removeFeed, refreshFeed, selectedFeed } from '../stores/app.js';

  const dispatch = createEventDispatcher();

  function handleRemove() {
    if ($selectedFeedId === null) return;
    if (confirm(`Remove "${$selectedFeed?.title || 'this feed'}"? This will delete all its entries.`)) {
      removeFeed($selectedFeedId);
    }
  }

  function handleRefresh() {
    if ($selectedFeedId !== null) {
      refreshFeed($selectedFeedId);
    }
  }
</script>

<div class="toolbar">
  <div class="toolbar-group">
    <button class="toolbar-btn" title="Add Feed" on:click={() => dispatch('addFeed')}>
      <i class="fas fa-plus"></i>
    </button>
    <button
      class="toolbar-btn"
      title="Edit Feed"
      disabled={$selectedFeedId === null}
      on:click={() => dispatch('editFeed')}
    >
      <i class="fas fa-pen"></i>
    </button>
    <button
      class="toolbar-btn"
      title="Remove Feed"
      disabled={$selectedFeedId === null}
      on:click={handleRemove}
    >
      <i class="fas fa-trash"></i>
    </button>
    <button
      class="toolbar-btn"
      title="Refresh Feed"
      disabled={$selectedFeedId === null}
      on:click={handleRefresh}
    >
      <i class="fas fa-sync-alt"></i>
    </button>
  </div>
  <div class="toolbar-group">
    <button class="toolbar-btn" title="Settings" on:click={() => dispatch('openSettings')}>
      <i class="fas fa-cog"></i>
    </button>
  </div>
</div>

<style>
  .toolbar {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    width: 72px;
    background-color: var(--color-toolbar-bg);
    border-right: 1px solid var(--color-border);
    padding: 12px 0;
    flex-shrink: 0;
  }

  .toolbar-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 54px;
    height: 54px;
    border-radius: 9px;
    color: var(--color-text-muted);
    font-size: 21px;
    transition: background-color 0.15s, color 0.15s;
  }

  .toolbar-btn:hover:not(:disabled) {
    background-color: var(--color-surface-hover);
    color: var(--color-text);
  }

  .toolbar-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }
</style>
