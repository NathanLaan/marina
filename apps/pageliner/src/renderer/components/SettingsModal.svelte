<script>
  import { onMount } from 'svelte';
  import {
    SettingsShell, SettingGroup, ThemeList, ScaleList, ToggleOption,
    RestartBanner, ShortcutsList,
  } from '@marina/desktop-ui/settings';
  import { commandRegistry } from '@marina/desktop-ui/command-palette';

  let { onClose } = $props();

  let activeTab = $state('ui');
  let customTitlebar = $state(false);
  let customTitlebarInitial = $state(false);
  let prefsLoaded = $state(false);

  onMount(async () => {
    if (window.api?.getUIPrefs) {
      try {
        const prefs = await window.api.getUIPrefs();
        customTitlebar = !!prefs?.customTitlebar;
        customTitlebarInitial = customTitlebar;
      } catch { /* ignore */ }
    }
    prefsLoaded = true;
  });

  async function setCustomTitlebar(next) {
    customTitlebar = next;
    if (window.api?.setUIPrefs) {
      try { await window.api.setUIPrefs({ customTitlebar }); } catch { /* ignore */ }
    }
  }

  async function applyRestart() {
    if (window.api?.relaunchApp) await window.api.relaunchApp();
  }

  let restartPending = $derived(prefsLoaded && customTitlebar !== customTitlebarInitial);

  // Single source of truth for shortcuts — registered commands in App.svelte.
  const shortcuts = $derived(commandRegistry.shortcutList());

  const tabs = [
    { id: 'ui',        label: 'UI',                 render: uiTab },
    { id: 'shortcuts', label: 'Keyboard Shortcuts', render: shortcutsTab },
  ];
</script>

{#snippet uiTab()}
  <SettingGroup label="Theme">
    <ThemeList />
  </SettingGroup>

  <SettingGroup label="UI Scale" help="Or use Ctrl+= / Ctrl+- / Ctrl+0, or Ctrl+MouseWheel.">
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
{/snippet}

{#snippet shortcutsTab()}
  <ShortcutsList shortcuts={shortcuts} />
{/snippet}

<SettingsShell {tabs} bind:activeTab {onClose} />
