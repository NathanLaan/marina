# Marina

Monorepo for desktop apps that share UI and Electron infrastructure.

## Apps

- `apps/noteliner/`   — outliner-style note-taking
- `apps/threadliner/` — RSS reader with git sync

### NoteLiner

NoteLiner is a single-user outliner-style note-taking application, built with Electron and Svelte 5. It allows users to create and organize files in a hierarchical structure. Each file is written in Markdown with syntax highlighting, and all changes are automatically synced via Git.

NoteLiner should be considered BETA software. I wrote it for my own personal use, and it meets my specific needs.

### ThreadLiner

A desktop RSS reader built with Electron, Svelte, and Git-synced JSON. Supports RSS 2.0, Atom, and JSON Feed formats.

## Packages

- `packages/desktop-ui/` — shared UI components, theme system, Electron host helpers.

## Prerequisites

- Node.js 20+ (Vite 6 prefers 22.12+; 20.x works with a warning)
- npm 9+

## Install

```bash
npm install
```

This installs all workspaces and links them via the root `package-lock.json`.

## Build

```bash
npm run build              # builds both apps (apps/<app>/dist/)
npm run build:noteliner
npm run build:threadliner
```

## Run in development

Both apps share the same dev orchestration (`scripts/dev.js` per app):
start Vite, wait for `Local:` in its output, then spawn Electron with
`NODE_ENV=development` so the main process loads the dev server URL
instead of the built file. Save in your editor → HMR.

```bash
npm run electron:dev -w noteliner       # Vite on 5250 + Electron
npm run electron:dev -w threadliner     # Vite on 5251 + Electron

# Root shortcuts:
npm run electron:noteliner
npm run electron:threadliner
```

The two apps use different Vite ports (5250 / 5251), so you can run them
side-by-side without a collision.

Renderer-only (no Electron window — useful when you just want to iterate
on Svelte components):

```bash
npm run dev -w noteliner       # or: npm run dev:noteliner
npm run dev -w threadliner     # or: npm run dev:threadliner
```

## Run a built app

After `npm run build`:

```bash
npm run start -w noteliner
npm run start -w threadliner
```

## App icons

Each app's icon originates from a master SVG inside the app:

- `apps/noteliner/assets/icon.svg`
- `apps/threadliner/assets/icon.svg`

The pipeline from SVG to packaged app is:

1. `scripts/rasterize-icon.js` (headless Electron) renders each app's
   `assets/icon.svg` to a 512×512 `assets/icon.png` alongside it.
2. Each app's `build:icons` step (ImageMagick, in `apps/<app>/scripts/build-icons.sh`)
   pads that PNG into a square `apps/<app>/build/icon.png`.
3. `electron-builder` reads `build/icon.png` and derives the platform
   icons (`.icns`, `.ico`, multi-size PNG sets) at package time.

After editing either source SVG, regenerate the per-app PNGs:

```bash
npm run icons:rasterize                 # both apps
npm run icons:rasterize:noteliner       # one app
npm run icons:rasterize:threadliner
```

Commit the updated `apps/<app>/assets/icon.png` alongside the SVG change.
Step 2 runs automatically as part of `build:linux` / `build:win` / `build:mac` / `build:all`.
