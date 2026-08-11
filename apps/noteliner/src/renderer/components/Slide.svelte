<script>
  // One slide, rendered onto a fixed-size stage (1920×1080 for 16:9) and then
  // scaled by the caller with a CSS transform.
  //
  // Everything that displays a slide uses this component — the preview column
  // now, and the detached presenter window, thumbnail rail, and export
  // renderer in later phases. Because the geometry is fixed and only the scale
  // changes, a slide looks identical at every size, and the exported PDF
  // matches the screen because it *is* the screen.

  import { marked } from 'marked';
  import { stageSize, substitute } from '../lib/slides.js';
  import { resolveAttachmentUrls } from '../lib/attachments.js';

  let {
    slide,
    config,
    total = 1,
    // Multiplier applied to the fixed stage. The caller computes it from its
    // own width so slides fit whatever container they land in.
    scale = 1,
    // Extra placeholder values for header/footer text ({{name}} etc.).
    vars = {},
  } = $props();

  const stage = $derived(stageSize(config?.aspect));

  // Blocks render through `marked` so a slide supports the same inline
  // Markdown as the note preview. Headings are emitted directly instead:
  // setext headings arrive as plain text without their `##`, and rendering the
  // tag ourselves keeps the level authoritative.
  function renderBlock(block) {
    if (block.kind === 'heading') {
      const level = Math.min(6, Math.max(1, block.level || 1));
      return `<h${level}>${marked.parseInline(block.text)}</h${level}>`;
    }
    if (block.kind === 'video') return renderVideo(block);
    return marked.parse(block.text);
  }

  // Local files play inline; YouTube stays a link card in the editor preview —
  // embedding an iframe per slide would cost far more than it shows. The
  // presenter window can upgrade this later.
  function renderVideo(block) {
    const src = block.src || '';
    if (/^https?:/i.test(src)) {
      return `<figure class="slide-video-link"><i class="fas fa-circle-play"></i>`
        + `<span>${escapeHtml(block.alt || src)}</span></figure>`;
    }
    return `<video src="${escapeHtml(src)}" controls preload="metadata"></video>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  const headingBlocks = $derived(slide.blocks.filter((b) => b.kind === 'heading'));
  const bodyBlocks = $derived(slide.blocks.filter((b) => b.kind !== 'heading'));

  const headingHtml = $derived(
    resolveAttachmentUrls(headingBlocks.map(renderBlock).join(''))
  );
  const bodyHtml = $derived(
    bodyBlocks.map((b) => ({ kind: b.kind, html: resolveAttachmentUrls(renderBlock(b)) }))
  );

  const placeholders = $derived({
    page: slide.index,
    total,
    ...vars,
  });

  const headerText = $derived(substitute(slide.directives?.header ?? config?.header, placeholders));
  const footerText = $derived(substitute(slide.directives?.footer ?? config?.footer, placeholders));
  const background = $derived(slide.directives?.bg || null);
  const extraClass = $derived(typeof slide.directives?.class === 'string' ? slide.directives.class : '');
</script>

<div class="slide-frame" style="width: {stage.w * scale}px; height: {stage.h * scale}px;">
  <div
    class="slide-stage theme-{config?.theme || 'dark'} layout-{slide.layout} {extraClass}"
    style="width: {stage.w}px; height: {stage.h}px; transform: scale({scale});{background ? ` background: ${background};` : ''}"
  >
    {#if headerText}
      <div class="slide-band slide-header">{headerText}</div>
    {/if}

    <div class="slide-content">
      {#if headingBlocks.length}
        <div class="slide-heading">{@html headingHtml}</div>
      {/if}
      {#if bodyHtml.length}
        <div class="slide-body">
          {#each bodyHtml as block, i (i)}
            <div class="slide-block kind-{block.kind}">{@html block.html}</div>
          {/each}
        </div>
      {/if}
    </div>

    {#if footerText || config?.slideNumbers}
      <div class="slide-band slide-footer">
        <span class="slide-footer-text">{footerText}</span>
        {#if config?.slideNumbers}
          <span class="slide-number">{slide.index}</span>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  /* The frame occupies the scaled footprint so surrounding layout is correct;
     the stage inside it is always full size and scaled down into place. */
  .slide-frame {
    position: relative;
    overflow: hidden;
    flex-shrink: 0;
  }

  .slide-stage {
    position: absolute;
    top: 0;
    left: 0;
    transform-origin: top left;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    padding: 96px 120px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--slide-bg);
    color: var(--slide-fg);
    overflow: hidden;
  }

  /* Slide themes are independent of the app theme on purpose — a deck must
     look the same to its audience regardless of the presenter's UI theme. */
  .theme-dark {
    --slide-bg: #14181d;
    --slide-fg: #f2f5f8;
    --slide-muted: #8b98a5;
    --slide-accent: #4da3ff;
    --slide-rule: #2b333d;
    --slide-code-bg: #1e242b;
  }

  .theme-light {
    --slide-bg: #ffffff;
    --slide-fg: #16191d;
    --slide-muted: #5d6673;
    --slide-accent: #0b62c4;
    --slide-rule: #dfe4ea;
    --slide-code-bg: #f2f4f7;
  }

  .slide-band {
    flex-shrink: 0;
    font-size: 28px;
    color: var(--slide-muted);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
  }

  .slide-header {
    padding-bottom: 32px;
    border-bottom: 2px solid var(--slide-rule);
    margin-bottom: 48px;
  }

  .slide-footer {
    padding-top: 32px;
    margin-top: 48px;
    border-top: 2px solid var(--slide-rule);
  }

  .slide-number {
    font-variant-numeric: tabular-nums;
    margin-left: auto;
  }

  .slide-content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 48px;
  }

  .slide-heading {
    flex-shrink: 0;
  }

  .slide-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 48px;
    font-size: 44px;
    line-height: 1.4;
  }

  .slide-block {
    min-width: 0;
  }

  /* ─── Layouts ───────────────────────────────────────────────────────────
     The block count and kind pick one of these (lib/slides.js pickLayoutFor);
     there is no manual positioning anywhere in the app. */

  .layout-hero .slide-content,
  .layout-quote .slide-content {
    justify-content: center;
  }

  .layout-hero .slide-heading :global(h1),
  .layout-hero .slide-heading :global(h2) {
    font-size: 132px;
    line-height: 1.05;
  }

  .layout-hero .slide-body {
    flex: 0 0 auto;
    font-size: 52px;
    color: var(--slide-muted);
  }

  .layout-split .slide-body {
    flex-direction: row;
    gap: 72px;
    align-items: flex-start;
  }

  .layout-split .slide-block {
    flex: 1 1 0;
  }

  .layout-grid .slide-body {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 48px 72px;
    align-content: start;
    font-size: 38px;
  }

  .layout-quote .slide-body {
    font-size: 64px;
  }

  .layout-quote .slide-block :global(blockquote) {
    border-left: none;
    padding-left: 0;
    margin: 0;
    color: var(--slide-fg);
    font-style: italic;
  }

  /* Full-bleed drops the padding entirely and lets the single image own the
     stage; the bands are suppressed so nothing overlays the picture. */
  .layout-full-bleed {
    padding: 0;
  }

  .layout-full-bleed .slide-content {
    gap: 0;
  }

  .layout-full-bleed .slide-body {
    gap: 0;
  }

  .layout-full-bleed .slide-block,
  .layout-full-bleed .kind-image {
    height: 100%;
  }

  .layout-full-bleed :global(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 0;
    max-height: none;
  }

  .layout-full-bleed .slide-band {
    display: none;
  }

  /* ─── Block content ─────────────────────────────────────────────────── */

  .slide-stage :global(h1) { font-size: 104px; line-height: 1.1; margin: 0; font-weight: 600; }
  .slide-stage :global(h2) { font-size: 80px;  line-height: 1.15; margin: 0; font-weight: 600; }
  .slide-stage :global(h3) { font-size: 60px;  line-height: 1.2; margin: 0; font-weight: 600; }
  .slide-stage :global(h4),
  .slide-stage :global(h5),
  .slide-stage :global(h6) { font-size: 48px; margin: 0; font-weight: 600; }

  .slide-stage :global(p) { margin: 0 0 24px; }
  .slide-stage :global(p:last-child) { margin-bottom: 0; }
  .slide-stage :global(strong) { font-weight: 700; }
  .slide-stage :global(a) { color: var(--slide-accent); text-decoration: none; }
  .slide-stage :global(mark) { background: var(--slide-accent); color: var(--slide-bg); padding: 0 8px; }

  .slide-stage :global(ul),
  .slide-stage :global(ol) { margin: 0; padding-left: 1.4em; }
  .slide-stage :global(li) { margin-bottom: 20px; }
  .slide-stage :global(li:last-child) { margin-bottom: 0; }

  .slide-stage :global(img) {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 8px;
    display: block;
  }

  .slide-stage :global(video) {
    max-width: 100%;
    max-height: 100%;
    border-radius: 8px;
  }

  .slide-stage :global(.slide-video-link) {
    display: flex;
    align-items: center;
    gap: 24px;
    margin: 0;
    padding: 32px 40px;
    border: 2px solid var(--slide-rule);
    border-radius: 12px;
    color: var(--slide-muted);
  }

  .slide-stage :global(blockquote) {
    margin: 0;
    padding-left: 40px;
    border-left: 8px solid var(--slide-accent);
    color: var(--slide-fg);
  }

  .slide-stage :global(code) {
    background: var(--slide-code-bg);
    padding: 4px 12px;
    border-radius: 6px;
    font-size: 0.9em;
  }

  /* A projected slide can't scroll, so long code lines wrap rather than being
     clipped at the edge of the block. */
  .slide-stage :global(pre) {
    background: var(--slide-code-bg);
    padding: 32px;
    border-radius: 12px;
    margin: 0;
    font-size: 34px;
    line-height: 1.4;
    white-space: pre-wrap;
    overflow-wrap: break-word;
  }

  .slide-stage :global(pre code) { background: none; padding: 0; font-size: 1em; }

  .slide-stage :global(table) {
    width: 100%;
    border-collapse: collapse;
    font-size: 38px;
  }

  /* No `text-align` here on purpose: marked emits the Markdown column
     alignment as an `align` attribute, and any CSS rule would override it —
     so `--:` columns would silently render left-aligned. */
  .slide-stage :global(th),
  .slide-stage :global(td) {
    border-bottom: 2px solid var(--slide-rule);
    padding: 20px 24px;
  }

  .slide-stage :global(th) { color: var(--slide-muted); font-weight: 600; }

  .slide-stage :global(hr) { display: none; }
</style>
