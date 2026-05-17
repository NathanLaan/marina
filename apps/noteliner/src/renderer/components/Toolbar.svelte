<script>
  import {
    Toolbar as ToolbarShell, ToolbarButton, ToolbarDivider, ToolbarSpacer,
  } from '@marina/desktop-ui/components';
  import { updateState } from '../stores/update.svelte.js';

  let {
    onGoHome, onOpenFolder, onNewFile, onImportDocument,
    onToggleSidebar, onToggleOutline, onToggleTags, onToggleTagGroups,
    onToggleLog, onToggleAttachments, onToggleSearch, onToggleBacklinks,
    onShowAbout, onShowSettings, onShowProjectSettings, onShowSync, onShowHelp,
    projectOpen,
    customTitlebar = false,
    logVisible = false, sidebarVisible = true, outlineVisible = false,
    tagsVisible = true, tagGroupsVisible = false, attachmentsVisible = false,
    searchVisible = false, backlinksVisible = false,
  } = $props();

  const updateReady = $derived(updateState.state === 'available' || updateState.state === 'downloaded');
</script>

<ToolbarShell>
  {#if !customTitlebar}
    <ToolbarButton icon="fa-house" active={!projectOpen} disabled={!projectOpen} onclick={onGoHome} title="Home" />
    <ToolbarButton icon="fa-folder-open" onclick={onOpenFolder} title="Open Folder (Ctrl+O)" />
  {/if}

  {#if projectOpen}
    {#if !customTitlebar}
      <ToolbarDivider />
      <ToolbarButton icon="fa-file-circle-plus" onclick={onNewFile} title="New File (Ctrl+N)" />
      <ToolbarButton icon="fa-file-import" onclick={onImportDocument} title="Import Document (Ctrl+Shift+I)" />
      <ToolbarDivider />
    {/if}

    <ToolbarButton icon="fa-bars-staggered" active={sidebarVisible} onclick={onToggleSidebar} title="Files (Ctrl+E)" />
    <ToolbarButton icon="fa-list-ol" active={outlineVisible} onclick={onToggleOutline} title="Outline (Ctrl+Shift+O)" />
    <ToolbarButton icon="fa-tag" active={tagsVisible} onclick={onToggleTags} title="Tags (Ctrl+Shift+T)" />
    <ToolbarButton icon="fa-tags" active={tagGroupsVisible} onclick={onToggleTagGroups} title="Tag Groups (Ctrl+G)" />
    <ToolbarButton icon="fa-paperclip" active={attachmentsVisible} onclick={onToggleAttachments} title="Attachments (Ctrl+B)" />

    <ToolbarDivider />

    <ToolbarButton icon="fa-magnifying-glass" active={searchVisible} onclick={onToggleSearch} title="Search (Ctrl+F)" />
    <ToolbarButton icon="fa-link" active={backlinksVisible} onclick={onToggleBacklinks} title="Backlinks (Ctrl+Shift+B)" />
  {/if}

  <ToolbarSpacer />

  {#if projectOpen}
    <ToolbarButton icon="fa-cloud-arrow-up" onclick={onShowSync} title="Remote Sync (Ctrl+Shift+S)" />
  {/if}

  <ToolbarButton icon="fa-terminal" active={logVisible} onclick={onToggleLog} title="Show Log (Ctrl+L)" />

  <ToolbarDivider />

  {#if projectOpen}
    <ToolbarButton icon="fa-sliders" onclick={onShowProjectSettings} title="Project Settings (Ctrl+Shift+,)" />
  {/if}

  <ToolbarButton icon="fa-gear" onclick={onShowSettings} title="Settings (Ctrl+,)" />

  <!-- The About button overlays an update-ready dot, which the library
       primitive doesn't model. Restate the .toolbar-btn styles locally so
       this one button can layer a child <span> on top of the icon. -->
  <button
    class="about-btn"
    onclick={onShowAbout}
    title={updateReady ? `Update ${updateState.state === 'downloaded' ? 'ready to install' : 'available'} — About (Ctrl+I)` : 'About (Ctrl+I)'}
    aria-label="About"
  >
    <i class="fas fa-circle-info"></i>
    {#if updateReady}<span class="update-dot" aria-hidden="true"></span>{/if}
  </button>

  <ToolbarButton icon="fa-circle-question" onclick={onShowHelp} title="Help (F1)" />
</ToolbarShell>

<style>
  .about-btn {
    position: relative;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    color: var(--text-secondary);
    font-size: 16px;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .about-btn:hover {
    background: var(--bg-button);
    color: var(--text-primary);
  }

  .update-dot {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 0 2px var(--bg-overlay);
  }
</style>
