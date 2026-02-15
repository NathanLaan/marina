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
  import { loadFeeds, loadTags, error, setupComplete, checkSetup } from './stores/app.js';
  import { loadTheme } from './stores/theme.js';
  import { startPolling, stopPolling } from './stores/sync.js';

  let sidebarWidth = 240;
  let showAddModal = false;
  let showEditModal = false;
  let showSettingsModal = false;
  let showSyncModal = false;
  let showTagsModal = false;
  let loading = true;

  onMount(async () => {
    const isReady = await checkSetup();
    if (isReady) {
      await loadTheme();
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
    await loadTheme();
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
  <SetupDialog on:complete={handleSetupComplete} />
{:else}
  <div class="app-shell">
    <Toolbar
      on:addFeed={() => (showAddModal = true)}
      on:editFeed={() => (showEditModal = true)}
      on:openSettings={() => (showSettingsModal = true)}
      on:openSync={() => (showSyncModal = true)}
      on:openTags={() => (showTagsModal = true)}
    />
    <div class="main-content">
      <Sidebar bind:width={sidebarWidth} />
      <EntryList />
      <ContentViewer />
    </div>
  </div>

  {#if $error}
    <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
    <div class="error-toast" role="alert" on:click={() => error.set(null)} on:keydown={(e) => e.key === 'Escape' && error.set(null)}>
      <i class="fas fa-exclamation-circle"></i>
      <span>{$error}</span>
      <button class="error-dismiss" on:click|stopPropagation={() => error.set(null)}><i class="fas fa-times"></i></button>
    </div>
  {/if}

  {#if showAddModal}
    <AddFeedModal on:close={() => (showAddModal = false)} />
  {/if}

  {#if showEditModal}
    <EditFeedModal on:close={() => (showEditModal = false)} />
  {/if}

  {#if showSettingsModal}
    <SettingsModal on:close={() => (showSettingsModal = false)} />
  {/if}

  {#if showSyncModal}
    <SyncModal on:close={() => (showSyncModal = false)} />
  {/if}

  {#if showTagsModal}
    <TagsModal on:close={() => (showTagsModal = false)} />
  {/if}
{/if}

<style>
  .loading-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    color: var(--color-text-muted);
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
    background-color: var(--color-danger);
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
