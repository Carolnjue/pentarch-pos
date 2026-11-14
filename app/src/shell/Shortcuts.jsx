import { openModal, Modal } from '../ui/overlay.jsx';
import { Kbd } from '../ui/kit.jsx';
import { shortcuts } from '../modules/index.js';
import { t } from '../i18n/index.js';

const GLOBAL = [
  { keys: 'Ctrl K', label: 'Search everything / command palette', scope: 'Anywhere' },
  { keys: 'F1', label: 'Keyboard shortcuts', scope: 'Anywhere' },
  { keys: 'F2', label: 'Go to Sell / search products', scope: 'Anywhere' },
  { keys: 'Ctrl L', label: 'Lock / switch user', scope: 'Anywhere' },
  { keys: 'Esc', label: 'Close dialog / clear search', scope: 'Anywhere' }
];
export const openShortcuts = () => openModal((close) => (
  <Modal title={t('Keyboard shortcuts')} icon="keyboard" size="lg" onClose={() => close()}>
    {Object.entries([...GLOBAL, ...shortcuts()].reduce((m, s) => ((m[s.scope] ||= []).push(s), m), {})).map(([scope, list]) => (
      <div class="mb">
        <div class="section-title">{t(scope)}</div>
        <div class="grid2" style={{ gap: '4px 24px' }}>
          {list.map((s) => <div class="row" style={{ padding: '6px 0', borderBottom: '1px solid #f0ede6' }}><span class="grow">{t(s.label)}</span>{s.keys.split(' / ').map((k) => <Kbd>{k}</Kbd>)}</div>)}
        </div>
      </div>
    ))}
    <p class="small mute">{t('Barcode scanners work anywhere on the Sell screen — no need to click the search box first.')}</p>
  </Modal>
));
