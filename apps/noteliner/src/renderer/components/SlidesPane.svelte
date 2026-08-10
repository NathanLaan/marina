<script>
  // SLIDES pane: the deck's structure, and where slides are managed.
  //
  // Rows track the caret the way OutlinePane tracks the active heading, and
  // clicking one scrolls the editor to that slide. Every mutation goes through
  // lib/slideEdits.js (pure, unit-tested) and is applied by
  // projectState.applySlideEdit, so this component holds no rewriting logic.

  import Slide from './Slide.svelte';
  import ContextMenu from './ContextMenu.svelte';
  import { projectState } from '../stores/project.svelte.js';
  import { slideAtLine } from '../lib/slides.js';
  import {
    insertSlide, duplicateSlide, deleteSlide, moveSlide, reorderSlide,
    mergeIntoPrevious, retitleSlide, setSlideLayout,
  } from '../lib/slideEdits.js';

  let { onOpenSettings = () => {} } = $props();

  const deck = $derived(projectState.deck);
  const total = $derived(deck?.slides.length ?? 0);
  const activeIndex = $derived(deck ? slideAtLine(deck, projectState.cursorLine)?.index ?? null : null);

  let contextMenu = $state(null);
  let editingIndex = $state(null);
  let editingTitle = $state('');
  let dragIndex = $state(null);
  let dropIndex = $state(null);

  // Thumbnails are the same Slide component the preview and (later) the
  // presenter window use, just at a small scale. Kept narrow so the title and
  // layout label still have room in a default-width sidebar.
  const THUMB_WIDTH = 104;
  const thumbScale = $derived(deck ? THUMB_WIDTH / deck.stage.w : 0);

  async function apply(edit) {
    await projectState.applySlideEdit(edit);
  }

  function jumpTo(slide) {
    projectState.scrollToLine = { line: slide.sourceRange.fromLine, ts: Date.now() };
  }

  function startRename(slide) {
    editingIndex = slide.index;
    editingTitle = slide.title ?? '';
  }

  async function commitRename() {
    const index = editingIndex;
    const title = editingTitle.trim();
    editingIndex = null;
    editingTitle = '';
    if (!index || !deck) return;
    const current = deck.slides[index - 1];
    if (!current || title === (current.title ?? '')) return;
    await apply(retitleSlide(projectState.editorContent, deck, index, title));
  }

  function focusInput(node) {
    node.focus();
    node.select();
  }

  const LAYOUTS = ['auto', 'hero', 'title-body', 'split', 'grid', 'full-bleed', 'quote'];

  // What the slide asks for explicitly, as opposed to what was inferred.
  const explicitLayout = (slide) =>
    typeof slide.directives?.layout === 'string' ? slide.directives.layout : null;

  function openMenu(e, slide) {
    e.preventDefault();
    e.stopPropagation();
    const zoom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;
    const md = () => projectState.editorContent;
    contextMenu = {
      x: e.clientX / zoom,
      y: e.clientY / zoom,
      items: [
        { label: 'New Slide Below', icon: 'fa-plus',
          action: () => apply(insertSlide(md(), deck, { after: slide.index })) },
        { label: 'Duplicate Slide', icon: 'fa-clone',
          action: () => apply(duplicateSlide(md(), deck, slide.index)) },
        { label: 'Rename...', icon: 'fa-pen', action: () => startRename(slide) },
        { separator: true },
        { label: 'Move Up', icon: 'fa-arrow-up', disabled: slide.index === 1,
          action: () => apply(moveSlide(md(), deck, slide.index, 'up')) },
        { label: 'Move Down', icon: 'fa-arrow-down', disabled: slide.index === total,
          action: () => apply(moveSlide(md(), deck, slide.index, 'down')) },
        { label: 'Merge Into Previous', icon: 'fa-compress', disabled: slide.index === 1,
          action: () => apply(mergeIntoPrevious(md(), deck, slide.index)) },
        { separator: true },
        // The check marks what the *slide declares*, not what was inferred —
        // otherwise "Automatic" and the inferred layout would both look chosen.
        // Automatic names the inference so the information isn't lost.
        ...LAYOUTS.map((layout) => ({
          label: layout === 'auto' ? `Layout: Automatic (${slide.layout})` : `Layout: ${layout}`,
          icon: (explicitLayout(slide) ? explicitLayout(slide) === layout : layout === 'auto')
            ? 'fa-circle-check' : 'fa-table-cells-large',
          action: () => apply(setSlideLayout(md(), deck, slide.index, layout)),
        })),
        { separator: true },
        { label: 'Presentation Settings...', icon: 'fa-sliders', action: () => onOpenSettings() },
        { label: 'Delete Slide', icon: 'fa-trash',
          action: () => apply(deleteSlide(md(), deck, slide.index)) },
      ],
    };
  }

  // Drag to reorder. `dropIndex` is the position the dragged slide would take.
  function handleDragStart(e, slide) {
    dragIndex = slide.index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(slide.index));
  }

  function handleDragOver(e, slide) {
    if (dragIndex == null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dropIndex = slide.index;
  }

  async function handleDrop(e, slide) {
    e.preventDefault();
    const from = dragIndex;
    dragIndex = null;
    dropIndex = null;
    if (!from || from === slide.index || !deck) return;
    await apply(reorderSlide(projectState.editorContent, deck, from, slide.index));
  }

  function handleDragEnd() {
    dragIndex = null;
    dropIndex = null;
  }
</script>

<div class="slides-pane">
  {#if !deck}
    <p class="slides-empty">Not a presentation.</p>
  {:else if total === 0}
    <p class="slides-empty">No slides yet — add a heading or a <code>---</code> separator.</p>
  {:else}
    {#each deck.slides as slide (slide.index)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        class="slide-row"
        class:active={activeIndex === slide.index}
        class:dragging={dragIndex === slide.index}
        class:drop-target={dropIndex === slide.index && dragIndex !== slide.index}
        draggable={editingIndex === null}
        role="button"
        tabindex="0"
        onclick={() => jumpTo(slide)}
        ondblclick={() => startRename(slide)}
        oncontextmenu={(e) => openMenu(e, slide)}
        ondragstart={(e) => handleDragStart(e, slide)}
        ondragover={(e) => handleDragOver(e, slide)}
        ondrop={(e) => handleDrop(e, slide)}
        ondragend={handleDragEnd}
        title="Slide {slide.index}{slide.title ? ` — ${slide.title}` : ''}"
      >
        <span class="slide-num">{slide.index}</span>
        <div class="slide-thumb">
          {#if thumbScale > 0}
            <Slide {slide} config={deck.config} {total} scale={thumbScale} />
          {/if}
        </div>
        <div class="slide-meta">
          {#if editingIndex === slide.index}
            <input
              class="slide-title-input"
              bind:value={editingTitle}
              use:focusInput
              onclick={(e) => e.stopPropagation()}
              onblur={commitRename}
              onkeydown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
                if (e.key === 'Escape') { e.preventDefault(); editingIndex = null; }
              }}
            />
          {:else}
            <span class="slide-title" class:untitled={!slide.title}>
              {slide.title || 'Untitled'}
            </span>
            <span class="slide-tags">
              <span class="slide-layout">{slide.layout}</span>
              {#if slide.notes}
                <i class="fas fa-comment-dots" title="Has speaker notes"></i>
              {/if}
            </span>
          {/if}
        </div>
      </div>
    {/each}
    {#if deck.skipped > 0}
      <p class="slides-empty">{deck.skipped} hidden by <code>notes-only</code>.</p>
    {/if}
  {/if}
</div>

{#if contextMenu}
  <ContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    items={contextMenu.items}
    onClose={() => contextMenu = null}
  />
{/if}

<style>
  .slides-pane {
    overflow-y: auto;
    height: 100%;
    padding: 4px 0;
  }

  .slide-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    cursor: pointer;
    border-left: 2px solid transparent;
  }

  .slide-row:hover {
    background: var(--bg-button-hover);
  }

  .slide-row.active {
    background: var(--bg-selected);
    border-left-color: var(--accent);
  }

  .slide-row.dragging {
    opacity: 0.4;
  }

  .slide-row.drop-target {
    border-top: 2px solid var(--accent);
  }

  .slide-num {
    width: 16px;
    flex-shrink: 0;
    font-size: 10px;
    font-variant-numeric: tabular-nums;
    text-align: right;
    color: var(--text-muted);
  }

  .slide-row.active .slide-num {
    color: var(--accent);
  }

  /* The thumbnail is the real Slide component scaled down, so what the pane
     shows and what the audience sees can't drift apart. */
  .slide-thumb {
    flex-shrink: 0;
    border: 1px solid var(--border);
    border-radius: 3px;
    overflow: hidden;
    pointer-events: none;
  }

  .slide-meta {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .slide-title {
    font-size: 12px;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .slide-title.untitled {
    color: var(--text-muted);
    font-style: italic;
  }

  .slide-tags {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
  }

  .slide-layout {
    text-transform: uppercase;
    letter-spacing: 0.4px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .slide-title-input {
    width: 100%;
    padding: 2px 4px;
    font-size: 12px;
    color: var(--text-primary);
    background: var(--input-bg);
    border: 1px solid var(--input-border-focus);
    border-radius: 3px;
    outline: none;
    box-sizing: border-box;
  }

  .slides-empty {
    margin: 8px;
    font-size: 12px;
    font-style: italic;
    color: var(--text-muted);
  }

  code {
    background: var(--code-bg);
    padding: 1px 4px;
    border-radius: 3px;
    font-style: normal;
  }
</style>
