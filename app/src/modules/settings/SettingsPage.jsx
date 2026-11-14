import { settingsPanels } from '../index.js';
import { PageHeader, Icon, Empty } from '../../ui/kit.jsx';
import { navigate } from '../../router.js';
import { t } from '../../i18n/index.js';

export default function SettingsPage({ params }) {
  const panels = settingsPanels();
  const cur = panels.find((p) => p.id === params.panel) || panels[0];
  if (!cur) return <div class="page"><Empty icon="shield" title={t('No access')} /></div>;
  const C = cur.component;
  return (
    <div class="page">
      <PageHeader title={t('Settings')} sub={t('Set up the business, receipts, payments, staff and data.')} />
      <div class="settings">
        <nav class="snav" aria-label={t('Settings sections')}>
          {panels.map((p) => <a href={'#/settings/' + p.id} class={p.id === cur.id ? 'on' : ''} aria-current={p.id === cur.id ? 'page' : undefined}><Icon name={p.icon} size={18} />{t(p.label)}</a>)}
        </nav>
        <div style={{ minWidth: 0 }}><C key={cur.id} /></div>
      </div>
    </div>
  );
}
