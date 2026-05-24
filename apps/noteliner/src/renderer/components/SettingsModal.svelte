<script>
  import { onMount } from 'svelte';
  import {
    SettingsShell, SettingGroup, ThemeList, ScaleList, ToggleOption,
    RestartBanner, ShortcutsList,
  } from '@marina/desktop-ui/settings';
  import { commandRegistry } from '@marina/desktop-ui/command-palette';
  import McpWalkthroughModal from './McpWalkthroughModal.svelte';

  let { onClose } = $props();

  let activeTab = $state('ui');
  let customTitlebar = $state(false);
  let customTitlebarInitial = $state(false);
  let writeFrontmatter = $state(true);
  let spellCheckEnabled = $state(true);
  let mcpEnabled = $state(false);
  let mcpConfirmWrites = $state(false);
  let mcpDisabledTools = $state([]);
  let showMcpWalkthrough = $state(false);
  let mcpStatus = $state(null);
  let copiedConfig = $state(false);
  let prefsLoaded = $state(false);

  async function refreshMcpStatus() {
    if (window.api?.getMcpStatus) {
      try { mcpStatus = await window.api.getMcpStatus(); }
      catch { mcpStatus = null; }
    }
  }

  onMount(async () => {
    if (window.api?.getUIPrefs) {
      try {
        const prefs = await window.api.getUIPrefs();
        customTitlebar = !!prefs?.customTitlebar;
        customTitlebarInitial = customTitlebar;
        writeFrontmatter = prefs?.writeFrontmatter !== false;
        spellCheckEnabled = prefs?.spellCheckEnabled !== false;
        mcpEnabled = !!prefs?.mcpEnabled;
        mcpConfirmWrites = !!prefs?.mcpConfirmWrites;
        mcpDisabledTools = Array.isArray(prefs?.mcpDisabledTools) ? [...prefs.mcpDisabledTools] : [];
      } catch { /* ignore */ }
    }
    await refreshMcpStatus();
    prefsLoaded = true;
  });

  // Refresh MCP status whenever the user lands on the MCP tab — the previous
  // top-tab onclick handler did this inline; we replicate it as an effect so
  // the new bind:activeTab in SettingsShell stays the source of truth.
  $effect(() => {
    if (activeTab === 'mcp') refreshMcpStatus();
  });

  async function setCustomTitlebar(next) {
    customTitlebar = next;
    if (window.api?.setUIPrefs) {
      try { await window.api.setUIPrefs({ customTitlebar }); } catch { /* ignore */ }
    }
  }

  async function setWriteFrontmatter(next) {
    writeFrontmatter = next;
    if (window.api?.setUIPrefs) {
      try { await window.api.setUIPrefs({ writeFrontmatter }); } catch { /* ignore */ }
    }
  }

  async function setSpellCheckEnabled(next) {
    spellCheckEnabled = next;
    if (window.api?.setUIPrefs) {
      try { await window.api.setUIPrefs({ spellCheckEnabled }); } catch { /* ignore */ }
    }
  }

  async function toggleMcp() {
    // Every off→on transition opens the walkthrough as a confirmation gate.
    // The toggle only commits if the user clicks "Enable" inside the modal.
    // Off-direction (disabling) flips silently — no value in nagging there.
    if (!mcpEnabled) {
      if (!mcpStatus?.bridgePath) await refreshMcpStatus();
      showMcpWalkthrough = true;
      return;
    }
    mcpEnabled = false;
    if (window.api?.setUIPrefs) {
      try { await window.api.setUIPrefs({ mcpEnabled: false }); } catch { /* ignore */ }
    }
    await refreshMcpStatus();
  }

  async function handleWalkthroughEnable() {
    showMcpWalkthrough = false;
    mcpEnabled = true;
    if (window.api?.setUIPrefs) {
      try { await window.api.setUIPrefs({ mcpEnabled: true }); } catch { /* ignore */ }
    }
    await refreshMcpStatus();
  }

  function handleWalkthroughCancel() {
    showMcpWalkthrough = false;
  }

  async function setMcpConfirmWrites(next) {
    mcpConfirmWrites = next;
    if (window.api?.setUIPrefs) {
      try { await window.api.setUIPrefs({ mcpConfirmWrites }); } catch { /* ignore */ }
    }
  }

  async function toggleToolDisabled(tool) {
    if (mcpDisabledTools.includes(tool)) {
      mcpDisabledTools = mcpDisabledTools.filter(t => t !== tool);
    } else {
      mcpDisabledTools = [...mcpDisabledTools, tool];
    }
    if (window.api?.setUIPrefs) {
      try { await window.api.setUIPrefs({ mcpDisabledTools }); } catch { /* ignore */ }
    }
  }

  // Tool lists come from main via getMcpStatus so the source of truth is the
  // service itself — no chance of the UI listing a tool that doesn't exist.
  let readTools = $derived(mcpStatus?.tools?.read || []);
  let writeTools = $derived(mcpStatus?.tools?.write || []);

  let mcpConfigSnippet = $derived(mcpStatus?.bridgePath
    ? JSON.stringify({
        mcpServers: {
          noteliner: {
            command: 'node',
            args: [mcpStatus.bridgePath],
          },
        },
      }, null, 2)
    : '');

  async function copyMcpConfig() {
    if (!mcpConfigSnippet) return;
    try {
      await navigator.clipboard.writeText(mcpConfigSnippet);
      copiedConfig = true;
      setTimeout(() => { copiedConfig = false; }, 1500);
    } catch { /* ignore */ }
  }

  let mcpStatusText = $derived(
    !mcpStatus ? '…'
    : !mcpStatus.enabled ? 'Disabled'
    : !mcpStatus.projectOpen ? 'Idle (no project open)'
    : mcpStatus.running ? 'Running'
    : 'Stopped'
  );

  async function applyRestart() {
    if (window.api?.relaunchApp) {
      await window.api.relaunchApp();
    }
  }

  let restartPending = $derived(prefsLoaded && customTitlebar !== customTitlebarInitial);

  // Derived from the command registry — single source of truth for shortcuts.
  // Adding a new keyboard shortcut means adding the command in App.svelte's
  // registerCommands(); this list updates automatically.
  const shortcuts = $derived(commandRegistry.shortcutList());

  // CodeMirror-handled shortcuts that aren't NoteLiner commands but are worth
  // documenting alongside.
  const editorShortcuts = [
    { keys: 'Ctrl+Shift+F', action: 'Find in File', section: 'Editor' },
  ];

  const allShortcuts = $derived([...shortcuts, ...editorShortcuts]);

  const tabs = [
    { id: 'ui',        label: 'UI',                 render: uiTab },
    { id: 'mcp',       label: 'MCP',                render: mcpTab },
    { id: 'shortcuts', label: 'Keyboard Shortcuts', render: shortcutsTab },
  ];
</script>

{#snippet uiTab()}
  <SettingGroup label="Theme">
    <ThemeList />
  </SettingGroup>

  <SettingGroup label="UI Scale">
    <ScaleList />
  </SettingGroup>

  <SettingGroup label="Window">
    <ToggleOption
      label="Custom Window Titlebar"
      checked={customTitlebar}
      disabled={!prefsLoaded}
      onchange={setCustomTitlebar}
    />
    {#if restartPending}
      <RestartBanner
        message="Restart required to apply titlebar change."
        onRestart={applyRestart}
      />
    {/if}
  </SettingGroup>

  <SettingGroup
    label="Storage"
    help="Mirrors id, name, and tags into a YAML block at the top of each note so external tools can read them. Applies to future saves; files are reconciled on next project open."
  >
    <ToggleOption
      label="Write YAML frontmatter to .md files"
      checked={writeFrontmatter}
      disabled={!prefsLoaded}
      onchange={setWriteFrontmatter}
    />
  </SettingGroup>

  <SettingGroup
    label="Editor"
    help="Underlines misspelled words in the editor. Uses Chromium's built-in spell checker with your system language. Toggle with F7."
  >
    <ToggleOption
      label="Check spelling"
      checked={spellCheckEnabled}
      disabled={!prefsLoaded}
      onchange={setSpellCheckEnabled}
    />
  </SettingGroup>
{/snippet}

{#snippet mcpTab()}
  <SettingGroup
    label="Model Context Protocol Server"
    help="Lets external AI assistants (Claude Code, Claude Desktop, Cursor) list, read, search, and write notes in the currently-open project. All writes go through the normal save path and are committed to git. The server is local-only — no network port is opened."
  >
    <ToggleOption
      label="Enable MCP server"
      checked={mcpEnabled}
      disabled={!prefsLoaded}
      onchange={toggleMcp}
    />
  </SettingGroup>

  <SettingGroup label="Status">
    <div class="mcp-status-row">
      <span class="mcp-status-dot" class:running={mcpStatus?.running}></span>
      <span class="mcp-status-text">{mcpStatusText}</span>
      <button class="link-btn" onclick={refreshMcpStatus}>Refresh</button>
    </div>
    {#if mcpStatus?.socketPath}
      <div class="mcp-kv">
        <span class="mcp-k">Socket</span>
        <code class="mcp-v">{mcpStatus.socketPath}</code>
      </div>
    {/if}
    {#if mcpStatus?.bridgePath}
      <div class="mcp-kv">
        <span class="mcp-k">Bridge</span>
        <code class="mcp-v">{mcpStatus.bridgePath}</code>
      </div>
    {/if}
  </SettingGroup>

  {#if mcpEnabled && mcpConfigSnippet}
    <SettingGroup label="Client Configuration">
      <p class="setting-help">
        Paste this into your MCP client's config file (for Claude Code:
        <code>.mcp.json</code> in the project; for Claude Desktop:
        <code>claude_desktop_config.json</code>).
      </p>
      <div class="snippet-wrap">
        <pre class="snippet">{mcpConfigSnippet}</pre>
        <button class="snippet-copy" onclick={copyMcpConfig}>
          {copiedConfig ? 'Copied' : 'Copy'}
        </button>
      </div>
    </SettingGroup>
  {/if}

  <SettingGroup
    label="Safety"
    help={`When enabled, NoteLiner asks for permission before running write tools (create_note, update_note, delete_note, etc.). Read tools are never gated. "Allow for session" remembers your choice until the project closes.`}
  >
    <ToggleOption
      label="Ask before write operations"
      checked={mcpConfirmWrites}
      disabled={!prefsLoaded || !mcpEnabled}
      onchange={setMcpConfirmWrites}
    />
  </SettingGroup>

  {#if mcpStatus?.tools}
    <SettingGroup
      label="Tool Access"
      help="Untick to disable individual tools. Disabled tools return an error to the MCP client. This applies to both read and write tools — handy for restricting an agent's reach without turning the whole server off."
    >
      <div class="tool-section">
        <span class="tool-section-label">Read</span>
        {#each readTools as tool (tool)}
          {@const disabled = mcpDisabledTools.includes(tool)}
          <button
            class="tool-row"
            class:disabled
            onclick={() => toggleToolDisabled(tool)}
            disabled={!prefsLoaded || !mcpEnabled}
          >
            <span class="tool-check">
              {#if !disabled}
                <i class="fas fa-square-check"></i>
              {:else}
                <i class="far fa-square"></i>
              {/if}
            </span>
            <code class="tool-name">{tool}</code>
          </button>
        {/each}
      </div>

      <div class="tool-section">
        <span class="tool-section-label">Write</span>
        {#each writeTools as tool (tool)}
          {@const disabled = mcpDisabledTools.includes(tool)}
          <button
            class="tool-row"
            class:disabled
            onclick={() => toggleToolDisabled(tool)}
            disabled={!prefsLoaded || !mcpEnabled}
          >
            <span class="tool-check">
              {#if !disabled}
                <i class="fas fa-square-check"></i>
              {:else}
                <i class="far fa-square"></i>
              {/if}
            </span>
            <code class="tool-name">{tool}</code>
            <span class="tool-tag">write</span>
          </button>
        {/each}
      </div>
    </SettingGroup>
  {/if}
{/snippet}

{#snippet shortcutsTab()}
  <ShortcutsList shortcuts={allShortcuts} />
{/snippet}

<SettingsShell {tabs} bind:activeTab {onClose} />

{#if showMcpWalkthrough}
  <McpWalkthroughModal
    bridgePath={mcpStatus?.bridgePath || ''}
    onEnable={handleWalkthroughEnable}
    onCancel={handleWalkthroughCancel}
  />
{/if}

<style>
  .setting-help {
    margin: 8px 2px 0;
    font-size: 12px;
    line-height: 1.4;
    color: var(--text-muted);
  }

  .mcp-status-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-primary);
  }

  .mcp-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-faint);
  }

  .mcp-status-dot.running {
    background: #2ea043;
    box-shadow: 0 0 6px rgba(46, 160, 67, 0.6);
  }

  .mcp-status-text {
    flex: 1;
  }

  .mcp-kv {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 8px;
    font-size: 12px;
  }

  .mcp-k {
    font-size: 11px;
    text-transform: uppercase;
    color: var(--text-muted);
    width: 60px;
    flex-shrink: 0;
  }

  .mcp-v {
    color: var(--text-secondary);
    font-family: 'SF Mono', 'Fira Code', monospace;
    word-break: break-all;
  }

  .link-btn {
    font-size: 12px;
    color: var(--accent);
    background: transparent;
    padding: 0;
  }

  .link-btn:hover {
    text-decoration: underline;
  }

  .snippet-wrap {
    position: relative;
    margin-top: 8px;
  }

  .snippet {
    background: var(--bg-base);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 12px 14px;
    margin: 0;
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 12px;
    color: var(--text-secondary);
    white-space: pre;
    overflow-x: auto;
  }

  .snippet-copy {
    position: absolute;
    top: 8px;
    right: 8px;
    padding: 4px 10px;
    font-size: 11px;
    background: var(--bg-button);
    color: var(--text-primary);
    border-radius: 4px;
    border: 1px solid var(--border);
  }

  .snippet-copy:hover {
    background: var(--bg-button-hover);
  }

  .tool-section {
    margin-top: 8px;
  }

  .tool-section-label {
    display: block;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-faint);
    margin: 8px 0 4px;
  }

  .tool-row {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 6px 10px;
    background: transparent;
    border-radius: 4px;
    font-size: 13px;
    color: var(--text-primary);
    text-align: left;
    transition: background 0.15s;
  }

  .tool-row:hover:not(:disabled) {
    background: var(--bg-button);
  }

  .tool-row:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .tool-row.disabled .tool-name {
    color: var(--text-muted);
    text-decoration: line-through;
  }

  .tool-check {
    width: 18px;
    text-align: center;
    color: var(--accent);
  }

  .tool-row.disabled .tool-check {
    color: var(--text-faint);
  }

  .tool-name {
    flex: 1;
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 12px;
  }

  .tool-tag {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-faint);
    background: var(--bg-base);
    padding: 1px 6px;
    border-radius: 3px;
  }
</style>
