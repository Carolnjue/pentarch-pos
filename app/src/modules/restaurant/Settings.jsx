// Settings → Restaurant & tables.
import { useState } from 'preact/hooks';
import { Switch, Btn, Icon } from '../../ui/kit.jsx';
import { toast } from '../../ui/overlay.jsx';
import { saveBusiness } from '../../auth/session.js';
import { navigate } from '../../router.js';
import { Panel, Row } from '../settings/panels/general.jsx';
import * as S from '../../state.js';
import { t } from '../../i18n/index.js';

export default function RestaurantSettings() {
  const st = S.settings.value;
  const [f, setF] = useState({
    service_charge_pct: st.service_charge_pct || 0, service_charge_dine_in_only: !!st.service_charge_dine_in_only, kot_print: st.kot_print !== false,
    kot_copies: st.kot_copies || 1, ask_guests: st.ask_guests !== false, kitchen_stations: (st.kitchen_stations || ['kitchen', 'bar']).join(', '),
    waiter_pay: !!st.role_perms?.waiter?.['restaurant.take_payment']
  });
  const set = (p) => setF({ ...f, ...p });
  const save = async () => {
    const role_perms = { ...(st.role_perms || {}), waiter: { ...(st.role_perms?.waiter || {}), 'restaurant.take_payment': f.waiter_pay } };
    const stations = f.kitchen_stations.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
    await saveBusiness({ settings: {
      service_charge_pct: Math.max(0, Math.min(30, +f.service_charge_pct || 0)), service_charge_dine_in_only: f.service_charge_dine_in_only, kot_print: f.kot_print,
      kot_copies: Math.max(1, Math.min(3, +f.kot_copies || 1)), ask_guests: f.ask_guests, kitchen_stations: stations.length ? stations : ['kitchen', 'bar'], role_perms
    } });
    toast(t('Saved'));
  };
  return (
    <div class="col gap-l">
      <Panel title={t('Restaurant & tables')} sub={t('Tables, kitchen tickets, bills and waiters')} onSave={save}>
        <Row title={t('Service charge %')} sub={t('Added to the bill. 0 = off')}><input class="input mono num" style={{ width: '90px' }} inputMode="decimal" value={f.service_charge_pct} aria-label={t('Service charge %')} onInput={(e) => set({ service_charge_pct: e.target.value })} /></Row>
        <Row title={t('Service charge on dine-in only')} sub={t('No service charge on takeaway, delivery and counter sales')}><Switch checked={f.service_charge_dine_in_only} onChange={(v) => set({ service_charge_dine_in_only: v })} /></Row>
        <Row title={t('Ask for number of guests')} sub={t('When a table is opened')}><Switch checked={f.ask_guests} onChange={(v) => set({ ask_guests: v })} /></Row>
        <Row title={t('Waiters can take payment')} sub={t('Off = a cashier or manager approves each payment')}><Switch checked={f.waiter_pay} onChange={(v) => set({ waiter_pay: v })} /></Row>
        <Row title={t('Print kitchen tickets')} sub={t('One ticket per station when you tap Send to kitchen')}><Switch checked={f.kot_print} onChange={(v) => set({ kot_print: v })} /></Row>
        <Row title={t('Copies of each kitchen ticket')}><input class="input mono num" style={{ width: '90px' }} inputMode="numeric" value={f.kot_copies} aria-label={t('Copies of each kitchen ticket')} onInput={(e) => set({ kot_copies: e.target.value })} /></Row>
        <Row title={t('Kitchen stations')} sub={t('Separate with commas, e.g. kitchen, bar, grill. Set each product’s station in Products.')}><input class="input" style={{ maxWidth: '240px' }} value={f.kitchen_stations} aria-label={t('Kitchen stations')} onInput={(e) => set({ kitchen_stations: e.target.value })} /></Row>
      </Panel>
      <div class="card pad row wrap">
        <Icon name="utensils" /><div class="grow"><b>{t('Table layout')}</b><div class="small mute">{t('Add tables and areas, drag them to match your room.')}</div></div>
        <Btn icon="edit" onClick={() => navigate('/tables')}>{t('Open tables')}</Btn>
        <Btn icon="monitor" onClick={() => navigate('/kds')}>{t('Kitchen display')}</Btn>
      </div>
    </div>
  );
}
