# Marina

Monorepo for desktop apps that share UI and Electron infrastructure.

## Apps

- `apps/noteliner/`   — outliner-style note-taking
- `apps/threadliner/` — RSS reader with git sync

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

Each app has its own dev workflow because they orchestrate Vite + Electron
differently.

### NoteLiner

```bash
npm run electron:dev -w noteliner
```

Starts Vite on port 5250, waits for "Local:" in its output, then launches
Electron pointing at the dev server. Reloads on save.

Renderer-only (no Electron window — useful when you just want to iterate on
Svelte components):

```bash
npm run dev -w noteliner
```

### Threadliner

```bash
npm run dev -w threadliner
# or via the root shortcut:
npm run dev:threadliner
```

Runs `vite build --watch` in the background and launches Electron against the
built output. The renderer rebuilds on save; Electron picks up the new files
on the next reload (`Ctrl+R` inside the window).

## Run a built app

After `npm run build`:

```bash
npm run start -w noteliner
npm run start -w threadliner
```
