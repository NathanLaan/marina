<script>
  import { onMount, tick } from 'svelte';
  import {
    SettingsShell, SettingGroup, ThemeList, ScaleList, ToggleOption,
    RestartBanner, ShortcutsList,
  } from '@marina/desktop-ui/settings';
  import { syncLog, lastSyncTime, loadFullLog } from '../stores/sync.js';

  let { onClose } = $props();

  let activeTab = $state('ui');
  let syncWaitTime = $state('10');
  let pollInterval = $state('10');
  let pollNotificationsEnabled = $state(true);
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

  const pollIntervalOptions = [
    { value: '1',  label: '1 minute' },
    { value: '5',  label: '5 minutes' },
    { value: '10', label: '10 minutes' },
    { value: '30', label: '30 minutes' },
    { value: '60', label: '60 minutes' },
  ];

  const shortcuts = [
    { keys: 'Esc',          action: 'Close modal',     section: 'General' },

    { keys: 'Ctrl+N',       action: 'Add Feed',        section: 'Feeds' },
    { keys: 'Ctrl+E',       action: 'Edit Feed',       section: 'Feeds' },
    { keys: 'Ctrl+D',       action: 'Remove Feed',     section: 'Feeds' },
    { keys: 'F5',           action: 'Refresh Feed',    section: 'Feeds' },

    { keys: 'Ctrl+M',       action: 'Mark as Read',    section: 'Entries' },
    { keys: 'Ctrl+Shift+M', action: 'Mark as Unread',  section: 'Entries' },

    { keys: 'Ctrl+Shift+T', action: 'Tags',            section: 'Panels' },
    { keys: 'Ctrl+Shift+S', action: 'Remote Sync',     section: 'Panels' },
    { keys: 'Ctrl+Shift+E', action: 'Toggle Toolbar',  section: 'Panels' },

    { keys: 'Ctrl+,',       action: 'Settings',        section: 'App' },
    { keys: 'Ctrl+I',       action: 'About',           section: 'App' },
    { keys: 'F1',           action: 'Help',            section: 'App' },

    { keys: 'Ctrl+=',       action: 'Zoom in',         section: 'View' },
    { keys: 'Ctrl+-',       action: 'Zoom out',        section: 'View' },
    { keys: 'Ctrl+0',       action: 'Reset zoom',      section: 'View' },
  ];

  onMount(async () => {
    const saved = await window.api.getSetting('syncWaitTime');
    if (saved) syncWaitTime = String(saved);
    const savedPoll = await window.api.getSetting('pollInterval');
    if (savedPoll) pollInterval = String(savedPoll);
    const savedNotify = await window.api.getSetting('pollNotificationsEnabled');
    // Default ON if unset.
    pollNotificationsEnabled = savedNotify === null || savedNotify === undefined ? true : !!savedNotify;
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

  async function handlePollIntervalChange() {
    await window.api.setSetting('pollInterval', pollInterval);
  }

  async function setPollNotificationsEnabled(next) {
    pollNotificationsEnabled = next;
    await window.api.setSetting('pollNotificationsEnabled', next);
  }

  async function setCustomTitlebar(next) {
    customTitlebar = next;
    if (window.api?.setUIPrefs) {
      try { await window.api.setUIPrefs({ customTitlebar }); } catch { /* ignore */ }
    }
  }

  async function applyRestart() {
    if (window.api?.relaunchApp) {
      await window.api.relaunchApp();
    }
  }

  const restartPending = $derived(prefsLoaded && customTitlebar !== customTitlebarInitial);

  const tabs = [
    { id: 'ui',        label: 'UI',                 render: uiTab },
    { id: 'feeds',     label: 'Feeds',              render: feedsTab },
    { id: 'sync',      label: 'Sync',               render: syncTab },
    { id: 'shortcuts', label: 'Keyboard Shortcuts', render: shortcutsTab },
  ];
</script>

{#snippet uiTab()}
  <SettingGroup label="Theme">
    <ThemeList />
  </SettingGroup>

  <SettingGroup label="UI Scale">
    <ScaleList />
    <p class="kbd-help">
      Or use <kbd>Ctrl</kbd>+<kbd>=</kbd> / <kbd>Ctrl</kbd>+<kbd>-</kbd> / <kbd>Ctrl</kbd>+<kbd>0</kbd>.
    </p>
  </SettingGroup>

  <SettingGroup label="Window">
    <ToggleOption
      label="Custom Window Titlebar"
      checked={customTitlebar}
      disabled={!prefsLoaded}
      onchange={setCustomTitlebar}
    />
    {#if restartPending}
      <RestartBanner
        message="Restart required to apply titlebar change."
        onRestart={applyRestart}
      />
    {/if}
  </SettingGroup>
{/snippet}

{#snippet feedsTab()}
  <SettingGroup
    label="Poll Interval"
    help="How often ThreadLiner checks all RSS feeds for new entries."
  >
    <select bind:value={pollInterval} onchange={handlePollIntervalChange}>
      {#each pollIntervalOptions as opt (opt.value)}
        <option value={opt.value}>{opt.label}</option>
      {/each}
    </select>
  </SettingGroup>

  <SettingGroup
    label="Notifications"
    help="Show a system notification when new entries arrive."
  >
    <ToggleOption
      label="Show Toast Notifications"
      checked={pollNotificationsEnabled}
      onchange={setPollNotificationsEnabled}
    />
  </SettingGroup>
{/snippet}

{#snippet syncTab()}
  <SettingGroup
    label="Sync Wait Time"
    help="How long to wait after a local change before pushing to the remote repository."
  >
    <select bind:value={syncWaitTime} onchange={handleWaitTimeChange}>
      {#each waitTimeOptions as opt (opt.value)}
        <option value={opt.value}>{opt.label}</option>
      {/each}
    </select>
  </SettingGroup>

  <SettingGroup label="Last Sync">
    <p class="last-sync">{formatLastSync($lastSyncTime)}</p>
  </SettingGroup>

  <SettingGroup label="Activity">
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
  </SettingGroup>
{/snippet}

{#snippet shortcutsTab()}
  <ShortcutsList {shortcuts} />
{/snippet}

<SettingsShell {tabs} bind:activeTab {onClose} />

<style>
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

  .kbd-help {
    margin: 10px 2px 0;
    font-size: 12px;
    line-height: 1.4;
    color: var(--text-muted);
  }

  .kbd-help kbd {
    font-family: var(--font-mono);
    font-size: 11px;
    padding: 1px 5px;
    background: var(--bg-button);
    border: 1px solid var(--border);
    border-radius: 3px;
    color: var(--text-secondary);
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
</style>
