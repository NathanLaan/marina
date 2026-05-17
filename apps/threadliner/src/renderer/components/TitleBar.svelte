<script>
  import { selectedFeedId } from '../stores/app.js';

  let {
    onToggleToolbar,
    toolbarVisible = true,
    onAddFeed,
    onRefreshFeed,
    onOpenTags,
  } = $props();

  let isMaximized = $state(false);

  async function refreshMaximized() {
    if (window.api?.windowIsMaximized) {
      isMaximized = await window.api.windowIsMaximized();
    }
  }

  $effect(() => {
    refreshMaximized();
    const unsub = window.api?.onWindowMaximizedChange?.((v) => { isMaximized = v; });
    return () => { if (unsub) unsub(); };
  });

  function onTitlebarDblClick(e) {
    // Buttons own their own click handlers — don't let a double-click on
    // them bubble up and toggle max/restore.
    if (e.target.closest('button')) return;
    window.api?.windowMaximize();
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<div class="titlebar" ondblclick={onTitlebarDblClick}>
  <button
    class="titlebar-btn toolbar-toggle"
    class:active={toolbarVisible}
    onclick={onToggleToolbar}
    aria-label="Toggle toolbar"
    title="Toolbar"
  >
    <i class="fas fa-bars"></i>
  </button>

  <div class="titlebar-actions">
    <button class="titlebar-btn" onclick={onAddFeed} aria-label="Add Feed" title="Add Feed">
      <i class="fas fa-plus"></i>
    </button>
    <button
      class="titlebar-btn"
      onclick={onRefreshFeed}
      disabled={$selectedFeedId === null}
      aria-label="Refresh Feed"
      title="Refresh Feed"
    >
      <i class="fas fa-arrows-rotate"></i>
    </button>
    <button class="titlebar-btn" onclick={onOpenTags} aria-label="Tags" title="Tags">
      <i class="fas fa-tags"></i>
    </button>
  </div>

  <div class="titlebar-title">Threadliner</div>

  <div class="titlebar-controls">
    <button class="titlebar-btn" onclick={() => window.api?.windowMinimize()} aria-label="Minimize" title="Minimize">
      <i class="fas fa-window-minimize"></i>
    </button>
    <button
      class="titlebar-btn"
      onclick={() => window.api?.windowMaximize()}
      aria-label={isMaximized ? 'Restore' : 'Maximize'}
      title={isMaximized ? 'Restore' : 'Maximize'}
    >
      <i class={isMaximized ? 'fas fa-window-restore' : 'fas fa-window-maximize'}></i>
    </button>
    <button class="titlebar-btn close" onclick={() => window.api?.windowClose()} aria-label="Close" title="Close">
      <i class="fas fa-xmark"></i>
    </button>
  </div>
</div>

<style>
  .titlebar {
    display: flex;
    align-items: center;
    height: 32px;
    background: var(--accent);
    border-bottom: 1px solid var(--accent);
    -webkit-app-region: drag;
    flex-shrink: 0;
    user-select: none;
  }

  .titlebar-btn {
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
    transition: background 0.15s, opacity 0.15s;
  }

  .titlebar-btn:hover:not(:disabled) {
    background: rgba(0, 0, 0, 0.18);
    opacity: 1;
  }

  .titlebar-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .titlebar-btn.active {
    opacity: 1;
    background: rgba(0, 0, 0, 0.12);
  }

  .titlebar-actions {
    display: flex;
    -webkit-app-region: no-drag;
  }

  .titlebar-btn.close:hover {
    background: #e81123;
    color: #ffffff;
    opacity: 1;
  }

  .titlebar-title {
    flex: 1;
    text-align: center;
    font-size: 12px;
    color: var(--accent-on);
    opacity: 0.9;
    padding: 0 8px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    -webkit-app-region: drag;
  }

  .titlebar-controls {
    display: flex;
    align-items: center;
    -webkit-app-region: no-drag;
  }
</style>
