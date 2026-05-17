<script>
  let { onComplete } = $props();

  let dataDir = $state('');
  let remoteUrl = $state('');
  let step = $state(1);
  let loading = $state(false);
  let errorMsg = $state('');

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
      onComplete();
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
        <div class="setting-group">
          <span class="setting-label">Data Folder</span>
          <p class="setting-help">Choose a local folder where Threadliner will store your feeds and settings.</p>
          <div class="folder-input">
            <input
              type="text"
              bind:value={dataDir}
              placeholder="/path/to/threadliner-data"
              disabled={loading}
              readonly
            />
            <button class="btn btn-secondary" onclick={handleBrowse} disabled={loading}>
              Browse...
            </button>
          </div>
        </div>

        <div class="setting-group">
          <span class="setting-label">Git Remote URL <em>(optional)</em></span>
          <p class="setting-help">SSH URL for syncing across devices. Leave blank for local-only use.</p>
          <input
            type="text"
            bind:value={remoteUrl}
            placeholder="git@github.com:user/threadliner-data.git"
            disabled={loading}
          />
        </div>

        {#if errorMsg}
          <p class="error">{errorMsg}</p>
        {/if}

        <div class="actions">
          <button class="btn btn-primary" onclick={handleSubmit} disabled={loading || !dataDir.trim()}>
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
    background-color: var(--bg-base);
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
    color: var(--accent);
    margin-bottom: 16px;
  }

  .setup-header h1 {
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 8px;
  }

  .setup-header p {
    color: var(--text-muted);
    font-size: 14px;
  }

  .setup-body {
    background-color: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 28px;
  }

  .setting-group {
    margin-bottom: 24px;
  }

  .setting-label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    margin-bottom: 6px;
  }

  .setting-label em {
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
  }

  .setting-help {
    font-size: 12px;
    color: var(--text-muted);
    margin-bottom: 10px;
    line-height: 1.5;
  }

  input {
    width: 100%;
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid var(--input-border);
    background-color: var(--input-bg);
    color: var(--text-primary);
    outline: none;
  }

  input:focus {
    border-color: var(--input-border-focus);
  }

  .folder-input {
    display: flex;
    gap: 8px;
  }

  .folder-input input {
    flex: 1;
  }

  .error {
    color: var(--danger);
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
    background-color: var(--bg-button);
    color: var(--text-primary);
    flex-shrink: 0;
  }

  .btn-secondary:hover {
    background-color: var(--bg-button-hover);
  }

  .btn-primary {
    background: var(--bg-selected);
    outline: 1px solid var(--accent);
    color: var(--accent);
    padding: 10px 24px;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--accent);
    color: var(--accent-on);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
