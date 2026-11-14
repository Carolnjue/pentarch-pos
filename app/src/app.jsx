import { phase } from './state.js';
import { ModalHost, ToastHost } from './ui/overlay.jsx';
import { TourHost } from './ui/tour.jsx';
import { lazy } from './lib/lazy.jsx';
import { Lock } from './shell/Lock.jsx';
import { Shell } from './shell/Shell.jsx';
import { t } from './i18n/index.js';

const Welcome = lazy(() => import('./shell/Welcome.jsx'));
const Wizard = lazy(() => import('./shell/Wizard.jsx'));

export function App() {
  const p = phase.value;
  return (
    <>
      {p === 'boot' && <div class="boot"><img src="/pos/brand/pentarch-mark.svg" alt="" width="56" height="56" /><span>Pentarch POS</span></div>}
      {p === 'error' && <BootError />}
      {p === 'welcome' && <Welcome />}
      {p === 'wizard' && <Wizard />}
      {p === 'locked' && <Lock />}
      {p === 'app' && <Shell />}
      <ModalHost />
      <ToastHost />
      <TourHost />
    </>
  );
}
function BootError() {
  return (
    <div class="boot" style={{ textAlign: 'center', padding: '20px' }}>
      <img src="/pos/brand/pentarch-mark.svg" alt="" width="56" height="56" />
      <span>{t('Pentarch POS could not start')}</span>
      <p style={{ color: '#aab5cf', font: '400 15px var(--f-body)', maxWidth: '420px' }}>{t('Your browser blocked local storage (private window?) or the database is damaged. Close private mode and reload. Your data is safe on this device and in the cloud.')}</p>
      <button class="btn sun" onClick={() => location.reload()}>{t('Reload')}</button>
    </div>
  );
}
