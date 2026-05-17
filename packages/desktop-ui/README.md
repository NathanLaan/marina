# @marina/desktop-ui

Shared UI components, theme system, and Electron host helpers for the Marina
desktop apps (NoteLiner, Threadliner).

This package is workspace-private — it's not published to npm. Consumers
inside the Marina monorepo depend on it via `"@marina/desktop-ui": "*"`.

## Required versions

| Dependency | Range | Why |
|---|---|---|
| Svelte | `^5.0.0` | Runes (`$state`, `$props`, `$derived`, `$effect`) and the snippet template syntax used throughout |
| Electron | `>=28` | `contextBridge`, `app.relaunch`, IPC modeled on the modern surface |
| Vite | `^6.0.0` | What both consumer apps use; the library has no opinion of its own — it's source-only |
| Node | `>=20` (Vite 6 prefers `>=22.12`) | Matches the consumer apps |

The peer-dependency range in `package.json` is the source of truth.

## What's exported

Imports are exposed under subpaths so consumers can tree-shake. The umbrella
`@marina/desktop-ui` is for quick prototyping; subpaths are the canonical form
for production code.

| Subpath | Exports |
|---|---|
| `@marina/desktop-ui/theme` | `themeState` (rune-based store with `init`, `set`, `setScale`, `zoomIn/Out/Reset`, `hydrateFromSettings`, `configure`) |
| `@marina/desktop-ui/styles` | The global stylesheet — scrollbars, modal/pane classes, `:root` fallbacks. Import once per renderer. |
| `@marina/desktop-ui/components` | `TitleBar`, `Toolbar`, `ToolbarButton`, `ToolbarDivider`, `ToolbarSpacer`, `AboutModal` |
| `@marina/desktop-ui/settings` | `SettingsShell`, `SettingGroup`, `ThemeList`, `ScaleList`, `ToggleOption`, `RestartBanner`, `ShortcutsList` |
| `@marina/desktop-ui/panels` | `PaneHost` — vertical stack of drag-to-reorder, drag-to-resize panes; pane bodies come from consumer snippets |
| `@marina/desktop-ui/command-palette` | `CommandPalette`, `commandRegistry`, `fuzzyScore` |
| `@marina/desktop-ui/electron-host` | `registerWindowHandlers`, `registerUIPrefsHandlers`, `registerRelaunchHandler`, `applyFrameFromPrefs` — used from your app's `main.js` |
| `@marina/desktop-ui/secondary-window` | `createSecondaryWindow`, `getSecondaryWindow`, `closeSecondaryWindow` — singleton non-modal BrowserWindow helper for help/preferences/scratchpad windows |
| `@marina/desktop-ui/preload` | `exposeWindowApi`, `exposeUIPrefsApi` — used from your app's `preload.js` |

Anything not listed in the `exports` map of `package.json` is **internal**
and may change without notice (utility files, individual `.svelte`
components imported via deep paths, etc.).

## Quickstart

### Renderer (Svelte)

```js
// src/renderer/main.js
import App from './App.svelte';
import '@fortawesome/fontawesome-free/css/all.min.css';
import '@marina/desktop-ui/styles';
import { mount } from 'svelte';
import { themeState } from '@marina/desktop-ui/theme';

// Pin the localStorage prefix so this app doesn't clobber another consumer's
// theme on the same machine. Synchronous — paints saved theme on first frame.
themeState.init({ appId: 'myapp' });

mount(App, { target: document.getElementById('app') });
```

```svelte
<!-- src/renderer/App.svelte -->
<script>
  import { TitleBar } from '@marina/desktop-ui/components';
  import { SettingsShell, ThemeList, SettingGroup } from '@marina/desktop-ui/settings';

  let showSettings = $state(false);
  let activeTab = $state('ui');

  const tabs = [{ id: 'ui', label: 'UI', render: uiTab }];
</script>

{#snippet uiTab()}
  <SettingGroup label="Theme">
    <ThemeList />
  </SettingGroup>
{/snippet}

<TitleBar appName="MyApp" />

{#if showSettings}
  <SettingsShell {tabs} bind:activeTab onClose={() => (showSettings = false)} />
{/if}
```

### Main process

```js
// src/main/main.js
const { app, BrowserWindow } = require('electron');
const {
  registerWindowHandlers,
  registerUIPrefsHandlers,
  applyFrameFromPrefs,
} = require('@marina/desktop-ui/electron-host');

let mainWindow;
let uiPrefsApi;

app.whenReady().then(() => {
  uiPrefsApi = registerUIPrefsHandlers({
    prefsPath: path.join(app.getPath('userData'), 'ui-preferences.json'),
    defaults: { customTitlebar: false },
  });
  registerWindowHandlers({ getWindow: () => mainWindow });

  const opts = applyFrameFromPrefs({ width: 1200, height: 800, /* ... */ }, uiPrefsApi.read());
  mainWindow = new BrowserWindow(opts);
});
```

### Preload

```js
// src/main/preload.js
const { contextBridge, ipcRenderer } = require('electron');
const { exposeWindowApi, exposeUIPrefsApi } = require('@marina/desktop-ui/preload');

contextBridge.exposeInMainWorld('api', {
  ...exposeWindowApi(ipcRenderer),
  ...exposeUIPrefsApi(ipcRenderer),
  // ...app-specific methods
});
```

## Conventions you must follow

### Preload must be bundled (or `sandbox: false`)

Modern Electron defaults `sandbox` to `true` when `contextIsolation: true` +
`nodeIntegration: false`. A sandboxed preload can't `require()` third-party
packages (the allowlist is `electron`, `events`, `timers`, `url` only) —
plain `require('@marina/desktop-ui/preload')` fails there.

Two ways to handle this:

- **(Recommended) Bundle the preload.** Inline `@marina/desktop-ui/preload`
  into a single self-contained file at build time. The Marina monorepo's
  three apps use esbuild via a one-line npm script:

  ```jsonc
  "scripts": {
    "bundle:preload": "esbuild src/main/preload.js --bundle --platform=node --target=node20 --external:electron --outfile=dist/preload.cjs",
    "prebuild": "npm run bundle:preload"
  }
  ```

  Then point `webPreferences.preload` at the bundled output
  (`dist/preload.cjs`) instead of the source file, and Electron's default
  sandbox stays on.

- **Set `sandbox: false`.** Simpler for prototyping; opts that renderer
  out of Chromium's sandbox. Avoid for production windows that load
  untrusted content.

### `themeState.init({ appId })`

The library namespaces its `localStorage` keys (`<appId>-theme`,
`<appId>-scale`) so two consumers sharing one machine don't fight over the
same key. Default is `desktop-ui`; both consumer apps in this repo pass a
unique `appId` at init time.

### `themeState.hydrateFromSettings()` (optional)

Apps whose data dir is git-synced (e.g. Threadliner) can mirror the
theme/scale choice into a synced settings store and pick it up on a fresh
install. The library writes through `window.api.setSetting('theme'|'scale', …)`
in `set`/`setScale` when that method is present, and `hydrateFromSettings()`
backfills from `window.api.getSetting(…)` when localStorage is empty. Both
are no-ops when the corresponding `window.api` method isn't exposed, so apps
without a settings IPC (NoteLiner) ignore the entire mechanism cleanly.

### `app:relaunch` and dev orchestrators

The library's `registerRelaunchHandler` does `app.relaunch(); app.exit(0);`
— correct for packaged builds, but in dev it tears down the spawned Electron
child and (with it) the Vite dev server. If you use a dev orchestrator like
the `scripts/dev.js` pattern in this monorepo, register a custom
`app:relaunch` handler that creates a new `BrowserWindow` (which re-reads
prefs through `uiPrefsApi.read()`) and closes the old one. Both consumer
apps and the playground do this.

## API stability promise

Anything reachable through `@marina/desktop-ui` or one of its declared
subpath exports is part of the v1 API. Changes that remove an export, rename
a prop, or change a function signature constitute a breaking change and bump
the major version.

Additions — new components, new props (with safe defaults), new exports —
are minor-version changes.

Internal files (anything not behind a subpath export) can change in any
release.

## Development

The playground exercises every export:

```bash
npm run playground   # from the monorepo root
```

It's also the target the snapshot tests drive:

```bash
npm test         -w @marina/desktop-ui     # run visual regression
npm run test:update -w @marina/desktop-ui  # regenerate baselines
```

Baselines live in `tests/visual.spec.js-snapshots/` and are checked in.
Generate them on the first run, then commit; subsequent runs will compare
against the committed images with a small (0.2%) pixel-diff tolerance to
absorb sub-pixel rendering differences across machines.

## Cutting a release

`@marina/desktop-ui` is workspace-private — there is no `npm publish` step.
Tag the repo when you want to mark an API surface stable:

```bash
git tag -a desktop-ui-v1.0.0 -m "@marina/desktop-ui 1.0.0"
git push origin desktop-ui-v1.0.0
```

Bump `version` in `package.json` alongside the tag; consumers don't pin
because they use `"@marina/desktop-ui": "*"` workspace links, but the
version field is what the API stability promise above refers to.
