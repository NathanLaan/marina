# PageLiner

PageLiner is a desktop **e-reader and document library** built with Electron and Svelte 5, on top of the shared `@marina/desktop-ui` framework. It manages a library of EPUB and PDF documents and provides a reading experience with table-of-contents navigation, reading-position persistence, and annotations.

PageLiner is **early/scaffold-stage** software. See `docs/plans/ereader-report.md` (repo root) for the full design and phased plan.

## Status

**Phase 0 — Shell (current).** A runnable app reusing the full marina chrome: custom titlebar, themes + zoom, command palette, tabbed settings, and a resizable/reorderable sidebar (`PaneHost`) with placeholder Library / Collections panes. No reading or import functionality yet.

Roadmap (from the design report):

- **Phase 1 — Library:** import documents, cover grid, metadata, tags/collections, full-library search.
- **Phase 2 — PDF reader:** `pdf.js` integration, page nav, TOC, in-book search.
- **Phase 3 — EPUB reader:** `epub.js` integration, pagination, reading settings, CFI position persistence, TOC.
- **Phase 4 — Annotations & polish:** bookmarks, highlights, resume-on-open.
- **Phase 5 (optional) — Sync:** opt-in git sync of the library index + reading state, mirroring ThreadLiner. Book blobs stay local by default.

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
