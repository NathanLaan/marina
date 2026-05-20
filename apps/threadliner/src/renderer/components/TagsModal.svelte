<script>
  import { tags, removeTag } from '../stores/app.js';
  import AddTagModal from './AddTagModal.svelte';
  import EditTagModal from './EditTagModal.svelte';

  let { onClose } = $props();

  let selectedTagId = $state(null);
  let showAddModal = $state(false);
  let showEditModal = $state(false);

  const selectedTag = $derived($tags.find((t) => t.id === selectedTagId) || null);

  function handleDelete() {
    if (!selectedTag) return;
    if (confirm(`Delete tag "${selectedTag.name}"? It will be removed from all feeds.`)) {
      removeTag(selectedTagId);
      selectedTagId = null;
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
  <div class="modal-compact tags-modal">
    <div class="modal-header">
      <h2>Tags</h2>
      <button class="modal-close-btn" onclick={onClose} aria-label="Close" title="Close (Esc)">
        <i class="fas fa-xmark"></i>
      </button>
    </div>
    <div class="modal-body">
      <div class="body-grid">
        <div class="actions-col">
          <button class="action-btn" title="Add Tag" aria-label="Add Tag" onclick={() => (showAddModal = true)}>
            <i class="fas fa-plus"></i>
          </button>
          <button
            class="action-btn"
            title="Edit Tag"
            aria-label="Edit Tag"
            disabled={!selectedTag}
            onclick={() => (showEditModal = true)}
          >
            <i class="fas fa-pen"></i>
          </button>
          <button
            class="action-btn"
            title="Delete Tag"
            aria-label="Delete Tag"
            disabled={!selectedTag}
            onclick={handleDelete}
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
                onclick={() => (selectedTagId = tag.id)}
              >
                {tag.name}
              </button>
            {/each}
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>

{#if showAddModal}
  <AddTagModal onClose={() => (showAddModal = false)} />
{/if}

{#if showEditModal && selectedTag}
  <EditTagModal tagId={selectedTagId} onClose={() => (showEditModal = false)} />
{/if}

<style>
  .tags-modal {
    min-width: 420px;
    max-width: 560px;
  }

  /* Override the default modal-body padding so the action column and list
     can flush against the modal edges. */
  .tags-modal .modal-body {
    padding: 0;
  }

  .body-grid {
    display: grid;
    grid-template-columns: 48px 1fr;
    max-height: 50vh;
  }

  .actions-col {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px;
    border-right: 1px solid var(--border);
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 6px;
    color: var(--text-muted);
    font-size: 13px;
    transition: background 0.15s, color 0.15s;
  }

  .action-btn:hover:not(:disabled) {
    background: var(--bg-button-hover);
    color: var(--text-primary);
  }

  .action-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .tag-list {
    overflow-y: auto;
    padding: 4px 0;
  }

  .tag-item {
    display: block;
    width: 100%;
    padding: 8px 16px;
    text-align: left;
    font-size: 13px;
    color: var(--text-primary);
    transition: background 0.15s;
  }

  .tag-item:hover {
    background: var(--bg-item-hover);
  }

  .tag-item.active {
    background: var(--bg-selected);
    outline: 1px solid var(--accent);
    outline-offset: -1px;
  }

  .empty-text {
    padding: 16px;
    color: var(--text-muted);
    font-size: 13px;
    text-align: center;
  }
</style>
