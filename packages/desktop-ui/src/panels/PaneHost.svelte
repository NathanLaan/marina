<script>
  // Vertical stack of resizable, reorderable panes. The library owns the
  // layout chrome (header bar, drag-to-reorder, drag-the-divider resize,
  // ResizeObserver-based clamping); consumers provide pane content via
  // snippets.
  //
  // `panes` is the source of truth for which panes are visible — omit a
  // pane from the array to hide it. `order` is the canonical ordering of
  // pane IDs, bindable so the host can update it on drag-to-reorder.
  //
  // Each pane is `{ id, title, height, minHeight?, render, headerExtra?, closable? }`:
  //   - id           string, stable across renders
  //   - title        string, shown in the header (uppercased small-caps)
  //   - height       number, pixels; the host calls onPaneResize when the
  //                  user drags a divider
  //   - minHeight    number, optional, default 44 (matches the header height)
  //   - render       Svelte snippet, rendered into the pane body
  //   - headerExtra  Svelte snippet, optional, rendered after the title
  //                  before the close X (for per-pane action buttons)
  //   - closable     bool, optional, default true; hides the close X when false
  let {
    panes = [],
    order = [],
    onPaneResize,
    onPaneReorder,
    onClosePane,
  } = $props();

  const HEADER_H = 44;
  const RESIZER_H = 4;
  const DEFAULT_MIN_H = HEADER_H;

  let hostEl;

  // Visible panes in canonical order. `order` defines the sequence; `panes`
  // controls which are actually shown. A pane in `order` but missing from
  // `panes` is skipped; a pane in `panes` but missing from `order` falls
  // through to the end (defensive — caller should keep order in sync).
  const visiblePanes = $derived.by(() => {
    const byId = new Map(panes.map((p) => [p.id, p]));
    const seen = new Set();
    const out = [];
    for (const id of order) {
      const p = byId.get(id);
      if (p) { out.push(p); seen.add(id); }
    }
    for (const p of panes) {
      if (!seen.has(p.id)) out.push(p);
    }
    return out;
  });

  function minHeight(pane) {
    return pane.minHeight ?? DEFAULT_MIN_H;
  }

  // Clamp pane heights whenever the available space or pane set changes so
  // the total doesn't exceed the host height (e.g., after window resize).
  function clampHeights() {
    if (!hostEl || !onPaneResize) return;
    const totalH = hostEl.clientHeight;
    if (totalH <= 0) return;
    const resizerCount = Math.max(0, visiblePanes.length - 1);
    const budget = totalH - resizerCount * RESIZER_H;
    let sum = 0;
    for (const p of visiblePanes) sum += p.height;
    if (sum > budget && sum > 0) {
      const scale = budget / sum;
      for (const p of visiblePanes) {
        const scaled = Math.max(minHeight(p), Math.floor(p.height * scale));
        onPaneResize(p.id, scaled);
      }
    }
  }

  $effect(() => {
    // Track visible pane set + sizes — when either changes, re-clamp.
    visiblePanes;
    clampHeights();
  });

  $effect(() => {
    if (!hostEl) return;
    const ro = new ResizeObserver(() => clampHeights());
    ro.observe(hostEl);
    return () => ro.disconnect();
  });

  // Pane resize. Drag-the-divider between `above` and `below` panes.
  // Symmetric: both stored heights update so the user can shrink either side
  // down to its minHeight. When `below` is the last (flex-grow) pane, its
  // rendered height can exceed its stored height (flex absorbs leftover); we
  // seed the drag with the rendered height so the divider tracks the cursor.
  function startResize(above, below, isBelowLast) {
    return (e) => {
      e.preventDefault();
      const startY = e.clientY;
      const startAbove = above.height;
      // Mouse coords are viewport pixels but panes sit inside the consumer's
      // zoomed layout (zoom: var(--ui-zoom)). Divide delta by zoom so pane
      // height tracks the cursor at any UI scale.
      const zoom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;

      let startBelow = below.height;
      if (isBelowLast && hostEl) {
        const totalH = hostEl.clientHeight;
        const resizerCount = Math.max(0, visiblePanes.length - 1);
        let othersStored = resizerCount * RESIZER_H;
        for (const p of visiblePanes) {
          if (p.id !== below.id) othersStored += p.height;
        }
        const flexLeftover = Math.max(0, totalH - othersStored - below.height);
        startBelow = below.height + flexLeftover;
      }

      const combined = startAbove + startBelow;
      const minA = minHeight(above);
      const minB = minHeight(below);

      const onMouseMove = (ev) => {
        const deltaY = (ev.clientY - startY) / zoom;
        let newAbove = startAbove + deltaY;
        let newBelow = startBelow - deltaY;
        if (newAbove < minA) { newAbove = minA; newBelow = combined - newAbove; }
        else if (newBelow < minB) { newBelow = minB; newAbove = combined - newBelow; }
        onPaneResize?.(above.id, newAbove);
        onPaneResize?.(below.id, newBelow);
      };
      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };
  }

  // Drag-to-reorder via HTML5 drag-and-drop. The data transfer carries a
  // namespaced MIME so a pane-header drag doesn't cross-fire with other
  // drag sources in the consumer (e.g. file drops on the same parent).
  const PANE_MIME = 'application/x-marina-pane';
  let draggingPane = $state(null);
  let dragOverPane = $state(null);
  let dragOverPosition = $state(null);

  function handleHeaderDragStart(e, paneId) {
    e.dataTransfer.setData(PANE_MIME, paneId);
    e.dataTransfer.effectAllowed = 'move';
    draggingPane = paneId;
  }

  function handleHeaderDragEnd() {
    draggingPane = null;
    dragOverPane = null;
    dragOverPosition = null;
  }

  function handleHeaderDragOver(e, paneId) {
    if (!e.dataTransfer.types.includes(PANE_MIME)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    dragOverPosition = y < rect.height / 2 ? 'before' : 'after';
    dragOverPane = paneId;
  }

  function handleHeaderDragLeave() {
    dragOverPane = null;
  }

  function handleHeaderDrop(e, targetId) {
    if (!e.dataTransfer.types.includes(PANE_MIME)) return;
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData(PANE_MIME);
    const position = dragOverPosition;
    dragOverPane = null;
    dragOverPosition = null;
    draggingPane = null;
    if (!draggedId || draggedId === targetId) return;

    const newOrder = order.filter((id) => id !== draggedId);
    const targetIndex = newOrder.indexOf(targetId);
    if (targetIndex === -1) return;
    const insertAt = position === 'before' ? targetIndex : targetIndex + 1;
    newOrder.splice(insertAt, 0, draggedId);
    onPaneReorder?.(newOrder);
  }
</script>

<div class="pane-host" bind:this={hostEl}>
  {#each visiblePanes as pane, i (pane.id)}
    {@const isLast = i === visiblePanes.length - 1}
    {#if i > 0}
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <div
        class="pane-resizer"
        role="separator"
        aria-orientation="horizontal"
        tabindex="-1"
        onmousedown={startResize(visiblePanes[i - 1], pane, isLast)}
      ></div>
    {/if}
    <div
      class="resizable-pane"
      class:flex-pane={isLast}
      style="height: {pane.height}px"
    >
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="pane-header"
        class:dragging={draggingPane === pane.id}
        class:drag-over-before={dragOverPane === pane.id && dragOverPosition === 'before'}
        class:drag-over-after={dragOverPane === pane.id && dragOverPosition === 'after'}
        draggable="true"
        ondragstart={(e) => handleHeaderDragStart(e, pane.id)}
        ondragend={handleHeaderDragEnd}
        ondragover={(e) => handleHeaderDragOver(e, pane.id)}
        ondragleave={handleHeaderDragLeave}
        ondrop={(e) => handleHeaderDrop(e, pane.id)}
      >
        <span class="pane-title">{pane.title}</span>
        <div class="pane-header-actions" draggable="false" ondragstart={(e) => e.preventDefault()}>
          {#if pane.headerExtra}{@render pane.headerExtra(pane)}{/if}
          {#if pane.closable !== false}
            <button class="pane-header-btn" onclick={() => onClosePane?.(pane.id)} title="Close pane" aria-label="Close pane">
              <i class="fas fa-xmark"></i>
            </button>
          {/if}
        </div>
      </div>

      <div class="pane-body">
        {@render pane.render()}
      </div>
    </div>
  {/each}
</div>

<style>
  .pane-host {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .resizable-pane {
    flex-shrink: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 44px;
  }

  /* Last visible pane auto-grows to fill leftover space when the sum of
     pane heights is less than the host. If user-assigned heights already
     fill the host, the explicit height wins and flex-grow is inactive. */
  .resizable-pane.flex-pane {
    flex-grow: 1;
  }

  .pane-body {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .pane-resizer {
    height: 4px;
    cursor: row-resize;
    background: var(--border);
    flex-shrink: 0;
  }

  .pane-resizer:hover {
    background: var(--border-hover);
  }
</style>
