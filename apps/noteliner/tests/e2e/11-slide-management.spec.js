// Presentation mode, Phase 2: the ways a deck gets created, and the SLIDES
// pane that manages it. Drives the real UI — modal, context menu, keyboard
// commands — so the wiring is covered, not just the pure functions (those have
// their own unit tests in tests/integration/slide-edits.test.mjs).

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { test, expect } = require('./fixtures');

const readFrontmatter = (project, filename) =>
  matter(fs.readFileSync(path.join(project, filename), 'utf-8')).data;

const readBody = (project, filename) =>
  matter(fs.readFileSync(path.join(project, filename), 'utf-8')).content;

test('New File dialog creates a presentation via the Type selector', async ({ app, project }) => {
  await app.window.evaluate((proj) => window.__nlTest.initProject(proj, null), project);

  await app.window.keyboard.press('Control+n');
  await app.window.waitForSelector('.new-file-modal');

  // Default is Note; the modal renames itself once Presentation is chosen.
  expect(await app.window.locator('.modal-header h2').textContent()).toBe('New File');
  await app.window.locator('.type-option', { hasText: 'Presentation' }).click();
  expect(await app.window.locator('.modal-header h2').textContent()).toBe('New Presentation');
  expect(await app.window.locator('#new-file-template option').first().textContent())
    .toBe('Blank Presentation');

  await app.window.locator('#new-file-name').fill('Kickoff');
  await app.window.locator('.ok-btn').click();
  await app.window.waitForSelector('.new-file-modal', { state: 'detached' });

  // The dialog closes immediately; seeding the body and the `presentation:`
  // block are async writes that land just after.
  await app.window.waitForFunction(() => window.__nlTest.deckSnapshot().isDeck, null,
    { timeout: 10_000 });

  const snap = await app.window.evaluate(() => window.__nlTest.deckSnapshot());
  expect(snap.isDeck).toBe(true);
  // Blank Presentation seeds a title slide plus one content slide.
  expect(snap.slideCount).toBe(2);

  const files = await app.window.evaluate(() => window.__nlTest.snapshot().files);
  const data = readFrontmatter(project, files[0].filename);
  expect(data.presentation).toBeTruthy();
  expect(data.presentation.aspect).toBe('16:9');
  expect(readBody(project, files[0].filename)).toContain('# Kickoff');

  // The file tree marks it as a deck.
  expect(await app.window.locator('.file-item .fa-person-chalkboard').count()).toBe(1);
});

test('an existing note converts to a presentation from the file tree', async ({ app, project }) => {
  const entry = await app.window.evaluate(async (proj) => {
    await window.__nlTest.initProject(proj, null);
    const e = await window.__nlTest.createFile('Weekly Notes', []);
    // An ordinary meeting note: no presentation syntax at all.
    await window.__nlTest.writeBody('## Revenue\n\n- up 12%\n\n## Churn\n\nFlat.\n');
    return e;
  }, project);

  expect(await app.window.evaluate(() => window.__nlTest.deckSnapshot().isDeck)).toBe(false);
  expect(await app.window.locator('.file-item .fa-file-lines').count()).toBe(1);

  await app.window.locator('.file-item').first().click({ button: 'right' });
  await app.window.waitForSelector('.context-menu');
  await app.window.locator('.context-menu', { hasText: 'Convert to Presentation' })
    .getByText('Convert to Presentation...').click();

  // Conversion opens Presentation Settings so the deck's options are one step away.
  await app.window.waitForSelector('.presentation-modal');
  await app.window.locator('.presentation-modal .cancel-btn').click();

  const snap = await app.window.evaluate(() => window.__nlTest.deckSnapshot());
  expect(snap.isDeck).toBe(true);
  // The note was already a deck in structure — conversion added no content.
  expect(snap.titles).toEqual(['Revenue', 'Churn']);

  const data = readFrontmatter(project, entry.filename);
  expect(data.presentation.slideLevel).toBe(2);
  expect(data.name).toBe('Weekly Notes');   // managed mirror fields survive
  expect(readBody(project, entry.filename)).toContain('- up 12%');

  // Icon flips without a reload, and the SLIDES pane opens with the deck.
  expect(await app.window.locator('.file-item .fa-person-chalkboard').count()).toBe(1);
  await app.window.waitForSelector('.slides-pane');
  expect(await app.window.locator('.slide-row').count()).toBe(2);
});

test('SLIDES pane manages slides, and converting back leaves the note intact', async ({ app, project }) => {
  const entry = await app.window.evaluate(async (proj) => {
    await window.__nlTest.initProject(proj, null);
    const e = await window.__nlTest.createFile('Deck', []);
    await window.__nlTest.writeBody('## Alpha\n\nFirst.\n\n## Beta\n\nSecond.\n');
    return e;
  }, project);

  // Convert through the store the way the context menu does, then open the pane.
  await app.window.evaluate((id) => window.__nlTest.convertToPresentation(id), entry.id);
  await app.window.keyboard.press('Control+Shift+G');
  await app.window.waitForSelector('.slide-row');
  expect(await app.window.locator('.slide-row').count()).toBe(2);

  // Rows show the inferred layout, and the thumbnail is a real rendered slide.
  expect(await app.window.locator('.slide-row').first().locator('.slide-title').textContent())
    .toBe('Alpha');
  expect(await app.window.locator('.slide-row').first().locator('.slide-stage').count()).toBe(1);

  // Clicking a row moves the editor caret into that slide.
  await app.window.locator('.slide-row').nth(1).click();
  await app.window.waitForFunction(() => window.__nlTest.deckSnapshot().activeIndex === 2);

  // Ctrl+Enter adds a slide after the caret's slide.
  await app.window.keyboard.press('Control+Enter');
  await app.window.waitForFunction(() => window.__nlTest.deckSnapshot().slideCount === 3);
  expect(await app.window.evaluate(() => window.__nlTest.deckSnapshot().titles))
    .toEqual(['Alpha', 'Beta', 'New Slide']);

  // Alt+Up moves the caret's slide earlier in the deck.
  await app.window.keyboard.press('Alt+ArrowUp');
  await app.window.waitForFunction(() =>
    JSON.stringify(window.__nlTest.deckSnapshot().titles) === '["Alpha","New Slide","Beta"]');

  // Rename in place from the pane.
  await app.window.locator('.slide-row').nth(1).dblclick();
  await app.window.locator('.slide-title-input').fill('Renamed');
  await app.window.keyboard.press('Enter');
  await app.window.waitForFunction(() =>
    window.__nlTest.deckSnapshot().titles[1] === 'Renamed');

  // Edits are persisted, not just held in the editor.
  await app.window.waitForFunction(() => window.__nlTest.snapshot().saveStatus !== 'saving');
  const body = readBody(project, entry.filename);
  expect(body).toContain('## Renamed');
  expect(body).toContain('First.');
  expect(body).toContain('Second.');

  // Converting back drops the block and closes the pane, leaving content alone.
  await app.window.evaluate((id) => window.__nlTest.convertToNote(id), entry.id);
  await app.window.waitForSelector('.slides-pane', { state: 'detached' });
  expect(await app.window.evaluate(() => window.__nlTest.deckSnapshot().isDeck)).toBe(false);
  expect(readFrontmatter(project, entry.filename).presentation).toBeUndefined();
  expect(readBody(project, entry.filename)).toContain('## Renamed');
});

test('Presentation Settings writes the frontmatter block', async ({ app, project }) => {
  const entry = await app.window.evaluate(async (proj) => {
    await window.__nlTest.initProject(proj, null);
    const e = await window.__nlTest.createFile('Settings Deck', []);
    await window.__nlTest.writeBody('# Title\n\n## One\n\nBody\n');
    await window.__nlTest.convertToPresentation(e.id);
    return e;
  }, project);

  await app.window.evaluate(() => window.__nlTest.openPresentationSettings());
  await app.window.waitForSelector('.presentation-modal');

  await app.window.locator('#pres-theme').selectOption('light');
  await app.window.locator('#pres-aspect').selectOption('4:3');
  await app.window.locator('#pres-footer').fill('Confidential');
  await app.window.locator('#pres-level').selectOption('1');
  await app.window.locator('.presentation-modal .ok-btn').click();
  await app.window.waitForSelector('.presentation-modal', { state: 'detached' });

  const saved = readFrontmatter(project, entry.filename).presentation;
  expect(saved.theme).toBe('light');
  expect(saved.aspect).toBe('4:3');
  expect(saved.footer).toBe('Confidential');
  expect(saved.slideLevel).toBe(1);

  // slideLevel 1 means the H2 no longer breaks, so the deck collapses to one slide.
  await app.window.waitForFunction(() => window.__nlTest.deckSnapshot().slideCount === 1);
});
