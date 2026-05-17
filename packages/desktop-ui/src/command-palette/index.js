export { default as CommandPalette } from './CommandPalette.svelte';
export { commandRegistry } from './registry.svelte.js';
// Re-export the matcher so consumers' extraItemsProvider can score against
// the same algorithm the library uses internally.
export { fuzzyScore } from '../lib/fuzzy.js';
