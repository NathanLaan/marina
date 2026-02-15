# Threadline

A desktop RSS reader built with Electron, Svelte, and Git-synced JSON. Supports RSS 2.0, Atom, and JSON Feed formats.

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm (included with Node.js)
- [Git](https://git-scm.com/) (required for data sync)
- SSH keys configured for GitHub (if using remote sync)

## Development Setup

1. **Clone the repository**

   ```bash
   git clone <repo-url>
   cd threadline
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Build the renderer**

   ```bash
   npm run build
   ```

4. **Start the app**

   ```bash
   npm start
   ```

On first launch, Threadline will prompt you to choose a local data folder and optionally configure a Git remote for cross-device sync.

## Development Workflow

For active development, use two terminals:

```bash
# Terminal 1: Watch and rebuild the Svelte renderer on changes
npm run dev:renderer

# Terminal 2: Launch Electron (re-run after renderer rebuilds)
npm run dev:electron
```

Or use the combined dev command (builds and launches together):

```bash
npm run dev
```

## NPM Scripts

| Script                  | Description                                   |
| ----------------------- | --------------------------------------------- |
| `npm run build`         | Build the Svelte renderer to `dist/renderer/` |
| `npm start`             | Launch the Electron app                       |
| `npm run dev`           | Watch-build renderer and launch Electron      |
| `npm run dev:renderer`  | Watch-build the renderer only                 |
| `npm run dev:electron`  | Launch Electron only                          |

## Project Structure

```
threadline/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── main.js              # App entry point, window, IPC handlers
│   │   ├── preload.js           # Context bridge (renderer API)
│   │   ├── data-store.js        # JSON file-based data layer
│   │   ├── feed-parser.js       # RSS/Atom/JSON Feed parser
│   │   ├── git-sync.js          # Git CLI wrapper for sync
│   │   └── sync-manager.js      # Debounced commit/push orchestration
│   └── renderer/                # Svelte frontend
│       ├── index.html           # HTML entry point
│       ├── main.js              # Svelte mount point
│       ├── App.svelte           # Root layout component
│       ├── components/          # UI components
│       ├── stores/              # Svelte stores (app state, theme, sync)
│       └── styles/              # Global CSS and theme definitions
├── docs/                        # Documentation and planning
├── package.json
├── vite.config.mjs
└── svelte.config.js
```

## Data Sync

Threadline stores all data as JSON files in a local Git repository:

- `configuration/settings.json` — App settings (theme, sync wait time)
- `data/feeds.json` — Feed index
- `data/feeds/<id>/entries.json` — Per-feed entries with read status

Changes are committed locally on every action and pushed to a remote on a configurable debounce timer (default 10 seconds). The sync system uses the system's `git` CLI and existing SSH credentials.

## Tech Stack

- **Electron** - Desktop runtime
- **Svelte** - Frontend UI framework
- **Vite** - Build tooling
- **Git** - Data sync via commit/push/pull
- **rss-parser** - RSS/Atom XML parsing
- **DOMPurify** - HTML sanitization
- **Font Awesome** - Icons
