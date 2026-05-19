<script>
  import { onMount, onDestroy } from 'svelte';
  import { TitleBar, AboutModal } from '@marina/desktop-ui/components';
  import Toolbar from './components/Toolbar.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import EntryList from './components/EntryList.svelte';
  import ContentViewer from './components/ContentViewer.svelte';
  import AddFeedModal from './components/AddFeedModal.svelte';
  import EditFeedModal from './components/EditFeedModal.svelte';
  import SettingsModal from './components/SettingsModal.svelte';
  import SyncModal from './components/SyncModal.svelte';
  import SetupDialog from './components/SetupDialog.svelte';
  import TagsModal from './components/TagsModal.svelte';
  import {
    loadFeeds, loadTags, error, setupComplete, checkSetup,
    selectedFeedId, selectedEntryId, selectedFeed, refreshFeed, entries,
    removeFeed, markAllRead, markAllUnread, markEntryRead, markEntryUnread,
  } from './stores/app.js';
  import { themeState } from '@marina/desktop-ui/theme';
  import { updateState } from './stores/update.svelte.js';
  import { startPolling, stopPolling } from './stores/sync.js';

  let sidebarWidth = $state(240);
  let entryListWidth = $state(320);
  let showAddModal = $state(false);
  let showEditModal = $state(false);
  let showSettingsModal = $state(false);
  let showSyncModal = $state(false);
  let showTagsModal = $state(false);
  let showAboutModal = $state(false);
  let loading = $state(true);
  let customTitlebar = $state(false);
  let toolbarVisible = $state(true);
  let appVersion = $state('');
  let unsubFeedsUpdated = null;

  const TITLEBAR_HEIGHT = '32px';

  async function handleFeedsUpdated(payload) {
    await loadFeeds();
    if ($selectedFeedId !== null && payload?.updatedFeeds?.some((f) => f.id === $selectedFeedId)) {
      const fresh = await window.api.getEntries($selectedFeedId);
      entries.set(fresh);
    }
  }

  function isTypingTarget(t) {
    if (!t) return false;
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return true;
    return !!t.isContentEditable;
  }

  function anyModalOpen() {
    return showAddModal || showEditModal || showSettingsModal
        || showSyncModal || showTagsModal || showAboutModal;
  }

  function handleMarkReadShortcut() {
    if ($selectedFeedId === null) return;
    if ($selectedEntryId !== null) markEntryRead($selectedEntryId, $selectedFeedId);
    else markAllRead($selectedFeedId);
  }

  function handleMarkUnreadShortcut() {
    if ($selectedFeedId === null) return;
    if ($selectedEntryId !== null) markEntryUnread($selectedEntryId, $selectedFeedId);
    else markAllUnread($selectedFeedId);
  }

  function handleRemoveShortcut() {
    if ($selectedFeedId === null) return;
    // Matches Toolbar.handleRemove — same confirm copy so the keyboard path
    // and the button path behave identically.
    if (confirm(`Remove "${$selectedFeed?.title || 'this feed'}"? This will delete all its entries.`)) {
      removeFeed($selectedFeedId);
    }
  }

  function handleGlobalKeydown(e) {
    if (isTypingTarget(e.target)) return;

    const mod = e.ctrlKey || e.metaKey;

    // Zoom is intentionally always-on, even with a modal open, so users can
    // resize the UI mid-flow. Match the existing Ctrl+= / Ctrl+- / Ctrl+0
    // handling, including the shift-invert "+" / "_" variants.
    if (mod && !e.altKey && !e.shiftKey) {
      if (e.key === '=' || e.key === '+') { e.preventDefault(); themeState.zoomIn();    return; }
      if (e.key === '-' || e.key === '_') { e.preventDefault(); themeState.zoomOut();   return; }
      if (e.key === '0')                  { e.preventDefault(); themeState.zoomReset(); return; }
    }

    // Everything below is gated on setup-complete + no modal open, so a
    // shortcut can't open a second modal on top of the first.
    if (!$setupComplete || anyModalOpen()) return;

    // F-key shortcuts (no modifier required).
    if (e.key === 'F1') {
      e.preventDefault();
      window.api?.openHelpWindow?.();
      return;
    }
    if (e.key === 'F5') {
      e.preventDefault();
      if ($selectedFeedId !== null) refreshFeed($selectedFeedId);
      return;
    }

    if (!mod || e.altKey) return;

    if (e.shiftKey) {
      switch (e.key.toLowerCase()) {
        case 't': e.preventDefault(); showTagsModal = true; return;
        case 's': e.preventDefault(); showSyncModal = true; return;
        case 'e': e.preventDefault(); toolbarVisible = !toolbarVisible; return;
        case 'm': e.preventDefault(); handleMarkUnreadShortcut(); return;
      }
      return;
    }

    switch (e.key.toLowerCase()) {
      case 'n': e.preventDefault(); showAddModal = true; return;
      case 'e':
        e.preventDefault();
        if ($selectedFeedId !== null) showEditModal = true;
        return;
      case 'd': e.preventDefault(); handleRemoveShortcut();    return;
      case 'm': e.preventDefault(); handleMarkReadShortcut();  return;
      case 'i': e.preventDefault(); showAboutModal = true;     return;
      case ',': e.preventDefault(); showSettingsModal = true;  return;
    }
  }

  async function loadUIPrefs() {
    if (!window.api?.getUIPrefs) return;
    try {
      const prefs = await window.api.getUIPrefs();
      customTitlebar = !!prefs?.customTitlebar;
      // The CSS var feeds modal overlays so they offset below the titlebar.
      document.documentElement.style.setProperty(
        '--titlebar-height',
        customTitlebar ? TITLEBAR_HEIGHT : '0px'
      );
    } catch { /* non-critical */ }
  }

  function handleRefreshFromTitlebar() {
    if ($selectedFeedId !== null) refreshFeed($selectedFeedId);
  }

  onMount(async () => {
    // Theme has been applied synchronously from localStorage in main.js;
    // hydrate from settings so a fresh install on a synced data dir picks up
    // the saved value too.
    themeState.hydrateFromSettings();
    await loadUIPrefs();
    try { appVersion = await window.api.getAppVersion(); } catch { appVersion = 'x.x.x'; }
    window.addEventListener('keydown', handleGlobalKeydown);
    const isReady = await checkSetup();
    if (isReady) {
      await loadFeeds();
      await loadTags();
      startPolling();
      unsubFeedsUpdated = window.api?.onFeedsUpdated?.(handleFeedsUpdated);
    }
    loading = false;
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleGlobalKeydown);
    stopPolling();
    if (unsubFeedsUpdated) {
      unsubFeedsUpdated();
      unsubFeedsUpdated = null;
    }
  });

  async function handleSetupComplete() {
    setupComplete.set(true);
    themeState.hydrateFromSettings();
    await loadFeeds();
    await loadTags();
    startPolling();
    if (!unsubFeedsUpdated) {
      unsubFeedsUpdated = window.api?.onFeedsUpdated?.(handleFeedsUpdated);
    }
  }
</script>

{#snippet titlebarActions()}
  <button class="title-action" onclick={() => (showAddModal = true)} aria-label="Add Feed" title="Add Feed (Ctrl+N)">
    <i class="fas fa-plus"></i>
  </button>
  <button
    class="title-action"
    onclick={handleRefreshFromTitlebar}
    disabled={$selectedFeedId === null}
    aria-label="Refresh Feed"
    title="Refresh Feed (F5)"
  >
    <i class="fas fa-arrows-rotate"></i>
  </button>
  <button class="title-action" onclick={() => (showTagsModal = true)} aria-label="Tags" title="Tags (Ctrl+Shift+T)">
    <i class="fas fa-tags"></i>
  </button>
{/snippet}

<div class="app-layout">
  {#if customTitlebar}
    <TitleBar
      appName="Threadliner"
      onToggleToolbar={() => (toolbarVisible = !toolbarVisible)}
      {toolbarVisible}
      actions={titlebarActions}
    />
  {/if}

  <div class="app-body">
    {#if loading}
      <div class="loading-screen">
        <i class="fas fa-rss fa-3x"></i>
      </div>
    {:else if !$setupComplete}
      <SetupDialog onComplete={handleSetupComplete} />
    {:else}
      <div class="app-shell">
        {#if toolbarVisible}
          <Toolbar
            onAddFeed={() => (showAddModal = true)}
            onEditFeed={() => (showEditModal = true)}
            onOpenSettings={() => (showSettingsModal = true)}
            onOpenSync={() => (showSyncModal = true)}
            onOpenTags={() => (showTagsModal = true)}
            onOpenAbout={() => (showAboutModal = true)}
            onOpenHelp={() => window.api?.openHelpWindow?.()}
            syncOpen={showSyncModal}
            settingsOpen={showSettingsModal}
            tagsOpen={showTagsModal}
            aboutOpen={showAboutModal}
          />
        {/if}
        <div class="main-content">
          <Sidebar bind:width={sidebarWidth} />
          <EntryList bind:width={entryListWidth} />
          <ContentViewer />
        </div>
      </div>
    {/if}
  </div>
</div>

{#if !loading && $setupComplete}
  {#if $error}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="error-toast" role="alert" onclick={() => error.set(null)} onkeydown={(e) => e.key === 'Escape' && error.set(null)}>
      <i class="fas fa-exclamation-circle"></i>
      <span>{$error}</span>
      <button class="error-dismiss" aria-label="Dismiss" onclick={(e) => { e.stopPropagation(); error.set(null); }}><i class="fas fa-times"></i></button>
    </div>
  {/if}

  {#if showAddModal}
    <AddFeedModal onClose={() => (showAddModal = false)} />
  {/if}

  {#if showEditModal}
    <EditFeedModal onClose={() => (showEditModal = false)} />
  {/if}

  {#if showSettingsModal}
    <SettingsModal onClose={() => (showSettingsModal = false)} />
  {/if}

  {#if showSyncModal}
    <SyncModal onClose={() => (showSyncModal = false)} />
  {/if}

  {#if showTagsModal}
    <TagsModal onClose={() => (showTagsModal = false)} />
  {/if}

  {#if showAboutModal}
    <AboutModal
      appName="Threadliner"
      version={appVersion}
      description="A desktop RSS reader built with Electron, Svelte, and Git-synced JSON."
      repoUrl="https://github.com/NathanLaan/threadline"
      repoLabel="github.com/NathanLaan/threadline"
      iconClass="fa-rss"
      {updateState}
      onClose={() => (showAboutModal = false)}
    />
  {/if}
{/if}

<style>
  .loading-screen {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
  }

  /* Zoom + viewport sizing live on the outer layout so the custom titlebar
     scales with --ui-zoom alongside the rest of the UI. */
  .app-layout {
    display: flex;
    flex-direction: column;
    zoom: var(--ui-zoom, 1);
    height: var(--ui-zoom-height, 100vh);
    width: var(--ui-zoom-width, 100vw);
    overflow: hidden;
  }

  .app-body {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .app-shell {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .main-content {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .error-toast {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 18px;
    background-color: var(--danger);
    color: #ffffff;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25), 0 2px 6px rgba(0, 0, 0, 0.12);
    font-size: 13px;
    cursor: pointer;
    z-index: 1500;
    max-width: 500px;
  }

  .error-dismiss {
    color: #ffffff;
    opacity: 0.75;
    margin-left: 4px;
    transition: opacity 0.15s;
  }

  .error-dismiss:hover {
    opacity: 1;
  }

  /* Match the look of the library's .titlebar-btn for action buttons we
     inject through the <TitleBar actions={...}> snippet. */
  .title-action {
    -webkit-app-region: no-drag;
    width: 48px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-on);
    opacity: 0.75;
    font-size: 12px;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
  }

  .title-action:hover:not(:disabled) {
    background: rgba(0, 0, 0, 0.18);
    opacity: 1;
  }

  .title-action:disabled {
    opacity: 0.35;
    cursor: default;
  }

  /* The library ToolbarButton exposes an `extraClass` hook for app-specific
     visual states. Threadliner's auto-sync engine flips syncStatus to
     'committing' or 'waiting' between user actions — tint the Sync button's
     icon so the user notices a push is queued without needing to open the
     modal. :global() opts out of Svelte's CSS scoping because ToolbarButton
     owns its own `.toolbar-btn` selector. */
  :global(.toolbar-btn.sync-pending) {
    color: var(--accent);
  }
</style>
