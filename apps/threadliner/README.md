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

## Building for Distribution

Threadline uses [electron-builder](https://www.electron.build/) to package the app for distribution.

### 1. Install electron-builder

```bash
npm install --save-dev electron-builder
```

### 2. Add build configuration

Add the following `build` section to `package.json`:

```json
{
  "build": {
    "appId": "com.threadline.app",
    "productName": "Threadline",
    "files": [
      "src/main/**/*",
      "dist/renderer/**/*"
    ],
    "directories": {
      "output": "release"
    },
    "linux": {
      "target": ["AppImage", "deb"],
      "category": "Network;Feed"
    },
    "mac": {
      "target": ["dmg"],
      "category": "public.app-category.news"
    },
    "win": {
      "target": ["nsis"]
    }
  }
}
```

### 3. Add packaging scripts

Add these scripts to the `scripts` section in `package.json`:

```json
{
  "scripts": {
    "dist": "npm run build && electron-builder",
    "dist:linux": "npm run build && electron-builder --linux",
    "dist:mac": "npm run build && electron-builder --mac",
    "dist:win": "npm run build && electron-builder --win"
  }
}
```

### 4. Build the distributable

```bash
# Build for the current platform
npm run dist

# Or target a specific platform
npm run dist:linux
npm run dist:mac
npm run dist:win
```

Output files are written to the `release/` directory (already in `.gitignore`).

### Runtime requirements

The packaged app requires **Git** to be installed on the end user's system for data sync to work. Threadline uses the system `git` CLI and existing SSH credentials.

## Tech Stack

- **Electron** - Desktop runtime
- **Svelte** - Frontend UI framework
- **Vite** - Build tooling
- **Git** - Data sync via commit/push/pull
- **rss-parser** - RSS/Atom XML parsing
- **DOMPurify** - HTML sanitization
- **Font Awesome** - Icons
