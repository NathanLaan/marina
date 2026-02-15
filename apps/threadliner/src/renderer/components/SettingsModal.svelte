<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { theme, setTheme } from '../stores/theme.js';

  const dispatch = createEventDispatcher();

  let activeTab = 'theme';
  let syncWaitTime = '10';

  const themes = [
    { id: 'light', label: 'Light', description: 'Clean and bright' },
    { id: 'dark', label: 'Dark', description: 'Easy on the eyes' },
    { id: 'midnight', label: 'Midnight', description: 'Deep blue tones' },
  ];

  const waitTimeOptions = [
    { value: '5', label: '5 seconds' },
    { value: '10', label: '10 seconds' },
    { value: '30', label: '30 seconds' },
    { value: '60', label: '60 seconds' },
  ];

  onMount(async () => {
    const saved = await window.api.getSetting('syncWaitTime');
    if (saved) syncWaitTime = String(saved);
  });

  async function handleWaitTimeChange() {
    await window.api.setSetting('syncWaitTime', syncWaitTime);
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') dispatch('close');
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="modal-overlay" on:mousedown|self={() => dispatch('close')} on:keydown={handleKeydown}>
  <div class="modal">
    <div class="modal-header">
      <h3>Settings</h3>
      <button class="close-btn" on:click={() => dispatch('close')}>
        <i class="fas fa-times"></i>
      </button>
    </div>

    <div class="modal-body">
      <div class="tabs">
        <button
          class="tab"
          class:active={activeTab === 'theme'}
          on:click={() => (activeTab = 'theme')}
        >
          <i class="fas fa-palette"></i> Theme
        </button>
        <button
          class="tab"
          class:active={activeTab === 'sync'}
          on:click={() => (activeTab = 'sync')}
        >
          <i class="fas fa-cloud"></i> Sync
        </button>
      </div>

      <div class="tab-content">
        {#if activeTab === 'theme'}
          <div class="theme-grid">
            {#each themes as t (t.id)}
              <button
                class="theme-card"
                class:selected={$theme === t.id}
                on:click={() => setTheme(t.id)}
              >
                <div class="theme-preview" data-theme={t.id}>
                  <div class="preview-toolbar"></div>
                  <div class="preview-sidebar"></div>
                  <div class="preview-content">
                    <div class="preview-line"></div>
                    <div class="preview-line short"></div>
                  </div>
                </div>
                <span class="theme-label">{t.label}</span>
                <span class="theme-desc">{t.description}</span>
                {#if $theme === t.id}
                  <i class="fas fa-check theme-check"></i>
                {/if}
              </button>
            {/each}
          </div>
        {/if}

        {#if activeTab === 'sync'}
          <div class="setting-group">
            <label class="setting-label">
              <span class="setting-title">Sync Wait Time</span>
              <span class="setting-desc">How long to wait after a change before pushing to the remote repository.</span>
              <select bind:value={syncWaitTime} on:change={handleWaitTimeChange}>
                {#each waitTimeOptions as opt (opt.value)}
                  <option value={opt.value}>{opt.label}</option>
                {/each}
              </select>
            </label>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .modal {
    background-color: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    width: 520px;
    max-width: 90vw;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--color-border);
  }

  h3 {
    font-size: 16px;
    font-weight: 600;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    color: var(--color-text-muted);
    font-size: 14px;
  }

  .close-btn:hover {
    background-color: var(--color-surface-hover);
    color: var(--color-text);
  }

  .modal-body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .tabs {
    display: flex;
    flex-direction: column;
    width: 140px;
    padding: 8px;
    border-right: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
    color: var(--color-text-muted);
    text-align: left;
  }

  .tab:hover {
    background-color: var(--color-surface-hover);
    color: var(--color-text);
  }

  .tab.active {
    background-color: var(--color-surface-active);
    color: var(--color-text);
    font-weight: 500;
  }

  .tab-content {
    flex: 1;
    padding: 20px;
    overflow-y: auto;
  }

  .theme-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .theme-card {
    position: relative;
    display: grid;
    grid-template-columns: 80px 1fr;
    grid-template-rows: auto auto;
    gap: 2px 12px;
    align-items: center;
    padding: 12px;
    border-radius: 8px;
    border: 2px solid var(--color-border);
    text-align: left;
    transition: border-color 0.15s;
  }

  .theme-card:hover {
    border-color: var(--color-text-muted);
  }

  .theme-card.selected {
    border-color: var(--color-accent);
  }

  .theme-preview {
    grid-row: 1 / 3;
    display: flex;
    height: 48px;
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid var(--color-border);
  }

  .preview-toolbar {
    width: 8px;
    background-color: var(--color-toolbar-bg);
  }

  .preview-sidebar {
    width: 18px;
    background-color: var(--color-sidebar-bg);
    border-right: 1px solid var(--color-border);
  }

  .preview-content {
    flex: 1;
    background-color: var(--color-bg);
    padding: 8px 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    justify-content: center;
  }

  .preview-line {
    height: 3px;
    border-radius: 1px;
    background-color: var(--color-text-muted);
    opacity: 0.4;
  }

  .preview-line.short {
    width: 60%;
  }

  .theme-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text);
  }

  .theme-desc {
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .theme-check {
    position: absolute;
    top: 12px;
    right: 12px;
    color: var(--color-accent);
    font-size: 14px;
  }

  .setting-group {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .setting-label {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .setting-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text);
  }

  .setting-desc {
    font-size: 12px;
    color: var(--color-text-muted);
    margin-bottom: 4px;
  }

  select {
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid var(--color-border);
    background-color: var(--color-bg);
    color: var(--color-text);
    font-family: inherit;
    font-size: 13px;
    outline: none;
    cursor: pointer;
    width: 100%;
  }

  select:focus {
    border-color: var(--color-accent);
  }
</style>
