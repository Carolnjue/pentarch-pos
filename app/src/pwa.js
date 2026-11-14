// Service worker registration with an update prompt (never reloads mid-sale on its own).
import { toast } from './ui/overlay.jsx';
import { t } from './i18n/index.js';

export function registerSW() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  import('virtual:pwa-register').then(({ registerSW: reg }) => {
    const update = reg({
      immediate: true,
      onNeedRefresh() { toast(t('A new version of Pentarch POS is ready.'), { icon: 'refresh', ms: 60000, action: { label: t('Update now'), fn: () => update(true) } }); },
      onOfflineReady() { toast(t('Ready to work offline.'), { icon: 'wifi-off' }); }
    });
  }).catch(() => {});
}
