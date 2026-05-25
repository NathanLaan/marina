<script>
  import { projectState } from '../stores/project.svelte.js';

  let { onTagsChanged, tagAction = null } = $props();

  let adding = $state(false);
  let addValue = $state('');

  function autoFocus(node) {
    node.focus();
  }

  function handleAdd() {
    if (!projectState.selectedFileId) return;
    adding = true;
    addValue = '';
  }

  function commitAdd() {
    const value = addValue.trim();
    if (value && projectState.selectedFileId) {
      projectState.addTag(projectState.selectedFileId, value);
      onTagsChanged();
    }
    adding = false;
    addValue = '';
  }

  function cancelAdd() {
    adding = false;
    addValue = '';
  }

  function handleInputKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitAdd();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelAdd();
    }
  }

  // Toggle whether `tag` is on the currently selected file. With no file
  // selected the chips render disabled and this handler shouldn't fire, but
  // we guard anyway in case a keyboard activation slips through.
  function toggle(tag) {
    if (!projectState.selectedFileId) return;
    const onFile = projectState.selectedFileTags.includes(tag);
    if (onFile) {
      projectState.removeTag(projectState.selectedFileId, tag);
    } else {
      projectState.addTag(projectState.selectedFileId, tag);
    }
    onTagsChanged();
  }

  // The pane header's `+` button raises tagAction.type === 'add'. The `-`
  // button has been removed; we no longer handle 'remove' here.
  $effect(() => {
    if (tagAction && tagAction.type === 'add') handleAdd();
  });

  // Cancel an in-progress add if the file selection changes underneath.
  $effect(() => {
    projectState.selectedFileId;
    adding = false;
  });

  let dragOverTag = $state(null);

  function handleChipDragOver(e, tag) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dragOverTag = tag;
  }

  function handleChipDragLeave() {
    dragOverTag = null;
  }

  function handleChipDrop(e, tag) {
    e.preventDefault();
    dragOverTag = null;
    const fileId = e.dataTransfer.getData('text/plain');
    if (!fileId) return;
    projectState.addTag(fileId, tag);
    onTagsChanged();
  }

  let hasSelection = $derived(!!projectState.selectedFileId);
  let allTags = $derived(projectState.allTags);
  let fileTags = $derived(projectState.selectedFileTags);
</script>

<div class="tags-pane">
  <div class="tags-body">
    {#if adding}
      <input
        class="tag-input"
        type="text"
        bind:value={addValue}
        placeholder="Tag name..."
        onkeydown={handleInputKeydown}
        onblur={cancelAdd}
        use:autoFocus
      />
    {/if}

    {#each allTags as tag (tag)}
      {@const active = fileTags.includes(tag)}
      <button
        class="tag-chip"
        class:active
        class:drag-over={tag === dragOverTag}
        disabled={!hasSelection}
        title={hasSelection
          ? (active ? `Remove "${tag}" from this file` : `Add "${tag}" to this file`)
          : 'Select a file to edit tags'}
        aria-pressed={active}
        onclick={() => toggle(tag)}
        ondragover={(e) => handleChipDragOver(e, tag)}
        ondragleave={handleChipDragLeave}
        ondrop={(e) => handleChipDrop(e, tag)}
      >
        <i class="fas fa-square-check chip-icon" class:hidden={!active} aria-hidden="true"></i>
        <i class="far fa-square chip-icon" class:hidden={active} aria-hidden="true"></i>
        <span class="chip-label">{tag}</span>
      </button>
    {/each}

    {#if allTags.length === 0 && !adding}
      <span class="tags-empty">No tags</span>
    {/if}
  </div>
</div>

<style>
  .tags-pane {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
    height: 100%;
  }

  .tags-body {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 8px 12px;
    min-height: 36px;
    overflow-y: auto;
    align-content: flex-start;
    flex: 1;
  }

  .tag-input {
    background: var(--input-bg);
    border: 1px solid var(--accent);
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 12px;
    color: var(--text-primary);
    outline: none;
    width: 100px;
    height: 24px;
  }

  .tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 10px;
    font-size: 12px;
    background: var(--bg-button);
    color: var(--text-secondary);
    border-radius: 10px;
    transition: background 0.15s, color 0.15s, opacity 0.15s;
    height: 24px;
    cursor: pointer;
  }

  .tag-chip:hover:not(:disabled) {
    background: var(--bg-button-hover);
    color: var(--text-primary);
  }

  .tag-chip.active {
    background: var(--bg-selected);
    outline: 1px solid var(--accent);
    color: var(--accent);
  }

  .tag-chip.active:hover:not(:disabled) {
    background: var(--bg-selected);
    color: var(--accent);
  }

  .tag-chip:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .tag-chip.drag-over {
    background: var(--bg-selected);
    outline: 2px solid var(--accent);
    color: var(--accent);
  }

  /* Two icons in the same slot — toggle via .hidden so the chip width
     doesn't reflow when the state flips. */
  .chip-icon {
    font-size: 10px;
    width: 10px;
    flex-shrink: 0;
  }
  .chip-icon.hidden {
    display: none;
  }

  .chip-label {
    line-height: 1;
  }

  .tags-empty {
    font-size: 12px;
    color: var(--text-muted);
    font-style: italic;
  }
</style>
