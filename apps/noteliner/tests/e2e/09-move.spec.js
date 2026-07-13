const fs = require('fs');
const path = require('path');
const { test, expect } = require('./fixtures');

test('move reparents a note under a new parent and persists to the index', async ({ app, project }) => {
  const { parentId, childId } = await app.window.evaluate(async (proj) => {
    await window.__nlTest.initProject(proj, null);
    const parent = await window.__nlTest.createFile('Parent', []);
    const child = await window.__nlTest.createFile('Child', []);
    // Both start at the root; move Child under Parent.
    await window.__nlTest.moveFile(child.id, parent.id);
    return { parentId: parent.id, childId: child.id };
  }, project);

  // Persisted index reflects the new parent.
  const index = JSON.parse(fs.readFileSync(path.join(project, 'noteliner.json'), 'utf-8'));
  const child = index.files.find(f => f.id === childId);
  expect(child.parentId).toBe(parentId);

  // In-memory store agrees.
  const inMem = await app.window.evaluate(() => window.__nlTest.snapshot());
  expect(inMem.files.find(f => f.id === childId).parentId).toBe(parentId);
});

test('move to (None) promotes a nested note back to the top level', async ({ app, project }) => {
  const { childId } = await app.window.evaluate(async (proj) => {
    await window.__nlTest.initProject(proj, null);
    const parent = await window.__nlTest.createFile('Parent', []);
    const child = await window.__nlTest.createFile('Child', []);
    await window.__nlTest.moveFile(child.id, parent.id);
    // Now move it back out to the root by passing no parent.
    await window.__nlTest.moveFile(child.id, null);
    return { childId: child.id };
  }, project);

  const index = JSON.parse(fs.readFileSync(path.join(project, 'noteliner.json'), 'utf-8'));
  const child = index.files.find(f => f.id === childId);
  expect(child.parentId ?? null).toBeNull();
});
