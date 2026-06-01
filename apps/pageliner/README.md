# PageLiner

PageLiner is a desktop **e-reader and document library** built with Electron and Svelte 5, on top of the shared `@marina/desktop-ui` framework. It manages a library of EPUB and PDF documents and provides a reading experience with table-of-contents navigation, reading-position persistence, and annotations.

PageLiner is **early/scaffold-stage** software. See `docs/plans/ereader-report.md` (repo root) for the full design and phased plan.

## Status

**Phase 5 — Git sync (current).** All planned phases are implemented; the core e-reader is feature-complete.

Done:

- **Phase 0 — Shell:** marina chrome (custom titlebar, themes + zoom, command palette, tabbed settings).
  - **App chrome (NoteLiner-parity):** optional custom titlebar (hamburger toggles the sidebar), a left **library sidebar** (All / EPUB / PDF filters with counts, `Ctrl+E`), and a bottom **status bar** (book count / current title + reading position + scale, `Ctrl+J`). Settings → UI offers **Theme**, **UI Scale**, and **Custom Window Titlebar**; sidebar/status-bar visibility persist via UI prefs.
- **Phase 1 — Library:** import EPUB/PDF, cover grid with EPUB cover/metadata extraction, sort, delete, `pageliner.json` storage model.
- **Phase 2 — PDF reader:** `pdf.js` rendering with page navigation (buttons + arrow/Page keys), zoom + fit-width, a `PaneHost` sidebar with **Contents** (PDF outline) and **Search** (in-document page search) panes, and persisted page position.
- **Phase 3 — EPUB reader:** `epub.js` paginated rendition, prev/next + arrow-key page turns, **reading settings** (font size, Light/Sepia/Dark theme — persisted globally), a `PaneHost` **Contents** (TOC) pane, and **CFI position persistence**. EPUB content renders in a sandboxed iframe with embedded scripts disabled.
- **Phase 4 — Annotations:** **bookmarks** for both formats (PDF page / EPUB CFI) and **highlights** for both — EPUB via epub.js CFI ranges, PDF via a pdf.js **text layer** (which also enables text selection/copy) with selection rectangles stored in zoom-independent page units. Surfaced in a shared **Annotations** pane (jump + delete) in each reader's `PaneHost` sidebar. Annotations persist in `state/<id>.json` and reapply on reopen. Resume-on-open ships from Phases 2–3.

- **Phase 5 — Git sync (opt-in):** versions the library index (`pageliner.json`) and `state/` (reading positions, bookmarks, highlights) through a Git remote; **book blobs and covers stay local** (`books/`, `covers/` are git-ignored). Enable it in the **Git Sync** dialog (`Ctrl+Shift+S`, or the sidebar footer): initialises the repo, lets you set a remote, and offers **Sync Now** (commit → rebase-pull → push) with ahead/behind status. Library changes auto-commit + push on an 8 s debounce. Mirrors the ThreadLiner model; uses the system `git` (no extra dependency).

## Planned storage model

```
<library folder>/
├── pageliner.json     # index: [{ id, title, author, format, file, cover, tags, addedAt }]
├── books/<id>.<epub|pdf>
├── covers/<id>.<png|jpg>
└── state/<id>.json    # { position, bookmarks[], highlights[], lastOpenedAt }
```

Git-sync is **optional** (ThreadLiner model): the index and `state/` sync cleanly; large book blobs are kept local by default to avoid repo bloat.

## Development

```bash
# From the monorepo root:
npm install
npm run electron:pageliner     # Vite dev server on 5253 + Electron with HMR
```

Or from this directory: `npm run electron:dev`.

## Building

```bash
npm run build:linux   # or build:win / build:mac
```

Renders via Vite; the preload is bundled with esbuild into `dist/preload.cjs`; packaged with electron-builder.

## Technology

Electron · Svelte 5 (runes) · Vite · `@marina/desktop-ui` (titlebar, theming, command palette, settings, PaneHost) · planned: `pdfjs-dist`, `epubjs`.
