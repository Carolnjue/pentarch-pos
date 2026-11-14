// Promotions: % off, amount off or fixed price on products/categories, by date range, days and hours.
import { useEffect, useState } from 'preact/hooks';
import { Btn, Icon, Input, Select, Badge, Empty, Switch } from '../../../ui/kit.jsx';
import { openModal, Modal, toast, confirm } from '../../../ui/overlay.jsx';
import { db } from '../../../db/index.js';
import { save, remove } from '../../../db/repo.js';
import { catalog } from '../../../db/catalog.js';
import { parseMoney, money } from '../../../lib/money.js';
import { pickProduct } from '../../products/picker.jsx';
import { promos } from '../../sell/cart.js';
import { Panel } from './general.jsx';
import { t } from '../../../i18n/index.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export default function PromotionsPanel() {
  const [list, setList] = useState([]);
  const load = () => db().promotions.toArray().then((p) => { const live = p.filter((x) => !x.deleted); setList(live); promos.value = live.filter((x) => x.active !== false); });
  useEffect(load, []);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Panel title={t('Promotions')} sub={t('Applied automatically on the Sell screen.')} extra={<Btn variant="primary" icon="plus" onClick={async () => { if (await editPromo()) load(); }}>{t('New promotion')}</Btn>}>
      {list.map((p) => {
        const live = p.active !== false && (!p.start || p.start <= today) && (!p.end || p.end >= today);
        return (
          <div class="list-item click" onClick={async () => { if (await editPromo(p)) load(); }}>
            <span class="ico-bub" style={{ background: live ? 'var(--teal-50)' : 'var(--paper-2)', color: live ? 'var(--teal-d)' : 'var(--mute)' }}><Icon name="gift" size={18} /></span>
            <div class="grow"><b>{p.name}</b><div class="small mute">{p.type === 'pct' ? p.value + '% ' + t('off') : p.type === 'amount' ? money(p.value) + ' ' + t('off') : t('Price {p}', { p: money(p.value) })} · {t('{n} products, {c} categories', { n: p.product_ids?.length || 0, c: p.category_ids?.length || 0 })}{p.start || p.end ? ` · ${p.start || '…'} → ${p.end || '…'}` : ''}{p.hours ? ' · ' + p.hours : ''}</div></div>
            <Badge tone={live ? 'ok' : ''}>{live ? t('Running') : t('Not running')}</Badge>
          </div>
        );
      })}
      {!list.length && <Empty icon="gift" title={t('No promotions yet')} text={t('e.g. “Happy hour 10% off beers 5–7pm” or “Weekend: Kimbo 1kg at KES 399”.')} />}
    </Panel>
  );
}
const editPromo = (p) => openModal((close) => <PromoEdit p={p} close={close} />);
function PromoEdit({ p, close }) {
  const [f, setF] = useState(p ? { ...p } : { name: '', type: 'pct', value: 10, product_ids: [], category_ids: [], start: new Date().toISOString().slice(0, 10), end: '', days_of_week: [], hours: '', active: true });
  const [val, setVal] = useState(p ? (p.type === 'pct' ? String(p.value) : String(p.value / 100)) : '10');
  const set = (x) => setF({ ...f, ...x });
  const go = async () => {
    if (!f.name.trim()) return toast.error(t('Enter a name'));
    if (!f.product_ids.length && !f.category_ids.length) return toast.error(t('Choose products or categories'));
    if (f.hours && !/^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(f.hours)) return toast.error(t('Hours like 17:00-19:00'));
    const value = f.type === 'pct' ? parseFloat(val) || 0 : parseMoney(val) || 0;
    await save('promotions', { ...f, value }, { audit: { action: p ? 'promotion.update' : 'promotion.create', details: { name: f.name } } });
    close(true);
  };
  return (
    <Modal title={p ? p.name : t('New promotion')} icon="gift" size="lg" onClose={() => close(false)}
      footer={<>{p && <Btn variant="danger" icon="trash" onClick={async () => { if (await confirm({ title: t('Delete promotion?'), danger: true, ok: t('Delete') })) { await remove('promotions', p.id); close(true); } }}>{t('Delete')}</Btn>}<span class="spacer" /><Btn onClick={() => close(false)}>{t('Cancel')}</Btn><Btn variant="primary" onClick={go}>{t('Save')}</Btn></>}>
      <div class="form-grid">
        <Input class="span2" label={t('Name')} value={f.name} onValue={(v) => set({ name: v })} autoFocus />
        <Select label={t('Type')} value={f.type} onValue={(v) => set({ type: v })} options={[{ value: 'pct', label: t('Percent off') }, { value: 'amount', label: t('Amount off (KES)') }, { value: 'price', label: t('Fixed price (KES)') }]} />
        <Input label={f.type === 'pct' ? t('Percent') : t('KES')} value={val} onValue={setVal} inputClass="mono num" />
        <Input label={t('Starts')} type="date" value={f.start} onValue={(v) => set({ start: v })} />
        <Input label={t('Ends')} type="date" value={f.end} onValue={(v) => set({ end: v })} />
        <Input label={t('Hours (optional)')} value={f.hours} onValue={(v) => set({ hours: v })} placeholder="17:00-19:00" />
        <div class="field full"><label>{t('Days (none = every day)')}</label><div class="row wrap gap-s">{DAYS.map((d, i) => <button class={'chip' + (f.days_of_week.includes(i) ? ' on' : '')} onClick={() => set({ days_of_week: f.days_of_week.includes(i) ? f.days_of_week.filter((x) => x !== i) : [...f.days_of_week, i] })}>{t(d)}</button>)}</div></div>
        <div class="field full"><label>{t('Categories')}</label><div class="row wrap gap-s">{catalog.value.categories.map((c) => <button class={'chip' + (f.category_ids.includes(c.id) ? ' on' : '')} onClick={() => set({ category_ids: f.category_ids.includes(c.id) ? f.category_ids.filter((x) => x !== c.id) : [...f.category_ids, c.id] })}>{c.name}</button>)}</div></div>
        <div class="field full"><label>{t('Products')}</label>
          <div class="row wrap gap-s">{f.product_ids.map((id) => <span class="chip on">{catalog.value.byId.get(id)?.name}<button class="btn ghost icon xs" style={{ color: '#fff' }} aria-label={t('Remove')} onClick={() => set({ product_ids: f.product_ids.filter((x) => x !== id) })}><Icon name="x" size={12} /></button></span>)}
            <Btn size="sm" icon="plus" onClick={async () => { const pr = await pickProduct(); if (pr && !f.product_ids.includes(pr.id)) set({ product_ids: [...f.product_ids, pr.id] }); }}>{t('Add product')}</Btn></div></div>
        <div class="full"><Switch checked={f.active !== false} onChange={(v) => set({ active: v })} label={t('Active')} /></div>
      </div>
    </Modal>
  );
}
