<script>
  import { onMount } from 'svelte';
  import { themeState } from '../stores/theme.svelte.js';

  let { onClose } = $props();

  let activeTab = $state('ui');
  let syncWaitTime = $state('10');

  const waitTimeOptions = [
    { value: '5', label: '5 seconds' },
    { value: '10', label: '10 seconds' },
    { value: '30', label: '30 seconds' },
    { value: '60', label: '60 seconds' },
  ];

  // Static list — keyboard bindings beyond Escape aren't wired yet; this will
  // populate from a command registry in a follow-up stage (see plan §11).
  const shortcuts = [
    { keys: 'Esc', action: 'Close modal', section: 'General' },
  ];

  onMount(async () => {
    const saved = await window.api.getSetting('syncWaitTime');
    if (saved) syncWaitTime = String(saved);
  });

  async function handleWaitTimeChange() {
    await window.api.setSetting('syncWaitTime', syncWaitTime);
  }

  function focusOnMount(node) {
    node.focus();
  }

  function handleKeydown(e) {
    if (e.key === 'Escape' || e.key === 'Enter') onClose();
  }
</script>

<div class="modal-overlay" use:focusOnMount onclick={(e) => { if (e.target === e.currentTarget) onClose(); }} onkeydown={handleKeydown} role="dialog" aria-modal="true" tabindex="-1">
  <div class="modal">
    <div class="modal-header">
      <h2>Settings</h2>
    </div>

    <div class="tab-bar">
      <button class="tab" class:active={activeTab === 'ui'} onclick={() => (activeTab = 'ui')}>UI</button>
      <button class="tab" class:active={activeTab === 'sync'} onclick={() => (activeTab = 'sync')}>Sync</button>
      <button class="tab" class:active={activeTab === 'shortcuts'} onclick={() => (activeTab = 'shortcuts')}>Keyboard Shortcuts</button>
    </div>

    <div class="modal-body">
      {#if activeTab === 'ui'}
        <div class="setting-group">
          <span class="setting-label">Theme</span>
          <div class="theme-list">
            {#each themeState.list as t (t.id)}
              <button
                class="theme-option"
                class:active={themeState.current === t.id}
                onclick={() => themeState.set(t.id)}
              >
                <span class="theme-radio">
                  {#if themeState.current === t.id}
                    <i class="fas fa-circle-check"></i>
                  {:else}
                    <i class="far fa-circle"></i>
                  {/if}
                </span>
                {t.name}
              </button>
            {/each}
          </div>
        </div>
      {:else if activeTab === 'sync'}
        <div class="setting-group">
          <span class="setting-label">Sync Wait Time</span>
          <p class="setting-help">
            How long to wait after a local change before pushing to the remote
            repository.
          </p>
          <select bind:value={syncWaitTime} onchange={handleWaitTimeChange}>
            {#each waitTimeOptions as opt (opt.value)}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        </div>
      {:else if activeTab === 'shortcuts'}
        <div class="shortcuts-list">
          {#each shortcuts as shortcut, i (shortcut.section + '|' + shortcut.keys + '|' + i)}
            {#if i === 0 || shortcut.section !== shortcuts[i - 1].section}
              <div class="shortcut-section">{shortcut.section}</div>
            {/if}
            <div class="shortcut-row">
              <span class="shortcut-action">{shortcut.action}</span>
              <kbd class="shortcut-keys">{shortcut.keys}</kbd>
            </div>
          {/each}
        </div>
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

  .setting-group {
    margin-bottom: 24px;
  }

  .setting-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    display: block;
    margin-bottom: 10px;
  }

  .setting-help {
    margin: 0 2px 8px;
    font-size: 12px;
    line-height: 1.4;
    color: var(--text-muted);
  }

  .theme-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .theme-option {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: var(--bg-button);
    color: var(--text-primary);
    border-radius: 6px;
    font-size: 14px;
    text-align: left;
    transition: background 0.15s;
  }

  .theme-option:hover {
    background: var(--bg-button-hover);
  }

  .theme-option.active {
    background: var(--bg-selected);
    outline: 1px solid var(--accent);
  }

  .theme-radio {
    color: var(--text-muted);
    font-size: 15px;
    width: 18px;
    text-align: center;
  }

  .theme-option.active .theme-radio {
    color: var(--accent);
  }

  select {
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid var(--input-border);
    background-color: var(--input-bg);
    color: var(--text-primary);
    font-family: inherit;
    font-size: 13px;
    outline: none;
    cursor: pointer;
    width: 100%;
  }

  select:focus {
    border-color: var(--input-border-focus);
  }

  .shortcuts-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .shortcut-section {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    padding: 12px 12px 4px;
  }

  .shortcut-section:first-child {
    padding-top: 0;
  }

  .shortcut-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-radius: 6px;
  }

  .shortcut-row:nth-child(odd) {
    background: var(--bg-base);
  }

  .shortcut-action {
    font-size: 13px;
    color: var(--text-primary);
  }

  .shortcut-keys {
    font-size: 12px;
    font-family: var(--font-mono);
    color: var(--text-secondary);
    background: var(--bg-button);
    padding: 3px 8px;
    border-radius: 4px;
    border: 1px solid var(--border);
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
