import App from './App.svelte';
import '@fortawesome/fontawesome-free/css/all.min.css';
import '@marina/desktop-ui/styles';
import { mount } from 'svelte';
import { themeState } from '@marina/desktop-ui/theme';

// Apply saved theme + scale before Svelte mounts so CSS vars are already in
// place on first paint — prevents the light/midnight flash while modules
// resolve. The appId pins the localStorage keys to "threadliner-*", which
// matches what the pre-library code already used so existing installs keep
// their saved theme.
themeState.init({
  appId: 'threadliner',
  // ThreadLiner ships only these three themes. The library defines more
  // (NoteLiner uses the full set); the allowlist filters Settings → UI →
  // Theme without changing the underlying variable scheme.
  themes: ['light', 'dark', 'midnight'],
});

const app = mount(App, { target: document.getElementById('app') });

export default app;
