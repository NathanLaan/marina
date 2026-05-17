<script>
  import { onMount, tick } from 'svelte';
  import { themeState } from '../stores/theme.svelte.js';
  import { syncLog, lastSyncTime, loadFullLog } from '../stores/sync.js';

  let { onClose } = $props();

  let activeTab = $state('ui');
  let syncWaitTime = $state('10');
  let customTitlebar = $state(false);
  let customTitlebarInitial = $state(false);
  let prefsLoaded = $state(false);
  let logContainer = $state();

  const waitTimeOptions = [
    { value: '5', label: '5 seconds' },
    { value: '10', label: '10 seconds' },
    { value: '30', label: '30 seconds' },
    { value: '60', label: '60 seconds' },
  ];

  // Static list — keyboard bindings beyond Escape and the zoom shortcuts aren't
  // wired yet; this will populate from a command registry in a follow-up stage.
  const shortcuts = [
    { keys: 'Esc', action: 'Close modal', section: 'General' },
    { keys: 'Ctrl+=', action: 'Zoom in', section: 'View' },
    { keys: 'Ctrl+-', action: 'Zoom out', section: 'View' },
    { keys: 'Ctrl+0', action: 'Reset zoom', section: 'View' },
  ];

  onMount(async () => {
    const saved = await window.api.getSetting('syncWaitTime');
    if (saved) syncWaitTime = String(saved);
    if (window.api?.getUIPrefs) {
      try {
        const prefs = await window.api.getUIPrefs();
        customTitlebar = !!prefs?.customTitlebar;
        customTitlebarInitial = customTitlebar;
      } catch { /* ignore */ }
    }
    await loadFullLog();
    prefsLoaded = true;
  });

  // Pin the log to the bottom as new entries arrive — only when the Sync tab
  // is visible, otherwise logContainer is null.
  $effect(() => {
    $syncLog;
    if (activeTab !== 'sync') return;
    tick().then(() => {
      if (logContainer) logContainer.scrollTop = logContainer.scrollHeight;
    });
  });

  function formatLastSync(iso) {
    if (!iso) return 'Never';
    try { return new Date(iso).toLocaleString(); } catch { return 'Unknown'; }
  }

  function formatLogTime(timestamp) {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  async function handleWaitTimeChange() {
    await window.api.setSetting('syncWaitTime', syncWaitTime);
  }

  async function toggleCustomTitlebar() {
    customTitlebar = !customTitlebar;
    if (window.api?.setUIPrefs) {
      try {
        await window.api.setUIPrefs({ customTitlebar });
      } catch { /* ignore */ }
    }
  }

  async function applyRestart() {
    if (window.api?.relaunchApp) {
      await window.api.relaunchApp();
    }
  }

  const restartPending = $derived(prefsLoaded && customTitlebar !== customTitlebarInitial);

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

        <div class="setting-group">
          <span class="setting-label">UI Scale</span>
          <div class="scale-list">
            {#each themeState.scaleList as scale (scale.id)}
              <button
                class="scale-option"
                class:active={themeState.scale === scale.id}
                onclick={() => themeState.setScale(scale.id)}
              >
                {scale.label}
              </button>
            {/each}
          </div>
          <p class="setting-help">Or use <kbd>Ctrl</kbd>+<kbd>=</kbd> / <kbd>Ctrl</kbd>+<kbd>-</kbd> / <kbd>Ctrl</kbd>+<kbd>0</kbd>.</p>
        </div>

        <div class="setting-group">
          <span class="setting-label">Window</span>
          <button
            class="toggle-option"
            class:active={customTitlebar}
            onclick={toggleCustomTitlebar}
            disabled={!prefsLoaded}
          >
            <span class="toggle-radio">
              {#if customTitlebar}
                <i class="fas fa-square-check"></i>
              {:else}
                <i class="far fa-square"></i>
              {/if}
            </span>
            Custom Window Titlebar
          </button>
          {#if restartPending}
            <div class="restart-banner">
              <span>Restart required to apply titlebar change.</span>
              <button class="restart-btn" onclick={applyRestart}>Restart now</button>
            </div>
          {/if}
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

        <div class="setting-group">
          <span class="setting-label">Last Sync</span>
          <p class="last-sync">{formatLastSync($lastSyncTime)}</p>
        </div>

        <div class="setting-group">
          <span class="setting-label">Activity</span>
          <div class="log-container" bind:this={logContainer}>
            {#if $syncLog.length === 0}
              <div class="log-empty">No sync activity yet.</div>
            {:else}
              {#each $syncLog as entry (entry.id)}
                <div class="log-entry" class:log-error={entry.level === 'error'}>
                  <span class="log-time">{formatLogTime(entry.timestamp)}</span>
                  <span class="log-message">{entry.message}</span>
                </div>
                {#if entry.detail}
                  <div class="log-entry log-detail">
                    <span class="log-time"></span>
                    <span class="log-message">{entry.detail}</span>
                  </div>
                {/if}
              {/each}
            {/if}
          </div>
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

  .scale-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .scale-option {
    padding: 8px 14px;
    background: var(--bg-button);
    color: var(--text-primary);
    border-radius: 6px;
    font-size: 13px;
    transition: background 0.15s;
  }

  .scale-option:hover {
    background: var(--bg-button-hover);
  }

  .scale-option.active {
    background: var(--bg-selected);
    outline: 1px solid var(--accent);
    color: var(--accent);
  }

  .toggle-option {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: var(--bg-button);
    color: var(--text-primary);
    border-radius: 6px;
    font-size: 14px;
    text-align: left;
    width: 100%;
    transition: background 0.15s;
  }

  .toggle-option:hover:not(:disabled) {
    background: var(--bg-button-hover);
  }

  .toggle-option.active {
    background: var(--bg-selected);
    outline: 1px solid var(--accent);
  }

  .toggle-option:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .toggle-radio {
    color: var(--text-muted);
    font-size: 15px;
    width: 18px;
    text-align: center;
  }

  .toggle-option.active .toggle-radio {
    color: var(--accent);
  }

  .restart-banner {
    margin-top: 10px;
    padding: 10px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    background: var(--bg-selected);
    border: 1px solid var(--accent);
    border-radius: 6px;
    font-size: 13px;
    color: var(--text-primary);
  }

  .restart-btn {
    padding: 6px 14px;
    background: var(--accent);
    color: var(--accent-on);
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    transition: background 0.15s;
  }

  .restart-btn:hover {
    background: var(--accent-hover);
  }

  .last-sync {
    font-size: 13px;
    color: var(--text-secondary);
    padding: 6px 12px;
    background: var(--bg-base);
    border-radius: 6px;
    display: inline-block;
  }

  .log-container {
    height: 220px;
    overflow-y: auto;
    background: var(--bg-base);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px 10px;
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.5;
  }

  .log-empty {
    color: var(--text-muted);
    font-style: italic;
    font-family: var(--font-sans);
    font-size: 13px;
    text-align: center;
    padding-top: 30px;
  }

  .log-entry {
    display: flex;
    gap: 8px;
    padding: 1px 0;
  }

  .log-time {
    color: var(--text-muted);
    flex-shrink: 0;
    user-select: none;
  }

  .log-message {
    color: var(--text-secondary);
    word-break: break-all;
  }

  .log-error .log-message {
    color: var(--danger);
  }

  .log-detail .log-message {
    color: var(--text-muted);
    opacity: 0.7;
  }

  .setting-help kbd {
    font-family: var(--font-mono);
    font-size: 11px;
    padding: 1px 5px;
    background: var(--bg-button);
    border: 1px solid var(--border);
    border-radius: 3px;
    color: var(--text-secondary);
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
