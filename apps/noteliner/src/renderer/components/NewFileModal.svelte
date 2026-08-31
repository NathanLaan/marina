<script>
  import { onMount } from 'svelte';
  import { projectState } from '../stores/project.svelte.js';

  let {
    onConfirm,
    onCancel,
    initialName = '',
    initialTags = [],
    initialParentId = '',
    title = 'New File',
    // Hidden in Duplicate mode — the copy's body comes from the source note,
    // so a template picker would have nothing to act on.
    showTemplate = true,
    // Also hidden in Duplicate mode: a copy inherits its source's type.
    showType = true,
    initialType = 'note',
  } = $props();

  // Prop-initialized state: the parent always remounts this modal via {#if showNewFile},
  // so the initial-capture semantics are exactly what we want — no re-sync needed.
  // svelte-ignore state_referenced_locally
  let fileName = $state(initialName);
  // svelte-ignore state_referenced_locally
  let selectedTags = $state(new Set(initialTags));

  // Templates from _templates/. Empty string = "Blank" (the default body).
  let templates = $state([]);
  let selectedTemplate = $state('');

  // 'note' | 'deck'. A creation-time seed, not a property of the note: picking
  // Presentation seeds the `presentation:` frontmatter block, and that block
  // being present is the only definition of "is a deck".
  // svelte-ignore state_referenced_locally
  let fileType = $state(initialType);

  // Type filters the template list, which is why it sits above the name field.
  // Templates predating the `kind` field default to 'note', so nothing that
  // already exists disappears.
  let visibleTemplates = $derived(
    templates.filter((t) => (t.kind || 'note') === (fileType === 'deck' ? 'deck' : 'note'))
  );

  // Keep the selection valid when the type flips under it.
  $effect(() => {
    if (selectedTemplate && !visibleTemplates.some((t) => t.id === selectedTemplate)) {
      selectedTemplate = '';
    }
  });

  const modalTitle = $derived(
    showType && fileType === 'deck' && title === 'New File' ? 'New Presentation' : title
  );

  // Parent note for the new file. Empty string = "(None)" → root-level file.
  // svelte-ignore state_referenced_locally
  let selectedParent = $state(initialParentId);

  // All files flattened into tree order (depth-first, unfiltered by the tag
  // popover) with a depth so the dropdown can indent to show hierarchy.
  let parentOptions = $derived.by(() => {
    const out = [];
    const walk = (parentId, depth) => {
      for (const f of projectState.getAllChildren(parentId)) {
        out.push({ id: f.id, name: f.name, depth });
        walk(f.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  });

  // Indent nested files with non-breaking spaces — plain spaces get collapsed
  // in <option> labels, so the hierarchy wouldn't show otherwise.
  function parentLabel(p) {
    return '  '.repeat(p.depth) + p.name;
  }

  // The FILES-panel selection is the common case for "nest this under what I'm
  // looking at", but it isn't the default parent (root is), so it gets a
  // one-click shortcut rather than becoming the initial value.
  let currentFile = $derived(projectState.selectedFile);

  function useCurrentFile() {
    if (currentFile) selectedParent = currentFile.id;
  }

  onMount(() => {
    if (!showTemplate) return;
    const p = window.api?.listTemplates?.();
    if (!p) return;
    p.then((list) => { templates = Array.isArray(list) ? list : []; })
     .catch(() => { templates = []; });
  });

  let allTags = $derived(projectState.allTags);

  function focusInput(node) {
    node.focus();
    node.select();
  }

  let canSubmit = $derived(fileName.trim().length > 0);

  function handleKeydown(e) {
    if (e.key === 'Escape') onCancel();
    if (e.key === 'Enter' && !e.shiftKey && canSubmit) handleOk();
  }

  function toggleTag(tag) {
    const next = new Set(selectedTags);
    if (next.has(tag)) {
      next.delete(tag);
    } else {
      next.add(tag);
    }
    selectedTags = next;
  }

  function handleOk() {
    const name = fileName.trim();
    if (!name) return;
    onConfirm({
      name,
      tags: [...selectedTags],
      templateId: selectedTemplate || null,
      parentId: selectedParent || null,
      type: showType ? fileType : 'note',
    });
  }
</script>

<div class="modal-overlay" onclick={(e) => { if (e.target === e.currentTarget) onCancel(); }} onkeydown={handleKeydown} role="dialog" aria-modal="true" tabindex="-1">
  <div class="modal new-file-modal">
    <div class="modal-header">
      <h2>{modalTitle}</h2>
    </div>
    <div class="modal-body">
      {#if showType}
        <div class="field">
          <div class="field-label" id="new-file-type-label">Type:</div>
          <div class="type-toggle" role="radiogroup" aria-labelledby="new-file-type-label">
            <button
              class="type-option"
              class:selected={fileType === 'note'}
              role="radio"
              aria-checked={fileType === 'note'}
              onclick={() => fileType = 'note'}
            >
              <i class="fas fa-file-lines"></i>
              <span>Note</span>
            </button>
            <button
              class="type-option"
              class:selected={fileType === 'deck'}
              role="radio"
              aria-checked={fileType === 'deck'}
              onclick={() => fileType = 'deck'}
            >
              <i class="fas fa-person-chalkboard"></i>
              <span>Presentation</span>
            </button>
          </div>
        </div>
      {/if}

      <div class="field">
        <label for="new-file-name">File Name:</label>
        <input id="new-file-name" type="text" bind:value={fileName} placeholder="Untitled" use:focusInput />
      </div>

      <div class="field">
        <label for="new-file-parent">Parent:</label>
        <div class="parent-row">
          <select id="new-file-parent" bind:value={selectedParent}>
            <option value="">(None)</option>
            {#each parentOptions as p (p.id)}
              <option value={p.id}>{parentLabel(p)}</option>
            {/each}
          </select>
          <button
            class="current-file-btn"
            onclick={useCurrentFile}
            disabled={!currentFile}
            title={currentFile ? `Set parent to "${currentFile.name}"` : 'No file selected in FILES'}
          >
            Current File
          </button>
        </div>
      </div>

      {#if showTemplate && (visibleTemplates.length > 0 || fileType === 'deck')}
        <div class="field">
          <label for="new-file-template">Template:</label>
          <select id="new-file-template" bind:value={selectedTemplate}>
            <option value="">{fileType === 'deck' ? 'Blank Presentation' : 'Blank'}</option>
            {#each visibleTemplates as t (t.id)}
              <option value={t.id}>{t.name}</option>
            {/each}
          </select>
        </div>
      {/if}

      {#if allTags.length > 0}
        <div class="field">
          <div class="field-label">Tags:</div>
          <div class="tag-list">
            {#each allTags as tag (tag)}
              <button
                class="tag-item"
                class:selected={selectedTags.has(tag)}
                onclick={() => toggleTag(tag)}
              >
                <span class="tag-check">{selectedTags.has(tag) ? '✓' : ''}</span>
                <span class="tag-name">{tag}</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <div class="modal-footer">
        <button class="cancel-btn" onclick={onCancel}>Cancel</button>
        <button class="ok-btn" onclick={handleOk} disabled={!canSubmit}>OK</button>
      </div>
    </div>
  </div>
</div>

<style>
  .new-file-modal {
    max-width: 480px;
    max-height: 572px;
    height: auto;
    margin: auto;
    width: 100%;
  }

  .field {
    margin-bottom: 14px;
  }

  .field label,
  .field .field-label {
    display: block;
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 4px;
  }

  .field input,
  .field select {
    width: 100%;
    padding: 8px 12px;
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 14px;
    outline: none;
    box-sizing: border-box;
  }

  .field input:focus,
  .field select:focus {
    border-color: var(--input-border-focus);
  }

  .field select option {
    background: var(--bg-surface);
    color: var(--text-primary);
  }

  .parent-row {
    display: flex;
    gap: 6px;
  }

  /* min-width:0 lets the select shrink below its longest option label, which is
     what keeps a deeply-indented parent name from pushing the button off-row. */
  .parent-row select {
    flex: 1;
    width: auto;
    min-width: 0;
  }

  .current-file-btn {
    flex-shrink: 0;
    padding: 8px 12px;
    font-size: 13px;
    white-space: nowrap;
    color: var(--text-secondary);
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
  }

  .current-file-btn:hover:not(:disabled) {
    color: var(--text-primary);
    background: var(--bg-button-hover);
  }

  .current-file-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  /* Segmented control rather than a <select>: with two options, showing both
     is what makes the Presentation type discoverable at all. */
  .type-toggle {
    display: flex;
    gap: 6px;
  }

  .type-option {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px 12px;
    font-size: 13px;
    color: var(--text-secondary);
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
  }

  .type-option:hover {
    color: var(--text-primary);
    background: var(--bg-button-hover);
  }

  .type-option.selected {
    color: var(--accent);
    background: var(--bg-selected);
    border-color: var(--accent);
  }

  .tag-list {
    /* Two rows shorter than before — each .tag-item is ~28px tall. */
    max-height: 204px;
    overflow-y: auto;
    border: 1px solid var(--input-border);
    border-radius: 6px;
    background: var(--input-bg);
  }

  .tag-item {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 6px 12px;
    font-size: 13px;
    color: var(--text-primary);
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    text-align: left;
    gap: 8px;
    transition: background 0.1s;
  }

  .tag-item:last-child {
    border-bottom: none;
  }

  .tag-item:hover {
    background: var(--bg-button-hover);
  }

  .tag-item.selected {
    background: var(--bg-selected);
  }

  .tag-check {
    width: 16px;
    flex-shrink: 0;
    font-size: 12px;
    color: var(--accent);
    text-align: center;
  }

  .tag-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
  }

  .cancel-btn {
    padding: 8px 20px;
    color: var(--text-muted);
    border-radius: 6px;
    transition: color 0.15s;
  }

  .cancel-btn:hover {
    color: var(--text-secondary);
  }

  .ok-btn {
    padding: 8px 24px;
    background: var(--bg-selected);
    outline: 1px solid var(--accent);
    color: var(--accent);
    border-radius: 6px;
    transition: background 0.15s, color 0.15s;
  }

  .ok-btn:hover:not(:disabled) {
    background: var(--accent);
    color: var(--accent-on);
  }

  .ok-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
</style>
