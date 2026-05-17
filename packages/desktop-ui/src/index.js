// Umbrella export. Consumers can either:
//
//   import { TitleBar, themeState, SettingsShell } from '@marina/desktop-ui';
//
// or import from the more specific subpaths declared in package.json:
//
//   import { themeState } from '@marina/desktop-ui/theme';
//   import { TitleBar } from '@marina/desktop-ui/components';
//   import { CommandPalette, commandRegistry } from '@marina/desktop-ui/command-palette';
//   import { SettingsShell, ThemeList } from '@marina/desktop-ui/settings';
//
// Subpath imports are recommended for tree-shaking; the umbrella is for
// quick prototyping.

export * from './theme/index.svelte.js';
export * from './components/index.js';
export * from './command-palette/index.js';
export * from './settings/index.js';
export * from './panels/index.js';
