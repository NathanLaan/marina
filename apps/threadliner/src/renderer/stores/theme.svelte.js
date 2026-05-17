const THEMES = {
  light: {
    name: 'Light',
    vars: {
      '--bg-base': '#f5f5f7',
      '--bg-surface': '#ffffff',
      '--bg-overlay': '#e8e8ee',
      '--bg-button': '#ececf0',
      '--bg-button-hover': '#d8d8e0',
      '--bg-selected': 'rgba(91, 108, 224, 0.1)',
      '--bg-drag-over': 'rgba(91, 108, 224, 0.12)',
      '--bg-item-hover': 'rgba(0, 0, 0, 0.04)',
      '--border': '#d4d4dc',
      '--border-hover': '#b0b0b8',
      '--text-primary': '#1c1c1e',
      '--text-secondary': '#555555',
      '--text-tertiary': '#333333',
      '--text-muted': '#6e6e80',
      '--text-faint': '#b0b0b8',
      '--accent': '#5b6ce0',
      '--accent-hover': '#4a5bcf',
      '--accent-on': '#ffffff',
      '--danger': '#d44050',
      '--scrollbar-track': '#f0f0f0',
      '--scrollbar-thumb': '#c0c0c0',
      '--scrollbar-thumb-hover': '#a0a0a0',
      '--input-bg': '#f0f0f0',
      '--input-border': '#d4d4dc',
      '--input-border-focus': '#5b6ce0',
      '--modal-overlay': 'rgba(0, 0, 0, 0.3)',
      '--code-bg': '#ececf0',
      '--pre-bg': '#f0f0f0',
      '--blockquote-border': '#d4d4dc',
      '--tag-bg': '#ececf0',
    },
  },
  dark: {
    name: 'Dark',
    vars: {
      '--bg-base': '#1e1e1e',
      '--bg-surface': '#2a2a2a',
      '--bg-overlay': '#181818',
      '--bg-button': '#333333',
      '--bg-button-hover': '#444444',
      '--bg-selected': 'rgba(110, 164, 244, 0.12)',
      '--bg-drag-over': 'rgba(110, 164, 244, 0.15)',
      '--bg-item-hover': 'rgba(255, 255, 255, 0.05)',
      '--border': '#444444',
      '--border-hover': '#555555',
      '--text-primary': '#e0e0e0',
      '--text-secondary': '#aaaaaa',
      '--text-tertiary': '#cccccc',
      '--text-muted': '#909090',
      '--text-faint': '#555555',
      '--accent': '#6ea4f4',
      '--accent-hover': '#5a93e3',
      '--accent-on': '#1e1e1e',
      '--danger': '#e06070',
      '--scrollbar-track': '#232323',
      '--scrollbar-thumb': '#444444',
      '--scrollbar-thumb-hover': '#555555',
      '--input-bg': '#181818',
      '--input-border': '#444444',
      '--input-border-focus': '#6ea4f4',
      '--modal-overlay': 'rgba(0, 0, 0, 0.65)',
      '--code-bg': '#333333',
      '--pre-bg': '#181818',
      '--blockquote-border': '#444444',
      '--tag-bg': '#333333',
    },
  },
  midnight: {
    name: 'Midnight',
    vars: {
      '--bg-base': '#1e1e2e',
      '--bg-surface': '#252536',
      '--bg-overlay': '#1a1a28',
      '--bg-button': '#2e2e42',
      '--bg-button-hover': '#383850',
      '--bg-selected': 'rgba(124, 143, 244, 0.12)',
      '--bg-drag-over': 'rgba(124, 143, 244, 0.15)',
      '--bg-item-hover': 'rgba(255, 255, 255, 0.04)',
      '--border': '#3a3a50',
      '--border-hover': '#555570',
      '--text-primary': '#e0e0e8',
      '--text-secondary': '#a0a0c0',
      '--text-tertiary': '#c8c8dc',
      '--text-muted': '#8888a0',
      '--text-faint': '#505068',
      '--accent': '#7c8ff4',
      '--accent-hover': '#6b7ee3',
      '--accent-on': '#1e1e2e',
      '--danger': '#e06070',
      '--scrollbar-track': '#252536',
      '--scrollbar-thumb': '#3a3a50',
      '--scrollbar-thumb-hover': '#555570',
      '--input-bg': '#1a1a28',
      '--input-border': '#3a3a50',
      '--input-border-focus': '#7c8ff4',
      '--modal-overlay': 'rgba(0, 0, 0, 0.6)',
      '--code-bg': '#2e2e42',
      '--pre-bg': '#1a1a28',
      '--blockquote-border': '#3a3a50',
      '--tag-bg': '#2e2e42',
    },
  },
};

const UI_SCALES = [
  { id: '50', label: '50%', value: 0.5 },
  { id: '75', label: '75%', value: 0.75 },
  { id: '100', label: '100%', value: 1.0 },
  { id: '110', label: '110%', value: 1.1 },
  { id: '120', label: '120%', value: 1.2 },
  { id: '130', label: '130%', value: 1.3 },
  { id: '140', label: '140%', value: 1.4 },
  { id: '150', label: '150%', value: 1.5 },
  { id: '175', label: '175%', value: 1.75 },
  { id: '200', label: '200%', value: 2.0 },
];

class ThemeState {
  current = $state('light');
  scale = $state('100');

  get theme() {
    return THEMES[this.current];
  }

  get list() {
    return Object.entries(THEMES).map(([id, t]) => ({ id, name: t.name }));
  }

  get scaleList() {
    return UI_SCALES;
  }

  set(themeId) {
    if (!THEMES[themeId]) return;
    this.current = themeId;
    this.apply();
    localStorage.setItem('threadliner-theme', themeId);
    // Mirror to settings so the value survives data-dir migration.
    if (window.api?.setSetting) {
      window.api.setSetting('theme', themeId).catch(() => { /* non-critical */ });
    }
  }

  setScale(scaleId) {
    const entry = UI_SCALES.find((s) => s.id === scaleId);
    if (!entry) return;
    this.scale = scaleId;
    this.applyScale();
    localStorage.setItem('threadliner-scale', scaleId);
    if (window.api?.setSetting) {
      window.api.setSetting('scale', scaleId).catch(() => { /* non-critical */ });
    }
  }

  zoomIn() {
    const idx = UI_SCALES.findIndex((s) => s.id === this.scale);
    if (idx < UI_SCALES.length - 1) this.setScale(UI_SCALES[idx + 1].id);
  }

  zoomOut() {
    const idx = UI_SCALES.findIndex((s) => s.id === this.scale);
    if (idx > 0) this.setScale(UI_SCALES[idx - 1].id);
  }

  zoomReset() {
    this.setScale('100');
  }

  applyScale() {
    const entry = UI_SCALES.find((s) => s.id === this.scale);
    if (entry) {
      const root = document.documentElement;
      root.style.setProperty('--ui-zoom', entry.value);
      root.style.setProperty('--ui-zoom-height', `${100 / entry.value}vh`);
      root.style.setProperty('--ui-zoom-width', `${100 / entry.value}vw`);
    }
  }

  apply() {
    const vars = THEMES[this.current].vars;
    const root = document.documentElement;
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
    this.applyScale();
  }

  // Synchronous init: read localStorage and paint before mount to avoid FOUC.
  init() {
    const saved = localStorage.getItem('threadliner-theme');
    if (saved && THEMES[saved]) {
      this.current = saved;
    }
    const savedScale = localStorage.getItem('threadliner-scale');
    if (savedScale && UI_SCALES.find((s) => s.id === savedScale)) {
      this.scale = savedScale;
    }
    this.apply();
  }

  // Async backfill: if localStorage was empty but settings has a value
  // (e.g., fresh install pulling from a synced data dir), adopt it.
  async hydrateFromSettings() {
    if (!window.api?.getSetting) return;
    try {
      if (!localStorage.getItem('threadliner-theme')) {
        const themeId = await window.api.getSetting('theme');
        if (themeId && THEMES[themeId]) this.set(themeId);
      }
      if (!localStorage.getItem('threadliner-scale')) {
        const scaleId = await window.api.getSetting('scale');
        if (scaleId && UI_SCALES.find((s) => s.id === scaleId)) this.setScale(scaleId);
      }
    } catch { /* non-critical */ }
  }
}

export const themeState = new ThemeState();
