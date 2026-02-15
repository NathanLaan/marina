<script>
  import { createEventDispatcher } from 'svelte';
  import {
    selectedFeedId, selectedEntryId, selectedFeed,
    removeFeed, refreshFeed,
    markAllRead, markAllUnread,
    markEntryRead, markEntryUnread,
  } from '../stores/app.js';
  import { syncStatus } from '../stores/sync.js';

  $: hasPendingSync = $syncStatus === 'committing' || $syncStatus === 'waiting';

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

  function handleMarkRead() {
    if ($selectedFeedId === null) return;
    if ($selectedEntryId !== null) {
      markEntryRead($selectedEntryId, $selectedFeedId);
    } else {
      markAllRead($selectedFeedId);
    }
  }

  function handleMarkUnread() {
    if ($selectedFeedId === null) return;
    if ($selectedEntryId !== null) {
      markEntryUnread($selectedEntryId, $selectedFeedId);
    } else {
      markAllUnread($selectedFeedId);
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
    <div class="toolbar-divider"></div>
    <button
      class="toolbar-btn"
      title="Mark as Read"
      disabled={$selectedFeedId === null}
      on:click={handleMarkRead}
    >
      <i class="fas fa-check-double"></i>
    </button>
    <button
      class="toolbar-btn"
      title="Mark as Unread"
      disabled={$selectedFeedId === null}
      on:click={handleMarkUnread}
    >
      <i class="fas fa-rotate-left"></i>
    </button>
  </div>
  <div class="toolbar-group">
    <button class="toolbar-btn" class:sync-pending={hasPendingSync} title="Sync" on:click={() => dispatch('openSync')}>
      <i class="fas fa-cloud"></i>
    </button>
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

  .toolbar-divider {
    width: 32px;
    height: 1px;
    background-color: var(--color-border);
    margin: 4px 0;
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

  .toolbar-btn.sync-pending {
    color: var(--color-accent);
  }
</style>
