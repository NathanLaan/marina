<script>
  import { selectedFeed, editFeed } from '../stores/app.js';

  let { onClose } = $props();

  let title = $state($selectedFeed?.title || '');
  let url = $state($selectedFeed?.url || '');
  let loading = $state(false);
  let errorMsg = $state('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;
    if (!$selectedFeed) return;

    loading = true;
    errorMsg = '';
    try {
      await editFeed($selectedFeed.id, { title: title.trim(), url: url.trim() });
      onClose();
    } catch (err) {
      errorMsg = err.message || 'Failed to edit feed';
    } finally {
      loading = false;
    }
  }

  function focusOnMount(node) {
    node.focus();
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') onClose();
  }
</script>

<div
  class="modal-overlay-compact"
  use:focusOnMount
  onmousedown={(e) => { if (e.target === e.currentTarget) onClose(); }}
  onkeydown={handleKeydown}
  role="dialog"
  aria-modal="true"
  tabindex="-1"
>
  <div class="modal-compact">
    <div class="modal-header">
      <h2>Edit Feed</h2>
    </div>
    <div class="modal-body">
      {#if $selectedFeed}
        <form onsubmit={handleSubmit}>
          <label>
            <span class="setting-label">Title</span>
            <!-- svelte-ignore a11y_autofocus -->
            <input type="text" bind:value={title} disabled={loading} autofocus />
          </label>
          <label>
            <span class="setting-label">Feed URL</span>
            <input type="url" bind:value={url} disabled={loading} />
          </label>
          {#if errorMsg}
            <p class="error">{errorMsg}</p>
          {/if}
          <div class="actions">
            <button type="button" class="btn btn-secondary" onclick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" disabled={loading || !title.trim() || !url.trim()}>
              {#if loading}
                <i class="fas fa-spinner fa-spin"></i> Saving...
              {:else}
                Save
              {/if}
            </button>
          </div>
        </form>
      {:else}
        <p class="empty">No feed selected.</p>
        <div class="actions">
          <button class="btn btn-secondary" onclick={onClose}>Close</button>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  label {
    display: block;
    margin-bottom: 16px;
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

  .error {
    color: var(--danger);
    font-size: 13px;
    margin-bottom: 12px;
  }

  .empty {
    color: var(--text-muted);
    font-size: 13px;
    margin-bottom: 16px;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .btn {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
  }

  .btn-secondary {
    background: var(--bg-button);
    color: var(--text-primary);
  }

  .btn-secondary:hover {
    background: var(--bg-button-hover);
  }

  .btn-primary {
    background: var(--bg-selected);
    outline: 1px solid var(--accent);
    color: var(--accent);
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
