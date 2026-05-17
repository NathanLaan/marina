<script>
  import {
    Toolbar as ToolbarShell, ToolbarButton, ToolbarDivider, ToolbarSpacer,
  } from '@marina/desktop-ui/components';
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

<ToolbarShell>
  <ToolbarButton icon="fa-plus"        title="Add Feed"     label="Add Feed"     onclick={onAddFeed} />
  <ToolbarButton icon="fa-pen"         title="Edit Feed"    label="Edit Feed"    disabled={$selectedFeedId === null} onclick={onEditFeed} />
  <ToolbarButton icon="fa-trash"       title="Remove Feed"  label="Remove Feed"  disabled={$selectedFeedId === null} onclick={handleRemove} />
  <ToolbarButton icon="fa-arrows-rotate" title="Refresh Feed" label="Refresh Feed" disabled={$selectedFeedId === null} onclick={handleRefresh} />

  <ToolbarDivider />

  <ToolbarButton icon="fa-check-double" title="Mark as Read"   label="Mark as Read"   disabled={$selectedFeedId === null} onclick={handleMarkRead} />
  <ToolbarButton icon="fa-rotate-left"  title="Mark as Unread" label="Mark as Unread" disabled={$selectedFeedId === null} onclick={handleMarkUnread} />

  <ToolbarDivider />

  <ToolbarButton icon="fa-tags" title="Tags" label="Tags" active={tagsOpen} onclick={onOpenTags} />

  <ToolbarSpacer />

  <ToolbarButton
    icon="fa-cloud-arrow-up"
    title="Remote Sync"
    label="Sync"
    active={syncOpen}
    extraClass={hasPendingSync && !syncOpen ? 'sync-pending' : ''}
    onclick={onOpenSync}
  />

  <ToolbarDivider />

  <ToolbarButton icon="fa-gear"        title="Settings" label="Settings" active={settingsOpen} onclick={onOpenSettings} />
  <ToolbarButton icon="fa-circle-info" title="About"    label="About"    active={aboutOpen}    onclick={onOpenAbout} />
</ToolbarShell>

<style>
  /* The library ToolbarButton supports an `extraClass` hook for app-specific
     visual states. Threadliner's auto-sync engine flips syncStatus to
     'committing' or 'waiting' between user actions — tint the Sync button
     accent so the user notices a push is queued without needing to open the
     modal. The selector is :global() because ToolbarButton scopes its own
     CSS class to itself. */
  :global(.toolbar-btn.sync-pending) {
    color: var(--accent);
  }
</style>
