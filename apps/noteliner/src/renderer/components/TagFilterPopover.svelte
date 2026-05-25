<script>
  import { onMount } from 'svelte';
  import { projectState, UNTAGGED_KEY } from '../stores/project.svelte.js';

  let { onClose } = $props();
  let panel;

  // OR-of-checked semantics: a file is visible iff at least one of its tags
  // (or the No-Tags sentinel) is checked. The popover binds directly to
  // projectState.hiddenTags via isChecked/toggleChecked, so the FILES pane
  // updates live as the user clicks.

  function rowClick(key) {
    projectState.toggleChecked(key);
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose?.();
    }
  }

  onMount(() => {
    // Click-outside dismissal. Mousedown (not click) so the popover closes
    // even if the user drags-to-select inside it and then releases outside —
    // matches the dismissal feel of native menus.
    function onMouseDown(e) {
      if (panel && !panel.contains(e.target)) onClose?.();
    }
    document.addEventListener('mousedown', onMouseDown, true);
    return () => document.removeEventListener('mousedown', onMouseDown, true);
  });

  // Count of files per real tag — mirrors TagGroupsPane's counter UX.
  function countFor(tag) {
    return projectState.getFilesWithTag(tag).length;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="tag-filter-popover" bind:this={panel} onkeydown={handleKeydown} role="dialog" aria-label="Filter files by tags">
  <div class="popover-header">Filter by tags</div>

  <div class="popover-rows">
    <button
      class="filter-row"
      class:unchecked={!projectState.isChecked(UNTAGGED_KEY)}
      onclick={() => rowClick(UNTAGGED_KEY)}
    >
      <i class="fas fa-square-check check" class:hidden={!projectState.isChecked(UNTAGGED_KEY)}></i>
      <i class="far fa-square uncheck" class:hidden={projectState.isChecked(UNTAGGED_KEY)}></i>
      <span class="tag-label">No Tags</span>
      <span class="tag-count">{projectState.untaggedCount}</span>
    </button>

    {#each projectState.allTags as tag (tag)}
      <button
        class="filter-row"
        class:unchecked={!projectState.isChecked(tag)}
        onclick={() => rowClick(tag)}
      >
        <i class="fas fa-square-check check" class:hidden={!projectState.isChecked(tag)}></i>
        <i class="far fa-square uncheck" class:hidden={projectState.isChecked(tag)}></i>
        <span class="tag-label">{tag}</span>
        <span class="tag-count">{countFor(tag)}</span>
      </button>
    {/each}
  </div>

  <div class="popover-footer">
    <button class="footer-btn" onclick={() => projectState.showAllTags()}>Show all</button>
    <button class="footer-btn" onclick={() => projectState.hideAllTags()}>Hide all</button>
  </div>
</div>

<style>
  .tag-filter-popover {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    width: 220px;
    max-height: 320px;
    display: flex;
    flex-direction: column;
    background: var(--bg-base);
    border: 1px solid var(--border);
    border-radius: 6px;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
    z-index: 50;
    overflow: hidden;
    /* Defeat the .pane-header's user-select: none on inheritance — labels
       inside the popover should still be selectable for accessibility tools. */
    user-select: text;
    cursor: default;
  }

  .popover-header {
    padding: 8px 12px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    color: var(--text-muted);
    text-transform: uppercase;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .popover-rows {
    overflow-y: auto;
    padding: 4px 0;
    flex: 1;
    min-height: 0;
  }

  .filter-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 12px;
    background: transparent;
    border-radius: 0;
    font-size: 13px;
    color: var(--text-primary);
    text-align: left;
    transition: background 0.1s;
  }

  .filter-row:hover {
    background: var(--bg-item-hover);
  }

  .check, .uncheck {
    width: 14px;
    font-size: 12px;
    color: var(--accent);
    flex-shrink: 0;
  }

  .uncheck {
    color: var(--text-faint);
  }

  /* `.hidden` instead of conditional rendering so the two icons occupy the
     same slot in the DOM tree — keeps the row layout stable during toggle. */
  .check.hidden, .uncheck.hidden {
    display: none;
  }

  .tag-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .filter-row.unchecked .tag-label {
    color: var(--text-muted);
  }

  .tag-count {
    font-size: 10px;
    background: var(--tag-bg);
    color: var(--text-secondary);
    padding: 1px 6px;
    border-radius: 8px;
    flex-shrink: 0;
  }

  .popover-footer {
    display: flex;
    gap: 6px;
    padding: 6px 8px;
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }

  .footer-btn {
    flex: 1;
    padding: 4px 8px;
    background: var(--bg-button);
    color: var(--text-secondary);
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .footer-btn:hover {
    background: var(--bg-button-hover);
    color: var(--text-primary);
  }
</style>
