<script>
  import { createEventDispatcher, onMount, afterUpdate, tick } from 'svelte';
  import {
    syncStatus, lastSyncTime, lastError, syncConfig, syncLog,
    loadSyncConfig, forcePush, forcePull, loadFullLog,
  } from '../stores/sync.js';

  const dispatch = createEventDispatcher();

  let pushing = false;
  let pulling = false;
  let activeTab = 'status';
  let logLoaded = false;
  let logContainer;

  onMount(() => {
    loadSyncConfig();
  });

  // Auto-scroll log when new entries arrive
  afterUpdate(() => {
    if (activeTab === 'log' && logContainer) {
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  });

  async function switchToLog() {
    activeTab = 'log';
    if (!logLoaded) {
      await loadFullLog();
      logLoaded = true;
      await tick();
      if (logContainer) {
        logContainer.scrollTop = logContainer.scrollHeight;
      }
    }
  }

  async function handlePush() {
    pushing = true;
    await forcePush();
    pushing = false;
  }

  async function handlePull() {
    pulling = true;
    await forcePull();
    pulling = false;
  }

  function formatTime(isoString) {
    if (!isoString) return 'Never';
    try {
      const date = new Date(isoString);
      return date.toLocaleString();
    } catch {
      return 'Unknown';
    }
  }

  function formatLogTime(timestamp) {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function statusLabel(s) {
    switch (s) {
      case 'idle': return 'Idle';
      case 'committing': return 'Committing...';
      case 'waiting': return 'Push pending...';
      case 'pulling': return 'Pulling...';
      case 'pushing': return 'Pushing...';
      case 'error': return 'Error';
      default: return s;
    }
  }

  function statusIcon(s) {
    switch (s) {
      case 'idle': return 'fa-check-circle';
      case 'committing': return 'fa-spinner fa-spin';
      case 'waiting': return 'fa-clock';
      case 'pulling': return 'fa-spinner fa-spin';
      case 'pushing': return 'fa-spinner fa-spin';
      case 'error': return 'fa-exclamation-triangle';
      default: return 'fa-question-circle';
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') dispatch('close');
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="modal-overlay" on:mousedown|self={() => dispatch('close')} on:keydown={handleKeydown}>
  <div class="modal">
    <div class="modal-header">
      <h3>Sync</h3>
      <button class="close-btn" on:click={() => dispatch('close')}>
        <i class="fas fa-times"></i>
      </button>
    </div>

    <div class="tab-bar">
      <button
        class="tab"
        class:active={activeTab === 'status'}
        on:click={() => activeTab = 'status'}
      >Status</button>
      <button
        class="tab"
        class:active={activeTab === 'log'}
        on:click={switchToLog}
      >Log</button>
    </div>

    <div class="modal-body">
      {#if activeTab === 'status'}
        <div class="status-section">
          <div class="status-row">
            <span class="status-label">Status</span>
            <span class="status-value" class:error={$syncStatus === 'error'}>
              <i class="fas {statusIcon($syncStatus)}"></i>
              {statusLabel($syncStatus)}
            </span>
          </div>

          <div class="status-row">
            <span class="status-label">Last Sync</span>
            <span class="status-value">{formatTime($lastSyncTime)}</span>
          </div>

          {#if $syncConfig.remoteUrl}
            <div class="status-row">
              <span class="status-label">Remote</span>
              <span class="status-value mono">{$syncConfig.remoteUrl}</span>
            </div>
          {:else}
            <div class="status-row">
              <span class="status-label">Remote</span>
              <span class="status-value muted">Not configured (local only)</span>
            </div>
          {/if}

          <div class="status-row">
            <span class="status-label">Data Folder</span>
            <span class="status-value mono">{$syncConfig.dataDir || 'Not set'}</span>
          </div>
        </div>

        {#if $lastError}
          <div class="error-box">
            <i class="fas fa-exclamation-triangle"></i>
            <span>{$lastError}</span>
          </div>
        {/if}

        <div class="actions">
          <button
            class="btn btn-primary"
            on:click={handlePush}
            disabled={pushing || pulling || !$syncConfig.remoteUrl}
          >
            {#if pushing}
              <i class="fas fa-spinner fa-spin"></i> Syncing...
            {:else}
              <i class="fas fa-cloud-arrow-up"></i> Sync Now
            {/if}
          </button>
          <button
            class="btn btn-secondary"
            on:click={handlePull}
            disabled={pushing || pulling || !$syncConfig.remoteUrl}
          >
            {#if pulling}
              <i class="fas fa-spinner fa-spin"></i> Pulling...
            {:else}
              <i class="fas fa-cloud-arrow-down"></i> Pull Now
            {/if}
          </button>
        </div>
      {:else}
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
      {/if}
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
    width: 480px;
    max-width: 90vw;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: none;
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

  .tab-bar {
    display: flex;
    gap: 0;
    padding: 0 20px;
    border-bottom: 1px solid var(--color-border);
  }

  .tab {
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-muted);
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    background: none;
    cursor: pointer;
  }

  .tab:hover {
    color: var(--color-text);
  }

  .tab.active {
    color: var(--color-accent);
    border-bottom-color: var(--color-accent);
  }

  .modal-body {
    padding: 20px;
  }

  .status-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 16px;
  }

  .status-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }

  .status-label {
    font-size: 13px;
    color: var(--color-text-muted);
    flex-shrink: 0;
    min-width: 80px;
  }

  .status-value {
    font-size: 13px;
    text-align: right;
    word-break: break-all;
  }

  .status-value.error {
    color: var(--color-danger);
  }

  .status-value.muted {
    color: var(--color-text-muted);
    font-style: italic;
  }

  .status-value.mono {
    font-family: var(--font-mono);
    font-size: 12px;
  }

  .status-value i {
    margin-right: 4px;
  }

  .error-box {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 12px;
    background-color: rgba(224, 96, 112, 0.1);
    border: 1px solid var(--color-danger);
    border-radius: 6px;
    color: var(--color-danger);
    font-size: 12px;
    margin-bottom: 16px;
  }

  .error-box i {
    flex-shrink: 0;
    margin-top: 1px;
  }

  .actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .btn {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .btn-secondary {
    background-color: var(--color-surface-hover);
    color: var(--color-text);
  }

  .btn-secondary:hover:not(:disabled) {
    background-color: var(--color-surface-active);
  }

  .btn-primary {
    background-color: var(--color-accent);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background-color: var(--color-accent-hover);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .log-container {
    height: 280px;
    overflow-y: auto;
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.5;
  }

  .log-empty {
    color: var(--color-text-muted);
    font-style: italic;
    font-family: var(--font-sans, inherit);
    font-size: 13px;
    text-align: center;
    padding-top: 40px;
  }

  .log-entry {
    display: flex;
    gap: 8px;
    padding: 1px 0;
  }

  .log-time {
    color: var(--color-text-muted);
    flex-shrink: 0;
    user-select: none;
  }

  .log-message {
    color: var(--color-text-muted);
    word-break: break-all;
  }

  .log-error .log-message {
    color: var(--color-danger);
  }

  .log-detail .log-message {
    color: var(--color-text-muted);
    opacity: 0.7;
  }
</style>
