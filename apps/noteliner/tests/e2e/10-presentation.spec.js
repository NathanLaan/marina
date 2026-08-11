// Presentation mode, Phase 1: a note whose frontmatter carries a
// `presentation:` block renders in the preview pane as slides instead of a
// flowing document — and its speaker notes never reach a slide.
//
// This is the "done when" criterion from
// docs/plans/plan-presentations.md Phase 1, automated.

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { test, expect } = require('./fixtures');

const DECK_BODY = `# Deck Title

A subtitle line.

## First Point

- Alpha
- Beta

<!-- notes
SPEAKER_ONLY_TEXT
-->

## Second Point

Body text here.
`;

// Adds a `presentation:` block to a note's on-disk frontmatter, the way the
// Phase 2 "Convert to Presentation" action will. gray-matter is the same
// library ProjectService uses, so managed fields round-trip untouched.
function makeDeckOnDisk(project, filename, presentation) {
  const filePath = path.join(project, filename);
  const parsed = matter(fs.readFileSync(filePath, 'utf-8'));
  fs.writeFileSync(filePath, matter.stringify(DECK_BODY, { ...parsed.data, presentation }), 'utf-8');
}

test('a note with presentation frontmatter previews as slides', async ({ app, project }) => {
  const entry = await app.window.evaluate(async (proj) => {
    await window.__nlTest.initProject(proj, null);
    return window.__nlTest.createFile('Quarterly Deck', []);
  }, project);

  makeDeckOnDisk(project, entry.filename, { theme: 'dark', aspect: '16:9', slideLevel: 2 });

  // Re-select so the renderer re-reads body + frontmatter from disk.
  const state = await app.window.evaluate(async (id) => {
    await window.__nlTest.selectFile(id);
    return { isDeck: window.__nlTest.deckSnapshot().isDeck, slides: window.__nlTest.deckSnapshot().slideCount };
  }, entry.id);

  expect(state.isDeck).toBe(true);
  // H1 title slide, then the two H2 sections.
  expect(state.slides).toBe(3);

  // Open the preview pane (Ctrl+P) and let the deck render.
  await app.window.keyboard.press('Control+p');
  await app.window.waitForSelector('.deck-slide', { timeout: 10_000 });

  expect(await app.window.locator('.preview-title').textContent()).toBe('SLIDES');
  expect(await app.window.locator('.deck-slide').count()).toBe(3);

  // Slide 1 is the title slide, laid out as a hero.
  const firstStage = app.window.locator('.deck-slide[data-slide="1"] .slide-stage');
  expect(await firstStage.locator('h1').textContent()).toContain('Deck Title');
  expect(await firstStage.getAttribute('class')).toContain('layout-hero');

  // Slide 2 carries the heading and the list, and is a title-body layout.
  const secondStage = app.window.locator('.deck-slide[data-slide="2"] .slide-stage');
  expect(await secondStage.locator('h2').textContent()).toContain('First Point');
  expect(await secondStage.locator('li').count()).toBe(2);
  expect(await secondStage.getAttribute('class')).toContain('layout-title-body');

  // The whole point: notes are visible to the presenter, never on a slide.
  const allStageText = (await app.window.locator('.slide-stage').allTextContents()).join('\n');
  expect(allStageText).not.toContain('SPEAKER_ONLY_TEXT');
  const notesText = (await app.window.locator('.deck-notes').allTextContents()).join('\n');
  expect(notesText).toContain('SPEAKER_ONLY_TEXT');

  // Slide numbers come from the config default.
  expect(await app.window.locator('.deck-slide[data-slide="3"] .slide-number').textContent()).toBe('3');
});

test('an ordinary note still previews as a document', async ({ app, project }) => {
  await app.window.evaluate(async (proj) => {
    await window.__nlTest.initProject(proj, null);
    await window.__nlTest.createFile('Plain Note', []);
    await window.__nlTest.writeBody('# Plain\n\nJust a note.\n');
  }, project);

  const isDeck = await app.window.evaluate(() => window.__nlTest.deckSnapshot().isDeck);
  expect(isDeck).toBe(false);

  await app.window.keyboard.press('Control+p');
  await app.window.waitForSelector('.preview-content', { timeout: 10_000 });

  expect(await app.window.locator('.preview-title').textContent()).toBe('PREVIEW');
  expect(await app.window.locator('.deck-slide').count()).toBe(0);
  expect(await app.window.locator('.preview-content').textContent()).toContain('Just a note.');
});
