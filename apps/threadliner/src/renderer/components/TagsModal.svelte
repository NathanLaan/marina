<script>
  import { createEventDispatcher } from 'svelte';
  import { tags, removeTag } from '../stores/app.js';
  import AddTagModal from './AddTagModal.svelte';
  import EditTagModal from './EditTagModal.svelte';

  const dispatch = createEventDispatcher();

  let selectedTagId = null;
  let showAddModal = false;
  let showEditModal = false;

  $: selectedTag = $tags.find((t) => t.id === selectedTagId) || null;

  function handleDelete() {
    if (!selectedTag) return;
    if (confirm(`Delete tag "${selectedTag.name}"? It will be removed from all feeds.`)) {
      removeTag(selectedTagId);
      selectedTagId = null;
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
      <h3>Tags</h3>
      <button class="close-btn" on:click={() => dispatch('close')}>
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="modal-body">
      <div class="actions-col">
        <button class="action-btn" title="Add Tag" on:click={() => (showAddModal = true)}>
          <i class="fas fa-plus"></i>
        </button>
        <button
          class="action-btn"
          title="Edit Tag"
          disabled={!selectedTag}
          on:click={() => (showEditModal = true)}
        >
          <i class="fas fa-pen"></i>
        </button>
        <button
          class="action-btn"
          title="Delete Tag"
          disabled={!selectedTag}
          on:click={handleDelete}
        >
          <i class="fas fa-trash"></i>
        </button>
      </div>
      <div class="tag-list">
        {#if $tags.length === 0}
          <p class="empty-text">No tags created yet.</p>
        {:else}
          {#each $tags as tag (tag.id)}
            <button
              class="tag-item"
              class:active={selectedTagId === tag.id}
              on:click={() => (selectedTagId = tag.id)}
            >
              {tag.name}
            </button>
          {/each}
        {/if}
      </div>
    </div>
  </div>
</div>

{#if showAddModal}
  <AddTagModal on:close={() => (showAddModal = false)} />
{/if}

{#if showEditModal && selectedTag}
  <EditTagModal tagId={selectedTagId} on:close={() => (showEditModal = false)} />
{/if}

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
    width: 420px;
    max-width: 90vw;
    max-height: 60vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--color-border);
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

  .modal-body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .actions-col {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px;
    border-right: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 6px;
    color: var(--color-text-muted);
    font-size: 13px;
  }

  .action-btn:hover:not(:disabled) {
    background-color: var(--color-surface-hover);
    color: var(--color-text);
  }

  .action-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .tag-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
  }

  .tag-item {
    display: block;
    width: 100%;
    padding: 8px 16px;
    text-align: left;
    font-size: 13px;
    color: var(--color-text);
    border-radius: 0;
    transition: background-color 0.1s;
  }

  .tag-item:hover {
    background-color: var(--color-surface-hover);
  }

  .tag-item.active {
    background-color: var(--color-surface-active);
  }

  .empty-text {
    padding: 16px;
    color: var(--color-text-muted);
    font-size: 13px;
    text-align: center;
  }
</style>
