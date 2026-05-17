import { defineConfig } from '@playwright/test';

// Visual regression tests for @marina/desktop-ui. Each spec launches the
// playground Electron app (which mounts every library export under each
// theme + scale) and snapshots the result. Baselines live alongside the
// specs in tests/visual.spec.js-snapshots/ and are committed.
//
// Updating baselines: `npm run test:update -w @marina/desktop-ui`.
// Running:            `npm test -w @marina/desktop-ui`.
export default defineConfig({
  testDir: 'tests',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  timeout: 30_000,
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  // Snapshots compare with a small pixel-diff tolerance; AA + sub-pixel
  // rendering differs slightly across machines and Electron versions, so a
  // strict byte-equal would flake constantly. 0.2% gives us regression
  // detection without false positives on font hinting.
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.002,
    },
  },
});
