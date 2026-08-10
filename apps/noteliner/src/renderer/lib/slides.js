// Deck parsing for NoteLiner presentations.
//
// A note is a "deck" when its YAML frontmatter carries a `presentation:`
// block — see docs/plans/plan-presentations.md §2. This module turns the note
// *body* into a slide model. The body is all the renderer ever sees, because
// ProjectService.readFile() returns frontmatter-stripped content; the
// `presentation:` config arrives separately over `file:getFrontmatter`.
//
// Deliberately dependency-free and DOM-free: block bodies stay as raw
// markdown strings, rendered later by Slide.svelte via `marked`. That keeps
// this file unit-testable under plain Node — see
// tests/integration/slides-parser.test.mjs.
//
// Line numbers in the model are 1-based, matching projectState.cursorLine and
// projectState.scrollToLine so the UI can map caret ⇄ slide without offsets.

export const ASPECTS = {
  '16:9':  { w: 1920, h: 1080 },
  '16:10': { w: 1920, h: 1200 },
  '4:3':   { w: 1440, h: 1080 },
};

export const DEFAULT_PRESENTATION = {
  theme: 'dark',
  aspect: '16:9',
  // Headings at this level or shallower start a new slide. 0 disables
  // heading-driven breaks, leaving `---` as the only separator.
  slideLevel: 2,
  header: '',
  footer: '',
  slideNumbers: true,
  firstSlideTitle: true,
};

const LAYOUTS = new Set([
  'auto', 'hero', 'title-body', 'split', 'grid', 'full-bleed', 'quote', 'table',
]);

// ─── Config ──────────────────────────────────────────────────────────────

// Returns null when `raw` is absent — the caller's test for "is this note a
// deck?". `presentation: true` is accepted as shorthand for the defaults so a
// user can opt in with one word.
export function normalizePresentation(raw) {
  if (raw == null || raw === false) return null;
  const src = (raw === true || typeof raw !== 'object') ? {} : raw;
  const out = { ...DEFAULT_PRESENTATION };

  if (typeof src.theme === 'string' && src.theme.trim()) out.theme = src.theme.trim();
  if (typeof src.aspect === 'string' && ASPECTS[src.aspect.trim()]) out.aspect = src.aspect.trim();

  // YAML may hand us a number or a numeric string; anything unparseable keeps
  // the default rather than silently disabling slide breaks.
  const lvl = Number(src.slideLevel);
  if (Number.isInteger(lvl) && lvl >= 0 && lvl <= 6) out.slideLevel = lvl;

  if (typeof src.header === 'string') out.header = src.header;
  if (typeof src.footer === 'string') out.footer = src.footer;
  if (src.slideNumbers !== undefined) out.slideNumbers = !!src.slideNumbers;
  if (src.firstSlideTitle !== undefined) out.firstSlideTitle = !!src.firstSlideTitle;

  return out;
}

export function stageSize(aspect) {
  return ASPECTS[aspect] || ASPECTS['16:9'];
}

// Placeholder vocabulary deliberately mirrors TemplateService.substitute()
// (src/main/template-service.js) so the app has one placeholder language.
// Unknown placeholders are left as-is.
export function substitute(text, vars = {}) {
  if (!text) return '';
  return String(text).replace(/\{\{(\w+)\}\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match
  );
}

// ─── Line-level patterns ─────────────────────────────────────────────────

const FENCE_RE   = /^ {0,3}(`{3,}|~{3,})/;
const HR_RE      = /^ {0,3}-{3,} *$/;
const ATX_RE     = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const COMMENT_RE = /^\s*<!--\s*(notes|skip|slide)\b\s*:?\s*/i;
const LIST_RE    = /^ {0,3}(?:[-*+]\s|\d+[.)]\s)/;
const IMAGE_RE   = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/;
const YOUTUBE_RE = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?|youtu\.be\/)/i;
const VIDEO_EXT_RE = /\.(?:mp4|webm|mov|m4v|ogv)(?:[?#].*)?$/i;

function fenceCloses(line, marker) {
  const m = line.match(FENCE_RE);
  return !!m && m[1][0] === marker;
}

// A `---` line is a thematic break (slide separator) only when it is not the
// underline of a setext heading — i.e. only when the line above it is blank
// or absent. `Revenue\n---` is an H2 in Markdown, not a rule, and treating it
// as a separator would silently drop the heading text onto the previous slide.
function isSetextUnderline(lines, i) {
  if (i === 0) return false;
  const prev = lines[i - 1];
  if (!prev || prev.trim() === '') return false;
  // Structural lines can't be setext heading text.
  if (ATX_RE.test(prev) || FENCE_RE.test(prev) || LIST_RE.test(prev)) return false;
  if (prev.trimStart().startsWith('>')) return false;
  if (prev.includes('|')) return false;   // table row
  return true;
}

// ─── Parsing ─────────────────────────────────────────────────────────────

// parseDeck(markdown, presentation) → Deck
//
// Deck = {
//   config,                     // normalized presentation config
//   stage: { w, h },            // fixed stage size in px for the chosen aspect
//   slides: Slide[],            // 1-based `index`, notes-only slides removed
//   skipped: number,            // slides dropped by the notes-only directive
// }
export function parseDeck(markdown, presentation) {
  const config = normalizePresentation(presentation) ?? { ...DEFAULT_PRESENTATION };
  const stage = stageSize(config.aspect);
  const text = String(markdown ?? '').replace(/\r\n?/g, '\n');
  const lines = text.split('\n');

  const start = skipFrontmatter(lines);
  const scan = scanLines(lines, start, config.slideLevel);
  const raw = buildSlides(lines, scan, config);

  // notes-only slides stay in the document but leave the deck entirely, so
  // numbering skips them rather than showing a blank slide.
  const kept = raw.filter((s) => !s.notesOnly);
  kept.forEach((s, i) => { s.index = i + 1; });

  return { config, stage, slides: kept, skipped: raw.length - kept.length };
}

// The renderer receives frontmatter-stripped bodies, but tests, imports, and
// MCP writes can hand us a full file. Skipping a leading YAML block keeps its
// closing `---` from being read as the first slide separator.
//
// The block must actually look like YAML — at least one `key:` line and
// nothing that couldn't be YAML. A note whose body legitimately opens with a
// `---` separator would otherwise have everything up to the next `---`
// swallowed, which is the worst failure this module could have.
function skipFrontmatter(lines) {
  if (lines[0]?.trim() !== '---') return 0;
  let sawKey = false;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '---') return sawKey ? i + 1 : 0;
    if (line.trim() === '') continue;
    if (/^\s+\S/.test(line)) continue;             // nested mapping / continuation
    if (/^[\w.$-]+\s*:(\s|$)/.test(line)) { sawKey = true; continue; }
    return 0;                                      // not frontmatter after all
  }
  return 0;   // unterminated — treat the whole thing as body
}

// Single pass that classifies every line while tracking fenced-code state, so
// `#`, `---`, and `<!-- notes` inside a code block stay literal. Produces:
//   breaks         line indexes that start a new slide, → heading level or 0
//   comments       notes / skip / slide-directive regions
//   drop           lines consumed by comments or setext underlines
//   setext         line index → heading level, for `Text\n---` headings
function scanLines(lines, start, slideLevel) {
  const breaks = new Map();
  const comments = [];
  const drop = new Set();
  const setext = new Map();

  let inFence = false;
  let marker = null;

  for (let i = start; i < lines.length; i++) {
    const line = lines[i];

    if (inFence) {
      if (fenceCloses(line, marker)) { inFence = false; marker = null; }
      continue;
    }

    const fence = line.match(FENCE_RE);
    if (fence) { inFence = true; marker = fence[1][0]; continue; }

    const comment = line.match(COMMENT_RE);
    if (comment) {
      const region = readComment(lines, i, comment);
      comments.push(region);
      for (let j = region.fromLine; j <= region.toLine; j++) drop.add(j);
      i = region.toLine;
      continue;
    }

    const atx = line.match(ATX_RE);
    if (atx) {
      const level = atx[1].length;
      if (slideLevel > 0 && level <= slideLevel) breaks.set(i, level);
      continue;
    }

    if (HR_RE.test(line)) {
      if (isSetextUnderline(lines, i)) {
        // The line above is an H2; break there instead and drop the underline.
        const headingLine = i - 1;
        setext.set(headingLine, 2);
        if (slideLevel >= 2) breaks.set(headingLine, 2);
        drop.add(i);
      } else {
        breaks.set(i, 0);   // 0 = separator, not a heading
        drop.add(i);
      }
    }
  }

  return { start, breaks, comments, drop, setext };
}

// Reads a `<!-- notes … -->` / `<!-- skip … -->` / `<!-- slide: … -->`
// region, which may be a single line or span many. An unterminated comment
// runs to the end of the document — the same forgiving reading a Markdown
// renderer gives it.
function readComment(lines, i, match) {
  const kind = match[1].toLowerCase();
  const collected = [];
  let toLine = i;
  let first = lines[i].slice(match[0].length);

  const closeOn = (s) => s.indexOf('-->');
  const closeIdx = closeOn(first);
  if (closeIdx >= 0) {
    collected.push(first.slice(0, closeIdx));
  } else {
    collected.push(first);
    for (let j = i + 1; j < lines.length; j++) {
      toLine = j;
      const idx = closeOn(lines[j]);
      if (idx >= 0) { collected.push(lines[j].slice(0, idx)); break; }
      collected.push(lines[j]);
    }
  }

  const body = collected.join('\n').replace(/^\n+|\s+$/g, '');
  return { kind, fromLine: i, toLine, body };
}

// `layout=split bg=#101418 class="big quote"` → { layout, bg, class }
// Unknown keys are kept but ignored by renderers, so a note written against a
// future version never fails to parse.
function parseDirectives(body) {
  const out = {};
  const re = /(\w[\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+))/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    const key = m[1].toLowerCase();
    const value = m[2] ?? m[3] ?? m[4] ?? '';
    out[key] = value;
  }
  // Bare flags: `<!-- slide: notes-only -->`
  for (const word of body.split(/\s+/)) {
    const flag = word.trim().toLowerCase();
    if (flag && !flag.includes('=') && /^[\w-]+$/.test(flag) && !(flag in out)) {
      out[flag] = true;
    }
  }
  return out;
}

function buildSlides(lines, scan, config) {
  const { start, breaks, comments, drop, setext } = scan;
  const commentsByLine = new Map(comments.map((c) => [c.fromLine, c]));

  // Slice the document at break points. A break that is a heading keeps its
  // own line (the heading belongs to the new slide); a `---` separator is
  // dropped, so the new slide starts on the following line.
  const bounds = [];
  let cursor = start;
  for (let i = start; i < lines.length; i++) {
    if (!breaks.has(i)) continue;
    const isHeading = breaks.get(i) > 0;
    const from = isHeading ? i : i + 1;
    // A region that holds only the dropped separator yields no blocks and is
    // filtered out below, so a document opening with `---` gains no empty slide.
    if (from > cursor) bounds.push({ from: cursor, to: from - 1 });
    cursor = from;
  }
  bounds.push({ from: cursor, to: lines.length - 1 });

  const slides = [];
  for (const { from, to } of bounds) {
    const slide = buildSlide(lines, from, to, { drop, setext, commentsByLine });
    // Drop regions that carry nothing at all (e.g. trailing blank lines after
    // the final separator) so the deck has no phantom slides.
    if (!slide.blocks.length && !slide.notes && !Object.keys(slide.directives).length) continue;
    slides.push(slide);
  }

  if (config.firstSlideTitle && slides.length) applyTitleSlide(slides[0]);
  for (const slide of slides) slide.layout = pickLayoutFor(slide);
  return slides;
}

function buildSlide(lines, from, to, ctx) {
  const { drop, setext, commentsByLine } = ctx;
  const content = [];
  const notes = [];
  let directives = {};

  for (let i = from; i <= to; i++) {
    const comment = commentsByLine.get(i);
    if (comment) {
      if (comment.kind === 'notes' && comment.body) notes.push(comment.body);
      else if (comment.kind === 'slide') directives = { ...directives, ...parseDirectives(comment.body) };
      // 'skip' bodies are intentionally discarded — they stay in the note.
      i = comment.toLine;
      continue;
    }
    if (drop.has(i)) continue;
    content.push({ line: i, text: lines[i], setextLevel: setext.get(i) });
  }

  const blocks = splitBlocks(content);
  const heading = blocks.find((b) => b.kind === 'heading') || null;

  return {
    index: 0,                       // assigned after notes-only filtering
    sourceRange: { fromLine: from + 1, toLine: to + 1 },
    title: heading ? heading.text : null,
    headingLevel: heading ? heading.level : null,
    blocks,
    notes: notes.join('\n\n'),
    directives,
    notesOnly: directives['notes-only'] === true || directives['notes-only'] === 'true',
    layout: 'auto',                 // replaced by pickLayoutFor
  };
}

// Blank lines separate blocks. Fenced code keeps its interior blank lines, and
// headings always stand alone so a heading + paragraph never fuse into one
// block.
function splitBlocks(content) {
  const blocks = [];
  let cur = [];
  let inFence = false;
  let marker = null;

  const flush = () => {
    if (cur.length) { blocks.push(makeBlock(cur)); cur = []; }
  };

  for (const tok of content) {
    if (inFence) {
      cur.push(tok);
      if (fenceCloses(tok.text, marker)) { inFence = false; marker = null; flush(); }
      continue;
    }

    const fence = tok.text.match(FENCE_RE);
    if (fence) { flush(); inFence = true; marker = fence[1][0]; cur.push(tok); continue; }

    if (tok.text.trim() === '') { flush(); continue; }

    if (ATX_RE.test(tok.text) || tok.setextLevel) { flush(); cur.push(tok); flush(); continue; }

    cur.push(tok);
  }
  flush();
  return blocks;
}

function isTable(toks) {
  if (toks.length < 2) return false;
  if (!toks.every((t) => t.text.includes('|'))) return false;
  return /^[\s|:-]*-[\s|:-]*$/.test(toks[1].text) && toks[1].text.includes('-');
}

function makeBlock(toks) {
  const text = toks.map((t) => t.text).join('\n');
  const fromLine = toks[0].line + 1;
  const toLine = toks[toks.length - 1].line + 1;
  const base = { text, fromLine, toLine };
  const first = toks[0].text;
  const trimmed = first.trim();

  if (toks.length === 1) {
    const atx = first.match(ATX_RE);
    if (atx) return { ...base, kind: 'heading', level: atx[1].length, text: atx[2] };
    if (toks[0].setextLevel) return { ...base, kind: 'heading', level: toks[0].setextLevel, text: trimmed };

    const img = trimmed.match(IMAGE_RE);
    if (img) {
      const src = img[2];
      const kind = VIDEO_EXT_RE.test(src) ? 'video' : 'image';
      return { ...base, kind, alt: img[1], src };
    }
    if (YOUTUBE_RE.test(trimmed)) return { ...base, kind: 'video', src: trimmed, alt: '' };
  }

  if (FENCE_RE.test(first)) return { ...base, kind: 'code' };
  if (trimmed.startsWith('>')) return { ...base, kind: 'quote' };
  if (LIST_RE.test(first)) return { ...base, kind: 'list' };
  if (isTable(toks)) return { ...base, kind: 'table' };
  if (trimmed.startsWith('$$')) return { ...base, kind: 'math' };
  return { ...base, kind: 'para' };
}

// A leading H1 with at most one supporting block reads as a title slide.
// This is a layout hint only — it never changes how the note is split, so
// turning firstSlideTitle off cannot alter slide boundaries.
function applyTitleSlide(slide) {
  const heading = slide.blocks[0];
  if (heading?.kind === 'heading' && heading.level === 1 && slide.blocks.length <= 2) {
    slide.directives = { layout: 'hero', ...slide.directives };
  }
}

// ─── Layout ──────────────────────────────────────────────────────────────

// Block count and kind pick the layout; there is no manual positioning. An
// explicit `layout=` directive always wins (except `auto`, which asks for
// exactly this inference).
export function pickLayoutFor(slide) {
  const forced = slide.directives?.layout;
  if (typeof forced === 'string' && forced !== 'auto' && LAYOUTS.has(forced)) return forced;

  const body = slide.blocks.filter((b) => b.kind !== 'heading');
  const hasHeading = slide.blocks.some((b) => b.kind === 'heading');

  if (body.length === 0) return 'hero';

  if (body.length === 1) {
    const only = body[0];
    if (only.kind === 'image' || only.kind === 'video') return hasHeading ? 'title-body' : 'full-bleed';
    if (only.kind === 'quote') return 'quote';
    if (only.kind === 'table') return 'table';
    return hasHeading ? 'title-body' : 'hero';
  }

  return body.length === 2 ? 'split' : 'grid';
}

// ─── Helpers for the UI ──────────────────────────────────────────────────

// 1-based caret line → the slide containing it (or null). Used for the
// active-slide highlight; mirrors how OutlinePane tracks the active heading.
export function slideAtLine(deck, line) {
  if (!deck?.slides?.length || !line) return null;
  let active = null;
  for (const slide of deck.slides) {
    if (slide.sourceRange.fromLine <= line) active = slide;
    else break;
  }
  return active;
}

// Rough speaking time from the words the presenter actually says: visible
// block text plus speaker notes. Surfaced in the status bar in Phase 2.
export function estimateDuration(deck, wordsPerMinute = 130) {
  let words = 0;
  for (const slide of deck?.slides || []) {
    for (const block of slide.blocks) words += countWords(block.text);
    words += countWords(slide.notes);
  }
  return { words, minutes: words / wordsPerMinute };
}

function countWords(text) {
  if (!text) return 0;
  const matched = String(text).match(/[\p{L}\p{N}'’-]+/gu);
  return matched ? matched.length : 0;
}
