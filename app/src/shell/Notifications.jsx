// Bell menu: low stock, expiring batches, unsynced changes, backup reminder, licence.
import { useEffect, useState } from 'preact/hooks';
import { Dropdown } from '../ui/overlay.jsx';
import { Icon } from '../ui/kit.jsx';
import { catalog, levels } from '../db/catalog.js';
import { db, getMeta } from '../db/index.js';
import * as S from '../state.js';
import { licenceState } from '../auth/session.js';
import { can } from '../auth/permissions.js';
import { t } from '../i18n/index.js';
import { DAY } from '../lib/util.js';

export function lowStockList() {
  const lv = levels.value;
  return catalog.value.products.filter((p) => p.track_stock && p.active !== false && !p.has_variants && (lv.get(p.id) || 0) <= (p.reorder_level || 0));
}
export function Notifications() {
  const [exp, setExp] = useState(0);
  const [backupDue, setBackupDue] = useState(false);
  useEffect(() => {
    const days = S.settings.value.notify_expiry_days || 30;
    const lim = new Date(Date.now() + days * DAY).toISOString().slice(0, 10);
    db().batches.where('expiry').below(lim).count().then(setExp).catch(() => {});
    if (!S.isDemo.value) getMeta('last_backup_at').then((at) => setBackupDue(!at || Date.now() - at > (S.settings.value.notify_backup_days || 7) * DAY));
  }, [catalog.value.version]);
  const low = S.settings.value.notify_low_stock ? lowStockList().length : 0;
  const pend = S.sync.value.pending;
  const lic = licenceState();
  const items = [];
  if (low) items.push({ icon: 'box', tone: 'warn', text: t('{n} products are low on stock', { n: low }), href: '#/products?filter=low' });
  if (exp) items.push({ icon: 'calendar', tone: 'bad', text: t('{n} batches expire within {d} days', { n: exp, d: S.settings.value.notify_expiry_days || 30 }), href: '#/products?filter=expiring' });
  if (pend && !S.online.value) items.push({ icon: 'wifi-off', tone: 'warn', text: t('{n} changes waiting to sync — they will upload when you are online', { n: pend }) });
  if (backupDue && can('backup.manage')) items.push({ icon: 'database', tone: 'warn', text: t('Download a backup of your data'), href: '#/settings/backup' });
  if (lic.days_left != null && lic.days_left <= 7) items.push({ icon: 'calendar', tone: 'bad', text: t('Licence: {n} days left', { n: Math.max(0, lic.days_left) }), href: '#/settings/licence' });
  return (
    <Dropdown width="340px" trigger={({ toggle }) => (
      <button class="btn ghost icon sm" onClick={toggle} aria-label={t('Notifications')} style={{ position: 'relative' }}>
        <Icon name="bell" />
        {items.length > 0 && <span style={{ position: 'absolute', top: '4px', right: '4px', minWidth: '17px', height: '17px', borderRadius: '9px', background: 'var(--coral-d)', color: '#fff', font: '700 10.5px/17px var(--f-body)', textAlign: 'center', padding: '0 4px' }}>{items.length}</span>}
      </button>
    )}>
      <div class="lbl">{t('Notifications')}</div>
      {!items.length && <div style={{ padding: '14px 10px', color: 'var(--mute)' }}>{t('All good — nothing needs your attention.')}</div>}
      {items.map((x) => (
        <a href={x.href || '#'} onClick={(e) => !x.href && e.preventDefault()} style={{ alignItems: 'flex-start', padding: '8px 10px', minHeight: 0 }}>
          <span class="ico-bub" style={{ width: '30px', height: '30px', borderRadius: '9px', background: x.tone === 'bad' ? 'var(--coral-50)' : 'var(--sun-50)', color: x.tone === 'bad' ? 'var(--coral-d)' : 'var(--sun-d)' }}><Icon name={x.icon} size={16} /></span>
          <span style={{ whiteSpace: 'normal', lineHeight: 1.3, paddingTop: '5px' }}>{x.text}</span>
        </a>
      ))}
    </Dropdown>
  );
}
