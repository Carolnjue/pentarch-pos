// Restaurant ↔ Sell screen bridge: order-type bar / table bar above the cart, "sent" badges on lines,
// approval + VOID ticket when a sent item is removed, waiter payment rule, auto-save of the order.
import { useEffect, useState } from 'preact/hooks';
import { cart, updateLine, setQty, removeLine, lineGuards, restoreCart } from '../sell/cart.js';
import { Btn, Icon, Badge } from '../../ui/kit.jsx';
import { Dropdown, toast, confirm } from '../../ui/overlay.jsx';
import { requirePerm } from '../../auth/override.jsx';
import { can } from '../../auth/permissions.js';
import { db } from '../../db/index.js';
import { on } from '../../lib/bus.js';
import { navigate } from '../../router.js';
import { relTime } from '../../lib/util.js';
import * as S from '../../state.js';
import { t, tn } from '../../i18n/index.js';
import {
  orderInCart, flush, unsent, sendToKitchen, voidSent, printBill, transferTo, mergeFrom, setGuests, cancelOrder, leaveOrder,
  createOrder, loadOrder, splitOut, unsplit, ticketsFor, kitchenState, firstName, startAutosave
} from './logic.js';
import './restaurant.css';

const D = () => import('./dialogs.jsx');
const roundQ = (q) => Math.round(q * 1000) / 1000;

/* ---------- guard: removing items already sent to the kitchen ---------- */
lineGuards.add((l, q) => {
  if (!(l.sent_qty > q + 1e-9) || !cart.value.meta?.order_id) return true;
  voidFlow(l, q);
  return false;
});
async function voidFlow(l, q) {
  const by = await requirePerm('restaurant.void_sent', t('Remove {name} (already sent to the kitchen)', { name: l.name }));
  if (!by) return;
  const { askVoidReason } = await D();
  const reason = await askVoidReason(l.name, roundQ(l.sent_qty - q));
  if (!reason) return;
  await voidSent(l, q, reason, by);
  if (!cart.value.lines.find((x) => x.key === l.key)) return;
  updateLine(l.key, { sent_qty: q });
  if (q <= 0) removeLine(l.key, true); else setQty(l.key, q, true);
  toast(t('{name} removed — VOID ticket sent', { name: l.name }), { icon: 'ban' });
}

/* ---------- Sell extension ---------- */
export const sellExt = {
  CartBar,
  LineExtra,
  async beforePay() {
    const oid = orderInCart();
    if (oid) await flush(cart.value);
    if (!can('restaurant.take_payment')) {
      const by = await requirePerm('restaurant.take_payment', t('Take payment'));
      if (!by) return false;
    }
    if (oid && unsent().length && cart.value.orderType === 'dine_in') {
      const n = unsent().length;
      if (await confirm({ title: t('Send new items first?'), message: tn(n, '{n} item has not been sent to the kitchen yet.', '{n} items have not been sent to the kitchen yet.'), ok: t('Send to kitchen'), cancel: t('Pay without sending') })) await doSend();
    }
    return true;
  },
  async onHold() {
    if (!orderInCart()) return false;
    await leaveTo();
    return true;
  }
};

async function doSend() {
  const r = await sendToKitchen();
  if (!r) return;
  if (!r.count) return toast(t('Nothing new to send'), { icon: 'info' });
  const where = r.stations.map((s) => t(s === 'bar' ? 'Bar' : 'Kitchen')).join(' + ');
  toast(r.stations.length ? t('Sent {n} to {where}', { n: r.count, where }) : t('{n} items marked as served', { n: r.count }), { icon: 'check-circle' });
}
async function leaveTo() {
  const kind = cart.value.orderType;
  const name = cart.value.meta?.table_name;
  await leaveOrder();
  if (name) toast(t('Order saved on {name}', { name }), { icon: 'check-circle' });
  navigate(kind === 'dine_in' ? '/tables' : '/orders');
}

function OrderTypeBar() {
  const c = cart.value;
  const n = c.lines.length;
  const makeOrder = async (kind) => {
    const { askOrderInfo } = await D();
    const info = await askOrderInfo(kind);
    if (!info) return;
    const o = await createOrder({ kind, lines: c.lines.map((l) => ({ ...l })), customer: c.customer, info });
    loadOrder({ ...o, customer: c.customer || null });
    toast(kind === 'delivery' ? t('Delivery order #{no} started', { no: o.no }) : t('Takeaway order #{no} started', { no: o.no }), { icon: 'check-circle' });
  };
  const opts = [
    { id: 'counter', label: t('Counter'), icon: 'cart', run: () => {} },
    { id: 'table', label: t('Table'), icon: 'utensils', run: () => navigate(n ? '/tables?attach=1' : '/tables') },
    { id: 'takeaway', label: t('Takeaway'), icon: 'bag', run: () => makeOrder('takeaway') },
    { id: 'delivery', label: t('Delivery'), icon: 'truck', run: () => makeOrder('delivery') }
  ];
  return (
    <div class="ot-bar" role="radiogroup" aria-label={t('Order type')}>
      {opts.map((o) => <button role="radio" aria-checked={o.id === 'counter'} class={'ot' + (o.id === 'counter' ? ' on' : '')} onClick={o.run}><Icon name={o.icon} size={17} /><span>{o.label}</span></button>)}
    </div>
  );
}

function CartBar() {
  const c = cart.value;
  const oid = c.meta?.order_id;
  const [order, setOrder] = useState(null);
  const [kstate, setK] = useState('none');
  const [, tick] = useState(0);
  useEffect(() => {
    if (!oid) { setOrder(null); return; }
    const load = async () => {
      const o = await db().orders.get(oid);
      // the order is gone (another demo, closed on another till): fall back to a plain counter cart
      if (!o || o.deleted || o.status === 'cancelled' || o.status === 'paid') { if (cart.value.meta?.order_id === oid) restoreCart({ ...cart.value, meta: null, heldId: null, tableId: null, orderType: 'retail', lines: o ? [] : cart.value.lines }); return; }
      setOrder(o); setK(kitchenState(await ticketsFor([oid])));
    };
    load();
    const off = on('change', (e) => (e === 'orders' || e === 'kitchen_tickets') && load());
    const iv = setInterval(() => tick((x) => x + 1), 30000);
    return () => { off(); clearInterval(iv); };
  }, [oid]);
  if (!oid) return <OrderTypeBar />;
  const kind = c.orderType;
  const news = unsent(c.lines).length;
  const title = kind === 'dine_in' ? (c.meta.table_name || t('Table')) : (kind === 'delivery' ? t('Delivery') : t('Takeaway')) + ' #' + (c.meta.order_no || '');
  const sub = [
    kind === 'dine_in' && order?.guests ? tn(order.guests, '{n} guest', '{n} guests') : order?.customer_name,
    order?.waiter_name && firstName(order.waiter_name),
    order?.opened_at && relTime(order.opened_at, t)
  ].filter(Boolean).join(' · ');

  const split = async () => {
    if (!c.lines.length) return toast.warn(t('Add items first'));
    const { splitBill } = await D();
    const r = await splitBill(order?.guests);
    if (!r) return;
    if (r.mode === 'equal') {
      if (r.print) return printBill(r.n);
      if (!(await sellExt.beforePay())) return;
      const { openTender } = await import('../sell/Tender.jsx');
      await openTender({ shares: r.n });
      return;
    }
    if (!(await sellExt.beforePay())) return;
    const { part, original } = await splitOut(r.sel);
    const { openTender } = await import('../sell/Tender.jsx');
    const done = await openTender({});
    if (!done) { await unsplit(part, original); return toast(t('Split cancelled — all items are back on the bill'), { icon: 'undo' }); }
    const parent = await db().orders.get(part.parent_id);
    if (parent && parent.lines?.length) { loadOrder(parent); toast(tn(parent.lines.length, 'Part paid. {n} item still on the bill.', 'Part paid. {n} items still on the bill.'), { icon: 'check-circle' }); }
    else if (parent) { const { save } = await import('../../db/repo.js'); await save('orders', { ...parent, status: 'paid' }); navigate('/tables'); }
  };
  const transfer = async () => {
    const { pickTable } = await D();
    const r = await pickTable('free', { exclude: c.tableId });
    if (!r) return;
    await transferTo(r.table);
    toast(t('Moved to {name}', { name: r.table.name }), { icon: 'check-circle' });
  };
  const merge = async () => {
    const { pickTable } = await D();
    const r = await pickTable('busy', { exclude: c.tableId });
    if (!r?.order) return;
    if (!(await confirm({ title: t('Merge {a} into {b}?', { a: r.table.name, b: c.meta.table_name }), message: t('All items from {a} move to this bill and {a} becomes free.', { a: r.table.name }), ok: t('Merge tables') }))) return;
    await mergeFrom(r.order);
    toast(t('{a} merged into {b}', { a: r.table.name, b: c.meta.table_name }), { icon: 'link' });
  };
  const guests = async () => {
    const { askGuests } = await D();
    const n = await askGuests(null, order?.guests || 1);
    if (n) await setGuests(n);
  };
  const cancel = async () => {
    const sent = c.lines.filter((l) => l.sent_qty > 0);
    if (sent.length) {
      const by = await requirePerm('restaurant.void_sent', t('Cancel order with items already sent'));
      if (!by) return;
      const { askVoidReason } = await D();
      const reason = await askVoidReason(t('the whole order'), tn(sent.length, '{n} item', '{n} items'));
      if (!reason) return;
      for (const l of sent) await voidSent(l, 0, reason, by);
      await cancelOrder(reason);
    } else {
      if (!(await confirm({ title: t('Cancel this order?'), message: t('Nothing was sent to the kitchen. The order will be removed.'), danger: true, ok: t('Cancel order'), cancel: t('Keep order') }))) return;
      await cancelOrder('');
    }
    toast(t('Order cancelled'), { icon: 'trash' });
    navigate(kind === 'dine_in' ? '/tables' : '/orders');
  };
  const editInfo = async () => {
    const { askOrderInfo } = await D();
    const info = await askOrderInfo(kind === 'delivery' ? 'delivery' : 'takeaway', { name: order?.customer_name, phone: order?.phone, address: order?.address, rider: order?.rider });
    if (!info || !order) return;
    const { save } = await import('../../db/repo.js');
    await flush(cart.value);
    const cur = await db().orders.get(order.id);
    await save('orders', { ...cur, customer_name: info.name, phone: info.phone, address: info.address, rider: info.rider });
  };
  return (
    <div class="tbar">
      <div class="tbar-h">
        <span class="tb-ico"><Icon name={kind === 'dine_in' ? 'utensils' : kind === 'delivery' ? 'truck' : 'bag'} size={20} /></span>
        <div class="grow ellipsis"><b class="tb-name">{title}</b><div class="small mute ellipsis">{sub}</div></div>
        {order?.status === 'billed' && <Badge tone="warn">{t('Bill printed')}</Badge>}
        {kstate === 'ready' && <Badge tone="ok">{t('Food ready')}</Badge>}
        <Btn size="sm" icon="arrow-left" onClick={leaveTo} title={t('Save and go back')}>{kind === 'dine_in' ? t('Tables') : t('Orders')}</Btn>
      </div>
      <div class="tbar-a">
        <Btn variant={news ? 'primary' : ''} class="tb-send" disabled={!news} onClick={doSend}>
          <Icon name={news ? 'utensils' : 'check'} size={18} />{news ? t('Send to kitchen') : t('All sent')}{news > 0 && <span class="tb-n">{news}</span>}
        </Btn>
        <Btn icon="print" onClick={() => (c.lines.length ? printBill() : toast.warn(t('Add items first')))}>{t('Print bill')}</Btn>
        <Btn icon="users" onClick={split}>{t('Split bill')}</Btn>
        <Dropdown width="250px" trigger={({ toggle }) => <Btn icon="more" onClick={toggle} aria-label={t('More order actions')} />}>
          {kind === 'dine_in' && <button onClick={transfer}><Icon name="utensils" size={18} />{t('Move to another table')}</button>}
          {kind === 'dine_in' && <button onClick={merge}><Icon name="link" size={18} />{t('Merge tables')}</button>}
          {kind === 'dine_in' && <button onClick={guests}><Icon name="users" size={18} />{t('Change number of guests')}</button>}
          {kind !== 'dine_in' && <button onClick={editInfo}><Icon name="edit" size={18} />{t('Customer & delivery details')}</button>}
          <hr />
          <button onClick={cancel}><Icon name="trash" size={18} />{t('Cancel order')}</button>
        </Dropdown>
      </div>
    </div>
  );
}

function LineExtra({ l }) {
  if (!cart.value.meta?.order_id) return null;
  const sent = l.sent_qty || 0;
  if (sent >= l.qty - 1e-9 && sent > 0) return <span class="badge ok sent-b"><Icon name="check" size={11} />{t('Sent')}</span>;
  if (sent > 0) return <span class="badge warn sent-b">{t('{n} new', { n: roundQ(l.qty - sent) })}</span>;
  return <span class="badge warn sent-b">{t('New')}</span>;
}

startAutosave();
