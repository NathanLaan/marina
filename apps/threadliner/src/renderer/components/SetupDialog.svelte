<script>
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  let dataDir = '';
  let remoteUrl = '';
  let step = 1;
  let loading = false;
  let errorMsg = '';

  async function handleBrowse() {
    try {
      const result = await window.api.openFolderDialog();
      if (result) {
        dataDir = result;
      }
    } catch (err) {
      errorMsg = 'Failed to open folder dialog: ' + err.message;
    }
  }

  async function handleSubmit() {
    if (!dataDir.trim()) {
      errorMsg = 'Please select a data folder.';
      return;
    }

    loading = true;
    errorMsg = '';
    try {
      await window.api.setupInit(dataDir.trim(), remoteUrl.trim() || null);
      dispatch('complete');
    } catch (err) {
      errorMsg = err.message || 'Setup failed';
    } finally {
      loading = false;
    }
  }
</script>

<div class="setup-overlay">
  <div class="setup-dialog">
    <div class="setup-header">
      <i class="fas fa-rss"></i>
      <h1>Welcome to Threadline</h1>
      <p>Let's set up your data storage.</p>
    </div>

    {#if step === 1}
      <div class="setup-body">
        <label>
          <span>Data Folder</span>
          <p class="hint">Choose a local folder where Threadline will store your feeds and settings.</p>
          <div class="folder-input">
            <input
              type="text"
              bind:value={dataDir}
              placeholder="/path/to/threadline-data"
              disabled={loading}
              readonly
            />
            <button class="btn btn-secondary" on:click={handleBrowse} disabled={loading}>
              Browse...
            </button>
          </div>
        </label>

        <label>
          <span>Git Remote URL <em>(optional)</em></span>
          <p class="hint">SSH URL for syncing across devices. Leave blank for local-only use.</p>
          <input
            type="text"
            bind:value={remoteUrl}
            placeholder="git@github.com:user/threadline-data.git"
            disabled={loading}
          />
        </label>

        {#if errorMsg}
          <p class="error">{errorMsg}</p>
        {/if}

        <div class="actions">
          <button class="btn btn-primary" on:click={handleSubmit} disabled={loading || !dataDir.trim()}>
            {#if loading}
              <i class="fas fa-spinner fa-spin"></i> Setting up...
            {:else}
              Get Started
            {/if}
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .setup-overlay {
    position: fixed;
    inset: 0;
    background-color: var(--color-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
  }

  .setup-dialog {
    width: 500px;
    max-width: 90vw;
  }

  .setup-header {
    text-align: center;
    margin-bottom: 32px;
  }

  .setup-header i {
    font-size: 48px;
    color: var(--color-accent);
    margin-bottom: 16px;
  }

  .setup-header h1 {
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 8px;
  }

  .setup-header p {
    color: var(--color-text-muted);
    font-size: 14px;
  }

  .setup-body {
    background-color: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 24px;
  }

  label {
    display: block;
    margin-bottom: 20px;
  }

  label span {
    display: block;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 4px;
  }

  label em {
    font-weight: 400;
    color: var(--color-text-muted);
  }

  .hint {
    font-size: 12px;
    color: var(--color-text-muted);
    margin-bottom: 8px;
  }

  input {
    width: 100%;
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid var(--color-border);
    background-color: var(--color-bg);
    color: var(--color-text);
    outline: none;
  }

  input:focus {
    border-color: var(--color-accent);
  }

  .folder-input {
    display: flex;
    gap: 8px;
  }

  .folder-input input {
    flex: 1;
  }

  .error {
    color: var(--color-danger);
    font-size: 13px;
    margin-bottom: 12px;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
  }

  .btn {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
  }

  .btn-secondary {
    background-color: var(--color-surface-hover);
    color: var(--color-text);
    flex-shrink: 0;
  }

  .btn-secondary:hover {
    background-color: var(--color-surface-active);
  }

  .btn-primary {
    background-color: var(--color-accent);
    color: white;
    padding: 10px 24px;
  }

  .btn-primary:hover:not(:disabled) {
    background-color: var(--color-accent-hover);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
