<script>
  import { themeState } from '../theme/index.svelte.js';

  // Generic custom-titlebar bar. Consumers control:
  // - the centered app title via `appName`
  // - the action-button group between hamburger and spacer via `actions` snippet
  // - the toolbar-toggle behaviour via `onToggleToolbar` + `toolbarVisible`
  //
  // The window controls (min/max/close) are wired here against the IPC names
  // exposed by exposeWindowApi() in the preload helper, so they Just Work
  // when both halves of the library are in use.
  let {
    appName = '',
    onToggleToolbar,
    toolbarVisible = true,
    actions,
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
    // Buttons own their own click handlers — don't let a double-click on them
    // bubble up and toggle max/restore.
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

  {#if actions}
    <div class="titlebar-actions">
      {@render actions()}
    </div>
  {/if}

  <div class="titlebar-title">{appName}</div>

  <select
    class="titlebar-scale"
    aria-label="UI scale"
    title="UI scale"
    value={themeState.scale}
    onchange={(e) => themeState.setScale(e.currentTarget.value)}
  >
    {#each themeState.scaleList as scale (scale.id)}
      <option value={scale.id}>{scale.label}</option>
    {/each}
  </select>

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

  .titlebar-scale {
    -webkit-app-region: no-drag;
    height: 22px;
    margin: 0 6px;
    padding: 0 6px;
    background: rgba(0, 0, 0, 0.18);
    color: var(--accent-on);
    border: 1px solid rgba(0, 0, 0, 0.18);
    border-radius: 4px;
    font-size: 11px;
    line-height: 1;
    opacity: 0.85;
    transition: background 0.15s, opacity 0.15s;
  }

  .titlebar-scale:hover {
    background: rgba(0, 0, 0, 0.28);
    opacity: 1;
  }

  .titlebar-scale option {
    background: var(--bg-surface);
    color: var(--text-primary);
  }
</style>
