import { mount } from 'svelte';
import 'katex/dist/katex.min.css';
import './app.css';
import App from './App.svelte';
import { pwaStore } from './features/pwa/pwaStore.svelte';

const app = mount(App, {
  target: document.getElementById('app')!,
});

// ES: Inicializa el registro del Service Worker para funcionamiento sin conexión.
// EN: Initializes Service Worker registration for offline functionality.
pwaStore.init();

export default app;
