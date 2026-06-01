import App from './App.svelte';
import '@fortawesome/fontawesome-free/css/all.min.css';
import '@marina/desktop-ui/styles';
import { mount } from 'svelte';
import { themeState } from '@marina/desktop-ui/theme';

// Apply saved theme + scale before Svelte mounts so CSS vars are already in
// place on first paint — prevents a theme flash while modules resolve. appId
// pins the localStorage keys to "pageliner-*".
themeState.init({ appId: 'pageliner' });

const app = mount(App, { target: document.getElementById('app') });

export default app;
