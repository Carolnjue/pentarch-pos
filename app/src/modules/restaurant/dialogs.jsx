// Restaurant dialogs: guests, takeaway/delivery details, table picker (transfer / merge / attach), split bill, void reason.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { openModal, Modal, toast } from '../../ui/overlay.jsx';
import { Btn, Icon, Input, Seg, Empty, Textarea } from '../../ui/kit.jsx';
import { money, kes } from '../../lib/money.js';
import { normPhone } from '../../lib/util.js';
import { cart, totals } from '../sell/cart.js';
import { computeCart } from '../../core/pricing.js';
import { loadTables, openOrders, orderInCart, firstName, natural } from './logic.js';
import * as S from '../../state.js';
import { t, tn } from '../../i18n/index.js';

/* ---------- guests ---------- */
export const askGuests = (table, current) => openModal((close) => <Guests table={table} current={current} close={close} />);
function Guests({ table, current, close }) {
  const [more, setMore] = useState('');
  const nums = [1, 2, 3, 4, 5, 6, 7, 8];
  return (
    <Modal title={table ? t('{name} — how many guests?', { name: table.name }) : t('How many guests?')} icon="users" size="sm" center onClose={() => close(null)}>
      <div class="guest-grid">
        {nums.map((n) => <button class={'guest-btn' + ((current || table?.seats) === n ? ' sug' : '')} onClick={() => close(n)} aria-label={tn(n, '{n} guest', '{n} guests')}>{n}</button>)}
      </div>
      <div class="row" style={{ marginTop: '12px' }}>
        <input class="input mono num" inputMode="numeric" placeholder={t('More…')} value={more} onInput={(e) => setMore(e.target.value.replace(/\D/g, ''))} aria-label={t('Number of guests')} onKeyDown={(e) => e.key === 'Enter' && +more > 0 && close(+more)} />
        <Btn variant="primary" disabled={!(+more > 0)} onClick={() => close(+more)}>{t('OK')}</Btn>
      </div>
      {!current && <Btn variant="ghost" class="block" style={{ marginTop: '8px' }} onClick={() => close(0)}>{t('Skip — open the table')}</Btn>}
    </Modal>
  );
}

/* ---------- takeaway / delivery details ---------- */
export const askOrderInfo = (kind, init = {}) => openModal((close) => <OrderInfo kind={kind} init={init} close={close} />);
function OrderInfo({ kind, init, close }) {
  const c = cart.value.customer;
  const [f, setF] = useState({ name: init.name ?? c?.name ?? '', phone: init.phone ?? c?.phone ?? '', address: init.address || '', rider: init.rider || '', note: init.note || '' });
  const set = (p) => setF({ ...f, ...p });
  const riders = S.users.value.filter((u) => u.active !== false && !u.deleted);
  const ok = () => {
    if (kind === 'delivery') {
      if (!normPhone(f.phone)) return toast.error(t('Enter a valid Kenyan phone number'));
      if (!f.address.trim()) return toast.error(t('Enter the delivery address'));
    } else if (f.phone && !normPhone(f.phone)) return toast.error(t('Enter a valid Kenyan phone number'));
    close({ ...f, name: f.name.trim(), phone: normPhone(f.phone) || '', address: f.address.trim() });
  };
  return (
    <Modal title={kind === 'delivery' ? t('Delivery order') : t('Takeaway order')} icon={kind === 'delivery' ? 'truck' : 'bag'} size="sm" center onClose={() => close(null)}
      footer={<><Btn onClick={() => close(null)}>{t('Cancel')}</Btn><Btn variant="primary" icon="check" onClick={ok}>{t('Save order')}</Btn></>}>
      <div class="col">
        <Input label={t('Customer name')} value={f.name} onValue={(v) => set({ name: v })} placeholder={t('e.g. Jane')} data-autofocus />
        <Input label={kind === 'delivery' ? t('Phone') : t('Phone (optional)')} type="tel" value={f.phone} onValue={(v) => set({ phone: v })} placeholder="07xx xxx xxx" />
        {kind === 'delivery' && <Textarea label={t('Delivery address')} value={f.address} onValue={(v) => set({ address: v })} placeholder={t('Estate, building, house number, landmark')} rows={2} />}
        {kind === 'delivery' && (
          <div class="field"><label>{t('Rider')}</label>
            <input class="input" list="pp-riders" value={f.rider} onInput={(e) => set({ rider: e.target.value })} placeholder={t('Name of rider (can be added later)')} aria-label={t('Rider')} />
            <datalist id="pp-riders">{riders.map((u) => <option value={u.name} />)}</datalist>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ---------- table picker: transfer / merge / attach ---------- */
/** mode: 'free' (transfer), 'busy' (merge), 'any' (attach). Resolves {table, order?} or null. */
export const pickTable = (mode, { exclude, title } = {}) => openModal((close) => <TablePick mode={mode} exclude={exclude} title={title} close={close} />);
function TablePick({ mode, exclude, title, close }) {
  const [data, setData] = useState(null);
  useEffect(() => { Promise.all([loadTables(), openOrders()]).then(([tables, orders]) => setData({ tables, orders })); }, []);
  if (!data) return null;
  const busy = new Map(data.orders.filter((o) => o.kind === 'table' && o.table_id).map((o) => [o.table_id, o]));
  const list = data.tables.filter((tb) => tb.id !== exclude && (mode === 'any' || (mode === 'free' ? !busy.has(tb.id) : busy.has(tb.id) && busy.get(tb.id).id !== orderInCart())));
  const areas = [...new Set(list.map((x) => x.area || ''))];
  return (
    <Modal title={title || (mode === 'busy' ? t('Merge with which table?') : t('Move to which table?'))} icon={mode === 'busy' ? 'link' : 'utensils'} size="lg" onClose={() => close(null)}>
      {!list.length ? <Empty icon="utensils" title={mode === 'busy' ? t('No other table has an open order') : t('No free tables')} text={mode === 'busy' ? t('Merging joins two open bills into one.') : t('All tables are taken. Free a table first or merge.')} />
        : areas.map((a) => (
          <div class="mb">
            {a && <div class="section-title" style={{ marginTop: 0 }}>{a}</div>}
            <div class="pick-grid">
              {list.filter((x) => (x.area || '') === a).sort((x, y) => natural(x.name, y.name)).map((tb) => {
                const o = busy.get(tb.id);
                return (
                  <button class={'pick-t' + (o ? ' busy' : '')} onClick={() => close({ table: tb, order: o || null })}>
                    <b>{tb.name}</b>
                    <span class="small">{o ? money(orderTotalQuick(o)) + (o.waiter_name ? ' · ' + firstName(o.waiter_name) : '') : tn(tb.seats || 0, '{n} seat', '{n} seats')}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
    </Modal>
  );
}
const orderTotalQuick = (o) => computeCart(o.lines || [], { vatRegistered: !!S.business.value?.vat_registered, inclusive: S.settings.value.vat_inclusive !== false }).total;

/* ---------- split bill ---------- */
/** Resolves {mode:'items', sel:{key:qty}} | {mode:'equal', n} | null */
export const splitBill = (guests) => openModal((close) => <Split guests={guests} close={close} />);
function Split({ guests, close }) {
  const [mode, setMode] = useState('items');
  const [sel, setSel] = useState({});
  const [n, setN] = useState(Math.max(2, guests || 2));
  const lines = cart.value.lines;
  const total = totals.value.total;
  const partCalc = useMemo(() => {
    const ls = lines.filter((l) => sel[l.key] > 0).map((l) => ({ ...l, qty: sel[l.key] }));
    const st = S.settings.value;
    return computeCart(ls, { vatRegistered: !!S.business.value?.vat_registered, inclusive: st.vat_inclusive !== false, rounding: !!st.rounding, serviceChargePct: !st.service_charge_dine_in_only || cart.value.orderType === 'dine_in' ? Number(st.service_charge_pct) || 0 : 0 });
  }, [sel]);
  const pickedItems = Object.values(sel).reduce((a, b) => a + b, 0);
  const allPicked = lines.every((l) => (sel[l.key] || 0) >= l.qty);
  const step = (l, d) => setSel({ ...sel, [l.key]: Math.max(0, Math.min(l.qty, (sel[l.key] || 0) + d)) });
  return (
    <Modal title={t('Split bill')} icon="users" size="lg" onClose={() => close(null)}
      footer={mode === 'items'
        ? <><span class="grow"><span class="mute small">{t('This part')}</span><br /><b class="mono" style={{ fontSize: '20px' }}>{money(partCalc.total)}</b></span>
            <Btn variant="primary" size="lg" icon="wallet" disabled={!pickedItems || allPicked} onClick={() => close({ mode: 'items', sel })}>{t('Pay for these items')}</Btn></>
        : <><Btn icon="print" onClick={() => close({ mode: 'equal', n, print: true })}>{t('Print bill with shares')}</Btn><span class="spacer" /><Btn variant="primary" size="lg" icon="wallet" onClick={() => close({ mode: 'equal', n })}>{t('Take payments')}</Btn></>}>
      <Seg value={mode} onValue={setMode} options={[{ value: 'items', label: t('By items'), icon: 'list' }, { value: 'equal', label: t('Equally'), icon: 'users' }]} />
      {mode === 'items' ? (
        <>
          <p class="mute" style={{ margin: '12px 0 8px' }}>{t('Tap + on the items this person is paying for. The rest stays on the table.')}</p>
          <div class="card">
            {lines.map((l) => (
              <div class="list-item">
                <div class="grow"><b>{l.name}</b><div class="small mute">{l.qty} × {kes(l.price)}{l.modifiers?.length ? ' · ' + l.modifiers.map((m) => m.name).join(', ') : ''}</div></div>
                <div class="qty">
                  <button onClick={() => step(l, -1)} aria-label={t('Less')}><Icon name="minus" size={16} /></button>
                  <input readOnly value={(sel[l.key] || 0) + ' / ' + l.qty} aria-label={t('Quantity')} style={{ width: '64px' }} />
                  <button onClick={() => step(l, 1)} aria-label={t('More')}><Icon name="plus" size={16} /></button>
                </div>
              </div>
            ))}
          </div>
          {allPicked && <div class="callout warn mt"><Icon name="info" size={18} />{t('You picked everything — just use Pay instead.')}</div>}
        </>
      ) : (
        <div class="col" style={{ marginTop: '14px' }}>
          <div class="row"><span class="grow">{t('Number of people')}</span>
            <div class="qty"><button onClick={() => setN(Math.max(2, n - 1))} aria-label={t('Less')}><Icon name="minus" size={16} /></button><input readOnly value={n} aria-label={t('Number of people')} /><button onClick={() => setN(Math.min(30, n + 1))} aria-label={t('More')}><Icon name="plus" size={16} /></button></div>
          </div>
          <div class="card pad center" style={{ background: 'var(--paper)' }}>
            <div class="mute">{t('Each person pays')}</div>
            <div class="big-num">{money(Math.ceil(total / n / 100) * 100)}</div>
            <div class="small mute">{t('Total {a}', { a: money(total) })}</div>
          </div>
          <p class="mute small" style={{ margin: 0 }}>{t('Each person can pay with cash, M-Pesa or card. The payment screen shows how many have paid.')}</p>
        </div>
      )}
    </Modal>
  );
}

/* ---------- void reason ---------- */
export const askVoidReason = (name, qty) => openModal((close) => <VoidReason name={name} qty={qty} close={close} />);
function VoidReason({ name, qty, close }) {
  const [v, setV] = useState('');
  const opts = [t('Customer changed their mind'), t('Entered by mistake'), t('Out of stock'), t('Took too long')];
  return (
    <Modal title={t('Remove {n} × {name}?', { n: qty, name })} icon="ban" iconColor="var(--coral-d)" size="sm" center onClose={() => close(null)}
      footer={<><Btn onClick={() => close(null)}>{t('Keep it')}</Btn><Btn variant="primary" icon="ban" disabled={!v.trim()} onClick={() => close(v.trim())}>{t('Remove & tell kitchen')}</Btn></>}>
      <p class="mute" style={{ marginTop: 0 }}>{t('This item was already sent. A VOID ticket will go to the kitchen.')}</p>
      <div class="col">{opts.map((o) => <button class={'chip' + (v === o ? ' on' : '')} style={{ height: '44px', justifyContent: 'flex-start' }} onClick={() => setV(o)}>{o}</button>)}</div>
      <Input label={t('Other reason')} value={opts.includes(v) ? '' : v} onValue={setV} class="mt" />
    </Modal>
  );
}
