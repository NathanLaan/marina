<script>
  import {
    selectedFeedId, selectedEntryId, selectedFeed,
    removeFeed, refreshFeed,
    markAllRead, markAllUnread,
    markEntryRead, markEntryUnread,
  } from '../stores/app.js';
  import { syncStatus } from '../stores/sync.js';

  let {
    onAddFeed,
    onEditFeed,
    onOpenSettings,
    onOpenSync,
    onOpenTags,
    onOpenAbout,
    syncOpen = false,
    settingsOpen = false,
    tagsOpen = false,
    aboutOpen = false,
  } = $props();

  const hasPendingSync = $derived($syncStatus === 'committing' || $syncStatus === 'waiting');

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
  <button class="toolbar-btn" title="Add Feed" aria-label="Add Feed" onclick={onAddFeed}>
    <i class="fas fa-plus"></i>
  </button>
  <button
    class="toolbar-btn"
    title="Edit Feed"
    aria-label="Edit Feed"
    disabled={$selectedFeedId === null}
    onclick={onEditFeed}
  >
    <i class="fas fa-pen"></i>
  </button>
  <button
    class="toolbar-btn"
    title="Remove Feed"
    aria-label="Remove Feed"
    disabled={$selectedFeedId === null}
    onclick={handleRemove}
  >
    <i class="fas fa-trash"></i>
  </button>
  <button
    class="toolbar-btn"
    title="Refresh Feed"
    aria-label="Refresh Feed"
    disabled={$selectedFeedId === null}
    onclick={handleRefresh}
  >
    <i class="fas fa-arrows-rotate"></i>
  </button>

  <div class="toolbar-divider"></div>

  <button
    class="toolbar-btn"
    title="Mark as Read"
    aria-label="Mark as Read"
    disabled={$selectedFeedId === null}
    onclick={handleMarkRead}
  >
    <i class="fas fa-check-double"></i>
  </button>
  <button
    class="toolbar-btn"
    title="Mark as Unread"
    aria-label="Mark as Unread"
    disabled={$selectedFeedId === null}
    onclick={handleMarkUnread}
  >
    <i class="fas fa-rotate-left"></i>
  </button>

  <div class="toolbar-divider"></div>

  <button class="toolbar-btn" class:active={tagsOpen} title="Tags" aria-label="Tags" onclick={onOpenTags}>
    <i class="fas fa-tags"></i>
  </button>

  <div class="toolbar-spacer"></div>

  <button
    class="toolbar-btn"
    class:active={syncOpen}
    class:sync-pending={hasPendingSync && !syncOpen}
    title="Remote Sync"
    aria-label="Sync"
    onclick={onOpenSync}
  >
    <i class="fas fa-cloud-arrow-up"></i>
  </button>

  <div class="toolbar-divider"></div>

  <button class="toolbar-btn" class:active={settingsOpen} title="Settings" aria-label="Settings" onclick={onOpenSettings}>
    <i class="fas fa-gear"></i>
  </button>

  <button class="toolbar-btn" class:active={aboutOpen} title="About" aria-label="About" onclick={onOpenAbout}>
    <i class="fas fa-circle-info"></i>
  </button>
</div>

<style>
  .toolbar {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 48px;
    background: var(--bg-overlay);
    border-right: 1px solid var(--border);
    padding: 8px 0;
    flex-shrink: 0;
    gap: 4px;
  }

  .toolbar-btn {
    position: relative;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    color: var(--text-secondary);
    font-size: 16px;
    transition: background 0.15s, color 0.15s;
  }

  .toolbar-btn:hover:not(:disabled) {
    background: var(--bg-button);
    color: var(--text-primary);
  }

  .toolbar-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .toolbar-btn:disabled:hover {
    background: none;
    color: var(--text-secondary);
  }

  .toolbar-btn.active {
    background: var(--bg-selected);
    outline: 1px solid var(--accent);
    color: var(--accent);
  }

  /* Pending sync state — accent tint without the full active outline. */
  .toolbar-btn.sync-pending {
    color: var(--accent);
  }

  .toolbar-divider {
    width: 24px;
    height: 1px;
    background: var(--border);
    margin: 2px 0;
  }

  .toolbar-spacer {
    flex: 1;
  }
</style>
