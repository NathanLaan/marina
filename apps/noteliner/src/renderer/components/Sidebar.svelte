<script>
  import { projectState } from '../stores/project.svelte.js';
  import { PaneHost } from '@marina/desktop-ui/panels';
  import FileTree from './FileTree.svelte';
  import TagGroupsPane from './TagGroupsPane.svelte';
  import TagsPane from './TagsPane.svelte';
  import OutlinePane from './OutlinePane.svelte';
  import SearchPane from './SearchPane.svelte';
  import BacklinksPane from './BacklinksPane.svelte';

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

    if (position === 'child') {
      dragged.parentId = target.id;
      const children = projectState.getChildren(target.id);
      dragged.order = children.length;
    } else {
      dragged.parentId = target.parentId;
      const siblings = projectState.getChildren(target.parentId).filter(f => f.id !== draggedId);
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
    filesVisible && { id: 'files', title: 'FILES', height: filesHeight, render: filesPane },
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

{#snippet tagsHeaderExtra()}
  <button class="pane-header-btn" onclick={() => onTagAction?.('add')} disabled={!projectState.selectedFileId} title="Add Tag (Ctrl+T)" aria-label="Add Tag">
    <i class="fas fa-plus"></i>
  </button>
  <button class="pane-header-btn" onclick={() => onTagAction?.('remove')} disabled={!projectState.selectedFileId || projectState.selectedFileTags.length === 0} title="Remove Tag (Ctrl+Y)" aria-label="Remove Tag">
    <i class="fas fa-minus"></i>
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
</style>
