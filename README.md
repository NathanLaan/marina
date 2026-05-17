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
