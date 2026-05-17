import { test as base, _electron, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve the playground workspace so we can launch it as the test target.
// Going up one level from tests/ lands at packages/desktop-ui/; the
// playground is examples/playground/ inside that.
const PLAYGROUND_ROOT = path.resolve(__dirname, '..', 'examples', 'playground');

export const test = base.extend({
  // A fresh userData dir per test so localStorage / ui-preferences.json
  // start clean and one test's state can't leak into another's snapshot.
  tmpEnv: async ({}, use) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dui-test-'));
    const userData = path.join(root, 'userdata');
    fs.mkdirSync(userData);
    await use({ root, userData });
    fs.rmSync(root, { recursive: true, force: true });
  },

  // Launches the playground Electron app pointed at the throwaway userData
  // dir, then resolves once the first window's DOM is ready. Closes the
  // app on test teardown.
  app: async ({ tmpEnv }, use) => {
    const electronApp = await _electron.launch({
      args: [
        PLAYGROUND_ROOT,
        `--user-data-dir=${tmpEnv.userData}`,
        '--no-sandbox',
      ],
      cwd: PLAYGROUND_ROOT,
      env: {
        ...process.env,
        // Force production mode so the renderer loads from dist/ and doesn't
        // require a Vite dev server. The `pretest` script builds dist first.
        NODE_ENV: 'test',
      },
    });
    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    // The playground's mount uses themeState.init() synchronously before
    // Svelte mounts, so once #app has any content we know vars + theme are
    // applied and screenshots will be deterministic.
    await window.waitForFunction(() => {
      const el = document.getElementById('app');
      return el && el.children.length > 0;
    }, null, { timeout: 10_000 });
    await use({ electronApp, window, ...tmpEnv });
    try {
      await electronApp.close();
    } catch { /* already closed */ }
  },
});

export { expect };
