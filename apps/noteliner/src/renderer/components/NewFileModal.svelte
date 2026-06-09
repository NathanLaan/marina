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
    });
  }
</script>

<div class="modal-overlay" onclick={(e) => { if (e.target === e.currentTarget) onCancel(); }} onkeydown={handleKeydown} role="dialog" aria-modal="true" tabindex="-1">
  <div class="modal new-file-modal">
    <div class="modal-header">
      <h2>{title}</h2>
    </div>
    <div class="modal-body">
      <div class="field">
        <label for="new-file-name">File Name:</label>
        <input id="new-file-name" type="text" bind:value={fileName} placeholder="Untitled" use:focusInput />
      </div>

      <div class="field">
        <label for="new-file-parent">Parent:</label>
        <select id="new-file-parent" bind:value={selectedParent}>
          <option value="">(None)</option>
          {#each parentOptions as p (p.id)}
            <option value={p.id}>{parentLabel(p)}</option>
          {/each}
        </select>
      </div>

      {#if showTemplate && templates.length > 0}
        <div class="field">
          <label for="new-file-template">Template:</label>
          <select id="new-file-template" bind:value={selectedTemplate}>
            <option value="">Blank</option>
            {#each templates as t (t.id)}
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
    max-height: 520px;
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
