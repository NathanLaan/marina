// Slide-level edits on a deck's markdown.
//
// Every function here is pure: (markdown, deck, …) → { markdown, caretLine }.
// The UI applies a result by assigning projectState.editorContent — Editor.svelte
// syncs external content changes into CodeMirror — and writing the file. Keeping
// the rewriting logic here means it can be unit-tested with no editor, no DOM,
// and no Electron: tests/integration/slide-edits.test.mjs.
//
// Slide regions come from parseDeck's 1-based `sourceRange`, which tiles the
// document without overlap, so a region can be spliced by line index alone.
// Notes-only slides are absent from deck.slides; their lines simply stay put,
// which is what "stays in the note but off the deck" means.
//
// Two break styles have to survive every edit:
//   heading breaks   `## Title`  — a slide starts because the heading is
//                    shallow enough. Self-carrying: moving the block moves
//                    its boundary.
//   separators       `---`       — the boundary is a separate line that
//                    belongs to the *end* of the preceding slide's region.
// Reordering therefore strips a trailing separator off the block it moves and
// re-establishes boundaries afterwards (ensureBoundary), so a separator-only
// deck can't end up with a stray `---` at EOF or two slides fused together.

const ATX_RE = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const HR_RE = /^ {0,3}-{3,} *$/;
const DIRECTIVE_RE = /^\s*<!--\s*slide\s*:?\s*(.*?)\s*(-->)?\s*$/i;

function toLines(markdown) {
  return String(markdown ?? '').replace(/\r\n?/g, '\n').split('\n');
}

function result(lines, caretLine = null) {
  return {
    markdown: lines.join('\n'),
    caretLine: caretLine == null ? null : Math.max(1, Math.min(lines.length, caretLine)),
  };
}

// 0-based inclusive [start, end] for a slide's lines.
function bounds(slide) {
  return [slide.sourceRange.fromLine - 1, slide.sourceRange.toLine - 1];
}

function slideAt(deck, index) {
  return deck?.slides?.[index - 1] ?? null;
}

function breakLevel(config) {
  const level = config?.slideLevel ?? 2;
  return level > 0 ? level : 0;
}

// Does this line start a slide on its own (a heading shallow enough to break)?
function isBreakHeading(line, slideLevel) {
  if (slideLevel <= 0) return false;
  const m = line?.match(ATX_RE);
  return !!m && m[1].length <= slideLevel;
}

function trimBlanks(block) {
  const out = [...block];
  while (out.length && out[out.length - 1].trim() === '') out.pop();
  while (out.length && out[0].trim() === '') out.shift();
  return out;
}

// Region content stripped of blank padding and of the trailing `---` that is
// the *next* slide's boundary rather than part of this one.
function contentBlock(lines, slide) {
  const [from, to] = bounds(slide);
  let block = trimBlanks(lines.slice(from, to + 1));
  if (block.length && HR_RE.test(block[block.length - 1])) {
    block = trimBlanks(block.slice(0, -1));
  }
  return block;
}

// True when the nearest non-blank line above `at` is a separator (or there is
// nothing above at all) — i.e. a slide starting at `at` is already delimited.
function hasBoundaryBefore(lines, at) {
  for (let i = at - 1; i >= 0; i--) {
    if (lines[i].trim() === '') continue;
    return HR_RE.test(lines[i]);
  }
  return true;
}

function firstNonBlank(lines, from) {
  for (let i = from; i < lines.length; i++) {
    if (lines[i].trim() !== '') return lines[i];
  }
  return null;
}

// Inserts a slide block at line index `at`, adding whichever separators the
// break style requires: one before the block when it can't break on its own,
// and one after it when the following content can't either. Returns the line
// index the block ends up on.
function insertSlideBlock(lines, at, rawBlock, slideLevel) {
  const block = trimBlanks(rawBlock);
  if (!block.length) return at;

  const chunk = [];
  if (at > 0 && lines[at - 1]?.trim() !== '') chunk.push('');
  if (!isBreakHeading(block[0], slideLevel) && !hasBoundaryBefore(lines, at)) {
    chunk.push('---', '');
  }

  const offset = chunk.length;
  chunk.push(...block);

  const following = firstNonBlank(lines, at);
  if (following) {
    chunk.push('');
    if (!isBreakHeading(following, slideLevel) && !HR_RE.test(following)) chunk.push('---', '');
  } else {
    chunk.push('');
  }

  lines.splice(at, 0, ...chunk);
  // Blank padding on both sides can meet blank lines that were already there;
  // tidy just the seam rather than reformatting the rest of the note.
  const start = at + offset;
  tidyRange(lines, Math.max(0, at - 1), at + chunk.length + 1);
  return lines.indexOf(block[0], Math.max(0, start - 3));
}

// Collapses runs of 2+ blank lines down to one within [from, to]. Only ever
// called across a splice seam, which is never inside a fenced code block, so
// it can't corrupt code that relies on blank lines.
function tidyRange(lines, from, to) {
  const end = Math.min(lines.length, to);
  for (let i = Math.max(0, from); i < end && i < lines.length; i++) {
    if (lines[i].trim() !== '') continue;
    let run = 1;
    while (i + run < lines.length && lines[i + run].trim() === '') run++;
    if (run > 1) lines.splice(i + 1, run - 1);
  }
}

// After a region is spliced out, the separator that used to introduce it can be
// left dangling at the end of the note. Nothing follows it, so it would parse
// as an empty slide — drop it along with any trailing blanks.
function trimOrphanTail(lines, from) {
  if (lines.slice(from).some((l) => l.trim() !== '')) return;
  lines.length = from;
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  if (lines.length && HR_RE.test(lines[lines.length - 1])) lines.pop();
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  lines.push('');
}

// Guarantees that the slide starting at `at` still starts a slide after an
// edit: either it opens with a break heading, or a `---` precedes it. Returns
// how many lines were inserted.
function ensureBoundary(lines, at, slideLevel) {
  if (at <= 0 || at >= lines.length) return 0;
  if (isBreakHeading(lines[at], slideLevel)) return 0;
  if (hasBoundaryBefore(lines, at)) return 0;
  lines.splice(at, 0, '---', '');
  return 2;
}

// Collapses a run of blank lines at a splice junction down to one — or to none
// at the very start or end of the note, where a blank line is just noise.
function tidyJunction(lines, at) {
  let start = at;
  while (start > 0 && lines[start - 1]?.trim() === '') start--;
  let end = at;
  while (end < lines.length && lines[end]?.trim() === '') end++;
  const blanks = end - start;
  if (blanks === 0) return;
  const keep = (start === 0 || end >= lines.length) ? 0 : 1;
  if (blanks === keep) return;
  lines.splice(start, blanks, ...Array(keep).fill(''));
}

// ─── Inserting ───────────────────────────────────────────────────────────

// Adds a slide after slide `after` (1-based; 0 or null puts it first).
// The caret lands on the new slide's first line.
export function insertSlide(markdown, deck, { after = null, title = '', body = '' } = {}) {
  const lines = toLines(markdown);
  const slideLevel = breakLevel(deck?.config);
  const level = slideLevel > 0 ? slideLevel : 2;

  const heading = `${'#'.repeat(level)} ${title || 'New Slide'}`;
  const block = body ? [heading, '', ...String(body).split('\n')] : [heading];

  const anchor = slideAt(deck, after);
  const at = anchor
    ? bounds(anchor)[1] + 1
    : (deck?.slides?.length ? bounds(deck.slides[0])[0] : lines.length);

  const start = insertSlideBlock(lines, at, block, slideLevel);
  return result(lines, start + 1);
}

export function duplicateSlide(markdown, deck, index) {
  const slide = slideAt(deck, index);
  if (!slide) return result(toLines(markdown));
  const lines = toLines(markdown);
  const block = contentBlock(lines, slide);
  const start = insertSlideBlock(lines, bounds(slide)[1] + 1, block, breakLevel(deck?.config));
  return result(lines, start + 1);
}

// ─── Removing ────────────────────────────────────────────────────────────

export function deleteSlide(markdown, deck, index) {
  const slide = slideAt(deck, index);
  if (!slide) return result(toLines(markdown));
  const lines = toLines(markdown);
  const [from, to] = bounds(slide);

  lines.splice(from, to - from + 1);
  // The removed region may have carried the separator that introduced the next
  // slide, so re-establish the boundary before tidying blanks. If nothing
  // follows, the separator above is now dangling instead.
  ensureBoundary(lines, from, breakLevel(deck?.config));
  trimOrphanTail(lines, from);
  tidyJunction(lines, from);
  if (lines.length === 0) lines.push('');
  return result(lines, from + 1);
}

// ─── Reordering ──────────────────────────────────────────────────────────

// Moves slide `fromIndex` to 1-based position `toIndex` among the slides.
export function reorderSlide(markdown, deck, fromIndex, toIndex) {
  const slides = deck?.slides ?? [];
  const slide = slideAt(deck, fromIndex);
  if (!slide || slides.length < 2) return result(toLines(markdown));

  const target = Math.max(1, Math.min(slides.length, toIndex));
  if (target === fromIndex) return result(toLines(markdown));

  const lines = toLines(markdown);
  const slideLevel = breakLevel(deck?.config);
  const [from, to] = bounds(slide);
  const block = contentBlock(lines, slide);
  const removed = to - from + 1;

  // Anchor against a slide that isn't the one being moved, then translate its
  // original line index into the post-removal document.
  const others = slides.filter((s) => s.index !== slide.index);
  const shift = (line) => (line > to ? line - removed : line);

  let at;
  if (target === 1) {
    at = shift(bounds(others[0])[0]);
  } else {
    at = shift(bounds(others[target - 2])[1]) + 1;
  }

  lines.splice(from, removed);
  // Repair the hole the region left before inserting, so the surviving slides
  // keep their boundaries whether the moved slide was in the middle or last.
  ensureBoundary(lines, from, slideLevel);
  trimOrphanTail(lines, from);
  tidyJunction(lines, from);

  at = Math.max(0, Math.min(lines.length, at));
  const start = insertSlideBlock(lines, at, block, slideLevel);
  return result(lines, start + 1);
}

export function moveSlide(markdown, deck, index, direction) {
  const delta = direction === 'up' ? -1 : 1;
  return reorderSlide(markdown, deck, index, index + delta);
}

// ─── Merging and splitting ───────────────────────────────────────────────

// Removes the boundary at the top of slide `index` so it joins the slide
// before it. A heading boundary is demoted rather than deleted, so the text
// survives as content; a `---` boundary is removed outright.
export function mergeIntoPrevious(markdown, deck, index) {
  const slide = slideAt(deck, index);
  if (!slide || index < 2) return result(toLines(markdown));
  const lines = toLines(markdown);
  const slideLevel = breakLevel(deck?.config);
  const [from] = bounds(slide);

  if (isBreakHeading(lines[from], slideLevel)) {
    const m = lines[from].match(ATX_RE);
    if (slideLevel >= 6) lines[from] = `**${m[2]}**`;
    else lines[from] = `${'#'.repeat(slideLevel + 1)} ${m[2]}`;
    return result(lines, from + 1);
  }

  // Separator style: drop the nearest `---` above this slide's first line.
  for (let i = from - 1; i >= 0; i--) {
    if (lines[i].trim() === '') continue;
    if (HR_RE.test(lines[i])) {
      lines.splice(i, 1);
      tidyJunction(lines, i);
      return result(lines, i + 1);
    }
    break;
  }
  return result(lines, from + 1);
}

// Starts a new slide at `line` (1-based) using an explicit separator, which
// works regardless of slideLevel and invents no title.
export function splitAtLine(markdown, deck, line) {
  const lines = toLines(markdown);
  const at = Math.max(0, Math.min(lines.length, (line || 1) - 1));
  const slideLevel = breakLevel(deck?.config);

  if (at === 0) return result(lines, 1);
  if (isBreakHeading(lines[at], slideLevel)) return result(lines, at + 1);
  if (hasBoundaryBefore(lines, at)) return result(lines, at + 1);

  // Reuse the blank line already above the split point rather than stacking
  // another one on top of it.
  const chunk = lines[at - 1]?.trim() === '' ? ['---', ''] : ['', '---', ''];
  lines.splice(at, 0, ...chunk);
  return result(lines, at + chunk.length + 1);
}

// ─── Slide properties ────────────────────────────────────────────────────

// Renames a slide, inserting a heading if it had none.
export function retitleSlide(markdown, deck, index, title) {
  const slide = slideAt(deck, index);
  if (!slide) return result(toLines(markdown));
  const lines = toLines(markdown);
  const text = String(title ?? '').trim();
  const heading = slide.blocks.find((b) => b.kind === 'heading');

  if (heading) {
    const at = heading.fromLine - 1;
    const m = lines[at]?.match(ATX_RE);
    // Setext headings (`Title` + `---`) have no `#` to preserve; rewriting the
    // text line alone keeps the underline doing its job.
    const hashes = m ? m[1] : '';
    lines[at] = hashes ? `${hashes} ${text}` : text;
    return result(lines, at + 1);
  }

  const slideLevel = breakLevel(deck?.config);
  const level = slideLevel > 0 ? slideLevel : 2;
  const [from] = bounds(slide);
  // Insert after a separator that opens the region, not before it.
  let at = from;
  while (at < lines.length && (lines[at].trim() === '' || HR_RE.test(lines[at]))) at++;
  lines.splice(at, 0, `${'#'.repeat(level)} ${text}`, '');
  return result(lines, at + 1);
}

// Sets (or clears, with 'auto'/null) the layout directive for a slide.
export function setSlideLayout(markdown, deck, index, layout) {
  const slide = slideAt(deck, index);
  if (!slide) return result(toLines(markdown));
  const lines = toLines(markdown);
  const [from, to] = bounds(slide);
  const clearing = !layout || layout === 'auto';

  for (let i = from; i <= to && i < lines.length; i++) {
    const m = lines[i].match(DIRECTIVE_RE);
    if (!m) continue;
    const body = m[1] || '';
    const without = body.replace(/\blayout\s*=\s*(?:"[^"]*"|'[^']*'|[^\s]+)/i, '').replace(/\s+/g, ' ').trim();
    const next = clearing ? without : `${without} layout=${layout}`.trim();
    if (!next) {
      lines.splice(i, 1);
      tidyJunction(lines, i);
    } else {
      lines[i] = `<!-- slide: ${next} -->`;
    }
    return result(lines, Math.min(i + 1, lines.length));
  }

  if (clearing) return result(lines, from + 1);

  // No directive yet — add one just below the heading so it reads as the
  // slide's own metadata rather than floating above the title.
  const heading = slide.blocks.find((b) => b.kind === 'heading');
  const at = heading ? heading.toLine : from + 1;
  lines.splice(at, 0, '', `<!-- slide: layout=${layout} -->`);
  return result(lines, at + 2);
}

// ─── Speaker notes ───────────────────────────────────────────────────────

// Wraps lines [fromLine, toLine] (1-based, inclusive) in a notes comment, or
// unwraps them when they already are one.
export function toggleNotes(markdown, fromLine, toLine) {
  const lines = toLines(markdown);
  const from = Math.max(0, (fromLine || 1) - 1);
  const to = Math.max(from, Math.min(lines.length - 1, (toLine || fromLine || 1) - 1));

  const opensNotes = /^\s*<!--\s*notes\b/i.test(lines[from] || '');
  const closesNotes = /-->\s*$/.test(lines[to] || '');
  if (opensNotes && closesNotes && to > from) {
    // Selection is the whole block: drop the wrapper lines, keeping the body.
    lines.splice(to, 1);
    lines.splice(from, 1);
    return result(lines, from + 1);
  }

  // Already inside a notes block? Then leave the text alone — wrapping again
  // would nest comments, which HTML doesn't support.
  for (let i = from; i >= 0; i--) {
    if (/-->/.test(lines[i]) && i < from) break;
    if (/^\s*<!--\s*notes\b/i.test(lines[i])) return result(lines, from + 1);
  }

  lines.splice(to + 1, 0, '-->');
  lines.splice(from, 0, '<!-- notes');
  return result(lines, from + 2);
}
