// Settings → Services & commission: commission % per staff member and per service, staff picker behaviour.
import { useEffect, useState } from 'preact/hooks';
import { Switch, Avatar, Badge } from '../../ui/kit.jsx';
import { toast } from '../../ui/overlay.jsx';
import { saveBusiness } from '../../auth/session.js';
import { saveMany } from '../../db/repo.js';
import { db } from '../../db/index.js';
import { kes } from '../../lib/money.js';
import { Panel, Row } from '../settings/panels/general.jsx';
import * as S from '../../state.js';
import { t } from '../../i18n/index.js';
import { serviceStaff, isService } from './logic.js';

const pctIn = (v) => (v === '' || v == null ? null : Math.max(0, Math.min(100, parseFloat(v) || 0)));
export default function ServicesSettings() {
  const st = S.settings.value;
  const [opt, setOpt] = useState({ services_ask_staff: st.services_ask_staff ?? null, commission_on_products: !!st.commission_on_products });
  const [staff, setStaff] = useState(() => Object.fromEntries(serviceStaff().map((u) => [u.id, u.commission_pct ? String(u.commission_pct) : ''])));
  const [svc, setSvc] = useState(null);
  const [rates, setRates] = useState({});
  useEffect(() => { db().products.toArray().then((ps) => { const l = ps.filter((p) => !p.deleted && isService(p)).sort((a, b) => a.name.localeCompare(b.name)); setSvc(l); setRates(Object.fromEntries(l.map((p) => [p.id, p.commission_pct != null && p.commission_pct !== '' ? String(p.commission_pct) : '']))); }); }, []);
  const askOn = opt.services_ask_staff === true || (opt.services_ask_staff !== false && serviceStaff().some((u) => u.commission_pct > 0));
  const saveOpts = async () => { await saveBusiness({ settings: opt }); toast(t('Saved')); };
  const saveStaff = async () => {
    const us = serviceStaff().filter((u) => (pctIn(staff[u.id]) || 0) !== (u.commission_pct || 0)).map((u) => ({ ...u, commission_pct: pctIn(staff[u.id]) || 0 }));
    await saveMany('users', us);
    S.users.value = S.users.value.map((u) => us.find((x) => x.id === u.id) || u);
    toast(t('Saved'));
  };
  const saveSvc = async () => {
    const ch = svc.filter((p) => pctIn(rates[p.id]) !== (p.commission_pct ?? null)).map((p) => ({ ...p, commission_pct: pctIn(rates[p.id]) }));
    await saveMany('products', ch);
    setSvc(svc.map((p) => ch.find((x) => x.id === p.id) || p));
    toast(t('Saved'));
  };
  return (
    <div class="col gap-l">
      <Panel title={t('Services & commission')} sub={t('Who did each service, and what they earn')} onSave={saveOpts}>
        <Row title={t('Ask who did the service when it is added')} sub={t('A quick staff picker pops up on the Sell screen')}><Switch checked={askOn} onChange={(v) => setOpt({ ...opt, services_ask_staff: v })} /></Row>
        <Row title={t('Pay commission on products too')} sub={t('Off = only services earn commission (unless a product has its own rate)')}><Switch checked={opt.commission_on_products} onChange={(v) => setOpt({ ...opt, commission_on_products: v })} /></Row>
      </Panel>
      <Panel title={t('Commission per staff member')} sub={t('Used for every service that has no rate of its own')} onSave={saveStaff}>
        {serviceStaff().map((u) => (
          <div class="set-row"><Avatar name={u.name} size={32} /><div class="d"><b>{u.name}</b><small>{t(u.role === 'owner' ? 'Owner' : u.role === 'manager' ? 'Manager' : u.role === 'waiter' ? 'Waiter' : 'Cashier')}</small></div>
            <div class="row gap-s"><input class="input mono num" style={{ width: '80px' }} inputMode="decimal" value={staff[u.id]} placeholder="0" aria-label={t('Commission % for {name}', { name: u.name })} onInput={(e) => setStaff({ ...staff, [u.id]: e.target.value })} /><span class="mute">%</span></div></div>
        ))}
      </Panel>
      <Panel title={t('Commission per service')} sub={t('Leave empty to use the staff member’s rate')} onSave={saveSvc}>
        {!svc ? null : !svc.length ? <p class="mute">{t('No services yet. Add products of type “Service” first.')}</p> : svc.map((p) => (
          <div class="set-row"><div class="d"><b>{p.name}</b><small>{kes(p.price)}{p.service_duration_min ? ' · ' + p.service_duration_min + ' min' : ''}</small></div>
            {rates[p.id] !== '' && <Badge tone="navy">{t('Own rate')}</Badge>}
            <div class="row gap-s"><input class="input mono num" style={{ width: '80px' }} inputMode="decimal" value={rates[p.id]} placeholder={t('staff')} aria-label={t('Commission % for {name}', { name: p.name })} onInput={(e) => setRates({ ...rates, [p.id]: e.target.value })} /><span class="mute">%</span></div></div>
        ))}
      </Panel>
    </div>
  );
}
