import { writable } from 'svelte/store';

export const theme = writable('light');

export async function loadTheme() {
  const saved = await window.api.getSetting('theme');
  const value = saved || 'light';
  theme.set(value);
  applyTheme(value);
}

export async function setTheme(value) {
  theme.set(value);
  applyTheme(value);
  await window.api.setSetting('theme', value);
}

function applyTheme(value) {
  document.documentElement.setAttribute('data-theme', value);
}
