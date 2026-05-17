<script>
  import { addTag } from '../stores/app.js';

  let { onClose } = $props();

  let name = $state('');
  let loading = $state(false);
  let errorMsg = $state('');

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    loading = true;
    errorMsg = '';
    try {
      await addTag(trimmed);
      onClose();
    } catch (err) {
      errorMsg = err.message || 'Failed to add tag';
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
      <h2>Add Tag</h2>
    </div>
    <div class="modal-body">
      <form onsubmit={handleSubmit}>
        <label>
          <span class="setting-label">Tag Name</span>
          <!-- svelte-ignore a11y_autofocus -->
          <input
            type="text"
            bind:value={name}
            placeholder="e.g. Technology"
            disabled={loading}
            autofocus
          />
        </label>
        {#if errorMsg}
          <p class="error">{errorMsg}</p>
        {/if}
        <div class="actions">
          <button type="button" class="btn btn-secondary" onclick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" disabled={loading || !name.trim()}>
            {#if loading}
              <i class="fas fa-spinner fa-spin"></i> Adding...
            {:else}
              Add
            {/if}
          </button>
        </div>
      </form>
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
