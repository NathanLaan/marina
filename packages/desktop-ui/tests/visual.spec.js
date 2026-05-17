import { test, expect } from './fixtures.js';

// Visual regression matrix. Each test launches a fresh playground, drives it
// to a specific (component × theme × scale) state, and snapshots the window.
// Baselines live in visual.spec.js-snapshots/ next to this file and are
// committed.
//
// The matrix is intentionally small at v1.0 — just enough to catch the most
// common regression class (a theme variable rename or a primitive change
// that breaks one renderer surface). Expand as needed; the per-theme loop
// below is the place to extend if you want to cover every theme on every
// component.

const THEMES = ['midnight', 'dark', 'light'];

test.describe('@marina/desktop-ui visual regression', () => {
  test('boots and renders the playground', async ({ app }) => {
    const { window } = app;
    // The main heading is a stable anchor for "the page has actually
    // rendered." If this never resolves something is fundamentally broken.
    await expect(window.getByRole('heading', { name: /desktop-ui playground/i }))
      .toBeVisible({ timeout: 5_000 });
    await expect(window).toHaveScreenshot('boot-default.png');
  });

  for (const theme of THEMES) {
    test(`renders main view in ${theme} theme`, async ({ app }) => {
      const { window } = app;
      // themeState is a module singleton — the playground doesn't expose it
      // on window, so write the localStorage key it reads on init and
      // reload. This mirrors what a user clicking the theme list does.
      await window.evaluate((id) => {
        localStorage.setItem('desktop-ui-playground-theme', id);
      }, theme);
      await window.reload();
      await window.waitForLoadState('domcontentloaded');
      await window.waitForFunction(() => {
        const el = document.getElementById('app');
        return el && el.children.length > 0;
      }, null, { timeout: 10_000 });
      await expect(window).toHaveScreenshot(`theme-${theme}.png`);
    });
  }

  test('about modal', async ({ app }) => {
    const { window } = app;
    await window.getByRole('button', { name: 'About' }).first().click();
    await expect(window.getByRole('dialog')).toBeVisible();
    await expect(window).toHaveScreenshot('about-modal.png');
  });

  test('settings modal', async ({ app }) => {
    const { window } = app;
    await window.getByRole('button', { name: 'Settings' }).first().click();
    await expect(window.getByRole('dialog')).toBeVisible();
    await expect(window).toHaveScreenshot('settings-ui-tab.png');
  });

  test('command palette', async ({ app }) => {
    const { window } = app;
    // Ctrl+K opens the palette (registered in playground App.svelte).
    await window.keyboard.press('Control+k');
    await expect(window.getByRole('dialog')).toBeVisible();
    await expect(window).toHaveScreenshot('command-palette.png');
  });
});
