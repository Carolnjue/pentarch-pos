import { useEffect, useState } from 'preact/hooks';
import { Btn, Icon } from '../../../ui/kit.jsx';
import { getMeta } from '../../../db/index.js';
import { waLink } from '../../../lib/util.js';
import { Panel, Row } from './general.jsx';
import { openShortcuts } from '../../../shell/Shortcuts.jsx';
import * as S from '../../../state.js';
import { t } from '../../../i18n/index.js';

export default function AboutPanel() {
  const [m, setM] = useState({});
  useEffect(() => { Promise.all(['tenant_id', 'device_id', 'device_no', 'last_pull_seq', 'seed_total_ms'].map(async (k) => [k, await getMeta(k)])).then((r) => setM(Object.fromEntries(r))); }, []);
  return (
    <div class="col gap-l">
      <Panel title={t('About Pentarch POS')}>
        <div class="row gap-l mb"><img src="/pos/brand/pentarch-mark.svg" alt="" width="56" height="56" /><div><h2>Pentarch POS</h2><div class="mute">{t('Version')} 1.0.0 · {t('by Pentarch Communications, Nairobi')}</div></div></div>
        <dl class="kv">
          <dt>{t('Business ID')}</dt><dd class="mono small">{m.tenant_id}</dd>
          <dt>{t('Device')}</dt><dd class="mono small">{S.device.value.name} · #{m.device_no || 1} · {m.device_id}</dd>
          <dt>{t('Mode')}</dt><dd>{S.isDemo.value ? t('Demo') : t('Live')}{!S.isDemo.value && ' · ' + t('sync position {n}', { n: m.last_pull_seq || 0 })}</dd>
          <dt>{t('Works offline')}</dt><dd>{'serviceWorker' in navigator ? t('Yes — installed for offline use') : t('Limited (browser does not support offline apps)')}</dd>
        </dl>
      </Panel>
      <Panel title={t('Support')}>
        <Row title={t('WhatsApp support')} sub="+254 729 455 912"><a class="btn ok" target="_blank" rel="noopener" href={waLink('254729455912', t('Hello Pentarch, I need help with Pentarch POS ({b}).', { b: S.business.value?.name }))}><Icon name="whatsapp" />{t('Chat')}</a></Row>
        <Row title={t('Keyboard shortcuts')}><Btn icon="keyboard" onClick={openShortcuts}>{t('Show')}</Btn></Row>
        <Row title={t('Quick guide')}><a class="btn" href="#/help"><Icon name="help" />{t('Open help')}</a></Row>
        <Row title={t('Website')}><a class="btn" href="https://pentarchcommunications.com/systems/pos/" target="_blank" rel="noopener"><Icon name="external" />pentarchcommunications.com</a></Row>
      </Panel>
    </div>
  );
}
