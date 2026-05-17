# Threadline Sync Implementation Plan

## Overview

Replace the SQLite backend with a JSON file-based data layer stored in a user-specified local directory that doubles as a Git repository. Changes are committed locally on every data mutation and pushed to a remote GitHub repository on a configurable debounce timer. This enables cross-device sync via Git.

---

## Specification Review & Issues Identified

### 1. Incomplete Specification: "Mark all" with Entry Selected

The spec states:

> "If the user has a feed selected, and a feed item within the feed selected, then..."

This sentence is **cut off**. The plan assumes the intended behavior is:

- **Feed selected, no entry selected** → Mark **all entries in the feed** as read/unread
- **Feed selected, entry selected** → Mark only the **selected entry** as read/unread

If the intent was something else (e.g., mark all entries from the selected entry downward), this needs clarification before implementation.

### 2. SQLite Removal — Entry Content Storage

The current SQLite database stores full entry content (article HTML). Storing all entry content in JSON files committed to Git will cause the repository to grow quickly (a single feed refresh can add megabytes of HTML). Two options:

- **Option A (Recommended):** Store entry content in per-feed JSON files within `data/feeds/<feed-id>/entries.json`. Content is included but Git will diff efficiently since each feed is its own file.
- **Option B:** Store content separately from metadata. Complicates the file structure.

This plan uses **Option A** — per-feed files keep diffs small and merge conflicts isolated.

### 3. ID Generation Without SQLite Autoincrement

SQLite provided auto-incrementing integer IDs. With JSON files, we need a new ID strategy. This plan uses **UUIDs** (`crypto.randomUUID()`) for feed and entry identification. Feed URLs remain the natural deduplication key. Entry GUIDs (from the RSS feed itself) remain the deduplication key within a feed.

### 4. Git Conflict Resolution

Since this is a single-user system, conflicts should be rare (only possible if the user runs two instances simultaneously). The plan uses a **"pull --rebase then push"** strategy. If a rebase fails, the push is skipped and the user is notified via the Sync modal.

### 5. Git CLI vs. Library

SSH support in JavaScript Git libraries (e.g., `isomorphic-git`) is limited and unreliable. This plan **shells out to the system `git` CLI**, which uses the user's existing SSH agent/keys natively. Git must be installed on the system.

### 6. First-Run / Onboarding

On first launch (or when no data directory is configured), a **Setup dialog** must appear before the main UI. The user provides:
1. A local folder path for data storage
2. A Git remote URL (SSH format, e.g. `git@github.com:user/repo.git`)

The app will clone the repo (or init a new one) into the specified folder.

### 7. Settings Migration

Settings (theme, sync wait time) move from SQLite to `configuration/settings.json` in the Git repo. This means settings also sync across devices.

### 8. Atomic File Writes

JSON file writes must be atomic (write to a temp file, then rename) to prevent data corruption from crashes or power loss during writes.

### 9. Sync Wait Timer Behavior

The timer is a **debounce**, not a queue. Each new data mutation resets the timer. When the timer fires, a single `git push` sends all accumulated commits. This batches rapid actions (e.g., marking many entries read) into fewer pushes.

---

## Data Directory Structure

```
<user-specified-folder>/          # Git repository root
├── .git/                         # Git internals
├── configuration/
│   └── settings.json             # App settings (theme, sync wait time, etc.)
└── data/
    ├── feeds.json                # Feed index (id, title, url, siteUrl, description, timestamps)
    └── feeds/
        └── <feed-uuid>/
            └── entries.json      # All entries for this feed (metadata + content + read status)
```

### `configuration/settings.json`

```json
{
  "theme": "midnight",
  "syncWaitTime": 10
}
```

### `data/feeds.json`

```json
{
  "feeds": [
    {
      "id": "a1b2c3d4-...",
      "title": "Example Blog",
      "url": "https://example.com/feed.xml",
      "siteUrl": "https://example.com",
      "description": "An example blog",
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

### `data/feeds/<feed-uuid>/entries.json`

```json
{
  "feedId": "a1b2c3d4-...",
  "entries": [
    {
      "id": "e5f6g7h8-...",
      "guid": "https://example.com/post-1",
      "title": "Post Title",
      "link": "https://example.com/post-1",
      "content": "<p>Article HTML...</p>",
      "author": "Author Name",
      "publishedAt": "2025-01-15T08:00:00.000Z",
      "isRead": false,
      "createdAt": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

---

## Architecture

### Main Process Modules

```
src/main/
├── main.js                  # Electron app, window, IPC handlers (updated)
├── preload.js               # Context bridge API (updated)
├── feed-parser.js           # RSS/Atom/JSON Feed parser (unchanged)
├── data-store.js            # NEW: JSON file read/write layer (replaces db.js)
├── git-sync.js              # NEW: Git operations (clone, commit, pull, push, status)
└── sync-manager.js          # NEW: Debounced sync timer, commit-then-push orchestration
```

### Renderer Modules

```
src/renderer/
├── stores/
│   ├── app.js               # Updated: new mark-all actions
│   ├── theme.js             # Updated: reads from data-store instead of SQLite
│   └── sync.js              # NEW: sync status store
├── components/
│   ├── Toolbar.svelte        # Updated: mark-all buttons, sync button
│   ├── SetupDialog.svelte    # NEW: first-run configuration
│   ├── SyncModal.svelte      # NEW: sync status/controls
│   └── SettingsModal.svelte  # Updated: sync wait time tab/setting
│   └── ...existing components
```

---

## Major Implementation Phases

### Phase 1: JSON Data Store (`data-store.js`)

Replace `db.js` with a file-based JSON data layer.

**Tasks:**
1. Create `data-store.js` with functions mirroring `db.js` API:
   - `init(dataDir)` — ensure directory structure exists, load JSON files into memory
   - `getAllFeeds()` — read `feeds.json`, compute unread counts from per-feed entry files
   - `getFeedById(id)` — lookup from in-memory feeds list
   - `addFeed(title, url, siteUrl, description)` — generate UUID, append to `feeds.json`, create feed directory
   - `editFeed(id, data)` — update in-memory and write `feeds.json`
   - `removeFeed(id)` — remove from `feeds.json`, delete feed directory
   - `getEntriesByFeed(feedId)` — read `data/feeds/<id>/entries.json`
   - `insertEntries(feedId, entries)` — merge new entries (deduplicate by guid), write entries file
   - `markEntryRead(entryId, feedId)` — update `isRead` in entries file
   - `markAllRead(feedId)` — set all entries `isRead = true` in entries file
   - `markAllUnread(feedId)` — set all entries `isRead = false` in entries file
   - `markEntryUnread(entryId, feedId)` — update `isRead` in entries file
   - `getSetting(key)` — read from `configuration/settings.json`
   - `setSetting(key, value)` — update `configuration/settings.json`
   - `getDataDir()` — return current data directory path
2. Implement atomic file writes (write to `.tmp`, rename)
3. Keep an in-memory cache of `feeds.json` for fast reads; invalidate on writes
4. Note: `markEntryRead`/`markEntryUnread` now require `feedId` to locate the correct entries file — IPC signatures change

### Phase 2: Git Sync Module (`git-sync.js`)

Implement Git operations by shelling out to the `git` CLI.

**Tasks:**
1. Create `git-sync.js` with functions:
   - `isGitInstalled()` — check `git --version`
   - `cloneRepo(remoteUrl, localDir)` — `git clone <url> <dir>`
   - `initRepo(localDir)` — `git init` + `git remote add origin <url>` (for new repos)
   - `commitAll(dataDir, message)` — `git add -A && git commit -m <message>`
   - `pull(dataDir)` — `git pull --rebase origin main`
   - `push(dataDir)` — `git push origin main`
   - `getStatus(dataDir)` — `git status --porcelain` (check for uncommitted changes)
   - `getRemoteUrl(dataDir)` — `git remote get-url origin`
   - `getLastSyncTime(dataDir)` — timestamp of last successful push
2. All git commands run with `cwd` set to the data directory
3. Capture stdout/stderr for error reporting
4. Handle SSH auth failures with clear error messages

### Phase 3: Sync Manager (`sync-manager.js`)

Orchestrate the debounced commit-and-push cycle.

**Tasks:**
1. Create `sync-manager.js` with:
   - `init(dataDir, waitTimeSeconds)` — store config, load wait time from settings
   - `notifyChange(commitMessage)` — commit changes immediately, then start/reset the push debounce timer
   - `forcePush()` — cancel timer, push immediately
   - `forcePull()` — pull remote changes, reload data
   - `getSyncStatus()` — return current state: idle, waiting, pushing, pulling, error
   - `getLastSyncTime()` — timestamp of the last successful push
   - `updateWaitTime(seconds)` — update the debounce interval
   - `destroy()` — cancel timers, clean up
2. Sync flow on `notifyChange()`:
   ```
   1. git add -A && git commit -m "<message>"
   2. Reset debounce timer to syncWaitTime seconds
   3. When timer fires:
      a. git pull --rebase origin main
      b. If pull succeeds: git push origin main
      c. If pull fails (conflict): set status = error, notify user
      d. Update lastSyncTime on success
   ```
3. Expose sync status to renderer via IPC for the Sync modal

### Phase 4: Setup Dialog & First-Run Flow

Create the onboarding experience for new users or unconfigured installs.

**Tasks:**
1. Create `SetupDialog.svelte` component:
   - Step 1: Choose data folder (use Electron's `dialog.showOpenDialog` for folder picker)
   - Step 2: Enter Git remote URL (or skip for local-only mode)
   - Step 3: Clone repo / initialize new repo
   - Progress indicator during clone
   - Error handling (invalid path, clone failure, SSH auth failure)
2. Add `dialog:openFolder` IPC handler for native folder picker
3. Store the data directory path in Electron's `app.getPath('userData')/config.json` (this small local file is NOT in the Git repo — it just tells the app where the Git repo lives)
4. On app startup in `main.js`:
   - Read local `config.json` for data directory path
   - If not set → show setup dialog
   - If set → init data store, init sync manager, proceed to main UI
5. Add preload API: `api.openFolderDialog()`, `api.setupSync(dataDir, remoteUrl)`, `api.isSetupComplete()`

### Phase 5: Update IPC Handlers & Preload API

Rewire all IPC handlers from `db.js` to `data-store.js` and add new handlers.

**Tasks:**
1. Update `main.js` IPC handlers to call `data-store` instead of `db`:
   - `feed:getAll` → `dataStore.getAllFeeds()`
   - `feed:add` → `dataStore.addFeed(...)` + `syncManager.notifyChange('Add feed: <title>')`
   - `feed:edit` → `dataStore.editFeed(...)` + `syncManager.notifyChange('Edit feed: <title>')`
   - `feed:remove` → `dataStore.removeFeed(...)` + `syncManager.notifyChange('Remove feed: <title>')`
   - `feed:refresh` → `dataStore.insertEntries(...)` + `syncManager.notifyChange('Refresh feed: <title>')`
   - `entry:getByFeed` → `dataStore.getEntriesByFeed(feedId)`
   - `entry:markRead` → `dataStore.markEntryRead(entryId, feedId)` + `syncManager.notifyChange('Mark entry read')`
   - `settings:get` → `dataStore.getSetting(key)`
   - `settings:set` → `dataStore.setSetting(key, value)` + `syncManager.notifyChange('Update setting: <key>')`
2. Add new IPC handlers:
   - `entry:markUnread` → `dataStore.markEntryUnread(entryId, feedId)` + sync notify
   - `entry:markAllRead` → `dataStore.markAllRead(feedId)` + sync notify
   - `entry:markAllUnread` → `dataStore.markAllUnread(feedId)` + sync notify
   - `sync:getStatus` → `syncManager.getSyncStatus()`
   - `sync:forcePush` → `syncManager.forcePush()`
   - `sync:forcePull` → `syncManager.forcePull()`
   - `setup:isComplete` → check if data dir is configured
   - `setup:openFolderDialog` → open native folder picker
   - `setup:init` → clone/init repo, save config, init data store + sync manager
3. Update `preload.js` with new API methods:
   - `api.markUnread(entryId, feedId)`
   - `api.markAllRead(feedId)`
   - `api.markAllUnread(feedId)`
   - `api.markRead(entryId, feedId)` — **signature change**: now requires `feedId`
   - `api.getSyncStatus()`
   - `api.forcePush()`
   - `api.forcePull()`
   - `api.isSetupComplete()`
   - `api.openFolderDialog()`
   - `api.setupInit(dataDir, remoteUrl)`

### Phase 6: Toolbar Updates (Mark All Read/Unread + Sync Button)

Add three new buttons to the toolbar.

**Tasks:**
1. Add "Mark All Read" button (checkmark icon, `fa-check-double`):
   - Enabled when a feed is selected
   - If entry selected: marks only the selected entry as read
   - If no entry selected: marks all entries in the feed as read
2. Add "Mark All Unread" button (undo/circle icon, `fa-rotate-left`):
   - Same selection logic as above, but marks as unread
3. Add "Sync" button (cloud icon, `fa-cloud`):
   - Always enabled (once setup is complete)
   - Opens the Sync modal
   - Visual indicator when sync is in progress or has an error
4. Update `Toolbar.svelte` to dispatch new events: `markAllRead`, `markAllUnread`, `openSync`
5. Update `stores/app.js` with new actions:
   - `markAllRead(feedId)` / `markAllUnread(feedId)`
   - `markEntryUnread(entryId, feedId)`
   - Update `selectEntry()` to pass `feedId` to `markRead`

### Phase 7: Sync Modal (`SyncModal.svelte`)

Create the Sync status and control dialog.

**Tasks:**
1. Create `SyncModal.svelte`:
   - Display current sync status (idle, waiting to push, pushing, pulling, error)
   - Show last successful sync timestamp
   - Show the configured remote URL
   - Show the local data directory path
   - "Sync Now" button — triggers `forcePush()` (pull + push)
   - "Pull Now" button — triggers `forcePull()`
   - Display countdown timer if push is pending
   - Error details if last sync failed
2. Create `stores/sync.js`:
   - `syncStatus` writable store
   - `lastSyncTime` writable store
   - `pollSyncStatus()` — periodically fetch status from main process
   - `forcePush()` / `forcePull()` actions

### Phase 8: Settings Modal — Sync Wait Time

Add the Sync tab to the existing settings modal.

**Tasks:**
1. Add "Sync" tab to `SettingsModal.svelte`
2. Add "Sync Wait Time" dropdown with options: 5s, 10s, 30s, 60s
3. On change, call `setSetting('syncWaitTime', value)` and notify sync manager to update its interval
4. Load current value on modal open

### Phase 9: Remove SQLite Dependency

Remove `better-sqlite3` and `db.js` once all functionality is migrated.

**Tasks:**
1. Remove `db.js`
2. Remove `better-sqlite3` from `package.json`
3. Remove the `@electron/rebuild` step from the dev setup (no more native modules)
4. Update `README.md` — remove C/C++ toolchain prerequisite, add Git as a prerequisite
5. Update `.gitignore` — remove `*.db*` entries, ensure `config.json` pattern doesn't conflict

### Phase 10: Data Migration (Existing Users)

Provide a one-time migration from SQLite to JSON for anyone who has been using the app.

**Tasks:**
1. On startup, if SQLite database exists at old path AND data dir is not yet configured:
   - Show migration prompt
   - Read all feeds/entries/settings from SQLite
   - Write to JSON files in the new data directory
   - Mark migration complete
2. This is a nice-to-have for development — can be deferred since the app is pre-release

---

## IPC API Changes Summary

### Modified Signatures

| Before | After |
| --- | --- |
| `api.markRead(entryId)` | `api.markRead(entryId, feedId)` |

### New Methods

| Method | Description |
| --- | --- |
| `api.markUnread(entryId, feedId)` | Mark single entry unread |
| `api.markAllRead(feedId)` | Mark all entries in feed read |
| `api.markAllUnread(feedId)` | Mark all entries in feed unread |
| `api.getSyncStatus()` | Get sync state + last sync time |
| `api.forcePush()` | Trigger immediate push |
| `api.forcePull()` | Trigger immediate pull |
| `api.isSetupComplete()` | Check if data dir is configured |
| `api.openFolderDialog()` | Open native folder picker |
| `api.setupInit(dataDir, remoteUrl)` | Clone/init repo, configure app |

### Removed

| Method | Reason |
| --- | --- |
| (none removed) | All existing methods are preserved with same or updated signatures |

---

## Risk Assessment

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Git not installed on user's system | App cannot sync | Check on startup, show clear error with install instructions |
| SSH keys not configured | Clone/push fails | Surface the git error message clearly in the Sync modal |
| Large repos from feed content | Slow clone/push | Per-feed files keep diffs small; consider pruning old entries in a future version |
| Race condition: two instances editing same files | Data loss | Single-user assumption; file-level locking could be added later |
| JSON corruption from crash during write | Data loss | Atomic writes (tmp + rename) prevent partial writes |
| Rebase conflicts on pull | Push blocked | Notify user via Sync modal with error details; provide manual resolution guidance |

---

## Implementation Order & Dependencies

```
Phase 1  (JSON Data Store)      ← foundational, everything depends on this
  │
  ├── Phase 2  (Git Sync)       ← can be built in parallel with Phase 1
  │     │
  │     └── Phase 3  (Sync Manager)  ← depends on Phase 2
  │           │
  │           ├── Phase 7  (Sync Modal)       ← depends on Phase 3
  │           └── Phase 8  (Settings: Wait Time)  ← depends on Phase 3
  │
  ├── Phase 4  (Setup Dialog)    ← depends on Phase 1 + 2
  │
  ├── Phase 5  (IPC Rewiring)    ← depends on Phase 1 + 3
  │
  └── Phase 6  (Toolbar: Mark All + Sync Button)  ← depends on Phase 5
        │
        └── Phase 9  (Remove SQLite)  ← after all phases complete
              │
              └── Phase 10 (Migration)  ← optional, after Phase 9
```

Suggested serial order: **1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10**
