import App from './App.svelte';
import '@fortawesome/fontawesome-free/css/all.min.css';
import '@marina/desktop-ui/styles';
import { mount } from 'svelte';
import { themeState } from '@marina/desktop-ui/theme';

themeState.init({ appId: 'desktop-ui-playground' });

const app = mount(App, { target: document.getElementById('app') });

export default app;
