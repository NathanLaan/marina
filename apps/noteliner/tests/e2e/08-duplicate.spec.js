const fs = require('fs');
const path = require('path');
const { test, expect } = require('./fixtures');

test('duplicate note copies body + tags into a new file with a distinct filename', async ({ app, project }) => {
  const { sourceFilename, copyFilename, copyId } = await app.window.evaluate(async (proj) => {
    await window.__nlTest.initProject(proj, null);
    const source = await window.__nlTest.createFile('Original', ['alpha', 'beta']);
    await window.__nlTest.writeBody('# Original\n\nshared-body\n');
    // Same default the Duplicate dialog pre-fills: name + the source's tags.
    const copy = await window.__nlTest.duplicateFile(source.id, 'Original-Copy', ['alpha', 'beta']);
    return { sourceFilename: source.filename, copyFilename: copy.filename, copyId: copy.id };
  }, project);

  // The copy is a separate file on disk, not a clobbered original.
  expect(copyFilename).not.toBe(sourceFilename);
  expect(fs.existsSync(path.join(project, sourceFilename))).toBe(true);
  expect(fs.existsSync(path.join(project, copyFilename))).toBe(true);

  // The copy carries the source body.
  const copyBody = fs.readFileSync(path.join(project, copyFilename), 'utf-8');
  expect(copyBody).toContain('shared-body');

  // Index has both notes; the copy keeps the source's tags.
  const index = JSON.parse(fs.readFileSync(path.join(project, 'noteliner.json'), 'utf-8'));
  expect(index.files).toHaveLength(2);
  const copy = index.files.find(f => f.id === copyId);
  expect(copy.name).toBe('Original-Copy');
  expect(copy.tags).toEqual(['alpha', 'beta']);

  // In-memory store reflects the copy and selects it.
  const inMem = await app.window.evaluate(() => window.__nlTest.snapshot());
  expect(inMem.files).toHaveLength(2);
  expect(inMem.selectedFileId).toBe(copyId);
});
