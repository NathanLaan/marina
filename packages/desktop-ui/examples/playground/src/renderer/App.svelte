<script>
  import { onMount } from 'svelte';
  import {
    TitleBar, Toolbar, ToolbarButton, ToolbarDivider, ToolbarSpacer,
    AboutModal,
  } from '@marina/desktop-ui/components';
  import {
    SettingsShell, SettingGroup, ThemeList, ScaleList, ToggleOption,
    RestartBanner, ShortcutsList,
  } from '@marina/desktop-ui/settings';
  import { CommandPalette, commandRegistry } from '@marina/desktop-ui/command-palette';
  import { themeState } from '@marina/desktop-ui/theme';

  let showAbout = $state(false);
  let showSettings = $state(false);
  let showPalette = $state(false);
  let toolbarVisible = $state(true);
  // customTitlebar = the current toggle value (what's saved on disk).
  // customTitlebarApplied = the value at startup that determined whether the
  // OS frame is on. Only the latter controls whether <TitleBar/> renders, so
  // we never end up with two stacked bars before a relaunch.
  let customTitlebar = $state(false);
  let customTitlebarApplied = $state(false);
  let prefsLoaded = $state(false);
  let activeSettingsTab = $state('ui');

  const TITLEBAR_HEIGHT = '32px';

  // Register a few sample commands so the palette has something to show.
  commandRegistry.register({
    id: 'demo.about',
    label: 'Show About dialog',
    section: 'Demo',
    run: () => { showAbout = true; },
  });
  commandRegistry.register({
    id: 'demo.settings',
    label: 'Open Settings',
    section: 'Demo',
    shortcut: 'Ctrl+,',
    run: () => { showSettings = true; },
  });
  commandRegistry.register({
    id: 'demo.toggle-toolbar',
    label: 'Toggle toolbar',
    section: 'View',
    run: () => { toolbarVisible = !toolbarVisible; },
  });

  function handleGlobalKeydown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      showPalette = true;
      return;
    }
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.key === '=' || e.key === '+') { e.preventDefault(); themeState.zoomIn(); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); themeState.zoomOut(); }
    else if (e.key === '0') { e.preventDefault(); themeState.zoomReset(); }
  }

  onMount(async () => {
    window.addEventListener('keydown', handleGlobalKeydown);
    if (window.api?.getUIPrefs) {
      try {
        const prefs = await window.api.getUIPrefs();
        customTitlebar = !!prefs?.customTitlebar;
        customTitlebarApplied = customTitlebar;
        // Tell the modal-overlay CSS how much to offset by, so drawers don't
        // overlap the in-renderer titlebar when it's mounted.
        document.documentElement.style.setProperty(
          '--titlebar-height',
          customTitlebarApplied ? TITLEBAR_HEIGHT : '0px',
        );
      } catch { /* non-critical */ }
    }
    prefsLoaded = true;
    return () => window.removeEventListener('keydown', handleGlobalKeydown);
  });

  const restartPending = $derived(prefsLoaded && customTitlebar !== customTitlebarApplied);

  const sampleShortcuts = [
    { keys: 'Ctrl+K', action: 'Open command palette', section: 'General' },
    { keys: 'Ctrl+=', action: 'Zoom in',  section: 'View' },
    { keys: 'Ctrl+-', action: 'Zoom out', section: 'View' },
    { keys: 'Ctrl+0', action: 'Reset zoom', section: 'View' },
  ];

  const tabs = [
    {
      id: 'ui',
      label: 'UI',
      render: uiTab,
    },
    {
      id: 'shortcuts',
      label: 'Keyboard Shortcuts',
      render: shortcutsTab,
    },
  ];

  async function toggleCustomTitlebar() {
    customTitlebar = !customTitlebar;
    if (window.api?.setUIPrefs) {
      try {
        await window.api.setUIPrefs({ customTitlebar });
      } catch { /* non-critical */ }
    }
  }

  function relaunch() {
    console.log('[playground] relaunch clicked — window.api.relaunchApp =', typeof window.api?.relaunchApp);
    window.api?.relaunchApp?.();
  }
</script>

{#snippet uiTab()}
  <SettingGroup label="Theme">
    <ThemeList />
  </SettingGroup>

  <SettingGroup label="UI Scale" help="Or use Ctrl+= / Ctrl+- / Ctrl+0.">
    <ScaleList />
  </SettingGroup>

  <SettingGroup label="Window">
    <ToggleOption
      label="Custom Window Titlebar"
      checked={customTitlebar}
      onchange={toggleCustomTitlebar}
      disabled={!prefsLoaded}
    />
    {#if restartPending}
      <RestartBanner
        message="Restart required to apply titlebar change."
        onRestart={relaunch}
      />
    {/if}
  </SettingGroup>
{/snippet}

{#snippet shortcutsTab()}
  <ShortcutsList shortcuts={sampleShortcuts} />
{/snippet}

{#snippet titlebarActions()}
  <button class="title-action" onclick={() => (showAbout = true)} title="About">
    <i class="fas fa-circle-info"></i>
  </button>
  <button class="title-action" onclick={() => (showSettings = true)} title="Settings">
    <i class="fas fa-gear"></i>
  </button>
{/snippet}

{#if customTitlebarApplied}
  <TitleBar
    appName="desktop-ui playground"
    {toolbarVisible}
    onToggleToolbar={() => (toolbarVisible = !toolbarVisible)}
    actions={titlebarActions}
  />
{/if}

<div class="app-shell">
  {#if toolbarVisible}
    <Toolbar>
      <ToolbarButton icon="fa-bolt"        title="Open palette" active={showPalette}  onclick={() => (showPalette = true)} />
      <ToolbarDivider />
      <ToolbarButton icon="fa-circle-info" title="About"        active={showAbout}    onclick={() => (showAbout = true)} />
      <ToolbarSpacer />
      <ToolbarButton icon="fa-gear"        title="Settings"     active={showSettings} onclick={() => (showSettings = true)} />
    </Toolbar>
  {/if}

  <div class="main">
    <h1>desktop-ui playground</h1>
    <p>Exercises every <code>@marina/desktop-ui</code> export under the current theme.</p>
    <ul>
      <li>Theme: <strong>{themeState.theme.name}</strong> ({themeState.current})</li>
      <li>Scale: <strong>{themeState.scale}%</strong></li>
      <li>Custom titlebar: <strong>{customTitlebar ? 'on' : 'off'}</strong></li>
      <li>Toolbar visible: <strong>{toolbarVisible ? 'yes' : 'no'}</strong></li>
    </ul>
    <p class="hint">
      Press <kbd>Ctrl</kbd>+<kbd>K</kbd> for the command palette,
      <kbd>Ctrl</kbd>+<kbd>=</kbd>/<kbd>-</kbd>/<kbd>0</kbd> for zoom, or use the toolbar buttons above.
    </p>
  </div>
</div>

{#if showAbout}
  <AboutModal
    appName="desktop-ui playground"
    version="0.1.0"
    description="A standalone Electron + Vite app that mounts every library export so the package can be developed without touching either consumer."
    repoUrl="https://github.com/NathanLaan/marina"
    repoLabel="github.com/NathanLaan/marina"
    iconClass="fa-shapes"
    onClose={() => (showAbout = false)}
  />
{/if}

{#if showSettings}
  <SettingsShell
    {tabs}
    bind:activeTab={activeSettingsTab}
    onClose={() => (showSettings = false)}
  />
{/if}

{#if showPalette}
  <CommandPalette onClose={() => (showPalette = false)} />
{/if}

<style>
  .app-shell {
    display: flex;
    zoom: var(--ui-zoom, 1);
    height: calc(var(--ui-zoom-height, 100vh) - var(--titlebar-height, 0px));
    overflow: hidden;
  }

  .main {
    flex: 1;
    padding: 32px 40px;
    overflow-y: auto;
  }

  h1 {
    font-size: 22px;
    margin-bottom: 8px;
  }

  p {
    color: var(--text-secondary);
    margin-bottom: 12px;
    line-height: 1.5;
  }

  ul {
    margin: 16px 0 16px 20px;
    color: var(--text-secondary);
  }

  li { margin-bottom: 4px; }

  .hint {
    margin-top: 24px;
    padding: 12px 14px;
    background: var(--bg-base);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 13px;
  }

  kbd {
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    padding: 1px 5px;
    background: var(--bg-button);
    border: 1px solid var(--border);
    border-radius: 3px;
    color: var(--text-secondary);
  }

  .title-action {
    -webkit-app-region: no-drag;
    width: 36px;
    height: 32px;
    color: var(--accent-on);
    opacity: 0.75;
    background: transparent;
    font-size: 12px;
    border: none;
    cursor: pointer;
  }

  .title-action:hover {
    background: rgba(0, 0, 0, 0.18);
    opacity: 1;
  }
</style>
