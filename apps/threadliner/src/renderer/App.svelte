<script>
  import { onMount, onDestroy } from 'svelte';
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
  import AboutModal from './components/AboutModal.svelte';
  import { loadFeeds, loadTags, error, setupComplete, checkSetup } from './stores/app.js';
  import { themeState } from './stores/theme.svelte.js';
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

  onMount(async () => {
    // Theme has been applied synchronously from localStorage in main.js;
    // hydrate from settings so a fresh install on a synced data dir picks up
    // the saved value too.
    themeState.hydrateFromSettings();
    const isReady = await checkSetup();
    if (isReady) {
      await loadFeeds();
      await loadTags();
      startPolling();
    }
    loading = false;
  });

  onDestroy(() => {
    stopPolling();
  });

  async function handleSetupComplete() {
    setupComplete.set(true);
    themeState.hydrateFromSettings();
    await loadFeeds();
    await loadTags();
    startPolling();
  }
</script>

{#if loading}
  <div class="loading-screen">
    <i class="fas fa-rss fa-3x"></i>
  </div>
{:else if !$setupComplete}
  <SetupDialog onComplete={handleSetupComplete} />
{:else}
  <div class="app-shell">
    <Toolbar
      onAddFeed={() => (showAddModal = true)}
      onEditFeed={() => (showEditModal = true)}
      onOpenSettings={() => (showSettingsModal = true)}
      onOpenSync={() => (showSyncModal = true)}
      onOpenTags={() => (showTagsModal = true)}
      onOpenAbout={() => (showAboutModal = true)}
      syncOpen={showSyncModal}
      settingsOpen={showSettingsModal}
      tagsOpen={showTagsModal}
      aboutOpen={showAboutModal}
    />
    <div class="main-content">
      <Sidebar bind:width={sidebarWidth} />
      <EntryList bind:width={entryListWidth} />
      <ContentViewer />
    </div>
  </div>

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
    <AboutModal onClose={() => (showAboutModal = false)} />
  {/if}
{/if}

<style>
  .loading-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    color: var(--text-muted);
  }

  .app-shell {
    display: flex;
    height: 100vh;
    overflow: hidden;
  }

  .main-content {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .error-toast {
    position: fixed;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background-color: var(--danger);
    color: white;
    border-radius: 8px;
    font-size: 13px;
    cursor: pointer;
    z-index: 1000;
    max-width: 500px;
  }

  .error-dismiss {
    color: white;
    opacity: 0.7;
    margin-left: 4px;
  }

  .error-dismiss:hover {
    opacity: 1;
  }
</style>
