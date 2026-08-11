// Deck parser unit tests.
//
// Exercises src/renderer/lib/slides.js directly — it is deliberately DOM-free
// and dependency-free, so it runs under plain Node with no Electron, no Vite,
// and no browser. ESM (.mjs) because the renderer sources are ESM while the
// rest of tests/integration/ is CommonJS.
//
// Run: node tests/integration/slides-parser.test.mjs

import {
  parseDeck,
  normalizePresentation,
  stageSize,
  substitute,
  slideAtLine,
  estimateDuration,
  DEFAULT_PRESENTATION,
} from '../../src/renderer/lib/slides.js';

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
  const ok = actual === expected;
  if (ok) assert(name, true);
  else assert(name, false, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function assertDeep(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) assert(name, true);
  else assert(name, false, `expected ${e}, got ${a}`);
}

function section(title) {
  console.log(`\n${title}`);
}

const deckOf = (md, cfg = { slideLevel: 2 }) => parseDeck(md, cfg);
const kinds = (slide) => slide.blocks.map((b) => b.kind);
const titles = (deck) => deck.slides.map((s) => s.title);
const layouts = (deck) => deck.slides.map((s) => s.layout);

// ─── Config ──────────────────────────────────────────────────────────────

section('presentation config');
{
  assertEq('absent presentation → null (note is not a deck)', normalizePresentation(undefined), null);
  assertEq('null presentation → null', normalizePresentation(null), null);
  assertEq('false presentation → null', normalizePresentation(false), null);

  const shorthand = normalizePresentation(true);
  assertDeep('presentation: true → defaults', shorthand, DEFAULT_PRESENTATION);

  const cfg = normalizePresentation({ theme: 'light', aspect: '4:3', slideLevel: 3, slideNumbers: false });
  assertEq('theme honoured', cfg.theme, 'light');
  assertEq('aspect honoured', cfg.aspect, '4:3');
  assertEq('slideLevel honoured', cfg.slideLevel, 3);
  assertEq('slideNumbers honoured', cfg.slideNumbers, false);

  const bad = normalizePresentation({ aspect: '21:9', slideLevel: 99, theme: '   ' });
  assertEq('unknown aspect falls back', bad.aspect, '16:9');
  assertEq('out-of-range slideLevel falls back', bad.slideLevel, 2);
  assertEq('blank theme falls back', bad.theme, 'dark');

  const strLevel = normalizePresentation({ slideLevel: '1' });
  assertEq('numeric-string slideLevel accepted (YAML quirk)', strLevel.slideLevel, 1);

  const zero = normalizePresentation({ slideLevel: 0 });
  assertEq('slideLevel 0 preserved (separator-only mode)', zero.slideLevel, 0);

  assertDeep('stageSize 16:9', stageSize('16:9'), { w: 1920, h: 1080 });
  assertDeep('stageSize unknown falls back to 16:9', stageSize('nope'), { w: 1920, h: 1080 });

  assertEq('substitute fills known placeholders',
    substitute('{{name}} — {{page}}/{{total}}', { name: 'Q3', page: 2, total: 9 }), 'Q3 — 2/9');
  assertEq('substitute leaves unknown placeholders alone',
    substitute('{{nope}}', { name: 'x' }), '{{nope}}');
}

// ─── Heading-driven splitting ────────────────────────────────────────────

section('heading-driven splitting');
{
  const md = [
    '# Q3 Review',
    '',
    'Framing paragraph.',
    '',
    '## Revenue',
    '',
    '- Up 12% YoY',
    '- Churn flat',
    '',
    '## Next quarter',
    '',
    'Two bets.',
  ].join('\n');

  const deck = deckOf(md);
  assertEq('three slides', deck.slides.length, 3);
  assertDeep('titles from headings', titles(deck), ['Q3 Review', 'Revenue', 'Next quarter']);
  assertDeep('indices are 1-based and contiguous', deck.slides.map((s) => s.index), [1, 2, 3]);
  assertDeep('slide 2 blocks', kinds(deck.slides[1]), ['heading', 'list']);
  assertEq('heading level captured', deck.slides[1].headingLevel, 2);
  assertEq('list block keeps both items', deck.slides[1].blocks[1].text, '- Up 12% YoY\n- Churn flat');

  // The whole premise of the plan: an ordinary note is already a deck.
  assertDeep('source ranges are 1-based and cover the note',
    deck.slides.map((s) => [s.sourceRange.fromLine, s.sourceRange.toLine]),
    [[1, 4], [5, 9], [10, 12]]);

  const deeper = parseDeck(md, { slideLevel: 1 });
  assertEq('slideLevel 1 only breaks on H1', deeper.slides.length, 1);
  assertDeep('slideLevel 1 keeps H2s as content',
    kinds(deeper.slides[0]), ['heading', 'para', 'heading', 'list', 'heading', 'para']);

  const none = parseDeck(md, { slideLevel: 0 });
  assertEq('slideLevel 0 disables heading breaks', none.slides.length, 1);
}

// ─── Separator splitting ─────────────────────────────────────────────────

section('--- separators');
{
  const deck = deckOf('First slide\n\n---\n\nSecond slide\n', { slideLevel: 0 });
  assertEq('separator splits', deck.slides.length, 2);
  assertEq('separator line is not content', deck.slides[0].blocks.length, 1);
  assertEq('first slide text', deck.slides[0].blocks[0].text, 'First slide');
  assertEq('second slide text', deck.slides[1].blocks[0].text, 'Second slide');

  const leading = deckOf('---\n\nOnly slide\n', { slideLevel: 0 });
  assertEq('leading separator makes no empty slide', leading.slides.length, 1);

  const trailing = deckOf('Only slide\n\n---\n', { slideLevel: 0 });
  assertEq('trailing separator makes no empty slide', trailing.slides.length, 1);

  const long = deckOf('A\n\n-----\n\nB\n', { slideLevel: 0 });
  assertEq('longer rules also separate', long.slides.length, 2);
}

// ─── Setext headings must not be read as separators ───────────────────────

section('setext headings');
{
  const deck = deckOf('Revenue\n---\n\nUp 12%\n');
  assertEq('setext underline is not a separator', deck.slides.length, 1);
  assertDeep('setext line becomes a heading block', kinds(deck.slides[0]), ['heading', 'para']);
  assertEq('setext heading text', deck.slides[0].title, 'Revenue');
  assertEq('setext heading level', deck.slides[0].headingLevel, 2);

  const two = deckOf('Revenue\n---\n\nUp 12%\n\nChurn\n---\n\nFlat\n');
  assertEq('two setext sections → two slides', two.slides.length, 2);
  assertDeep('setext titles', titles(two), ['Revenue', 'Churn']);
}

// ─── Fenced code is literal ──────────────────────────────────────────────

section('fenced code');
{
  const md = [
    '## Config',
    '',
    '```yaml',
    '# not a heading',
    '---',
    'key: value',
    '```',
    '',
    'After the fence.',
  ].join('\n');

  const deck = deckOf(md);
  assertEq('fence contents do not split slides', deck.slides.length, 1);
  assertDeep('fence is one code block', kinds(deck.slides[0]), ['heading', 'code', 'para']);
  const code = deck.slides[0].blocks[1];
  assert('code block keeps its interior lines', code.text.includes('# not a heading') && code.text.includes('---'));

  const tilde = deckOf('## T\n\n~~~\n---\n~~~\n');
  assertEq('tilde fences also protect content', tilde.slides.length, 1);
}

// ─── Speaker notes ───────────────────────────────────────────────────────

section('speaker notes');
{
  const md = [
    '## Revenue',
    '',
    '- Up 12%',
    '',
    '<!-- notes',
    'Say the number slowly.',
    'Then pause.',
    '-->',
  ].join('\n');

  const deck = deckOf(md);
  assertEq('one slide', deck.slides.length, 1);
  assertDeep('notes are not visible blocks', kinds(deck.slides[0]), ['heading', 'list']);
  assertEq('multi-line notes captured', deck.slides[0].notes, 'Say the number slowly.\nThen pause.');

  const inline = deckOf('## A\n\n<!-- notes Say hi -->\n\nBody\n');
  assertEq('single-line notes captured', inline.slides[0].notes, 'Say hi');
  assertDeep('single-line notes leave content intact', kinds(inline.slides[0]), ['heading', 'para']);

  const two = deckOf('## A\n\n<!-- notes One -->\n\nBody\n\n<!-- notes Two -->\n');
  assertEq('multiple note blocks join', two.slides[0].notes, 'One\n\nTwo');

  const perSlide = deckOf('## A\n\n<!-- notes For A -->\n\n## B\n\n<!-- notes For B -->\n');
  assertDeep('notes attach to their own slide',
    perSlide.slides.map((s) => s.notes), ['For A', 'For B']);

  const unterminated = deckOf('## A\n\n<!-- notes\nRuns to the end\n');
  assertEq('unterminated notes block still parses', unterminated.slides[0].notes, 'Runs to the end');

  const skipped = deckOf('## A\n\nVisible\n\n<!-- skip\nBackground detail.\n-->\n');
  assertDeep('skip blocks leave the deck', kinds(skipped.slides[0]), ['heading', 'para']);
  assertEq('skip content is not notes', skipped.slides[0].notes, '');

  const inFence = deckOf('## A\n\n```\n<!-- notes not really -->\n```\n');
  assertEq('note syntax inside a fence stays literal', inFence.slides[0].notes, '');
}

// ─── Directives ──────────────────────────────────────────────────────────

section('slide directives');
{
  const deck = deckOf('## A\n\n<!-- slide: layout=split bg=#101418 class="big quote" -->\n\nOne\n\nTwo\n');
  assertEq('layout directive wins', deck.slides[0].layout, 'split');
  assertEq('bg directive parsed', deck.slides[0].directives.bg, '#101418');
  assertEq('quoted value parsed', deck.slides[0].directives.class, 'big quote');

  const auto = deckOf('## A\n\n<!-- slide: layout=auto -->\n\nOne\n');
  assertEq('layout=auto defers to inference', auto.slides[0].layout, 'title-body');

  const bogus = deckOf('## A\n\n<!-- slide: layout=nonsense -->\n\nOne\n');
  assertEq('unknown layout ignored', bogus.slides[0].layout, 'title-body');

  const notesOnly = deckOf('## A\n\nKeep\n\n## B\n\n<!-- slide: notes-only -->\n\nDrop\n\n## C\n\nKeep\n');
  assertEq('notes-only slide leaves the deck', notesOnly.slides.length, 2);
  assertEq('skipped count reported', notesOnly.skipped, 1);
  assertDeep('remaining slides renumber', notesOnly.slides.map((s) => s.index), [1, 2]);
  assertDeep('right slides survive', titles(notesOnly), ['A', 'C']);
}

// ─── Block classification ────────────────────────────────────────────────

section('block kinds');
{
  const img = deckOf('## A\n\n![Chart](_attachments/chart.png)\n');
  assertEq('image detected', img.slides[0].blocks[1].kind, 'image');
  assertEq('image src captured', img.slides[0].blocks[1].src, '_attachments/chart.png');
  assertEq('image alt captured', img.slides[0].blocks[1].alt, 'Chart');

  const vid = deckOf('## A\n\n![clip](demo.mp4)\n');
  assertEq('video by extension', vid.slides[0].blocks[1].kind, 'video');

  const yt = deckOf('## A\n\nhttps://www.youtube.com/watch?v=abc123\n');
  assertEq('youtube link is a video block', yt.slides[0].blocks[1].kind, 'video');

  const table = deckOf('## A\n\n| Q | Rev |\n|---|----:|\n| 1 | 10 |\n');
  assertEq('table detected', table.slides[0].blocks[1].kind, 'table');

  const quote = deckOf('## A\n\n> Ship it.\n');
  assertEq('quote detected', quote.slides[0].blocks[1].kind, 'quote');

  const ordered = deckOf('## A\n\n1. First\n2. Second\n');
  assertEq('ordered list detected', ordered.slides[0].blocks[1].kind, 'list');

  const task = deckOf('## A\n\n- [ ] Todo\n- [x] Done\n');
  assertEq('task list detected', task.slides[0].blocks[1].kind, 'list');

  const math = deckOf('## A\n\n$$\nx = y\n$$\n');
  assertEq('math block detected', math.slides[0].blocks[1].kind, 'math');

  const para = deckOf('## A\n\nJust words.\n');
  assertEq('paragraph fallback', para.slides[0].blocks[1].kind, 'para');

  const wrapped = deckOf('## A\n\nOne line\nand its continuation\n');
  assertEq('wrapped paragraph is one block', wrapped.slides[0].blocks.length, 2);
  assertEq('wrapped paragraph keeps both lines',
    wrapped.slides[0].blocks[1].text, 'One line\nand its continuation');

  const inlineImg = deckOf('## A\n\nSee ![x](y.png) inline.\n');
  assertEq('inline image stays a paragraph', inlineImg.slides[0].blocks[1].kind, 'para');
}

// ─── Layout inference ────────────────────────────────────────────────────

section('layout inference');
{
  assertEq('heading only → hero', deckOf('# Just a title\n').slides[0].layout, 'hero');
  assertEq('title + one block → title-body', deckOf('## A\n\nBody\n').slides[0].layout, 'title-body');
  assertEq('title + two blocks → split', deckOf('## A\n\nOne\n\nTwo\n').slides[0].layout, 'split');
  assertEq('title + three blocks → grid', deckOf('## A\n\nOne\n\nTwo\n\nThree\n').slides[0].layout, 'grid');
  assertEq('image alone → full-bleed', deckOf('## _\n\n![x](y.png)\n', { slideLevel: 0 }).slides[0].layout, 'title-body');
  assertEq('bare image, no heading → full-bleed',
    deckOf('![x](y.png)\n', { slideLevel: 0 }).slides[0].layout, 'full-bleed');
  assertEq('quote alone → quote', deckOf('> Ship it.\n', { slideLevel: 0 }).slides[0].layout, 'quote');
  assertEq('table alone → table',
    deckOf('| a | b |\n|---|---|\n| 1 | 2 |\n', { slideLevel: 0 }).slides[0].layout, 'table');
  assertEq('paragraph alone → hero', deckOf('Just words.\n', { slideLevel: 0 }).slides[0].layout, 'hero');

  const title = deckOf('# Q3 Review\n\nA subtitle line.\n\n## Next\n\nBody\n');
  assertEq('leading H1 + subtitle → hero title slide', title.slides[0].layout, 'hero');
  const noTitle = parseDeck('# Q3 Review\n\nA subtitle line.\n\n## Next\n\nBody\n',
    { slideLevel: 2, firstSlideTitle: false });
  assertEq('firstSlideTitle off → ordinary layout', noTitle.slides[0].layout, 'title-body');
  assertEq('firstSlideTitle never changes slide count', noTitle.slides.length, title.slides.length);
}

// ─── Frontmatter tolerance ───────────────────────────────────────────────

section('frontmatter');
{
  const withFm = deckOf('---\nid: abc\npresentation:\n  slideLevel: 2\n---\n\n## A\n\nBody\n');
  assertEq('leading YAML skipped, not read as a separator', withFm.slides.length, 1);
  assertEq('first slide is the real content', withFm.slides[0].title, 'A');

  // The dangerous case: a body that legitimately opens with a separator must
  // not have everything up to the next `---` swallowed as frontmatter.
  const notFm = deckOf('---\n\nReal content\n\n---\n\nMore content\n', { slideLevel: 0 });
  assertEq('leading separator is not mistaken for frontmatter', notFm.slides.length, 2);
  assertEq('no content lost', notFm.slides[0].blocks[0].text, 'Real content');

  // Unterminated frontmatter is treated as body — the same reading gray-matter
  // gives it. Nothing is discarded, so the stray YAML shows up as content
  // rather than the note being silently truncated.
  const unterminated = deckOf('---\nid: abc\n\n## A\n');
  assertEq('unterminated frontmatter keeps the real heading', unterminated.slides.at(-1).title, 'A');
  assert('unterminated frontmatter loses no content',
    unterminated.slides.some((s) => s.blocks.some((b) => b.text.includes('id: abc'))));
}

// ─── UI helpers ──────────────────────────────────────────────────────────

section('UI helpers');
{
  const deck = deckOf('# One\n\nA\n\n## Two\n\nB\n\n## Three\n\nC\n');
  assertEq('caret in slide 1', slideAtLine(deck, 1)?.title, 'One');
  assertEq('caret in slide 2', slideAtLine(deck, 6)?.title, 'Two');
  assertEq('caret in slide 3', slideAtLine(deck, 10)?.title, 'Three');
  assertEq('caret past the end clamps to last slide', slideAtLine(deck, 999)?.title, 'Three');
  assertEq('no caret → null', slideAtLine(deck, 0), null);
  assertEq('empty deck → null', slideAtLine(parseDeck('', {}), 3), null);

  const est = estimateDuration(deckOf('## A\n\nOne two three four five\n\n<!-- notes six seven -->\n'));
  assertEq('duration counts visible + notes words', est.words, 8);
  assert('duration in minutes is derived', Math.abs(est.minutes - 8 / 130) < 1e-9);
}

// ─── Degenerate input ────────────────────────────────────────────────────

section('degenerate input');
{
  assertEq('empty string → no slides', parseDeck('', {}).slides.length, 0);
  assertEq('whitespace only → no slides', parseDeck('\n\n   \n', {}).slides.length, 0);
  assertEq('null → no slides', parseDeck(null, {}).slides.length, 0);
  assertEq('undefined config still parses', parseDeck('# A\n').slides.length, 1);
  assertEq('CRLF handled', deckOf('## A\r\n\r\nBody\r\n').slides.length, 1);
  assertEq('CRLF strips carriage returns',
    deckOf('## A\r\n\r\nBody\r\n').slides[0].blocks[1].text, 'Body');
  assertEq('notes-only everything → empty deck',
    deckOf('## A\n\n<!-- slide: notes-only -->\n\nX\n').slides.length, 0);
}

// ─── Summary ─────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
