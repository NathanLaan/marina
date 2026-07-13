<script>
  import { projectState } from '../stores/project.svelte.js';

  let { file, onConfirm, onCancel } = $props();

  // Selected new parent. Empty string = "(None)" → root-level file. Seeded
  // with the file's current parent so the dropdown opens showing where the
  // file lives today.
  // svelte-ignore state_referenced_locally
  let selectedParent = $state(file.parentId || '');

  // Human-readable name of the file's *current* parent, shown read-only so the
  // user can see where the file lives before choosing a new home.
  let currentParentName = $derived.by(() => {
    if (!file.parentId) return '(None)';
    const p = projectState.index.files.find(f => f.id === file.parentId);
    return p ? p.name : '(None)';
  });

  // The file and its whole subtree are invalid parents — re-parenting a file
  // under one of its own descendants would create a cycle.
  let excludedIds = $derived.by(() => {
    const set = new Set();
    const collect = (id) => {
      set.add(id);
      for (const c of projectState.getAllChildren(id)) collect(c.id);
    };
    collect(file.id);
    return set;
  });

  // All files flattened into tree order (depth-first, unfiltered by the tag
  // popover) with a depth so the dropdown can indent to show hierarchy. The
  // moved file's subtree is skipped entirely.
  let parentOptions = $derived.by(() => {
    const out = [];
    const walk = (parentId, depth) => {
      for (const f of projectState.getAllChildren(parentId)) {
        if (excludedIds.has(f.id)) continue;
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
    return '  '.repeat(p.depth) + p.name;
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') onCancel();
    if (e.key === 'Enter' && !e.shiftKey) handleOk();
  }

  function handleOk() {
    onConfirm({ parentId: selectedParent || null });
  }
</script>

<div class="modal-overlay" onclick={(e) => { if (e.target === e.currentTarget) onCancel(); }} onkeydown={handleKeydown} role="dialog" aria-modal="true" tabindex="-1">
  <div class="modal move-file-modal">
    <div class="modal-header">
      <h2>Move File</h2>
    </div>
    <div class="modal-body">
      <div class="field">
        <div class="field-label">File:</div>
        <div class="field-static">{file.name}</div>
      </div>

      <div class="field">
        <div class="field-label">Current Parent:</div>
        <div class="field-static">{currentParentName}</div>
      </div>

      <div class="field">
        <label for="move-file-parent">New Parent:</label>
        <select id="move-file-parent" bind:value={selectedParent}>
          <option value="">(None)</option>
          {#each parentOptions as p (p.id)}
            <option value={p.id}>{parentLabel(p)}</option>
          {/each}
        </select>
      </div>

      <div class="modal-footer">
        <button class="cancel-btn" onclick={onCancel}>Cancel</button>
        <button class="ok-btn" onclick={handleOk}>OK</button>
      </div>
    </div>
  </div>
</div>

<style>
  .move-file-modal {
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

  .field-static {
    font-size: 14px;
    color: var(--text-primary);
    padding: 2px 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

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

  .field select:focus {
    border-color: var(--input-border-focus);
  }

  .field select option {
    background: var(--bg-surface);
    color: var(--text-primary);
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
</style>
