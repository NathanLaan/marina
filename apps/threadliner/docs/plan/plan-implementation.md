# Threadline Implementation Plan

## Overview

Threadline is a single-user desktop RSS reader built with Electron, Svelte, and SQLite. The UI consists of a left toolbar with feed management actions, a resizable sidebar listing feeds, a center panel listing entries for the selected feed, and a right content area displaying the selected entry.

---

## Assumptions

- **Single-user, local-only**: No authentication, no server component. All data is stored locally in SQLite.
- **Desktop only**: Targeting Electron for macOS, Linux, and Windows. No mobile or web deployment.
- **Standard RSS/Atom**: Support for RSS 2.0 and Atom feeds. No proprietary feed formats.
- **Online-only fetching**: Feeds are fetched live from the internet; no offline-first sync or caching beyond what SQLite stores.
- **No OPML import/export in v1**: Can be added later but is not in initial scope.
- **Font Awesome Free**: Using the free icon set via `@fortawesome/fontawesome-free`.
- **Electron Forge or electron-builder**: For packaging and distribution. Plan assumes `electron-builder` unless there's a preference.
- **Vite**: As the build tool for Svelte, using `@sveltejs/vite-plugin-svelte`.
- **better-sqlite3**: Synchronous SQLite driver for Node.js, well-suited for Electron's main process.
- **rss-parser**: Lightweight RSS/Atom parsing library.

---

## Scope

### In Scope (v1)

- Project scaffolding (Electron + Svelte + Vite + SQLite)
- SQLite database schema for feeds and entries
- Add, edit, and remove RSS/Atom feeds
- Fetch and parse feed entries
- Three-panel UI: feed list sidebar, entry list panel, content viewer
- Left toolbar with Font Awesome icon buttons (add, remove, edit)
- Resizable sidebar
- Mark entries as read/unread
- Basic feed refresh (manual)

### Out of Scope (v1)

- OPML import/export
- Feed folders/categories
- Full-text search
- Keyboard shortcuts
- Notification system
- Auto-refresh on a timer
- Theming / dark mode
- Packaged installers (dmg, deb, exe)

---

## Tech Stack

| Layer        | Technology                         |
| ------------ | ---------------------------------- |
| Runtime      | Electron                           |
| Frontend     | Svelte (via Vite)                  |
| Styling      | Plain CSS (scoped Svelte styles)   |
| Icons        | Font Awesome Free                  |
| Database     | SQLite via `better-sqlite3`        |
| Feed Parsing | `rss-parser`                       |
| IPC          | Electron `ipcMain` / `ipcRenderer` |
| Build        | Vite + electron-builder            |

---

## Database Schema (Draft)

### `feeds`

| Column      | Type    | Notes                      |
| ----------- | ------- | -------------------------- |
| id          | INTEGER | Primary key, autoincrement |
| title       | TEXT    | Feed title                 |
| url         | TEXT    | Feed URL (unique)          |
| site_url    | TEXT    | Link to the website        |
| description | TEXT    | Feed description           |
| created_at  | TEXT    | ISO 8601 timestamp         |
| updated_at  | TEXT    | ISO 8601 timestamp         |

### `entries`

| Column       | Type    | Notes                           |
| ------------ | ------- | ------------------------------- |
| id           | INTEGER | Primary key, autoincrement      |
| feed_id      | INTEGER | Foreign key to feeds.id         |
| guid         | TEXT    | Unique identifier from the feed |
| title        | TEXT    | Entry title                     |
| link         | TEXT    | Entry URL                       |
| content      | TEXT    | HTML content or summary         |
| author       | TEXT    | Author name                     |
| published_at | TEXT    | Publication date, ISO 8601      |
| is_read      | INTEGER | 0 = unread, 1 = read            |
| created_at   | TEXT    | ISO 8601 timestamp              |

---

## Major Phases

### Phase 1: Project Scaffolding

Set up the foundational project structure and tooling.

- Initialize `package.json` with dependencies (Electron, Svelte, Vite, better-sqlite3, rss-parser, Font Awesome)
- Configure Vite with `@sveltejs/vite-plugin-svelte`
- Set up Electron main process (`main.js`) with `BrowserWindow`
- Set up preload script for secure IPC bridge
- Create basic `index.html` and root Svelte `App.svelte`
- Verify the app launches with a blank window

### Phase 2: Database Layer

Implement the SQLite database and data access functions.

- Initialize SQLite database file in the app's user data directory
- Create `feeds` and `entries` tables (schema above)
- Implement data access functions: CRUD for feeds, CRUD for entries
- Wire database initialization into the Electron main process startup
- Expose database operations to the renderer via IPC handlers

### Phase 3: Feed Parsing & Management

Implement RSS/Atom feed fetching, parsing, and management operations.

- Implement feed URL validation and fetching
- Parse feeds using `rss-parser`, normalize into the `entries` schema
- Implement "add feed" flow: validate URL, fetch, parse, store feed + entries
- Implement "edit feed" flow: update feed title/URL
- Implement "remove feed" flow: delete feed and its entries
- Implement "refresh feed" to fetch new entries for an existing feed
- Deduplicate entries by `guid` on refresh

### Phase 4: Application Shell & Layout

Build the static UI shell with the three-panel layout and toolbar.

- Create the app layout: toolbar, sidebar, entry list, content area
- Implement the left toolbar with Font Awesome icon buttons (add, remove, edit)
- Make the sidebar resizable (drag handle between sidebar and entry list)
- Apply base styling: fonts, colors, spacing, scrollable panels
- Set up Svelte stores for app state (selected feed, selected entry, feed list, entry list)

### Phase 5: Feed List Sidebar

Wire the sidebar to display feeds and handle selection.

- Display list of feeds from the database in the sidebar
- Highlight the currently selected feed
- Show unread count per feed
- Clicking a feed loads its entries into the entry list panel
- Toolbar "add" button opens a dialog/modal to add a new feed
- Toolbar "edit" button opens a dialog/modal to edit the selected feed
- Toolbar "remove" button removes the selected feed (with confirmation)

### Phase 6: Entry List Panel

Wire the center panel to display entries for the selected feed.

- Display entries for the selected feed, sorted by publication date (newest first)
- Show entry title, date, and read/unread indicator
- Clicking an entry loads its content into the content area
- Mark entries as read when selected
- Visual distinction between read and unread entries

### Phase 7: Content Viewer

Display the selected entry's content in the right panel.

- Render entry HTML content safely (sanitize to prevent XSS)
- Display entry title, author, date, and link to original article
- Handle entries with no content (show summary or link)
- Basic typography and readability styling for article content

### Phase 8: Polish & Integration Testing

Final pass for usability, edge cases, and basic testing.

- Handle error states: invalid feed URL, network failures, empty feeds
- Loading indicators for feed fetching
- Empty states (no feeds added, no entries, no entry selected)
- Manual end-to-end testing of all flows
- Fix layout and styling issues across platforms

---

## File Structure (Planned)

```
threadline/
├── docs/
│   └── plan/
│       └── plan-implementation.md
├── src/
│   ├── main/
│   │   ├── main.js              # Electron main process
│   │   ├── preload.js           # Preload script (IPC bridge)
│   │   ├── db.js                # SQLite database setup & queries
│   │   └── feed-parser.js       # RSS/Atom fetch & parse logic
│   └── renderer/
│       ├── index.html           # HTML entry point
│       ├── main.js              # Svelte mount point
│       ├── App.svelte           # Root component (layout shell)
│       ├── stores/
│       │   └── app.js           # Svelte stores (feeds, entries, selection)
│       ├── components/
│       │   ├── Toolbar.svelte       # Left toolbar with action buttons
│       │   ├── Sidebar.svelte       # Feed list sidebar
│       │   ├── EntryList.svelte     # Entry list panel
│       │   ├── ContentViewer.svelte # Entry content display
│       │   ├── AddFeedModal.svelte  # Add feed dialog
│       │   └── EditFeedModal.svelte # Edit feed dialog
│       └── styles/
│           └── global.css       # Global styles
├── package.json
├── vite.config.js
└── electron-builder.yml
```
