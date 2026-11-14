import { render } from 'preact';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/bricolage-grotesque/latin-600.css';
import '@fontsource/bricolage-grotesque/latin-700.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import './styles.css';
import { App } from './app.jsx';
import { loadSession } from './store.js';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true })).catch(() => {});
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

loadSession().then(() => render(<App />, document.getElementById('app')));
