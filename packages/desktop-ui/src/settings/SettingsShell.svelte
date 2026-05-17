<script>
  // Drawer-style Settings modal chrome. Consumers pass a `tabs` array of
  // `{ id, label, render }` where `render` is a Svelte snippet that renders
  // the body for that tab. The shell handles the overlay, accent header,
  // top tab strip, body scroll, and the OK button in the footer.
  //
  // Pair this with the atomic primitives in this module (ThemeList,
  // ScaleList, ToggleOption, RestartBanner, ShortcutsList) so an app's tab
  // snippets are mostly composition.
  let {
    onClose,
    tabs = [],
    activeTab = $bindable(tabs[0]?.id),
    title = 'Settings',
  } = $props();

  function focusOnMount(node) {
    node.focus();
  }

  function handleKeydown(e) {
    if (e.key === 'Escape' || e.key === 'Enter') onClose();
  }

  const currentTab = $derived(tabs.find((t) => t.id === activeTab) ?? tabs[0]);
</script>

<div
  class="modal-overlay"
  use:focusOnMount
  onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}
  onkeydown={handleKeydown}
  role="dialog"
  aria-modal="true"
  tabindex="-1"
>
  <div class="modal">
    <div class="modal-header">
      <h2>{title}</h2>
    </div>

    <div class="tab-bar">
      {#each tabs as t (t.id)}
        <button class="tab" class:active={activeTab === t.id} onclick={() => (activeTab = t.id)}>
          {t.label}
        </button>
      {/each}
    </div>

    <div class="modal-body">
      {#if currentTab?.render}
        {@render currentTab.render()}
      {/if}
    </div>

    <div class="modal-footer">
      <button class="close-btn" onclick={onClose}>OK</button>
    </div>
  </div>
</div>

<style>
  .tab-bar {
    display: flex;
    border-bottom: 1px solid var(--border);
    padding: 0 24px;
    gap: 0;
    flex-shrink: 0;
  }

  .tab {
    padding: 10px 16px;
    font-size: 13px;
    color: var(--text-muted);
    border-bottom: 2px solid transparent;
    transition: color 0.15s, border-color 0.15s;
    margin-bottom: -1px;
  }

  .tab:hover {
    color: var(--text-primary);
  }

  .tab.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    padding: 12px 24px;
    border-top: 1px solid var(--border);
  }

  .close-btn {
    padding: 8px 24px;
    background: var(--bg-selected);
    outline: 1px solid var(--accent);
    color: var(--accent);
    border-radius: 6px;
    transition: background 0.15s, color 0.15s;
  }

  .close-btn:hover {
    background: var(--accent);
    color: var(--accent-on);
  }
</style>
