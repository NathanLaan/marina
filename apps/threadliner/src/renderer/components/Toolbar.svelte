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
    onOpenHelp,
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
  <ToolbarButton icon="fa-plus"          title="Add Feed (Ctrl+N)"     label="Add Feed"     onclick={onAddFeed} />
  <ToolbarButton icon="fa-pen"           title="Edit Feed (Ctrl+E)"    label="Edit Feed"    disabled={$selectedFeedId === null} onclick={onEditFeed} />
  <ToolbarButton icon="fa-trash"         title="Remove Feed (Ctrl+D)"  label="Remove Feed"  disabled={$selectedFeedId === null} onclick={handleRemove} />
  <ToolbarButton icon="fa-arrows-rotate" title="Refresh Feed (F5)"     label="Refresh Feed" disabled={$selectedFeedId === null} onclick={handleRefresh} />

  <ToolbarDivider />

  <ToolbarButton icon="fa-check-double" title="Mark as Read (Ctrl+M)"         label="Mark as Read"   disabled={$selectedFeedId === null} onclick={handleMarkRead} />
  <ToolbarButton icon="fa-rotate-left"  title="Mark as Unread (Ctrl+Shift+M)" label="Mark as Unread" disabled={$selectedFeedId === null} onclick={handleMarkUnread} />

  <ToolbarDivider />

  <ToolbarButton icon="fa-tags" title="Tags (Ctrl+Shift+T)" label="Tags" active={tagsOpen} onclick={onOpenTags} />

  <ToolbarSpacer />

  <ToolbarButton
    icon="fa-cloud-arrow-up"
    title="Remote Sync (Ctrl+Shift+S)"
    label="Sync"
    active={syncOpen}
    extraClass={hasPendingSync && !syncOpen ? 'sync-pending' : ''}
    onclick={onOpenSync}
  />

  <ToolbarDivider />

  <ToolbarButton icon="fa-gear"            title="Settings (Ctrl+,)" label="Settings" active={settingsOpen} onclick={onOpenSettings} />
  <ToolbarButton icon="fa-circle-info"     title="About (Ctrl+I)"    label="About"    active={aboutOpen}    onclick={onOpenAbout} />
  <ToolbarButton icon="fa-circle-question" title="Help (F1)"         label="Help"     onclick={onOpenHelp} />
</ToolbarShell>
