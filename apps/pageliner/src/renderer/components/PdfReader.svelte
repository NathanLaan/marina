<script>
  import { onMount, onDestroy } from 'svelte';
  import { PaneHost } from '@marina/desktop-ui/panels';
  import { pdfjsLib, ensurePdfWorker } from '../lib/pdfjs.js';

  let { book, onClose } = $props();

  let pdfDoc = null;
  let numPages = $state(0);
  let page = $state(1);
  let loading = $state(true);
  let error = $state(null);

  // Zoom: fitWidth recomputes scale from the container width on every render;
  // a manual zoom switches to an explicit scale.
  let fitWidth = $state(true);
  let scale = $state(1);
  let effectiveScale = $state(1);

  let canvasEl;
  let containerWidth = $state(0);
  let renderTask = null;

  // Outline (table of contents), flattened with depth for the Contents pane.
  let outline = $state([]);

  // Search: scans page text, lists matching pages in the Search pane.
  let searchQuery = $state('');
  let searchResults = $state([]);
  let searching = $state(false);
  const textCache = [];

  // --- Sidebar panes (PaneHost) -----------------------------------------
  let paneOrder = $state(['contents', 'search']);
  let paneHeights = $state({ contents: 360, search: 220 });
  let panes = $derived(
    paneOrder.map((id) => ({
      id,
      title: id === 'contents' ? 'Contents' : 'Search',
      height: paneHeights[id],
      render: id === 'contents' ? contentsPane : searchPane,
    }))
  );
  function handlePaneResize(id, h) { paneHeights = { ...paneHeights, [id]: h }; }
  function handlePaneReorder(o) { paneOrder = o; }

  // --- Rendering ---------------------------------------------------------
  async function renderPage() {
    if (!pdfDoc || !canvasEl) return;
    const pg = await pdfDoc.getPage(page);

    let s = scale;
    if (fitWidth && containerWidth > 0) {
      const base = pg.getViewport({ scale: 1 });
      s = (containerWidth - 32) / base.width;
    }
    effectiveScale = s;

    const viewport = pg.getViewport({ scale: s });
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvasEl.getContext('2d');
    canvasEl.width = Math.floor(viewport.width * dpr);
    canvasEl.height = Math.floor(viewport.height * dpr);
    canvasEl.style.width = `${Math.floor(viewport.width)}px`;
    canvasEl.style.height = `${Math.floor(viewport.height)}px`;

    if (renderTask) { try { renderTask.cancel(); } catch { /* ignore */ } }
    renderTask = pg.render({
      canvasContext: ctx,
      viewport,
      transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
    });
    try { await renderTask.promise; } catch { /* cancelled by a newer render */ }
  }

  // Re-render whenever page, zoom, or available width changes.
  $effect(() => {
    // touch reactive deps so the effect re-runs on their change
    page; scale; fitWidth; containerWidth;
    if (!loading && pdfDoc) renderPage();
  });

  // --- Navigation + persistence -----------------------------------------
  let saveTimer = null;
  function saveProgress() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      window.api?.setBookState?.(book.id, { page, format: 'pdf' });
    }, 400);
  }

  function goToPage(n) {
    const next = Math.min(Math.max(1, n), numPages || 1);
    if (next === page) return;
    page = next;
    saveProgress();
  }
  function prevPage() { goToPage(page - 1); }
  function nextPage() { goToPage(page + 1); }

  function zoomIn()  { fitWidth = false; scale = Math.min(5, (fitWidth ? effectiveScale : scale) + 0.2); }
  function zoomOut() { fitWidth = false; scale = Math.max(0.2, (fitWidth ? effectiveScale : scale) - 0.2); }
  function zoomFit() { fitWidth = true; }

  // --- Outline -----------------------------------------------------------
  async function loadOutline() {
    try {
      const raw = await pdfDoc.getOutline();
      const flat = [];
      const walk = (items, depth) => {
        for (const it of items || []) {
          flat.push({ title: it.title, dest: it.dest, depth });
          if (it.items?.length) walk(it.items, depth + 1);
        }
      };
      walk(raw, 0);
      outline = flat;
    } catch {
      outline = [];
    }
  }

  async function gotoDest(dest) {
    try {
      let explicit = dest;
      if (typeof dest === 'string') explicit = await pdfDoc.getDestination(dest);
      if (!Array.isArray(explicit) || !explicit[0]) return;
      const idx = await pdfDoc.getPageIndex(explicit[0]);
      goToPage(idx + 1);
    } catch { /* unresolvable dest — ignore */ }
  }

  // --- Search ------------------------------------------------------------
  async function runSearch(e) {
    e?.preventDefault?.();
    const q = searchQuery.trim().toLowerCase();
    searchResults = [];
    if (!q || !pdfDoc) return;
    searching = true;
    try {
      for (let n = 1; n <= numPages; n++) {
        let text = textCache[n - 1];
        if (text == null) {
          const pg = await pdfDoc.getPage(n);
          const tc = await pg.getTextContent();
          text = tc.items.map((i) => i.str).join(' ').toLowerCase();
          textCache[n - 1] = text;
        }
        if (text.includes(q)) searchResults = [...searchResults, n];
      }
    } finally {
      searching = false;
    }
    if (searchResults.length) goToPage(searchResults[0]);
  }

  // --- Keyboard (page nav when not typing) -------------------------------
  function onKeydown(e) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return; // leave zoom/app shortcuts alone
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); nextPage(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prevPage(); }
    else if (e.key === 'Home') { e.preventDefault(); goToPage(1); }
    else if (e.key === 'End') { e.preventDefault(); goToPage(numPages); }
  }

  onMount(async () => {
    window.addEventListener('keydown', onKeydown);
    try {
      ensurePdfWorker();
      const data = await window.api.getBookData(book.id);
      if (!data) { error = 'Could not read the document file.'; loading = false; return; }
      pdfDoc = await pdfjsLib.getDocument({ data }).promise;
      numPages = pdfDoc.numPages;
      const st = await window.api.getBookState?.(book.id);
      page = Math.min(Math.max(1, st?.page || 1), numPages);
      await loadOutline();
      loading = false;
    } catch (err) {
      error = err?.message || 'Failed to open PDF.';
      loading = false;
    }
  });

  onDestroy(() => {
    window.removeEventListener('keydown', onKeydown);
    clearTimeout(saveTimer);
    if (renderTask) { try { renderTask.cancel(); } catch { /* ignore */ } }
    if (pdfDoc) { try { pdfDoc.destroy(); } catch { /* ignore */ } }
  });
</script>

{#snippet contentsPane()}
  {#if outline.length === 0}
    <div class="pane-empty">No table of contents.</div>
  {:else}
    <ul class="toc">
      {#each outline as item, i (i)}
        <li>
          <button
            class="toc-item"
            style="padding-left: {8 + item.depth * 14}px"
            onclick={() => gotoDest(item.dest)}
            title={item.title}
          >{item.title}</button>
        </li>
      {/each}
    </ul>
  {/if}
{/snippet}

{#snippet searchPane()}
  <div class="search">
    <form onsubmit={runSearch}>
      <input type="search" placeholder="Search in document…" bind:value={searchQuery} />
    </form>
    {#if searching}
      <div class="pane-empty">Searching…</div>
    {:else if searchQuery && searchResults.length === 0}
      <div class="pane-empty">No matches.</div>
    {:else if searchResults.length > 0}
      <div class="search-count">{searchResults.length} page{searchResults.length === 1 ? '' : 's'} match</div>
      <ul class="results">
        {#each searchResults as n (n)}
          <li>
            <button class="result-item" class:current={n === page} onclick={() => goToPage(n)}>
              Page {n}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
{/snippet}

<div class="reader">
  <div class="toolbar">
    <button class="tb-btn" onclick={onClose} title="Back to Library">
      <i class="fas fa-arrow-left"></i> Library
    </button>
    <div class="tb-title" title={book.title}>{book.title}</div>
    <div class="tb-spacer"></div>

    <div class="pager">
      <button class="tb-btn icon" onclick={prevPage} disabled={page <= 1} title="Previous page"><i class="fas fa-chevron-left"></i></button>
      <span class="page-ind">{page} / {numPages || '–'}</span>
      <button class="tb-btn icon" onclick={nextPage} disabled={page >= numPages} title="Next page"><i class="fas fa-chevron-right"></i></button>
    </div>

    <div class="zoom">
      <button class="tb-btn icon" onclick={zoomOut} title="Zoom out"><i class="fas fa-minus"></i></button>
      <button class="tb-btn" onclick={zoomFit} class:active={fitWidth} title="Fit width">{Math.round(effectiveScale * 100)}%</button>
      <button class="tb-btn icon" onclick={zoomIn} title="Zoom in"><i class="fas fa-plus"></i></button>
    </div>
  </div>

  <div class="body">
    <aside class="sidebar">
      <PaneHost {panes} order={paneOrder} onPaneResize={handlePaneResize} onPaneReorder={handlePaneReorder} />
    </aside>

    <div class="canvas-scroll" bind:clientWidth={containerWidth}>
      {#if loading}
        <div class="status"><i class="fas fa-spinner fa-spin"></i> Opening…</div>
      {:else if error}
        <div class="status error"><i class="fas fa-triangle-exclamation"></i> {error}</div>
      {/if}
      <canvas bind:this={canvasEl} class:hidden={loading || error}></canvas>
    </div>
  </div>
</div>

<style>
  .reader { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .tb-spacer { flex: 1; }
  .tb-title {
    font-size: 13px;
    color: var(--text-secondary);
    max-width: 40%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tb-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: var(--bg-button);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-primary);
    cursor: pointer;
    font-size: 12px;
  }
  .tb-btn.icon { padding: 6px 9px; }
  .tb-btn:hover:not(:disabled) { background: var(--bg-button-hover); }
  .tb-btn:disabled { opacity: 0.4; cursor: default; }
  .tb-btn.active { background: var(--bg-selected); outline: 1px solid var(--accent); color: var(--accent); }
  .pager, .zoom { display: flex; align-items: center; gap: 4px; }
  .page-ind { font-size: 12px; color: var(--text-secondary); min-width: 64px; text-align: center; font-variant-numeric: tabular-nums; }

  .body { flex: 1; display: flex; min-height: 0; }

  .sidebar {
    width: 260px;
    flex-shrink: 0;
    border-right: 1px solid var(--border);
    background: var(--bg-surface);
    overflow: hidden;
  }

  .canvas-scroll {
    flex: 1;
    min-width: 0;
    overflow: auto;
    background: var(--bg-base);
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 16px;
  }
  canvas { box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35); background: #fff; }
  canvas.hidden { display: none; }

  .status { color: var(--text-muted); padding: 40px; font-size: 14px; }
  .status.error { color: #e0484d; }

  .pane-empty { padding: 12px; color: var(--text-muted); font-size: 12px; }

  .toc { list-style: none; padding: 6px 0; margin: 0; }
  .toc-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 5px 10px;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 12px;
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .toc-item:hover { background: var(--bg-item-hover); color: var(--text-primary); }

  .search { padding: 10px; }
  .search input {
    width: 100%;
    padding: 7px 10px;
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 13px;
    box-sizing: border-box;
  }
  .search input:focus { border-color: var(--input-border-focus); outline: none; }
  .search-count { font-size: 11px; color: var(--text-muted); margin: 10px 2px 4px; }
  .results { list-style: none; padding: 0; margin: 0; }
  .result-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 5px 10px;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 12px;
    cursor: pointer;
    border-radius: 4px;
  }
  .result-item:hover { background: var(--bg-item-hover); color: var(--text-primary); }
  .result-item.current { color: var(--accent); }
</style>
