<script>
  import { onMount, onDestroy } from 'svelte';
  import { PaneHost } from '@marina/desktop-ui/panels';
  import ePub from 'epubjs';

  let { book, onClose } = $props();

  let loading = $state(true);
  let error = $state(null);
  let chapterLabel = $state('');

  // Reading settings (persisted globally via UI prefs so they apply to all books).
  let fontSize = $state(100);             // percent
  let readingTheme = $state('light');     // light | sepia | dark

  let toc = $state([]);                   // flattened [{label, href, depth}]

  let containerEl;
  let bookObj = null;
  let rendition = null;
  let resizeObserver = null;
  let currentCfi = null;

  // --- Sidebar panes (PaneHost) -----------------------------------------
  let paneOrder = $state(['contents']);
  let paneHeights = $state({ contents: 480 });
  let panes = $derived(
    paneOrder.map((id) => ({ id, title: 'Contents', height: paneHeights[id], render: contentsPane }))
  );
  function handlePaneResize(id, h) { paneHeights = { ...paneHeights, [id]: h }; }
  function handlePaneReorder(o) { paneOrder = o; }

  // --- Reading themes ----------------------------------------------------
  const THEME_VARS = {
    light: { color: '#1a1a1a', background: '#ffffff' },
    sepia: { color: '#5b4636', background: '#f4ecd8' },
    dark:  { color: '#cdd6f4', background: '#1e1e2e' },
  };

  function registerThemes() {
    for (const [name, vars] of Object.entries(THEME_VARS)) {
      rendition.themes.register(name, {
        body: { color: vars.color, background: vars.background, 'line-height': '1.6' },
        a: { color: 'inherit' },
      });
    }
  }
  function applyTheme() {
    if (!rendition) return;
    rendition.themes.select(readingTheme);
    // Mirror the page background to the container so letterboxing matches.
    if (containerEl) containerEl.style.background = THEME_VARS[readingTheme].background;
  }
  function applyFontSize() {
    if (rendition) rendition.themes.fontSize(`${fontSize}%`);
  }

  async function persistSettings() {
    try { await window.api?.setUIPrefs?.({ epubFontSize: fontSize, epubTheme: readingTheme }); }
    catch { /* non-critical */ }
  }

  function setFontSize(next) {
    fontSize = Math.min(220, Math.max(60, next));
    applyFontSize();
    persistSettings();
  }
  function setTheme(next) {
    readingTheme = next;
    applyTheme();
    persistSettings();
  }

  // --- Navigation + persistence -----------------------------------------
  let saveTimer = null;
  function saveProgress() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (currentCfi) window.api?.setBookState?.(book.id, { cfi: currentCfi, format: 'epub' });
    }, 500);
  }
  function nextPage() { rendition?.next(); }
  function prevPage() { rendition?.prev(); }

  function gotoHref(href) {
    rendition?.display(href);
  }

  function labelForHref(href) {
    if (!href) return '';
    const base = href.split('#')[0];
    const hit = toc.find((t) => t.href.split('#')[0] === base);
    return hit ? hit.label : '';
  }

  function onKeydown(e) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); nextPage(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prevPage(); }
  }

  onMount(async () => {
    window.addEventListener('keydown', onKeydown);

    // Load persisted reading settings.
    try {
      const prefs = await window.api?.getUIPrefs?.();
      if (prefs?.epubFontSize) fontSize = prefs.epubFontSize;
      if (prefs?.epubTheme) readingTheme = prefs.epubTheme;
    } catch { /* defaults */ }

    try {
      const data = await window.api.getBookData(book.id);
      if (!data) { error = 'Could not read the document file.'; loading = false; return; }
      // epub.js wants an ArrayBuffer; slice to the exact view the IPC handed us.
      const ab = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      bookObj = ePub(ab);

      rendition = bookObj.renderTo(containerEl, {
        width: '100%',
        height: '100%',
        flow: 'paginated',
        spread: 'auto',
        allowScriptedContent: false, // never run scripts embedded in the EPUB
      });
      registerThemes();
      applyTheme();
      applyFontSize();

      // Restore saved position (CFI) or start at the beginning.
      const st = await window.api.getBookState?.(book.id);
      try { await rendition.display(st?.cfi || undefined); }
      catch { await rendition.display(); }

      // Table of contents.
      bookObj.loaded.navigation.then((nav) => {
        const flat = [];
        const walk = (items, depth) => {
          for (const it of items || []) {
            flat.push({ label: it.label?.trim() || '(untitled)', href: it.href, depth });
            if (it.subitems?.length) walk(it.subitems, depth + 1);
          }
        };
        walk(nav.toc, 0);
        toc = flat;
        chapterLabel = labelForHref(currentCfi ? rendition.location?.start?.href : null);
      });

      rendition.on('relocated', (loc) => {
        currentCfi = loc?.start?.cfi || currentCfi;
        chapterLabel = labelForHref(loc?.start?.href);
        saveProgress();
      });

      // Page-turn from inside the content iframe (where parent keydown can't reach).
      rendition.on('keyup', onKeydown);

      // Keep the rendition sized to its container (e.g. when the sidebar resizes).
      resizeObserver = new ResizeObserver(() => {
        if (rendition && containerEl) {
          try { rendition.resize(containerEl.clientWidth, containerEl.clientHeight); } catch { /* ignore */ }
        }
      });
      resizeObserver.observe(containerEl);

      loading = false;
    } catch (err) {
      error = err?.message || 'Failed to open EPUB.';
      loading = false;
    }
  });

  onDestroy(() => {
    window.removeEventListener('keydown', onKeydown);
    clearTimeout(saveTimer);
    if (resizeObserver) { try { resizeObserver.disconnect(); } catch { /* ignore */ } }
    if (rendition) { try { rendition.destroy(); } catch { /* ignore */ } }
    if (bookObj) { try { bookObj.destroy(); } catch { /* ignore */ } }
  });
</script>

{#snippet contentsPane()}
  {#if toc.length === 0}
    <div class="pane-empty">No table of contents.</div>
  {:else}
    <ul class="toc">
      {#each toc as item, i (i)}
        <li>
          <button
            class="toc-item"
            style="padding-left: {8 + item.depth * 14}px"
            onclick={() => gotoHref(item.href)}
            title={item.label}
          >{item.label}</button>
        </li>
      {/each}
    </ul>
  {/if}
{/snippet}

<div class="reader">
  <div class="toolbar">
    <button class="tb-btn" onclick={onClose} title="Back to Library">
      <i class="fas fa-arrow-left"></i> Library
    </button>
    <div class="tb-title" title={book.title}>{chapterLabel || book.title}</div>
    <div class="tb-spacer"></div>

    <div class="group">
      <button class="tb-btn icon" onclick={() => setFontSize(fontSize - 10)} title="Smaller text"><i class="fas fa-minus"></i></button>
      <span class="ind">{fontSize}%</span>
      <button class="tb-btn icon" onclick={() => setFontSize(fontSize + 10)} title="Larger text"><i class="fas fa-plus"></i></button>
    </div>

    <select class="theme-select" value={readingTheme} onchange={(e) => setTheme(e.currentTarget.value)} aria-label="Reading theme">
      <option value="light">Light</option>
      <option value="sepia">Sepia</option>
      <option value="dark">Dark</option>
    </select>

    <div class="group">
      <button class="tb-btn icon" onclick={prevPage} title="Previous page"><i class="fas fa-chevron-left"></i></button>
      <button class="tb-btn icon" onclick={nextPage} title="Next page"><i class="fas fa-chevron-right"></i></button>
    </div>
  </div>

  <div class="body">
    <aside class="sidebar">
      <PaneHost {panes} order={paneOrder} onPaneResize={handlePaneResize} onPaneReorder={handlePaneReorder} />
    </aside>

    <div class="render-wrap">
      {#if loading}
        <div class="status"><i class="fas fa-spinner fa-spin"></i> Opening…</div>
      {:else if error}
        <div class="status error"><i class="fas fa-triangle-exclamation"></i> {error}</div>
      {/if}
      <button class="edge prev" onclick={prevPage} aria-label="Previous page"><i class="fas fa-chevron-left"></i></button>
      <div class="rendition" bind:this={containerEl} class:hidden={loading || error}></div>
      <button class="edge next" onclick={nextPage} aria-label="Next page"><i class="fas fa-chevron-right"></i></button>
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
    max-width: 35%;
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
  .tb-btn:hover { background: var(--bg-button-hover); }
  .group { display: flex; align-items: center; gap: 4px; }
  .ind { font-size: 12px; color: var(--text-secondary); min-width: 42px; text-align: center; font-variant-numeric: tabular-nums; }
  .theme-select {
    padding: 6px 10px;
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 12px;
  }

  .body { flex: 1; display: flex; min-height: 0; }

  .sidebar {
    width: 260px;
    flex-shrink: 0;
    border-right: 1px solid var(--border);
    background: var(--bg-surface);
    overflow: hidden;
  }

  .render-wrap {
    flex: 1;
    min-width: 0;
    position: relative;
    display: flex;
    align-items: stretch;
    background: #fff;
  }
  .rendition { flex: 1; min-width: 0; height: 100%; }
  .rendition.hidden { visibility: hidden; }

  .edge {
    width: 44px;
    flex-shrink: 0;
    border: none;
    background: transparent;
    color: var(--text-faint);
    cursor: pointer;
    font-size: 16px;
    transition: background 0.12s, color 0.12s;
    z-index: 1;
  }
  .edge:hover { background: rgba(0, 0, 0, 0.06); color: var(--text-secondary); }

  .status {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: var(--text-muted);
    font-size: 14px;
    background: var(--bg-base);
    z-index: 2;
  }
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
</style>
