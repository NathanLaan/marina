<script>
  // Tag Editor — assigns colors from the SVG 1.1 named palette to tags.
  //
  // Left column: list of tags in the project, each row a preview chip
  // styled with its currently-assigned colour (or default if none).
  // Click a row to focus it; the right column then shows a swatch grid.
  // Right column: 147-cell colour grid. Clicking a swatch writes the
  // chosen colour to `index.tagMeta[tag].color` and the chip preview
  // updates immediately. A "Clear color" affordance removes any
  // assigned colour from the focused tag.
  //
  // Changes are committed to the index on every click (consistent with
  // how the rest of the app handles tag mutations — see Sidebar's
  // handleTagsChanged). The OK / X buttons just close the modal.

  import { projectState } from '../stores/project.svelte.js';
  import { SVG_COLORS, lookupColor } from '../lib/svgColors.js';

  let { onClose } = $props();

  function focusOnMount(node) {
    node.focus();
  }

  function handleKeydown(e) {
    if (e.key === 'Escape' || e.key === 'Enter') onClose();
  }

  // Tag list comes from the project's derived `allTags` so adding a
  // tag elsewhere shows up here without an explicit refresh.
  let tags = $derived(projectState.allTags);

  let selectedTag = $state(null);

  // Auto-focus the first tag whenever the list changes and either
  // nothing is focused yet, or the previously-focused tag has been
  // removed (e.g. the only file with it was deleted).
  $effect(() => {
    if (tags.length === 0) {
      selectedTag = null;
      return;
    }
    if (!selectedTag || !tags.includes(selectedTag)) {
      selectedTag = tags[0];
    }
  });

  async function persist() {
    // saveIndex performs a snapshot-and-commit; calling it on every
    // colour click means the change is durable the moment it's clicked,
    // matching the docx-import / sortMode flow.
    await window.api.saveIndex($state.snapshot(projectState.index));
  }

  async function pickColor(colorName) {
    if (!selectedTag) return;
    projectState.setTagColor(selectedTag, colorName);
    await persist();
  }

  async function clearColor() {
    if (!selectedTag) return;
    projectState.setTagColor(selectedTag, null);
    await persist();
  }

  function chipStyle(tag) {
    const swatch = lookupColor(projectState.getTagColor(tag));
    if (!swatch) return '';
    // Outline echoes the swatch so the active-pill state in TagsPane
    // stays legible at a glance. `currentColor` would conflict with
    // the chip's text colour, so use the literal name.
    return `background: ${swatch.name}; color: ${swatch.darkText ? '#111' : '#fff'};`;
  }

  let selectedSwatch = $derived(lookupColor(projectState.getTagColor(selectedTag)));
</script>

<div
  class="modal-overlay"
  use:focusOnMount
  onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}
  onkeydown={handleKeydown}
  role="dialog"
  aria-modal="true"
  tabindex="-1"
>
  <div class="modal tag-editor-modal">
    <div class="modal-header">
      <h2>Tag Editor</h2>
      <button class="modal-close-btn" onclick={onClose} aria-label="Close" title="Close (Esc)">
        <i class="fas fa-xmark"></i>
      </button>
    </div>
    <div class="modal-body">
      {#if tags.length === 0}
        <p class="empty-msg">No tags yet. Add a tag to a file to start customizing colors.</p>
      {:else}
        <div class="editor-grid">
          <div class="tag-list" role="listbox" aria-label="Tags">
            {#each tags as tag (tag)}
              <button
                class="tag-row"
                class:active={tag === selectedTag}
                onclick={() => selectedTag = tag}
                role="option"
                aria-selected={tag === selectedTag}
              >
                <span class="tag-row-chip" style={chipStyle(tag)}>{tag}</span>
              </button>
            {/each}
          </div>

          <div class="color-panel">
            <div class="color-panel-header">
              <div class="focused-tag">
                <span class="focused-tag-label">Editing</span>
                <span class="focused-tag-chip" style={chipStyle(selectedTag)}>{selectedTag ?? ''}</span>
              </div>
              <button
                class="clear-btn"
                onclick={clearColor}
                disabled={!selectedTag || !selectedSwatch}
                title="Remove the color from this tag"
              >
                Clear color
              </button>
            </div>

            <div class="swatch-grid" role="radiogroup" aria-label="Color palette">
              {#each SVG_COLORS as swatch (swatch.name + swatch.hex)}
                {@const active = selectedSwatch?.name === swatch.name}
                <button
                  type="button"
                  class="swatch"
                  class:active
                  style="background: {swatch.name};"
                  onclick={() => pickColor(swatch.name)}
                  title="{swatch.name} ({swatch.hex})"
                  aria-label={swatch.name}
                  aria-checked={active}
                  role="radio"
                  disabled={!selectedTag}
                >
                  {#if active}
                    <i class="fas fa-check" style="color: {swatch.darkText ? '#111' : '#fff'};"></i>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        </div>
      {/if}

      <div class="modal-footer">
        <button class="ok-btn" onclick={onClose}>OK</button>
      </div>
    </div>
  </div>
</div>

<style>
  /* Wider than the default modal — the swatch grid needs ~12 columns
     to stay compact. Capped so it still feels like a dialog, not a
     window. */
  .tag-editor-modal {
    max-width: 760px;
    width: 90%;
  }

  .empty-msg {
    color: var(--text-muted);
    font-size: 13px;
    text-align: center;
    padding: 20px 0;
  }

  .editor-grid {
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: 16px;
    margin-bottom: 16px;
  }

  .tag-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 360px;
    overflow-y: auto;
    padding: 4px;
    background: var(--bg-base);
    border-radius: 6px;
    border: 1px solid var(--border);
  }

  .tag-row {
    display: flex;
    align-items: center;
    padding: 4px 6px;
    background: transparent;
    border-radius: 4px;
    border: 1px solid transparent;
    text-align: left;
    transition: background 0.15s, border-color 0.15s;
  }

  .tag-row:hover {
    background: var(--bg-button);
  }

  .tag-row.active {
    border-color: var(--accent);
    background: var(--bg-selected);
  }

  /* Pill preview inside each row. Falls back to the default chip
     style when no colour is set (no inline `style` attr present). */
  .tag-row-chip {
    display: inline-flex;
    align-items: center;
    padding: 2px 10px;
    font-size: 12px;
    line-height: 1.4;
    background: var(--bg-button);
    color: var(--text-secondary);
    border-radius: 10px;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .color-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }

  .color-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .focused-tag {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .focused-tag-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }

  .focused-tag-chip {
    display: inline-flex;
    align-items: center;
    padding: 2px 12px;
    font-size: 13px;
    background: var(--bg-button);
    color: var(--text-secondary);
    border-radius: 10px;
    max-width: 240px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .clear-btn {
    padding: 4px 12px;
    font-size: 12px;
    background: var(--bg-button);
    color: var(--text-secondary);
    border-radius: 4px;
    transition: background 0.15s, color 0.15s;
  }

  .clear-btn:hover:not(:disabled) {
    background: var(--bg-button-hover);
    color: var(--text-primary);
  }

  .clear-btn:disabled {
    opacity: 0.45;
    cursor: default;
  }

  /* 12-column grid handles the 147 swatches in 13 rows. auto-fill
     would also work but a fixed column count makes the dialog width
     predictable. */
  .swatch-grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 4px;
    max-height: 320px;
    overflow-y: auto;
    padding: 4px;
    background: var(--bg-base);
    border-radius: 6px;
    border: 1px solid var(--border);
  }

  .swatch {
    aspect-ratio: 1 / 1;
    border-radius: 4px;
    border: 1px solid var(--border);
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    cursor: pointer;
    transition: transform 0.1s, box-shadow 0.15s;
  }

  .swatch:hover:not(:disabled) {
    transform: scale(1.1);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
  }

  .swatch.active {
    box-shadow: 0 0 0 2px var(--accent);
  }

  .swatch:disabled {
    cursor: default;
    opacity: 0.6;
  }

  /* Footer uses the same layout as the other modals so the OK button
     sits flush-right with the project-settings dialog's footer. */
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }

  .ok-btn {
    padding: 8px 24px;
    background: var(--bg-selected);
    outline: 1px solid var(--accent);
    color: var(--accent);
    border-radius: 6px;
    transition: background 0.15s, color 0.15s;
  }

  .ok-btn:hover {
    background: var(--accent);
    color: var(--accent-on);
  }
</style>
