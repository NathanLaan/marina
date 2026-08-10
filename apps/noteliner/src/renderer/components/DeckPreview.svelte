<script>
  // Deck branch of the preview pane: the open note rendered as a scrolling
  // column of slides instead of a flowing document.
  //
  // Only used when the note is a deck (frontmatter carries a `presentation:`
  // block). Speaker notes appear *below* each slide, never on it — which is
  // also how you can see at a glance that the notes/visible split is right.

  import Slide from './Slide.svelte';
  import { projectState } from '../stores/project.svelte.js';
  import { slideAtLine } from '../lib/slides.js';

  const deck = $derived(projectState.deck);
  const total = $derived(deck?.slides.length ?? 0);

  // Width of the scroll column, measured so slides can be scaled to fit it.
  let columnWidth = $state(0);

  const SLIDE_GUTTER = 28;   // room for the slide-number rail
  const scale = $derived.by(() => {
    if (!deck || !columnWidth) return 0;
    const available = Math.max(120, columnWidth - SLIDE_GUTTER);
    return available / deck.stage.w;
  });

  const activeSlide = $derived(
    deck ? slideAtLine(deck, projectState.cursorLine) : null
  );

  // Placeholder values for header/footer text. {{page}} and {{total}} are
  // filled per slide inside Slide.svelte.
  const vars = $derived.by(() => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    return {
      name: projectState.selectedFile?.name || '',
      title: projectState.selectedFile?.name || '',
      date,
      time,
      datetime: `${date} ${time}`,
    };
  });

  // Follow the caret, the way OutlinePane tracks the active heading. `nearest`
  // means it only scrolls when the active slide is actually out of view, so
  // typing inside a visible slide doesn't yank the column around.
  function followCaret(node) {
    $effect(() => {
      const index = activeSlide?.index;
      if (!index) return;
      const el = node.querySelector(`[data-slide="${index}"]`);
      if (el) el.scrollIntoView({ block: 'nearest' });
    });
  }

  function jumpToSlide(slide) {
    projectState.scrollToLine = { line: slide.sourceRange.fromLine, ts: Date.now() };
  }
</script>

<div class="deck-scroll" use:followCaret>
  <div class="deck-column" bind:clientWidth={columnWidth}>
    {#if !deck || total === 0}
      <p class="deck-empty">
        No slides yet — add a heading or a <code>---</code> separator to start one.
      </p>
    {:else}
      {#each deck.slides as slide (slide.index)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
          class="deck-slide"
          class:active={activeSlide?.index === slide.index}
          data-slide={slide.index}
          onclick={() => jumpToSlide(slide)}
          role="button"
          tabindex="0"
          title="Jump to slide {slide.index} in the editor"
        >
          <div class="deck-rail">{slide.index}</div>
          <div class="deck-slide-body">
            {#if scale > 0}
              <Slide {slide} config={deck.config} {total} {scale} {vars} />
            {/if}
            {#if slide.notes}
              <div class="deck-notes">
                <i class="fas fa-comment-dots"></i>
                <span>{slide.notes}</span>
              </div>
            {/if}
          </div>
        </div>
      {/each}

      {#if deck.skipped > 0}
        <p class="deck-note">
          {deck.skipped} slide{deck.skipped === 1 ? '' : 's'} hidden by
          <code>notes-only</code>.
        </p>
      {/if}
    {/if}
  </div>
</div>

<style>
  .deck-scroll {
    flex: 1;
    overflow-y: auto;
    background: var(--bg-base);
  }

  .deck-column {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 16px;
  }

  .deck-slide {
    display: flex;
    gap: 8px;
    cursor: pointer;
    border-radius: 6px;
    outline: 2px solid transparent;
    outline-offset: 3px;
    transition: outline-color 0.12s;
  }

  .deck-slide:hover {
    outline-color: var(--border);
  }

  .deck-slide.active {
    outline-color: var(--accent);
  }

  .deck-rail {
    width: 20px;
    flex-shrink: 0;
    padding-top: 2px;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    text-align: right;
    color: var(--text-muted);
  }

  .deck-slide.active .deck-rail {
    color: var(--accent);
  }

  .deck-slide-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .deck-notes {
    display: flex;
    gap: 8px;
    padding: 6px 8px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-muted);
    background: var(--bg-surface);
    border-left: 2px solid var(--border);
    border-radius: 0 4px 4px 0;
    white-space: pre-wrap;
  }

  .deck-notes i {
    flex-shrink: 0;
    padding-top: 2px;
  }

  .deck-empty,
  .deck-note {
    color: var(--text-muted);
    font-size: 13px;
    font-style: italic;
    margin: 8px 0;
  }

  code {
    background: var(--code-bg);
    padding: 1px 5px;
    border-radius: 3px;
    font-style: normal;
  }
</style>
