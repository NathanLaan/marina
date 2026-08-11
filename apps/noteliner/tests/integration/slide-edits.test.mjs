// Slide-edit unit tests.
//
// These functions rewrite the user's note, so the bar is high: every case
// re-parses the result and asserts the deck came out the way it should, rather
// than asserting on exact strings that would break on cosmetic changes.
//
// Run: node tests/integration/slide-edits.test.mjs

import { parseDeck } from '../../src/renderer/lib/slides.js';
import {
  insertSlide,
  duplicateSlide,
  deleteSlide,
  reorderSlide,
  moveSlide,
  mergeIntoPrevious,
  splitAtLine,
  retitleSlide,
  setSlideLayout,
  toggleNotes,
} from '../../src/renderer/lib/slideEdits.js';

let passed = 0, failed = 0;
const failures = [];

function assert(name, ok, detail) {
  if (ok) { console.log(`  PASS  ${name}`); passed++; }
  else {
    console.log(`  FAIL  ${name}${detail ? '\n        ' + detail : ''}`);
    failed++; failures.push(name);
  }
}

function assertEq(name, actual, expected) {
  if (actual === expected) assert(name, true);
  else assert(name, false, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function assertDeep(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) assert(name, true);
  else assert(name, false, `expected ${e}, got ${a}`);
}

function section(title) { console.log(`\n${title}`); }

const HEADING_CFG = { slideLevel: 2 };
const SEP_CFG = { slideLevel: 0 };

const deckOf = (md, cfg = HEADING_CFG) => parseDeck(md, cfg);
const titlesOf = (md, cfg = HEADING_CFG) => deckOf(md, cfg).slides.map((s) => s.title);
const countOf = (md, cfg = HEADING_CFG) => deckOf(md, cfg).slides.length;

// Heading-break deck: the common case.
const HEADINGS = `## Alpha

First body.

## Beta

Second body.

## Gamma

Third body.
`;

// Separator-only deck: the awkward case, where boundaries are their own lines.
const SEPARATORS = `Alpha body

---

Beta body

---

Gamma body
`;

// Text bodies stay recognisable so reordering can be checked by content.
const bodyOf = (md, index, cfg = HEADING_CFG) => {
  const slide = deckOf(md, cfg).slides[index - 1];
  return slide.blocks.filter((b) => b.kind !== 'heading').map((b) => b.text).join('\n');
};

// ─── Inserting ───────────────────────────────────────────────────────────

section('insertSlide');
{
  const deck = deckOf(HEADINGS);
  const r = insertSlide(HEADINGS, deck, { after: 1, title: 'New One' });
  assertEq('slide count grows', countOf(r.markdown), 4);
  assertDeep('inserted in position 2', titlesOf(r.markdown), ['Alpha', 'New One', 'Beta', 'Gamma']);
  assertEq('caret lands on the new heading',
    r.markdown.split('\n')[r.caretLine - 1].trim(), '## New One');

  const first = insertSlide(HEADINGS, deck, { after: 0, title: 'Zero' });
  assertDeep('after:0 inserts first', titlesOf(first.markdown), ['Zero', 'Alpha', 'Beta', 'Gamma']);

  const last = insertSlide(HEADINGS, deck, { after: 3, title: 'Omega' });
  assertDeep('after:last appends', titlesOf(last.markdown), ['Alpha', 'Beta', 'Gamma', 'Omega']);

  const withBody = insertSlide(HEADINGS, deck, { after: 1, title: 'Body', body: '- one\n- two' });
  assertEq('body content lands on the new slide', bodyOf(withBody.markdown, 2), '- one\n- two');

  // Separator decks: a heading alone wouldn't break, so a `---` must appear.
  const sepDeck = deckOf(SEPARATORS, SEP_CFG);
  const sep = insertSlide(SEPARATORS, sepDeck, { after: 1, title: 'Inserted' });
  assertEq('separator deck gains a slide', countOf(sep.markdown, SEP_CFG), 4);
  assertEq('separator deck keeps its own slides intact',
    bodyOf(sep.markdown, 1, SEP_CFG), 'Alpha body');
  assertEq('inserted slide is its own slide',
    deckOf(sep.markdown, SEP_CFG).slides[1].title, 'Inserted');
  assertEq('following slide is still separate',
    bodyOf(sep.markdown, 3, SEP_CFG), 'Beta body');
}

section('duplicateSlide');
{
  const r = duplicateSlide(HEADINGS, deckOf(HEADINGS), 2);
  assertDeep('copy lands after the original',
    titlesOf(r.markdown), ['Alpha', 'Beta', 'Beta', 'Gamma']);
  assertEq('copy carries the body', bodyOf(r.markdown, 3), 'Second body.');

  const sep = duplicateSlide(SEPARATORS, deckOf(SEPARATORS, SEP_CFG), 2);
  assertEq('separator deck duplicate keeps slide count consistent',
    countOf(sep.markdown, SEP_CFG), 4);
  assertEq('separator duplicate has the same body',
    bodyOf(sep.markdown, 3, SEP_CFG), 'Beta body');
}

// ─── Removing ────────────────────────────────────────────────────────────

section('deleteSlide');
{
  const mid = deleteSlide(HEADINGS, deckOf(HEADINGS), 2);
  assertDeep('middle slide removed', titlesOf(mid.markdown), ['Alpha', 'Gamma']);
  assert('deleted body is gone', !mid.markdown.includes('Second body'));

  const first = deleteSlide(HEADINGS, deckOf(HEADINGS), 1);
  assertDeep('first slide removed', titlesOf(first.markdown), ['Beta', 'Gamma']);

  const last = deleteSlide(HEADINGS, deckOf(HEADINGS), 3);
  assertDeep('last slide removed', titlesOf(last.markdown), ['Alpha', 'Beta']);

  const sep = deleteSlide(SEPARATORS, deckOf(SEPARATORS, SEP_CFG), 2);
  assertEq('separator deck drops to two slides', countOf(sep.markdown, SEP_CFG), 2);
  assertDeep('remaining separator slides are the right ones',
    [bodyOf(sep.markdown, 1, SEP_CFG), bodyOf(sep.markdown, 2, SEP_CFG)],
    ['Alpha body', 'Gamma body']);

  const only = deleteSlide('## Solo\n\nBody\n', deckOf('## Solo\n\nBody\n'), 1);
  assertEq('deleting the only slide leaves an empty note', only.markdown.trim(), '');

  const bad = deleteSlide(HEADINGS, deckOf(HEADINGS), 99);
  assertEq('out-of-range index is a no-op', bad.markdown, HEADINGS);
}

// ─── Reordering ──────────────────────────────────────────────────────────

section('reorderSlide / moveSlide');
{
  const up = moveSlide(HEADINGS, deckOf(HEADINGS), 2, 'up');
  assertDeep('move up swaps with the previous slide',
    titlesOf(up.markdown), ['Beta', 'Alpha', 'Gamma']);
  assertEq('moved slide keeps its body', bodyOf(up.markdown, 1), 'Second body.');
  assertEq('displaced slide keeps its body', bodyOf(up.markdown, 2), 'First body.');

  const down = moveSlide(HEADINGS, deckOf(HEADINGS), 2, 'down');
  assertDeep('move down swaps with the next slide',
    titlesOf(down.markdown), ['Alpha', 'Gamma', 'Beta']);

  const noop = moveSlide(HEADINGS, deckOf(HEADINGS), 1, 'up');
  assertDeep('move up from the top is a no-op', titlesOf(noop.markdown), ['Alpha', 'Beta', 'Gamma']);
  const noop2 = moveSlide(HEADINGS, deckOf(HEADINGS), 3, 'down');
  assertDeep('move down from the bottom is a no-op', titlesOf(noop2.markdown), ['Alpha', 'Beta', 'Gamma']);

  const toFront = reorderSlide(HEADINGS, deckOf(HEADINGS), 3, 1);
  assertDeep('drag last to first', titlesOf(toFront.markdown), ['Gamma', 'Alpha', 'Beta']);
  assertEq('bodies follow their slides', bodyOf(toFront.markdown, 1), 'Third body.');

  const toBack = reorderSlide(HEADINGS, deckOf(HEADINGS), 1, 3);
  assertDeep('drag first to last', titlesOf(toBack.markdown), ['Beta', 'Gamma', 'Alpha']);

  // The case that breaks naive implementations: separator boundaries live on
  // their own lines, so moving the last slide to the front must not leave a
  // dangling `---` at EOF or fuse two slides.
  const sepFront = reorderSlide(SEPARATORS, deckOf(SEPARATORS, SEP_CFG), 3, 1);
  assertEq('separator deck keeps three slides', countOf(sepFront.markdown, SEP_CFG), 3);
  assertDeep('separator reorder moves the right content',
    deckOf(sepFront.markdown, SEP_CFG).slides.map((s, i) => bodyOf(sepFront.markdown, i + 1, SEP_CFG)),
    ['Gamma body', 'Alpha body', 'Beta body']);
  assert('no trailing separator left at EOF',
    !/---\s*$/.test(sepFront.markdown.trimEnd()));

  const sepBack = reorderSlide(SEPARATORS, deckOf(SEPARATORS, SEP_CFG), 1, 3);
  assertEq('separator deck still three after moving first to last',
    countOf(sepBack.markdown, SEP_CFG), 3);
  assertDeep('separator move-to-end content order',
    [1, 2, 3].map((i) => bodyOf(sepBack.markdown, i, SEP_CFG)),
    ['Beta body', 'Gamma body', 'Alpha body']);

  const single = reorderSlide('## Solo\n\nX\n', deckOf('## Solo\n\nX\n'), 1, 1);
  assertEq('single-slide reorder is a no-op', single.markdown, '## Solo\n\nX\n');
}

// ─── Merge and split ─────────────────────────────────────────────────────

section('mergeIntoPrevious');
{
  const r = mergeIntoPrevious(HEADINGS, deckOf(HEADINGS), 2);
  assertDeep('merged slide disappears', titlesOf(r.markdown), ['Alpha', 'Gamma']);
  assert('merged heading survives as content, demoted', r.markdown.includes('### Beta'));
  assertEq('merged content joins the previous slide',
    countOf(r.markdown), 2);
  assert('body text is preserved', r.markdown.includes('Second body.'));

  const first = mergeIntoPrevious(HEADINGS, deckOf(HEADINGS), 1);
  assertEq('merging the first slide is a no-op', first.markdown, HEADINGS);

  const sep = mergeIntoPrevious(SEPARATORS, deckOf(SEPARATORS, SEP_CFG), 2);
  assertEq('separator merge drops a slide', countOf(sep.markdown, SEP_CFG), 2);
  assert('both bodies now share a slide',
    bodyOf(sep.markdown, 1, SEP_CFG).includes('Alpha body')
    && bodyOf(sep.markdown, 1, SEP_CFG).includes('Beta body'));

  // The title/subtitle case from the Phase 1 review: merge is the one-click fix.
  const sub = '# Title\n\n## Subtitle\n\nBody\n';
  assertEq('title + subtitle starts as two slides', countOf(sub), 2);
  const merged = mergeIntoPrevious(sub, deckOf(sub), 2);
  assertEq('merge fixes it in one step', countOf(merged.markdown), 1);
  assert('subtitle text survives', merged.markdown.includes('Subtitle'));
}

section('splitAtLine');
{
  const md = '## Alpha\n\nFirst para.\n\nSecond para.\n';
  const r = splitAtLine(md, deckOf(md), 5);   // the "Second para." line
  assertEq('split makes two slides', countOf(r.markdown), 2);
  assertEq('content before the split stays put', bodyOf(r.markdown, 1), 'First para.');
  assertEq('content after the split moves down', bodyOf(r.markdown, 2), 'Second para.');
  assertEq('caret follows the moved content',
    r.markdown.split('\n')[r.caretLine - 1], 'Second para.');

  const atHeading = splitAtLine(HEADINGS, deckOf(HEADINGS), 5);
  assertEq('splitting at an existing boundary changes nothing',
    countOf(atHeading.markdown), 3);

  const atTop = splitAtLine(md, deckOf(md), 1);
  assertEq('splitting at line 1 changes nothing', atTop.markdown, md);
}

// ─── Slide properties ────────────────────────────────────────────────────

section('retitleSlide');
{
  const r = retitleSlide(HEADINGS, deckOf(HEADINGS), 2, 'Renamed');
  assertDeep('title changes', titlesOf(r.markdown), ['Alpha', 'Renamed', 'Gamma']);
  assertEq('heading level is preserved', deckOf(r.markdown).slides[1].headingLevel, 2);
  assertEq('body untouched', bodyOf(r.markdown, 2), 'Second body.');

  // A slide with no heading gains one at slideLevel.
  const noHead = retitleSlide(SEPARATORS, deckOf(SEPARATORS, SEP_CFG), 2, 'Given a name');
  assertEq('titling a headless slide keeps the slide count',
    countOf(noHead.markdown, SEP_CFG), 3);
  assertEq('headless slide now has a title',
    deckOf(noHead.markdown, SEP_CFG).slides[1].title, 'Given a name');
  assertEq('its body survives', bodyOf(noHead.markdown, 2, SEP_CFG), 'Beta body');

  // Setext heading: no `#` to preserve, so only the text line is rewritten.
  const setext = 'Alpha\n---\n\nBody\n';
  const re = retitleSlide(setext, deckOf(setext), 1, 'Changed');
  assertEq('setext heading retitles', deckOf(re.markdown).slides[0].title, 'Changed');
  assertEq('setext underline still makes it a heading',
    deckOf(re.markdown).slides[0].headingLevel, 2);
}

section('setSlideLayout');
{
  const r = setSlideLayout(HEADINGS, deckOf(HEADINGS), 2, 'split');
  assertEq('layout directive applied', deckOf(r.markdown).slides[1].layout, 'split');
  assertEq('slide count unchanged', countOf(r.markdown), 3);
  assertEq('other slides unaffected', deckOf(r.markdown).slides[0].layout, 'title-body');

  const changed = setSlideLayout(r.markdown, deckOf(r.markdown), 2, 'grid');
  assertEq('existing directive is rewritten, not duplicated',
    deckOf(changed.markdown).slides[1].layout, 'grid');
  assertEq('only one directive line exists',
    (changed.markdown.match(/<!-- slide:/g) || []).length, 1);

  const cleared = setSlideLayout(changed.markdown, deckOf(changed.markdown), 2, 'auto');
  assertEq('clearing returns to inferred layout',
    deckOf(cleared.markdown).slides[1].layout, 'title-body');
  assertEq('empty directive line is removed',
    (cleared.markdown.match(/<!-- slide:/g) || []).length, 0);

  // Other directive keys survive a layout change.
  const withBg = '## A\n\n<!-- slide: bg=#101418 -->\n\nBody\n';
  const kept = setSlideLayout(withBg, deckOf(withBg), 1, 'quote');
  assertEq('unrelated directive keys survive', deckOf(kept.markdown).slides[0].directives.bg, '#101418');
  assertEq('layout applied alongside', deckOf(kept.markdown).slides[0].layout, 'quote');
}

// ─── Speaker notes ───────────────────────────────────────────────────────

section('toggleNotes');
{
  const md = '## A\n\nVisible line\n\nSpoken line\n';
  const r = toggleNotes(md, 5, 5);
  const deck = deckOf(r.markdown);
  assertEq('wrapped text becomes speaker notes', deck.slides[0].notes, 'Spoken line');
  assert('wrapped text leaves the visible blocks',
    !deck.slides[0].blocks.some((b) => b.text.includes('Spoken line')));
  assertEq('visible content is untouched', bodyOf(r.markdown, 1), 'Visible line');

  const multi = toggleNotes('## A\n\nOne\nTwo\n', 3, 4);
  assertEq('multi-line wrap captures both lines', deckOf(multi.markdown).slides[0].notes, 'One\nTwo');

  // Unwrapping: select the whole block including its wrapper lines.
  const wrapped = '## A\n\n<!-- notes\nSpoken\n-->\n';
  const un = toggleNotes(wrapped, 3, 5);
  assertEq('unwrap removes the notes block', deckOf(un.markdown).slides[0].notes, '');
  assert('unwrapped text returns to visible content',
    deckOf(un.markdown).slides[0].blocks.some((b) => b.text.includes('Spoken')));

  // Guard against nesting comments, which HTML can't express.
  const inside = toggleNotes(wrapped, 4, 4);
  assertEq('wrapping inside an existing notes block is a no-op', inside.markdown, wrapped);
}

// ─── Round-trip safety ───────────────────────────────────────────────────

section('round-trip safety');
{
  // A sequence of edits must never lose content or corrupt the deck.
  let md = HEADINGS;
  md = insertSlide(md, deckOf(md), { after: 3, title: 'Delta', body: 'Fourth body.' }).markdown;
  md = moveSlide(md, deckOf(md), 4, 'up').markdown;
  md = retitleSlide(md, deckOf(md), 3, 'Delta Prime').markdown;
  md = duplicateSlide(md, deckOf(md), 1).markdown;
  md = deleteSlide(md, deckOf(md), 2).markdown;
  md = setSlideLayout(md, deckOf(md), 2, 'split').markdown;

  const deck = deckOf(md);
  assertEq('deck survives a chain of edits', deck.slides.length, 4);
  assertDeep('titles are as expected',
    deck.slides.map((s) => s.title), ['Alpha', 'Beta', 'Delta Prime', 'Gamma']);
  assert('no content was lost', md.includes('Fourth body.') && md.includes('Third body.'));
  assert('no run of three blank lines crept in', !/\n\n\n\n/.test(md));

  // Same for a separator deck, where boundaries are fragile.
  // insert Mid after 2 → [Alpha, Beta, Mid, Gamma]
  // move 1 down        → [Beta, Alpha, Mid, Gamma]
  // delete 1           → [Alpha, Mid, Gamma]   (Beta is gone, by design)
  let sep = SEPARATORS;
  sep = insertSlide(sep, deckOf(sep, SEP_CFG), { after: 2, title: 'Mid' }).markdown;
  sep = moveSlide(sep, deckOf(sep, SEP_CFG), 1, 'down').markdown;
  sep = deleteSlide(sep, deckOf(sep, SEP_CFG), 1).markdown;
  const sepDeck = deckOf(sep, SEP_CFG);
  assertEq('separator deck survives a chain of edits', sepDeck.slides.length, 3);
  assertDeep('separator deck holds exactly the surviving slides',
    sepDeck.slides.map((s) => s.title ?? bodyOf(sep, s.index, SEP_CFG)),
    ['Alpha body', 'Mid', 'Gamma body']);
  assert('deleted slide is really gone', !sep.includes('Beta body'));
  assert('separator deck has no blank-line churn', !/\n\n\n/.test(sep));
  assert('separator deck does not start with a blank line', !/^\n/.test(sep));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
