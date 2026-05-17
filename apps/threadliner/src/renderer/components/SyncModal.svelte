<script>
  import { onMount, tick } from 'svelte';
  import {
    syncStatus, lastSyncTime, lastError, syncConfig, syncLog,
    loadSyncConfig, forcePush, forcePull, loadFullLog,
  } from '../stores/sync.js';

  let { onClose } = $props();

  let pushing = $state(false);
  let pulling = $state(false);
  let logContainer = $state();

  onMount(() => {
    loadSyncConfig();
    loadFullLog();
  });

  // Auto-scroll log when new entries arrive
  $effect(() => {
    // Subscribe to the log so this effect re-runs when entries are appended.
    $syncLog;
    tick().then(() => {
      if (logContainer) {
        logContainer.scrollTop = logContainer.scrollHeight;
      }
    });
  });

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
    if (e.key === 'Escape') onClose();
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="legacy-overlay" onmousedown={(e) => { if (e.target === e.currentTarget) onClose(); }} onkeydown={handleKeydown}>
  <div class="legacy-modal">
    <div class="legacy-modal-header">
      <h3>Sync</h3>
      <button class="close-btn" aria-label="Close" onclick={onClose}>
        <i class="fas fa-times"></i>
      </button>
    </div>

    <div class="legacy-modal-body">
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
          onclick={handlePush}
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
          onclick={handlePull}
          disabled={pushing || pulling || !$syncConfig.remoteUrl}
        >
          {#if pulling}
            <i class="fas fa-spinner fa-spin"></i> Pulling...
          {:else}
            <i class="fas fa-cloud-arrow-down"></i> Pull Now
          {/if}
        </button>
      </div>

      <div class="log-section">
        <div class="log-header">Log</div>
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
    </div>
  </div>
</div>

<style>
  .legacy-overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .legacy-modal {
    background-color: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    width: 960px;
    max-width: 90vw;
    overflow: hidden;
  }

  .legacy-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
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
    color: var(--text-muted);
    font-size: 14px;
  }

  .close-btn:hover {
    background-color: var(--bg-button-hover);
    color: var(--text-primary);
  }

  .legacy-modal-body {
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
    color: var(--text-muted);
    flex-shrink: 0;
    min-width: 80px;
  }

  .status-value {
    font-size: 13px;
    text-align: right;
    word-break: break-all;
  }

  .status-value.error {
    color: var(--danger);
  }

  .status-value.muted {
    color: var(--text-muted);
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
    border: 1px solid var(--danger);
    border-radius: 6px;
    color: var(--danger);
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
    margin-bottom: 20px;
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
    background-color: var(--bg-button-hover);
    color: var(--text-primary);
  }

  .btn-secondary:hover:not(:disabled) {
    background-color: var(--bg-selected);
  }

  .btn-primary {
    background-color: var(--accent);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background-color: var(--accent-hover);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .log-section {
    border-top: 1px solid var(--border);
    padding-top: 16px;
  }

  .log-header {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
    margin-bottom: 8px;
  }

  .log-container {
    height: 280px;
    overflow-y: auto;
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.5;
  }

  .log-empty {
    color: var(--text-muted);
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
    color: var(--text-muted);
    flex-shrink: 0;
    user-select: none;
  }

  .log-message {
    color: var(--text-muted);
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
