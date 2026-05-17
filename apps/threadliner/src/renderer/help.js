import HelpApp from './HelpApp.svelte';
import '@fortawesome/fontawesome-free/css/all.min.css';
import '@marina/desktop-ui/styles';
import { mount } from 'svelte';
import { themeState } from '@marina/desktop-ui/theme';

// Pick up the user's saved theme + scale (shared localStorage across windows)
// before mount so the help window paints with the correct CSS variables.
themeState.init({
  appId: 'threadliner',
  themes: ['light', 'dark', 'midnight'],
});

const app = mount(HelpApp, { target: document.getElementById('help') });

export default app;
