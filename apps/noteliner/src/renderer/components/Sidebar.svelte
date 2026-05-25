<script>
  import { projectState } from '../stores/project.svelte.js';
  import { PaneHost } from '@marina/desktop-ui/panels';
  import FileTree from './FileTree.svelte';
  import TagGroupsPane from './TagGroupsPane.svelte';
  import TagsPane from './TagsPane.svelte';
  import OutlinePane from './OutlinePane.svelte';
  import SearchPane from './SearchPane.svelte';
  import BacklinksPane from './BacklinksPane.svelte';
  import TagFilterPopover from './TagFilterPopover.svelte';

  let showTagFilter = $state(false);

  let {
    tagAction = null,
    filesVisible = true,
    outlineVisible = false,
    tagGroupsVisible = false,
    tagsVisible = true,
    searchVisible = false,
    backlinksVisible = false,
    searchFocusRequest = null,
    filesHeight = 200,
    tagGroupsHeight = 150,
    outlineHeight = 150,
    tagsHeight = 100,
    searchHeight = 200,
    backlinksHeight = 180,
    paneOrder = ['files', 'tagGroups', 'outline', 'tags', 'search', 'backlinks'],
    onPaneResize,
    onPaneReorder,
    onContextAction,
    onTagAction,
    onClosePane,
    onBacklinkSelect,
  } = $props();

  let editingId = $state(null);
  let editingName = $state('');

  function startRename(fileId, currentName) {
    editingId = fileId;
    editingName = currentName;
  }

  async function commitRename() {
    if (!editingId) return;
    const newName = editingName.trim();
    if (newName) {
      const entry = await window.api.renameFile(editingId, newName);
      if (entry) {
        projectState.updateFile(editingId, { name: entry.name, filename: entry.filename });
      }
    }
    editingId = null;
    editingName = '';
  }

  async function handleDelete(fileId) {
    await window.api.deleteFile(fileId);
    projectState.removeFile(fileId);
  }

  function handleSelect(fileId) {
    projectState.selectFile(fileId);
  }

  async function handleTagsChanged() {
    await window.api.saveIndex($state.snapshot(projectState.index));
  }

  async function setSortMode(mode) {
    projectState.sortMode = mode;
    if (window.api?.setUIPrefs) {
      try { await window.api.setUIPrefs({ filesSortMode: mode }); } catch { /* ignore */ }
    }
  }

  let externalDragOver = $state(false);

  function handleExternalDragOver(e) {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      externalDragOver = true;
    }
  }

  function handleExternalDragLeave(e) {
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget)) {
      externalDragOver = false;
    }
  }

  async function handleExternalDrop(e) {
    externalDragOver = false;
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const mdFiles = [...files].filter(f => f.name.toLowerCase().endsWith('.md'));
    if (mdFiles.length === 0) return;

    e.preventDefault();
    e.stopPropagation();

    for (const file of mdFiles) {
      const displayName = file.name.replace(/\.md$/i, '');
      const content = await file.text();
      const entry = await window.api.createFile(displayName);
      projectState.addFile(entry);
      await window.api.writeFile(entry.filename, content);
      projectState.selectFile(entry.id);
    }
  }

  async function handleDrop(draggedId, targetId, position) {
    const files = projectState.index.files;
    const dragged = files.find(f => f.id === draggedId);
    const target = files.find(f => f.id === targetId);
    if (!dragged || !target) return;

    // The renumber loop must walk *all* siblings, not only the ones currently
    // visible under a tag filter — otherwise hidden siblings get assigned
    // duplicate `order` values when the filter is later cleared.
    if (position === 'child') {
      dragged.parentId = target.id;
      const children = projectState.getAllChildren(target.id);
      dragged.order = children.length;
    } else {
      dragged.parentId = target.parentId;
      const siblings = projectState.getAllChildren(target.parentId).filter(f => f.id !== draggedId);
      const targetIndex = siblings.findIndex(f => f.id === targetId);
      const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
      siblings.splice(insertIndex, 0, dragged);
      siblings.forEach((f, i) => f.order = i);
    }

    await window.api.saveIndex($state.snapshot(projectState.index));
  }

  // Per-pane height-key map so the PaneHost's onPaneResize callback can route
  // back to App.svelte's expected onPaneResize(heightKey, newHeight) signature.
  const PANE_HEIGHT_KEY = {
    files: 'filesHeight',
    tagGroups: 'tagGroupsHeight',
    outline: 'outlineHeight',
    tags: 'tagsHeight',
    search: 'searchHeight',
    backlinks: 'backlinksHeight',
  };

  function handlePaneResize(id, newHeight) {
    const heightKey = PANE_HEIGHT_KEY[id];
    if (heightKey) onPaneResize?.(heightKey, newHeight);
  }

  // Build the panes array for PaneHost — only include panes the consumer
  // has marked visible. Order is enforced by the host using `paneOrder`.
  const panes = $derived([
    filesVisible && { id: 'files', title: 'FILES', height: filesHeight, render: filesPane, headerExtra: filesHeaderExtra },
    tagGroupsVisible && { id: 'tagGroups', title: 'TAG GROUPS', height: tagGroupsHeight, render: tagGroupsPaneBody },
    outlineVisible && { id: 'outline', title: 'OUTLINE', height: outlineHeight, render: outlinePaneBody },
    tagsVisible && { id: 'tags', title: 'TAGS', height: tagsHeight, render: tagsPaneBody, headerExtra: tagsHeaderExtra },
    searchVisible && { id: 'search', title: 'SEARCH', height: searchHeight, render: searchPaneBody },
    backlinksVisible && { id: 'backlinks', title: 'BACKLINKS', height: backlinksHeight, render: backlinksPaneBody },
  ].filter(Boolean));
</script>

{#snippet filesPane()}
  <div class="file-list">
    <FileTree
      parentId={null}
      selectedId={projectState.selectedFileId}
      {editingId}
      {editingName}
      onSelect={handleSelect}
      onStartRename={startRename}
      onCommitRename={commitRename}
      onDelete={handleDelete}
      onDrop={handleDrop}
      onEditingNameChange={(val) => editingName = val}
      {onContextAction}
    />
  </div>
{/snippet}

{#snippet tagGroupsPaneBody()}
  <TagGroupsPane selectedId={projectState.selectedFileId} onSelect={handleSelect} onTagsChanged={handleTagsChanged} />
{/snippet}

{#snippet outlinePaneBody()}
  <OutlinePane />
{/snippet}

{#snippet tagsPaneBody()}
  <TagsPane onTagsChanged={handleTagsChanged} {tagAction} />
{/snippet}

{#snippet searchPaneBody()}
  <SearchPane focusRequest={searchFocusRequest} />
{/snippet}

{#snippet backlinksPaneBody()}
  <BacklinksPane onSelect={(id, line) => onBacklinkSelect?.(id, line)} />
{/snippet}

{#snippet filesHeaderExtra()}
  <span class="pane-header-select-wrap">
    <select
      class="pane-header-select"
      title="Sort files"
      aria-label="Sort files"
      value={projectState.sortMode}
      onchange={(e) => setSortMode(e.currentTarget.value)}
      onclick={(e) => e.stopPropagation()}
      onmousedown={(e) => e.stopPropagation()}
    >
      <option value="user">User Order</option>
      <option value="name-asc">Name A-Z</option>
      <option value="name-desc">Name Z-A</option>
      <option value="modified-desc">Last Modified</option>
      <option value="created-desc">Created</option>
    </select>
    <i class="fas fa-chevron-down pane-header-select-chevron" aria-hidden="true"></i>
  </span>

  <span class="tag-filter-anchor">
    <button
      class="pane-header-btn tag-filter-btn"
      class:active={projectState.hiddenTags.size > 0}
      disabled={projectState.allTags.length === 0 && projectState.untaggedCount === 0}
      title="Filter by tags"
      aria-label="Filter by tags"
      aria-haspopup="dialog"
      aria-expanded={showTagFilter}
      onclick={(e) => { e.stopPropagation(); showTagFilter = !showTagFilter; }}
      onmousedown={(e) => e.stopPropagation()}
    >
      <i class="fas fa-filter"></i>
      {#if projectState.hiddenTags.size > 0}
        <span class="tag-filter-badge">{projectState.hiddenTags.size}</span>
      {/if}
    </button>
    {#if showTagFilter}
      <TagFilterPopover onClose={() => showTagFilter = false} />
    {/if}
  </span>
{/snippet}

{#snippet tagsHeaderExtra()}
  <button class="pane-header-btn" onclick={() => onTagAction?.('add')} disabled={!projectState.selectedFileId} title="Add Tag (Ctrl+T)" aria-label="Add Tag">
    <i class="fas fa-plus"></i>
  </button>
{/snippet}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="sidebar-content"
  class:drop-target={externalDragOver}
  ondragover={handleExternalDragOver}
  ondragleave={handleExternalDragLeave}
  ondrop={handleExternalDrop}
>
  <PaneHost
    {panes}
    order={paneOrder}
    onPaneResize={handlePaneResize}
    {onPaneReorder}
    {onClosePane}
  />
</div>

<style>
  .sidebar-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .file-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
    min-height: 0;
  }

  .sidebar-content.drop-target {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
    background: var(--bg-drag-over);
  }

  /* The pane header is a drag handle (panes reorder by header drag), so the
     select needs explicit pointer-events and stopped propagation on click/
     mousedown above to avoid the drag stealing focus. */
  /* Wrap exists so the chevron <i> can be absolutely positioned over the
     native select — selects can't host child elements, so we overlay it. */
  :global(.pane-header-select-wrap) {
    position: relative;
    display: inline-flex;
    align-items: center;
    align-self: center;
  }

  :global(.pane-header-select) {
    /* .pane-header-actions is a flex row with default align-items: stretch,
       which made this select climb to the close-button's 24px height. Lock
       height + line-height so it sits centered next to the close button. */
    height: 22px;
    line-height: 20px;
    padding: 0 20px 0 6px;
    font-size: 11px;
    color: var(--text-muted);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    appearance: none;
    cursor: pointer;
    transition: background-color 0.15s, color 0.15s, border-color 0.15s;
  }
  :global(.pane-header-select:hover) {
    color: var(--text-primary);
    background-color: var(--bg-button-hover);
    border-color: var(--border);
  }
  :global(.pane-header-select:focus) {
    outline: none;
    color: var(--text-primary);
    border-color: var(--border);
  }

  /* pointer-events: none so the chevron doesn't swallow the click that opens
     the native dropdown — the click passes through to the underlying select. */
  :global(.pane-header-select-chevron) {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 9px;
    color: var(--text-muted);
    pointer-events: none;
  }
  :global(.pane-header-select-wrap:hover .pane-header-select-chevron) {
    color: var(--text-primary);
  }

  /* The popover is `position: absolute` relative to this span. The anchor
     itself is inline-flex so it stays centered in the pane-header-actions
     row alongside the sort select. */
  :global(.tag-filter-anchor) {
    position: relative;
    display: inline-flex;
    align-items: center;
    align-self: center;
  }

  :global(.tag-filter-btn) {
    position: relative;
  }
  :global(.tag-filter-btn.active) {
    color: var(--accent);
  }
  :global(.tag-filter-btn.active:hover) {
    color: var(--accent);
  }

  :global(.tag-filter-badge) {
    position: absolute;
    bottom: -2px;
    right: -2px;
    min-width: 12px;
    height: 12px;
    padding: 0 3px;
    box-sizing: border-box;
    background: var(--accent);
    color: var(--bg-base);
    border-radius: 6px;
    font-size: 9px;
    font-weight: 700;
    line-height: 12px;
    text-align: center;
    pointer-events: none;
  }
</style>
