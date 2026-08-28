// List formatting: the two toolbar buttons that turn the selected lines into an
// ordered or unordered list, and the third that indents the caret's line as a
// sub-list.
//
// The transform rules themselves are covered exhaustively by
// tests/integration/list-edits.test.mjs. What this spec proves is the wiring
// the unit tests can't see: the buttons reach CodeMirror, a selection maps to
// the right line span, a bare caret acts on its own line, and the whole thing
// is one undo step.

const { test, expect } = require('./fixtures');

const BODY = 'Alpha\nBeta\nGamma\n';

// Buttons are identified by aria-label so the test doesn't depend on icon
// classes or their order in the toolbar.
const ORDERED = 'button[aria-label="Ordered List"]';
const UNORDERED = 'button[aria-label="Unordered List"]';
const INDENT = 'button[aria-label="Indent as Sub-list"]';

async function setup(app, project, body = BODY) {
  await app.window.evaluate(async ({ proj, text }) => {
    await window.__nlTest.initProject(proj, null);
    await window.__nlTest.createFile('Lists', []);
    await window.__nlTest.writeBody(text);
  }, { proj: project, text: body });
  await app.window.waitForSelector('.cm-content');
  // writeBody sets the store; wait for the editor to have taken the content.
  // Keying on the body's last non-empty line means this works for whatever
  // fixture text a test passes in.
  const lastLine = body.split('\n').filter((l) => l.trim()).pop();
  await app.window.waitForFunction(
    (expected) => document.querySelector('.cm-content')?.textContent.includes(expected),
    lastLine,
    { timeout: 5_000 },
  );
}

function content(app) {
  return app.window.evaluate(() => window.__nlTest.snapshot().editorContent);
}

// Put the caret on `line` (1-based) at column 0, then optionally extend the
// selection down to the end of `throughLine`.
async function select(app, line, throughLine = null) {
  await app.window.click('.cm-content');
  await app.window.keyboard.press('Control+Home');
  for (let i = 1; i < line; i++) await app.window.keyboard.press('ArrowDown');
  if (throughLine !== null) {
    for (let i = line; i < throughLine; i++) await app.window.keyboard.press('Shift+ArrowDown');
    await app.window.keyboard.press('Shift+End');
  }
}

test('selected lines become an ordered, then an unordered, then a plain list', async ({ app, project }) => {
  await setup(app, project);

  await select(app, 1, 3);
  await app.window.click(ORDERED);
  expect(await content(app)).toBe('1. Alpha\n2. Beta\n3. Gamma\n');

  // The transformed lines stay selected, so the next button acts on the same
  // block without re-selecting.
  await app.window.click(UNORDERED);
  expect(await content(app)).toBe('- Alpha\n- Beta\n- Gamma\n');

  // Pressing the same button again toggles the markers back off.
  await app.window.click(UNORDERED);
  expect(await content(app)).toBe('Alpha\nBeta\nGamma\n');
});

test('a bare caret formats only its own line', async ({ app, project }) => {
  await setup(app, project);

  await select(app, 2);
  await app.window.click(UNORDERED);

  expect(await content(app)).toBe('Alpha\n- Beta\nGamma\n');
});

test('formatting a selection is a single undo step', async ({ app, project }) => {
  await setup(app, project);

  await select(app, 1, 3);
  await app.window.click(ORDERED);
  expect(await content(app)).toBe('1. Alpha\n2. Beta\n3. Gamma\n');

  await app.window.click('.cm-content');
  await app.window.keyboard.press('Control+z');

  expect(await content(app)).toBe(BODY);
});

test('indent nests a list item under the item above it', async ({ app, project }) => {
  await setup(app, project, '- Alpha\n- Beta\n');

  await select(app, 2);
  await app.window.click(INDENT);

  expect(await content(app)).toBe('- Alpha\n  - Beta\n');
});

test('indent turns a non-list line into a new unordered list', async ({ app, project }) => {
  await setup(app, project);

  await select(app, 1);
  await app.window.click(INDENT);

  expect(await content(app)).toBe('- Alpha\nBeta\nGamma\n');
});

test('indent leaves the first item of a list alone', async ({ app, project }) => {
  await setup(app, project, '- Alpha\n- Beta\n');

  await select(app, 1);
  await app.window.click(INDENT);

  expect(await content(app)).toBe('- Alpha\n- Beta\n');
});

test('the context menu offers both list actions', async ({ app, project }) => {
  await setup(app, project);

  await select(app, 1, 3);
  await app.window.click('.cm-content', { button: 'right' });
  await app.window.waitForSelector('.context-menu');

  const labels = await app.window.$$eval('.context-menu .context-label', (els) =>
    els.map((e) => e.textContent.trim()));
  expect(labels).toContain('Ordered List');
  expect(labels).toContain('Unordered List');
});

test('formatted lists reach disk through the ordinary autosave path', async ({ app, project }) => {
  const fs = require('fs');
  const path = require('path');

  await setup(app, project);

  await select(app, 1, 3);
  await app.window.click(UNORDERED);

  // scheduleSave debounces 500ms, then writes and commits.
  const filename = (await app.window.evaluate(() => window.__nlTest.snapshot().files[0])).filename;
  const filePath = path.join(project, filename);
  await expect.poll(
    () => fs.readFileSync(filePath, 'utf-8'),
    { timeout: 10_000 },
  ).toContain('- Alpha');
});
