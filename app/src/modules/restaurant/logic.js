// Restaurant logic (no JSX): table orders, kitchen tickets (KOT / KDS), bills, transfer, merge, split, void.
// Orders are `orders` records (kind 'table' | 'takeaway' | 'delivery'); while an order is open on the Sell screen it lives
// in the cart (cart.heldId = order id, cart.meta.order_id) and is auto-saved back to the order.
import { effect } from '@preact/signals';
import { db, getMeta, setMeta, isDemoDb } from '../../db/index.js';
import { save, saveMany, audit, tx } from '../../db/repo.js';
import { catalog } from '../../db/catalog.js';
import { computeCart } from '../../core/pricing.js';
import { cart, emptyCart, restoreCart, clearCart, totals } from '../sell/cart.js';
import { doc, printHtml } from '../../print/print.js';
import { esc, prettyPhone } from '../../lib/util.js';
import { money, kes } from '../../lib/money.js';
import { syncNow } from '../../sync/client.js';
import * as S from '../../state.js';
import { t } from '../../i18n/index.js';

export const KIND_TYPE = { table: 'dine_in', takeaway: 'takeaway', delivery: 'delivery' };
export const STEPS = {
  takeaway: ['new', 'preparing', 'ready', 'collected'],
  delivery: ['new', 'preparing', 'ready', 'on_the_way', 'delivered']
};
export const STEP_LABEL = { new: 'New', preparing: 'Preparing', ready: 'Ready', collected: 'Collected', on_the_way: 'On the way', delivered: 'Delivered' };
export const STATION_LABEL = { kitchen: 'Kitchen', bar: 'Bar' };
export const stationLabel = (s) => t(STATION_LABEL[s] || (s ? s[0].toUpperCase() + s.slice(1) : 'Kitchen'));

const here = (r) => !r.deleted && (!r.branch_id || !S.branch.value?.id || r.branch_id === S.branch.value.id);
export const firstName = (n) => String(n || '').split(' ')[0];

/* ---------------- reading ---------------- */
export async function loadTables() {
  return (await db().table('tables').toArray()).filter(here).sort((a, b) => (a.area || '').localeCompare(b.area || '') || natural(a.name, b.name));
}
export const natural = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });
/** Open (not paid / cancelled) restaurant orders in this branch. */
export async function openOrders() {
  return (await db().orders.where('status').anyOf('open', 'billed').toArray()).filter((o) => here(o) && o.kind !== 'held');
}
export async function ticketsFor(orderIds) {
  if (!orderIds.length) return [];
  return (await db().kitchen_tickets.where('order_id').anyOf(orderIds).toArray()).filter((x) => !x.deleted);
}
/** Kitchen state of an order from its tickets: 'none' | 'cooking' | 'ready'. */
export function kitchenState(tks) {
  const orders = tks.filter((x) => x.kind !== 'void');
  if (!orders.length) return 'none';
  return orders.every((x) => x.status === 'done') ? 'ready' : 'cooking';
}

/** Cart-equivalent totals of an order (same options as the Sell screen). */
export function orderCalc(o) {
  const st = S.settings.value;
  const type = KIND_TYPE[o.kind] || 'retail';
  const sc = !st.service_charge_dine_in_only || type === 'dine_in';
  const opts = { vatRegistered: !!S.business.value?.vat_registered, inclusive: st.vat_inclusive !== false, rounding: !!st.rounding, serviceChargePct: sc ? Number(st.service_charge_pct) || 0 : 0 };
  const base = computeCart(o.lines || [], { ...opts, rounding: false, serviceChargePct: 0 });
  const d = o.cart_discount_obj;
  const cd = !d?.value ? 0 : d.type === 'amount' ? d.value : Math.round(((base.subtotal - base.line_discount) * d.value) / 100);
  return computeCart(o.lines || [], { ...opts, cartDiscount: cd });
}

async function nextOrderNo() {
  const seq = ((await getMeta('order_seq')) || 0) + 1;
  await setMeta('order_seq', seq);
  return `${S.device.value?.no || 1}-${String(seq).padStart(3, '0')}`;
}

/* ---------------- creating & loading ---------------- */
export async function createOrder({ kind = 'table', table = null, guests = 0, lines = [], customer = null, info = {} }) {
  const u = S.user.value;
  const o = await save('orders', {
    kind, no: await nextOrderNo(), table_id: table?.id || null, table_name: table?.name || '', area: table?.area || '', guests: guests || 0,
    waiter_id: u?.id || null, waiter_name: u?.name || '', lines, status: 'open', note: '', round: 0, opened_at: Date.now(),
    customer_id: customer?.id || null, customer_name: info.name || customer?.name || '', phone: info.phone || customer?.phone || '', address: info.address || '', rider: info.rider || '',
    delivery_status: kind === 'table' ? null : 'new', branch_id: S.branch.value?.id || null
  }, { audit: { action: 'order.open', details: { kind, table: table?.name || '', guests } } });
  return o;
}

/** Put an order into the Sell cart. */
export function loadOrder(o) {
  restoreCart({
    ...emptyCart(), lines: (o.lines || []).map((l) => ({ ...l })), heldId: o.id, orderType: KIND_TYPE[o.kind] || 'dine_in', tableId: o.table_id || null,
    customer: o.customer || null, note: o.note || '', cartDiscount: o.cart_discount_obj || null,
    meta: { order_id: o.id, order_no: o.no, table_name: o.table_name || '', ...(o.parent_id ? { parent_id: o.parent_id } : {}) }
  });
}
export const orderInCart = () => cart.value.meta?.order_id || null;
export const currentOrder = () => (orderInCart() ? db().orders.get(orderInCart()) : null);

/* ---------------- auto-save cart → order ---------------- */
let timer = null, pending = null;
let started = false;
export function startAutosave() {
  if (started) return; started = true;
  effect(() => {
    const c = cart.value;
    if (!c.meta?.order_id) return;
    pending = c;
    clearTimeout(timer);
    timer = setTimeout(flush, 700);
  });
}
/** Write the cart back to its order now (read + write in one transaction so a sale completing meanwhile is never undone). */
export async function flush(c = pending) {
  clearTimeout(timer);
  if (c === pending) pending = null;
  const id = c?.meta?.order_id;
  if (!id) return null;
  let out = null;
  await tx(async () => {
    const cur = await db().orders.get(id);
    if (!cur || cur.status === 'paid' || cur.status === 'cancelled') return;
    const same = JSON.stringify(cur.lines || []) === JSON.stringify(c.lines) && JSON.stringify(cur.cart_discount_obj || null) === JSON.stringify(c.cartDiscount || null) && (cur.note || '') === (c.note || '') && (cur.customer?.id || null) === (c.customer?.id || null);
    if (same) { out = cur; return; }
    const linesChanged = JSON.stringify(cur.lines || []) !== JSON.stringify(c.lines);
    out = await save('orders', { ...cur, lines: c.lines, cart_discount_obj: c.cartDiscount || null, note: c.note || '', customer: c.customer || null, customer_id: c.customer?.id || cur.customer_id || null, status: cur.status === 'billed' && linesChanged ? 'open' : cur.status });
  });
  return out;
}

/* ---------------- kitchen tickets ---------------- */
const stationOf = (l) => catalog.value.byId.get(l.product_id)?.kitchen_station || l.station || null;
const modNames = (l) => (l.modifiers || []).map((m) => m.name);
const live = () => !isDemoDb() && !S.isDemo.value;
/** Print without leaving the keyboard focus inside the hidden print frame (scanner + shortcuts must keep working). */
async function printKeepFocus(html, opts) {
  const prev = document.activeElement;
  try { await printHtml(html, opts); } finally { try { window.focus(); (prev && prev !== document.body && document.contains(prev) ? prev : document.body).focus?.(); if (document.activeElement?.tagName === 'IFRAME') document.activeElement.blur(); } catch {} }
}
const QA = (kind, html, extra = {}) => { try { (window.__pposPrintLog ||= []).push({ kind, at: Date.now(), html, ...extra }); if (window.__pposPrintLog.length > 30) window.__pposPrintLog.shift(); } catch {} };

/** Lines not yet sent (qty − sent_qty), grouped by station. */
export function unsent(lines = cart.value.lines) {
  return lines.filter((l) => (l.qty || 0) - (l.sent_qty || 0) > 1e-9);
}

/** Send new items of the order in the cart to the kitchen / bar: one ticket per station, printed + shown on the KDS. */
export async function sendToKitchen() {
  const id = orderInCart();
  if (!id) return null;
  await flush(cart.value);
  const c = cart.value;
  const news = unsent(c.lines);
  if (!news.length) return { count: 0, stations: [] };
  const order = await db().orders.get(id);
  const round = (order?.round || 0) + 1;
  const groups = {};
  for (const l of news) {
    const st = stationOf(l);
    if (!st) continue;
    (groups[st] ||= []).push({ name: l.name, qty: Math.round(((l.qty || 0) - (l.sent_qty || 0)) * 1000) / 1000, modifiers: modNames(l), note: l.note || '' });
  }
  const now = Date.now();
  const u = S.user.value;
  const tickets = Object.entries(groups).map(([station, lines]) => ({
    order_id: id, order_no: order?.no || '', table_id: order?.table_id || null, table_name: order?.table_name || '', order_type: KIND_TYPE[order?.kind] || 'dine_in',
    customer_name: order?.customer_name || '', kind: 'order', station, round, lines, status: 'new', waiter_id: u?.id || null, waiter_name: u?.name || order?.waiter_name || '',
    guests: order?.guests || 0, sent_at: now, branch_id: S.branch.value?.id || null
  }));
  const lines = c.lines.map((l) => (news.includes(l) ? { ...l, sent_qty: l.qty, station: stationOf(l) } : l));
  restoreCart({ ...cart.value, lines });
  let saved = [];
  await tx(async () => {
    saved = await saveMany('kitchen_tickets', tickets);
    const cur = await db().orders.get(id);
    await save('orders', { ...cur, lines, round, sent_at: now, status: cur.status === 'billed' ? 'open' : cur.status });
    await audit('order.send', 'orders', id, { table: order?.table_name || order?.customer_name || '', round, items: news.length, stations: Object.keys(groups) });
  });
  pending = null;
  if (S.settings.value.kot_print !== false) for (const tk of saved) await printTicket(tk);
  if (live()) syncNow('kitchen');
  return { count: news.length, stations: Object.keys(groups), tickets: saved };
}

/** Void items that were already sent: VOID ticket to the station + audit. Called after approval. */
export async function voidSent(l, newQty, reason, approver) {
  const id = orderInCart();
  const order = id ? await db().orders.get(id) : null;
  const qty = Math.round(((l.sent_qty || 0) - newQty) * 1000) / 1000;
  if (qty <= 0) return;
  const station = stationOf(l);
  let tk = null;
  if (station) {
    tk = await save('kitchen_tickets', {
      order_id: id, order_no: order?.no || '', table_id: order?.table_id || null, table_name: order?.table_name || '', order_type: KIND_TYPE[order?.kind] || 'dine_in',
      customer_name: order?.customer_name || '', kind: 'void', station, round: order?.round || 0, lines: [{ name: l.name, qty, modifiers: modNames(l), note: reason }],
      status: 'new', waiter_id: S.user.value?.id || null, waiter_name: S.user.value?.name || '', guests: order?.guests || 0, sent_at: Date.now(), branch_id: S.branch.value?.id || null, reason
    });
  }
  await audit('order.void_item', 'orders', id, { name: l.name, qty, reason, table: order?.table_name || '', approved_by: approver?.name || '' });
  if (tk && S.settings.value.kot_print !== false) await printTicket(tk);
  if (live()) syncNow('kitchen');
}

export async function setTicketStatus(tk, status) {
  return save('kitchen_tickets', { ...tk, status, bumped_at: status === 'done' ? Date.now() : null, bumped_by: S.user.value?.id || null });
}

/* ---------------- bill ---------------- */
export async function markBilled() {
  const id = orderInCart();
  if (!id) return;
  await flush(cart.value);
  const cur = await db().orders.get(id);
  if (cur) await save('orders', { ...cur, status: 'billed', bill_printed_at: Date.now() }, { audit: { action: 'order.bill', details: { table: cur.table_name, total: totals.value.total } } });
}

/* ---------------- move / merge / cancel ---------------- */
export async function transferTo(table) {
  const id = orderInCart();
  await flush(cart.value);
  const cur = await db().orders.get(id);
  await tx(async () => {
    await save('orders', { ...cur, table_id: table.id, table_name: table.name, area: table.area || '' }, { audit: { action: 'order.transfer', details: { from: cur.table_name, to: table.name } } });
    const tks = (await db().kitchen_tickets.where('order_id').equals(id).toArray()).filter((x) => x.status === 'new');
    if (tks.length) await saveMany('kitchen_tickets', tks.map((x) => ({ ...x, table_id: table.id, table_name: table.name })));
  });
  restoreCart({ ...cart.value, tableId: table.id, meta: { ...cart.value.meta, table_name: table.name } });
  if (live()) syncNow('transfer');
}
export async function mergeFrom(other) {
  const id = orderInCart();
  await flush(cart.value);
  const cur = await db().orders.get(id);
  const lines = [...cart.value.lines, ...(other.lines || []).map((l) => ({ ...l }))];
  restoreCart({ ...cart.value, lines });
  await tx(async () => {
    await save('orders', { ...cur, lines, guests: (cur.guests || 0) + (other.guests || 0) }, { audit: { action: 'order.merge', details: { into: cur.table_name, from: other.table_name, items: (other.lines || []).length } } });
    await save('orders', { ...other, status: 'cancelled', merged_into: id, lines: [] });
    const tks = (await db().kitchen_tickets.where('order_id').equals(other.id).toArray()).filter((x) => !x.deleted);
    if (tks.length) await saveMany('kitchen_tickets', tks.map((x) => ({ ...x, order_id: id, table_id: cur.table_id, table_name: cur.table_name })));
  });
  pending = null;
  if (live()) syncNow('merge');
}
export async function setGuests(n) {
  const id = orderInCart();
  await flush(cart.value);
  const cur = await db().orders.get(id);
  if (cur) await save('orders', { ...cur, guests: n });
}
/** Cancel the order in the cart (voids for sent items are written by the caller first). */
export async function cancelOrder(reason) {
  const id = orderInCart();
  const cur = await db().orders.get(id);
  pending = null; clearTimeout(timer);
  if (cur) await save('orders', { ...cur, status: 'cancelled', cancel_reason: reason || '', cancelled_at: Date.now() }, { audit: { action: 'order.cancel', details: { table: cur.table_name || cur.customer_name, items: (cur.lines || []).length, reason } } });
  clearCart();
}
/** Save the cart to its order and empty the Sell screen (leaving the table). */
export async function leaveOrder() {
  if (orderInCart()) { await flush(cart.value); clearCart(); }
}

/** Split by items: move the chosen quantities into a part order (paid on its own). Returns {part, parent, original}. */
export async function splitOut(sel) {
  const id = orderInCart();
  await flush(cart.value);
  const parent = await db().orders.get(id);
  const original = cart.value.lines.map((l) => ({ ...l }));
  const partLines = [], rest = [];
  for (const l of original) {
    const q = Math.min(l.qty, sel[l.key] || 0);
    if (q <= 0) { rest.push(l); continue; }
    partLines.push({ ...l, key: l.key + '-p', qty: q, sent_qty: Math.min(q, l.sent_qty || 0) });
    if (l.qty - q > 1e-9) rest.push({ ...l, qty: Math.round((l.qty - q) * 1000) / 1000, sent_qty: Math.max(0, (l.sent_qty || 0) - q) });
  }
  const parts = ((parent.parts || 0) + 1);
  let part;
  await tx(async () => {
    await save('orders', { ...parent, lines: rest, parts });
    part = await save('orders', { kind: parent.kind, no: parent.no + '/' + parts, parent_id: parent.id, table_id: parent.table_id, table_name: parent.table_name, area: parent.area, guests: 0, waiter_id: parent.waiter_id, waiter_name: parent.waiter_name, lines: partLines, status: 'open', round: parent.round || 0, opened_at: parent.opened_at, customer_name: parent.customer_name || '', branch_id: parent.branch_id });
  });
  loadOrder(part);
  return { part, parent: { ...parent, lines: rest }, original };
}
/** Tender was cancelled: put the part back into the parent order. */
export async function unsplit(part, original) {
  await tx(async () => {
    const parent = await db().orders.get(part.parent_id);
    await save('orders', { ...parent, lines: original });
    const p = await db().orders.get(part.id);
    await save('orders', { ...p, status: 'cancelled', lines: [] });
  });
  const parent = await db().orders.get(part.parent_id);
  loadOrder(parent);
}

/* ---------------- printing ---------------- */
const tm = (ms) => new Date(ms).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
function where(o) {
  if (o.order_type === 'takeaway' || o.kind === 'takeaway') return t('TAKEAWAY') + (o.customer_name ? ' · ' + o.customer_name : '');
  if (o.order_type === 'delivery' || o.kind === 'delivery') return t('DELIVERY') + (o.customer_name ? ' · ' + o.customer_name : '');
  return o.table_name || t('Table');
}
/** Kitchen order ticket (80 mm, large text). */
export function ticketHtml(tk) {
  const isVoid = tk.kind === 'void';
  const css = `.big{font-size:1.9em;font-weight:800;line-height:1.1}.it{font-size:1.35em;font-weight:800;margin:6px 0 0}.md{font-size:1.05em;margin-left:14px}.nt{font-size:1.1em;margin-left:14px;font-weight:700}
  .void{border:3px solid #000;padding:4px;text-align:center;font-size:1.6em;font-weight:900;margin:4px 0}.x{text-decoration:line-through}`;
  const body = `
  <div class="c b l">${esc(stationLabel(tk.station).toUpperCase())}${tk.round > 1 && !isVoid ? ' · ' + t('ROUND {n}', { n: tk.round }) : ''}</div>
  ${isVoid ? `<div class="void">*** VOID ***</div>` : ''}
  <div class="c big">${esc(where(tk))}</div>
  <div class="c s">#${esc(tk.order_no || '')} · ${tm(tk.sent_at || tk.created_at)}${tk.waiter_name ? ' · ' + esc(firstName(tk.waiter_name)) : ''}${tk.guests ? ' · ' + t('{n} guests', { n: tk.guests }) : ''}</div>
  <div class="hr2"></div>
  ${tk.lines.map((l) => `<div class="it${isVoid ? ' x' : ''}">${l.qty} × ${esc(l.name)}</div>${(l.modifiers || []).map((m) => `<div class="md">+ ${esc(m)}</div>`).join('')}${l.note ? `<div class="nt">${isVoid ? esc(t('Reason')) + ': ' : '! '}${esc(l.note)}</div>` : ''}`).join('')}
  <div class="hr2"></div>
  <div class="c s">${isVoid ? esc(t('Stop — do not prepare these items')) : esc(t('{n} items', { n: tk.lines.reduce((s, l) => s + l.qty, 0) }))}</div>`;
  return doc(body, { paper: 80, title: `KOT ${tk.order_no || ''}`, css, fontSize: 15 });
}
export async function printTicket(tk) {
  const html = ticketHtml(tk);
  QA('kot', html, { station: tk.station, tkind: tk.kind });
  await printKeepFocus(html, { copies: Number(S.settings.value.kot_copies) || 1 });
}

/** Customer bill (80 mm pre-receipt). shares > 1 → "each pays". */
export function billHtml({ order, calc, shares = 0 }) {
  const st = S.settings.value;
  const b = S.business.value || {};
  const br = S.branch.value || {};
  const mp = st.mpesa_type === 'paybill' && st.mpesa_paybill ? `M-Pesa Paybill ${esc(st.mpesa_paybill)}${st.mpesa_account ? ' · Acc ' + esc(st.mpesa_account) : ''}` : st.mpesa_till ? `M-Pesa Buy Goods Till ${esc(st.mpesa_till)}` : '';
  const lines = calc.lines.map((l) => `<div class="row"><span>${l.qty} × ${esc(l.name)}</span><span>${kes(l.gross)}</span></div>${(l.modifiers || []).map((m) => `<div class="s">&nbsp;&nbsp;+ ${esc(m.name)}</div>`).join('')}${l.discount ? `<div class="row s"><span>&nbsp;&nbsp;${t('Discount')}</span><span>-${kes(l.discount)}</span></div>` : ''}`).join('');
  const body = `${st.receipt_show_logo && b.logo ? `<img class="logo" src="${b.logo}" alt="">` : ''}
  <div class="c b l">${esc(b.name || '')}</div>
  <div class="c s">${esc([br.name, br.address || b.address].filter(Boolean).join(' · '))}</div>
  <div class="c s">${esc(prettyPhone(br.phone || b.phone || ''))}</div>
  <div class="hr"></div>
  <div class="c xl">${t('BILL')}</div>
  <div class="c b">${esc(where(order))}${order.guests ? ' · ' + t('{n} guests', { n: order.guests }) : ''}</div>
  <div class="row s"><span>#${esc(order.no || '')}${order.waiter_name ? ' · ' + esc(firstName(order.waiter_name)) : ''}</span><span>${new Date().toLocaleString('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></div>
  <div class="hr"></div>${lines}<div class="hr"></div>
  <div class="row"><span>${t('Subtotal')}</span><span>${kes(calc.subtotal)}</span></div>
  ${calc.discount ? `<div class="row"><span>${t('Discount')}</span><span>-${kes(calc.discount)}</span></div>` : ''}
  ${calc.service_charge ? `<div class="row"><span>${t('Service charge')}</span><span>${kes(calc.service_charge)}</span></div>` : ''}
  ${calc.tax_total ? `<div class="row s"><span>${t('VAT included')}</span><span>${kes(calc.tax_total)}</span></div>` : ''}
  <div class="row xl" style="margin:4px 0"><span>${t('TOTAL')}</span><span>${money(calc.total)}</span></div>
  ${shares > 1 ? `<div class="hr"></div><div class="c b l">${t('Split {n} ways: {a} each', { n: shares, a: money(Math.ceil(calc.total / shares / 100) * 100) })}</div>` : ''}
  ${mp ? `<div class="hr"></div><div class="c b">${mp}</div>` : ''}
  <div class="hr"></div><div class="c s">${t('This is not a receipt. Please ask for your receipt after paying.')}</div>
  <div class="c s" style="margin-top:4px">Powered by Pentarch POS</div>`;
  return doc(body, { paper: 80, title: `Bill ${order.no || ''}` });
}
export async function printBill(shares = 0) {
  const id = orderInCart();
  await flush(cart.value);
  const order = id ? await db().orders.get(id) : { no: '', table_name: '' };
  const html = billHtml({ order, calc: totals.value, shares });
  QA('bill', html, { shares });
  await printKeepFocus(html);
  await markBilled();
}

/* ---------------- typical layout for a new restaurant ---------------- */
export function typicalLayout() {
  return [
    ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ name: 'T' + n, area: t('Main hall'), seats: n % 3 === 0 ? 6 : 4, shape: n % 3 === 0 ? 'rect' : 'round', x: ((n - 1) % 4) * 150 + 30, y: Math.floor((n - 1) / 4) * 150 + 30 })),
    ...[9, 10, 11, 12].map((n, i) => ({ name: 'T' + n, area: t('Terrace'), seats: 2, shape: 'square', x: i * 150 + 30, y: 30 }))
  ];
}
export { here };
