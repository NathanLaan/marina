# Plan: Marina foundation — deferred and follow-up items

Status: Active. Tracks the work that wasn't part of the
[`plan-refactor-steps.md`](./plan-refactor-steps.md) execution path but
either blocks calling the foundation effort "done" or was explicitly
deferred to a later pass.

## Where we are

Steps 4–10 from `plan-refactor-steps.md` are complete:

- Monorepo with `apps/noteliner`, `apps/threadliner`, `packages/desktop-ui`,
  and `packages/desktop-ui/examples/playground`.
- Both apps consume `@marina/desktop-ui` for chrome and theming.
- Library has a Playwright snapshot harness scaffolded.
- Library API documented; `package.json` `exports` map is the SoT.

Confirm with:

```bash
cd ~/dev/hub/laan/marina
npm run build         # all workspaces green
ls packages/desktop-ui/tests/visual.spec.js  # snapshot harness exists
```

## Phase map

| Phase | Theme | Status |
|---|---|---|
| A | Blocking completion (Step 10 finish-up) | Pending user |
| B | Small polish (caught in passing during 4–10) | Pending |
| C | Explicit deferrals from `plan-refactor-refresh-ui.md` §11 | Pending |
| D | Future direction | Evaluate after A–C |

## Phase A — Blocking completion

These four items are what stand between "Step 10 mechanically done" and
"foundation effort declared complete." None take more than a few minutes.

### A.1 Generate snapshot baselines

The Playwright harness is wired up but no baseline images exist yet.
Run once from a workstation that can actually launch Electron:

```bash
npm run test:update -w @marina/desktop-ui
```

Commit the resulting PNGs under
`packages/desktop-ui/tests/visual.spec.js-snapshots/`. Subsequent
`npm test -w @marina/desktop-ui` runs compare against them with a 0.2%
pixel-diff tolerance.

**Done when:** `tests/visual.spec.js-snapshots/` exists in git with one
PNG per test (7 files at current matrix size).

**Commit:** `test(desktop-ui): pin visual regression baselines`

### A.2 Verify the NoteLiner Playwright suite still passes

Step 8 swapped NoteLiner's TitleBar, AboutModal, Toolbar, SettingsModal,
CommandPalette, theme store, global stylesheet, and the window/UI-prefs
IPC surface for library equivalents. The existing e2e suite under
`apps/noteliner/tests/e2e/` was last green pre-Step 8. Run it:

```bash
npm test -w noteliner
```

Any failures live in NoteLiner consumption code (not the library) and
get fixed there. The library is at the same revision the playground
tests are pinned against, so it's the right reference.

**Done when:** `npm test -w noteliner` is green on the post-Step-8 head.

**Commit:** any fix-forward needed; no commit if it's already passing.

### A.3 Fix the `productName` typo in Threadliner

`apps/threadliner/package.json` still says:

```json
"productName": "Threadline"
```

The npm package + everywhere else in this repo is **Threadliner**.
electron-builder uses `productName` for installer titles, app bundle
names, etc.; leaving it wrong means the next packaged build ships with
the old name. One-line fix.

**Done when:** `productName` reads `"Threadliner"` and a quick
`npm run build:threadliner` is green.

**Commit:** `fix(threadliner): correct productName spelling`

### A.4 Tag `desktop-ui-v1.0.0`

Per the README's "Cutting a release" section:

```bash
git tag -a desktop-ui-v1.0.0 -m "@marina/desktop-ui 1.0.0"
git push origin desktop-ui-v1.0.0
```

Bump `packages/desktop-ui/package.json` `version` from `0.1.0` → `1.0.0`
in the same commit you tag, so the version field matches the tag.

**Done when:** the annotated tag exists locally and on origin (if you
push to GitHub).

**Commit:** `release(desktop-ui): tag v1.0.0`

## Phase B — Small polish

Items I noticed while doing 4–10 that are small enough to land
individually. None affect correctness; each is one commit.

### B.1 Reload in-memory state after `git:resetToRemote` (Threadliner)

`apps/threadliner/src/renderer/components/SyncModal.svelte`'s
`handleResetFromRemote` calls `window.api.gitResetToRemote()` which
overwrites the on-disk data dir with the remote contents — but the
renderer's `feeds` / `entries` / `tags` stores still hold the pre-reset
data. Visible symptom: user resets, modal closes, sidebar still shows
the old feeds until app restart.

Fix: after `gitResetToRemote()` succeeds, dispatch `loadFeeds()`,
`loadTags()`, and `selectFeed(null)` from `stores/app.js`. Roughly:

```js
import { loadFeeds, loadTags, selectFeed } from '../stores/app.js';

async function handleResetFromRemote() {
  // ...existing code...
  try {
    await window.api.gitResetToRemote();
    selectFeed(null);
    await loadFeeds();
    await loadTags();
    await refreshStatus();
  } catch (err) { ... }
}
```

**Done when:** reset is followed by a visible refresh of the feeds list
without restart.

**Commit:** `fix(threadliner): refresh in-memory state after reset from remote`

### B.2 Optional theme allowlist for Threadliner

The library exposes 6 themes (light / dark / midnight / darkPurple /
lightPurple / lightMulberry). Threadliner had 3 (light / dark /
midnight) before Step 9; the new options work fine but expose theming
Threadliner didn't ship before.

If you'd rather keep Threadliner at 3, add an allowlist option to the
library's `themeState.configure({ themes: [...] })`. Sketch:

```js
// packages/desktop-ui/src/theme/index.svelte.js
configure({ appId, themes } = {}) {
  if (appId) this.appId = appId;
  if (Array.isArray(themes)) this.themeAllowlist = themes;
}

get list() {
  const ids = this.themeAllowlist || Object.keys(THEMES);
  return ids
    .filter((id) => THEMES[id])
    .map((id) => ({ id, name: THEMES[id].name }));
}
```

Then in `apps/threadliner/src/renderer/main.js`:

```js
themeState.init({
  appId: 'threadliner',
  themes: ['light', 'dark', 'midnight'],
});
```

**Done when:** Threadliner's Settings → UI → Theme list shows three
themes; NoteLiner still shows six.

**Commit:** `feat(desktop-ui): add theme allowlist; pin threadliner to 3`

### B.3 Bundle the preload to drop the `sandbox: false` requirement

**Status: done.** esbuild bundles each app's preload into
`dist/preload.cjs` via a `bundle:preload` npm script (run as a `prebuild`
hook and from each `scripts/dev.js` orchestrator before Electron starts).
All three apps now run with Electron's default sandbox enabled. Library
preload header + README updated to describe the bundling pattern as the
primary path with `sandbox: false` as a prototyping fallback.

## Phase C — Explicit deferrals from `plan-refactor-refresh-ui.md` §11

These were called out as "out of scope" in the refresh-UI plan. Each is
a substantial feature in its own right; treat as standalone projects
when (and if) they're worth doing.

### C.1 Auto-updater for Threadliner

The library's `AboutModal` already accepts an optional `updateState`
prop. NoteLiner provides one from `stores/update.svelte.js`, backed by
`electron-updater` and IPC channels `update:getState` / `:checkNow` /
`:downloadNow` / `:installNow` / event `update:state`.

To add to Threadliner:

1. Add `electron-updater` to `apps/threadliner/package.json` deps.
2. Port the `update.svelte.js` store from NoteLiner. Mostly portable;
   review `applies-to` checks for Threadliner-specific concerns.
3. Wire the matching IPC handlers in `apps/threadliner/src/main/main.js`.
4. Add the preload exposures.
5. Pass `updateState={updateState}` into `<AboutModal>` in
   `apps/threadliner/src/renderer/App.svelte`.

**Done when:** Threadliner About modal shows the Check / Download /
Install buttons that NoteLiner already does, fed by a working
electron-updater feed.

**Commit:** `feat(threadliner): wire electron-updater + about modal flow`

### C.2 Paneable / reorderable sidebar

NoteLiner has a multi-pane drag-to-reorder sidebar
(`apps/noteliner/src/renderer/components/Sidebar.svelte` + the
`pane-header*` classes in `packages/desktop-ui/src/styles/global.css`).
Threadliner has a fixed two-section sidebar (Feeds + Tags) — adequate
for an RSS reader.

If we want pane-reorder to be a first-class library feature, lift
NoteLiner's panel-host pattern into `@marina/desktop-ui/panels` (or
similar). API sketch:

```svelte
<PanelHost {panes} bind:order />
<!-- where each pane provides { id, label, render } -->
```

Threadliner's adoption is optional; even with the library API in place,
its two-pane sidebar stays simple.

**Done when:** the library exports a panel-host primitive and NoteLiner
consumes it for its sidebar. (Threadliner stays as-is.)

**Commit:** `feat(desktop-ui): extract paneable sidebar primitive`

### C.3 Help window pattern

NoteLiner has a separate help BrowserWindow loaded from `help.html`
(see `apps/noteliner/src/renderer/help.js`, `HelpApp.svelte`, and the
`help:open` IPC). It's NoteLiner-specific content but the
"second-window with shared chrome" pattern is reusable.

If/when Threadliner wants a help window, two options:

- **A.** Quick port — copy the NoteLiner pattern, with Threadliner's
  content. Limited code sharing.
- **B.** Library-ize — add `@marina/desktop-ui/secondary-window` that
  encapsulates the BrowserWindow + preload + theme bootstrapping for a
  second window with arbitrary content. More work; cleaner long term.

Pick A if Threadliner needs help text and that's it. Pick B if you
anticipate a third surface (preferences-as-window, scratchpad, etc.)
within the next year.

**Done when:** whichever option you pick is live and the user can open
a help window in Threadliner.

**Commit:** `feat(threadliner): add help window` (option A) or
`feat(desktop-ui): extract secondary-window helper` (option B)

## Phase D — Future direction

### D.1 Evaluate `plan-refactor-modular-app.md`

That plan exists in `docs/plans/` as the "evaluate after Step 10" item
in the foundation plan's references section. I haven't read it in
detail. With Phase A done and the library tagged, that's the right
moment to read it cold and decide whether it's worth pursuing.

The summary plan (`plan-refactor-summary.md`) compares the three
plans (foundation, refresh-UI, modular-app) — start there.

**Done when:** you've made a yes/no/modify decision on modular-app and
either deleted the plan, archived it, or promoted it to active.

## Awareness items (no action required)

Things to know about but not necessarily fix:

- **The two `.cjs` files in the library.** `electron-host/index.cjs` and
  `preload/index.cjs` are CommonJS because they run in Electron's main /
  preload contexts which use `require()`. The package is otherwise
  `"type": "module"`. Working as intended.
- **Custom `app:relaunch` handlers in both apps + the playground.** The
  library's `registerRelaunchHandler` does `app.relaunch(); app.exit(0);`
  which tears down `scripts/dev.js` along with Electron, killing Vite.
  Each app registers a window-recreate handler instead. The library's
  helper still works for packaged builds but is unused in this repo.
- **`themeState.hydrateFromSettings` + auto-mirror-to-settings on `set`.**
  Threadliner uses this (git-synced data dir). NoteLiner doesn't expose
  `window.api.setSetting`, so the optional-chain guards skip cleanly.
  Library-side both methods exist generically; no consumer-side opt-in
  needed.

## Pause points

| After phase | What you have |
|---|---|
| A | Foundation effort fully done; v1.0 tagged |
| B | Polish swept; both apps feel finished |
| C | Feature parity across the two apps to whatever degree you choose |
| D | Decision made on the next phase of architectural work |

The natural "ship and rest" point is **after Phase A**. Phases B–D are
opt-in and can land in any order — they don't depend on each other.

## References

- [`plan-refactor-steps.md`](./plan-refactor-steps.md) — completed execution plan (Steps 4–10)
- [`plan-refactor-common-foundation.md`](./plan-refactor-common-foundation.md) — library design (now implemented)
- [`plan-refactor-refresh-ui.md`](./plan-refactor-refresh-ui.md) — Threadliner visual refresh (now implemented); §11 lists what was deferred
- [`plan-refactor-modular-app.md`](./plan-refactor-modular-app.md) — future direction; evaluate in Phase D
- [`plan-refactor-summary.md`](./plan-refactor-summary.md) — three-plan comparison
