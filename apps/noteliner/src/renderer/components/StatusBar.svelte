<script>
  import { projectState } from '../stores/project.svelte.js';

  let {
    // Opens the Remote Sync modal when the branch/sync chip is clicked.
    onShowSync = () => {},
    // Bumped by the parent on events that can change git/MCP state (project
    // open, Sync modal close, Settings close) so we re-fetch without polling.
    // git:getSyncStatus does a network fetch, so we must NOT poll it.
    refreshToken = 0,
  } = $props();

  let branch = $state(null);
  let sync = $state(null);
  let mcpRunning = $state(false);

  async function refresh() {
    if (!projectState.isOpen) {
      branch = null; sync = null; mcpRunning = false;
      return;
    }
    try { branch = await window.api.gitGetBranch(); } catch { branch = null; }
    try { sync = await window.api.gitGetSyncStatus(); } catch { sync = null; }
    try { const s = await window.api.getMcpStatus(); mcpRunning = !!s?.running; }
    catch { mcpRunning = false; }
  }

  // Re-fetch when the project changes or the parent signals a refresh.
  $effect(() => {
    projectState.folderPath;   // track
    refreshToken;              // track
    refresh();
  });

  // Word/char counts derived from the live editor content.
  const text = $derived(projectState.editorContent || '');
  const wordCount = $derived((text.match(/\S+/g) || []).length);
  const charCount = $derived(text.length);

  const saveLabel = $derived(
    projectState.saveStatus === 'saving' ? 'Saving…'
    : projectState.saveStatus === 'unsaved' ? 'Unsaved'
    : 'Saved'
  );

  function syncDotClass(s) {
    switch (s?.status) {
      case 'synced': return 'dot-green';
      case 'ahead': return 'dot-blue';
      case 'behind': return 'dot-orange';
      case 'diverged': return 'dot-red';
      case 'no-upstream': return 'dot-grey';
      case 'error': return 'dot-red';
      default: return 'dot-grey';
    }
  }

  function syncLabel(s) {
    switch (s?.status) {
      case 'synced': return 'Synced';
      case 'ahead': return `↑${s.count}`;
      case 'behind': return `↓${s.count}`;
      case 'diverged': return `↑${s.ahead} ↓${s.behind}`;
      case 'no-upstream': return 'No upstream';
      case 'error': return 'Sync error';
      default: return '';
    }
  }

  function syncTitle(s) {
    switch (s?.status) {
      case 'synced': return 'Synced — local and remote match';
      case 'ahead': return `Local is ${s.count} commit${s.count !== 1 ? 's' : ''} ahead`;
      case 'behind': return `Local is ${s.count} commit${s.count !== 1 ? 's' : ''} behind`;
      case 'diverged': return `Diverged — ${s.ahead} ahead, ${s.behind} behind`;
      case 'no-upstream': return 'No upstream branch configured';
      case 'error': return s.message || 'Sync error';
      default: return 'Open Remote Sync';
    }
  }
</script>

<footer class="status-bar">
  <!-- Left: document & project context -->
  <div class="zone left">
    {#if !projectState.isOpen}
      <span class="seg muted">No project open</span>
    {:else}
      <span class="seg muted">
        {projectState.index.files.length} note{projectState.index.files.length !== 1 ? 's' : ''}
      </span>
      {#if projectState.selectedFile}
        <span class="seg save" class:is-unsaved={projectState.saveStatus === 'unsaved'}>
          <span class="dot {projectState.saveStatus === 'saved' ? 'dot-green' : projectState.saveStatus === 'saving' ? 'dot-orange' : 'dot-grey'}"></span>
          {saveLabel}
        </span>
        <span class="seg file" title={projectState.selectedFile.filename}>
          {projectState.selectedFile.name}
        </span>
      {:else}
        <span class="seg muted">No file selected</span>
      {/if}
    {/if}
  </div>

  <!-- Center: selection summary (only when something is selected) -->
  <div class="zone center">
    {#if projectState.selectionLength > 0}
      <span class="seg">{projectState.selectionLength} selected</span>
    {/if}
  </div>

  <!-- Right: editor & repo state -->
  <div class="zone right">
    {#if projectState.selectedFile}
      <span class="seg">Ln {projectState.cursorLine}, Col {projectState.cursorCol}</span>
      <span class="seg">{wordCount} word{wordCount !== 1 ? 's' : ''}</span>
      <span class="seg muted">{charCount} char{charCount !== 1 ? 's' : ''}</span>
    {/if}
    {#if mcpRunning}
      <span class="seg muted" title="MCP server is running">
        <i class="fas fa-plug"></i> MCP
      </span>
    {/if}
    {#if branch}
      <button class="seg chip" onclick={onShowSync} title={syncTitle(sync)}>
        <i class="fas fa-code-branch"></i>
        <span>{branch}</span>
        <span class="dot {syncDotClass(sync)}"></span>
        {#if syncLabel(sync)}<span class="sync-text">{syncLabel(sync)}</span>{/if}
      </button>
    {/if}
  </div>
</footer>

<style>
  .status-bar {
    display: flex;
    align-items: center;
    height: 24px;
    flex-shrink: 0;
    padding: 0 8px;
    gap: 12px;
    font-size: 12px;
    line-height: 1;
    color: var(--text-secondary);
    background: var(--bg-surface);
    border-top: 1px solid var(--border);
    user-select: none;
    overflow: hidden;
    white-space: nowrap;
  }

  .zone {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }
  .zone.left { flex: 0 1 auto; }
  .zone.center { flex: 1 1 auto; justify-content: center; }
  .zone.right { flex: 0 0 auto; }

  .seg {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
  }

  .seg.file {
    max-width: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--text-primary);
  }

  .muted { color: var(--text-secondary); opacity: 0.8; }

  .seg.save.is-unsaved { color: var(--text-primary); }

  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  /* Sync dot colors mirror SyncModal.svelte so the two stay consistent. */
  .dot-green { background: #4ade80; }
  .dot-blue { background: #60a5fa; }
  .dot-orange { background: #fb923c; }
  .dot-red { background: #f87171; }
  .dot-grey { background: #9ca3af; }

  .chip {
    font: inherit;
    color: inherit;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    transition: background 0.15s, color 0.15s;
  }
  .chip:hover {
    background: var(--bg-button);
    color: var(--text-primary);
  }
  .sync-text { font-variant-numeric: tabular-nums; }
</style>
