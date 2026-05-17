<script>
  import { createEventDispatcher } from 'svelte';
  import { addFeed } from '../stores/app.js';

  const dispatch = createEventDispatcher();

  let url = '';
  let loading = false;
  let errorMsg = '';

  async function handleSubmit() {
    const trimmed = url.trim();
    if (!trimmed) return;

    loading = true;
    errorMsg = '';
    try {
      await addFeed(trimmed);
      dispatch('close');
    } catch (err) {
      errorMsg = err.message || 'Failed to add feed';
    } finally {
      loading = false;
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') dispatch('close');
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="modal-overlay" on:mousedown|self={() => dispatch('close')} on:keydown={handleKeydown}>
  <div class="modal">
    <h3>Add Feed</h3>
    <form on:submit|preventDefault={handleSubmit}>
      <label>
        <span>Feed URL</span>
        <!-- svelte-ignore a11y-autofocus -->
        <input
          type="url"
          bind:value={url}
          placeholder="https://example.com/feed.xml"
          disabled={loading}
          autofocus
        />
      </label>
      {#if errorMsg}
        <p class="error">{errorMsg}</p>
      {/if}
      <div class="actions">
        <button type="button" class="btn btn-secondary" on:click={() => dispatch('close')} disabled={loading}>
          Cancel
        </button>
        <button type="submit" class="btn btn-primary" disabled={loading || !url.trim()}>
          {#if loading}
            <i class="fas fa-spinner fa-spin"></i> Adding...
          {:else}
            Add Feed
          {/if}
        </button>
      </div>
    </form>
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
    padding: 24px;
    width: 420px;
    max-width: 90vw;
  }

  h3 {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 16px;
  }

  label {
    display: block;
    margin-bottom: 16px;
  }

  label span {
    display: block;
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text-muted);
    margin-bottom: 6px;
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

  .error {
    color: var(--color-danger);
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
    background-color: var(--color-surface-hover);
    color: var(--color-text);
  }

  .btn-secondary:hover {
    background-color: var(--color-surface-active);
  }

  .btn-primary {
    background-color: var(--color-accent);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background-color: var(--color-accent-hover);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
