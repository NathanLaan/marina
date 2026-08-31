// List-edit unit tests.
//
// These functions rewrite the user's note, so the cases that matter are the
// ones that aren't the flat happy path: blank lines inside a selection,
// pre-existing indentation, nested numbering, and the indent rules that decide
// whether a line can be nested at all.
//
// Run: node tests/integration/list-edits.test.mjs

import {
  toOrderedList,
  toUnorderedList,
  indentAsSubList,
  classifySpan,
} from '../../src/renderer/lib/listEdits.js';

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
  else assert(name, false, `expected ${e}\n        got      ${a}`);
}

// Run a transform over every line of `text` and return the result as text, so
// cases read as before/after documents rather than as array literals.
function ordered(text, from = 1, to = null) {
  const lines = text.split('\n');
  return toOrderedList(lines, from, to ?? lines.length).lines.join('\n');
}

function unordered(text, from = 1, to = null) {
  const lines = text.split('\n');
  return toUnorderedList(lines, from, to ?? lines.length).lines.join('\n');
}

// indentAsSubList returns only the one line it rewrote, so splice it back into
// the document the way Editor.svelte does — it replaces just that line's range.
function indent(text, line) {
  const lines = text.split('\n');
  const edit = indentAsSubList(lines, line);
  if (!edit.changed) return text;
  const out = lines.slice();
  out.splice(line - 1, 1, ...edit.lines);
  return out.join('\n');
}

function indentChanged(text, line) {
  return indentAsSubList(text.split('\n'), line).changed;
}

console.log('\nconvert — plain lines');
{
  assertEq('plain → ordered numbers 1..n',
    ordered('Alpha\nBeta\nGamma'),
    '1. Alpha\n2. Beta\n3. Gamma');

  assertEq('plain → unordered',
    unordered('Alpha\nBeta\nGamma'),
    '- Alpha\n- Beta\n- Gamma');

  assertEq('single line converts',
    unordered('Alpha'),
    '- Alpha');

  assertEq('a span narrower than the document only touches its own lines',
    unordered('Alpha\nBeta\nGamma', 2, 2),
    '- Beta');
}

console.log('\nconvert — between list kinds');
{
  assertEq('ordered → unordered swaps the marker, does not strip',
    unordered('1. Alpha\n2. Beta'),
    '- Alpha\n- Beta');

  assertEq('unordered → ordered swaps the marker, does not strip',
    ordered('- Alpha\n- Beta'),
    '1. Alpha\n2. Beta');

  assertEq('mixed markers convert rather than strip',
    unordered('1. Alpha\n- Beta\nGamma'),
    '- Alpha\n- Beta\n- Gamma');

  assertEq('a list plus a plain line converts rather than strips',
    ordered('1. Alpha\nBeta'),
    '1. Alpha\n2. Beta');
}

console.log('\ntoggle — strip when already that kind');
{
  assertEq('unordered on an unordered span strips',
    unordered('- Alpha\n- Beta'),
    'Alpha\nBeta');

  assertEq('ordered on an ordered span strips',
    ordered('1. Alpha\n2. Beta'),
    'Alpha\nBeta');

  assertEq('stripping keeps leading indentation',
    unordered('  - Alpha\n  - Beta'),
    '  Alpha\n  Beta');

  assertEq('round trip: convert then convert again is a no-op on the text',
    unordered(unordered('Alpha\nBeta')),
    'Alpha\nBeta');
}

console.log('\nmarker normalization');
{
  assertEq('* and + are recognized and normalized to -',
    unordered('* Alpha\n+ Beta'),
    'Alpha\nBeta');   // all unordered already → strip

  assertEq('* and + convert to ordered',
    ordered('* Alpha\n+ Beta'),
    '1. Alpha\n2. Beta');

  assertEq('N) is recognized as ordered and normalized to N.',
    ordered('1) Alpha\n2) Beta'),
    'Alpha\nBeta');   // all ordered already → strip

  assertEq('--- is not a list item',
    unordered('---'),
    '- ---');

  assertEq('-Alpha without a space is not a list item',
    unordered('-Alpha'),
    '- -Alpha');

  assertEq('an empty item is recognized and strips to nothing',
    unordered('-'),
    '');

  assertEq('converting an empty item leaves no trailing space',
    ordered('-'),
    '1.');
}

console.log('\nblank lines');
{
  assertEq('a blank line inside a selection stays blank',
    unordered('Alpha\n\nBeta'),
    '- Alpha\n\n- Beta');

  assertEq('a blank line consumes no ordinal',
    ordered('Alpha\n\nBeta\nGamma'),
    '1. Alpha\n\n2. Beta\n3. Gamma');

  assertEq('a whitespace-only line is left exactly as it was',
    unordered('Alpha\n   \nBeta'),
    '- Alpha\n   \n- Beta');

  assertDeep('an all-blank span reports no change',
    (() => { const r = toUnorderedList(['', '  ', ''], 1, 3); return [r.lines, r.changed]; })(),
    [['', '  ', ''], false]);
}

console.log('\nindentation');
{
  assertEq('leading indentation is preserved on convert',
    unordered('    Alpha'),
    '    - Alpha');

  assertEq('mixed indent levels keep their shape',
    unordered('Alpha\n  Beta\nGamma'),
    '- Alpha\n  - Beta\n- Gamma');

  assertEq('nested ordered numbering restarts per level',
    ordered('Alpha\n  Beta\n  Gamma\nDelta'),
    '1. Alpha\n  1. Beta\n  2. Gamma\n2. Delta');

  assertEq('returning to a level after a deeper one continues that level',
    ordered('A\n  B\nC\n  D'),
    '1. A\n  1. B\n2. C\n  1. D');

  assertEq('an already-nested list survives a marker change',
    unordered('1. Alpha\n   1. Beta\n   2. Gamma'),
    '- Alpha\n   - Beta\n   - Gamma');
}

console.log('\nclassifySpan');
{
  assertEq('all ordered', classifySpan(['1. A', '2. B'], 1, 2), 'ordered');
  assertEq('all unordered', classifySpan(['- A', '* B'], 1, 2), 'unordered');
  assertEq('no list items', classifySpan(['A', 'B'], 1, 2), 'none');
  assertEq('all blank', classifySpan(['', '  '], 1, 2), 'none');
  assertEq('two kinds', classifySpan(['1. A', '- B'], 1, 2), 'mixed');
  assertEq('a list plus a plain line', classifySpan(['- A', 'B'], 1, 2), 'mixed');
  assertEq('blank lines are ignored', classifySpan(['- A', '', '- B'], 1, 3), 'unordered');
}

console.log('\nindent as sub-list');
{
  assertEq('a plain line becomes a new unordered item',
    indent('Alpha', 1),
    '- Alpha');

  assertEq('a plain indented line keeps its indentation',
    indent('    Alpha', 1),
    '    - Alpha');

  assertEq('the second item nests under the first',
    indent('- Alpha\n- Beta', 2),
    '- Alpha\n  - Beta');

  assertEq('an ordered child indents to the parent content column, not 2',
    indent('1. Alpha\n2. Beta', 2),
    '1. Alpha\n   1. Beta');

  assertEq('an ordered child is renumbered to 1.',
    indent('1. Alpha\n2. Beta\n3. Gamma', 3),
    '1. Alpha\n2. Beta\n   1. Gamma');

  assertEq('a two-digit parent widens the child indent',
    indent('9. Alpha\n10. Beta\n11. Gamma', 3),
    '9. Alpha\n10. Beta\n    1. Gamma');

  assert('the first item of a list cannot be indented',
    !indentChanged('- Alpha\n- Beta', 1));

  assert('a blank line cannot be indented',
    !indentChanged('- Alpha\n\n', 2));

  assert('an item whose only predecessor is its parent cannot be indented',
    !indentChanged('- Alpha\n  - Beta', 2));

  assertEq('a third-level item nests under its own sibling',
    indent('- Alpha\n  - Beta\n  - Gamma', 3),
    '- Alpha\n  - Beta\n    - Gamma');

  assertEq('a blank line between siblings does not end the list',
    indent('- Alpha\n\n- Beta', 3),
    '- Alpha\n\n  - Beta');

  assert('plain text above ends the list, so there is no sibling',
    !indentChanged('Intro text\n- Alpha', 2));

  assertEq('a deeper item between siblings is skipped over',
    indent('- Alpha\n  - Nested\n- Beta', 3),
    '- Alpha\n  - Nested\n  - Beta');

  assert('a line past the end of the document is a no-op',
    !indentChanged('- Alpha', 5));
}

console.log('\nchange reporting');
{
  assert('converting reports changed',
    toUnorderedList(['Alpha'], 1, 1).changed);

  assert('a no-op reports unchanged',
    !toUnorderedList([''], 1, 1).changed);

  assert('indenting the first item reports unchanged',
    !indentAsSubList(['- Alpha'], 1).changed);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
