// Cart state for the Sell screen (persisted per device so a reload or crash never loses a sale in progress).
import { signal, computed } from '@preact/signals';
import { computeCart, unitPrice, promoFor } from '../../core/pricing.js';
import { catalog, stockOf } from '../../db/catalog.js';
import { db } from '../../db/index.js';
import * as S from '../../state.js';
import { ulid } from '../../lib/ulid.js';

const KEY = 'ppos.cart';
const empty = () => ({ lines: [], customer: null, cartDiscount: null, note: '', wholesale: false, heldId: null, heldName: '', orderType: 'retail', tip: 0, tableId: null, meta: null });
/** Fresh empty cart object (modules that load an order into the cart start from this). */
export const emptyCart = empty;
function load() { try { const v = JSON.parse(localStorage.getItem(KEY + ':' + (S.mode.value || 'live'))); return v && Array.isArray(v.lines) ? { ...empty(), ...v } : empty(); } catch { return empty(); } }
export const cart = signal(empty());
export const selKey = signal(null);
export const promos = signal([]);
let loadedFor = null;
export function initCart() {
  if (loadedFor === S.mode.value) return;
  loadedFor = S.mode.value;
  cart.value = load();
  db().promotions.toArray().then((p) => (promos.value = p.filter((x) => !x.deleted && x.active !== false)));
}
function persist() { try { localStorage.setItem(KEY + ':' + S.mode.value, JSON.stringify(cart.value)); } catch {} }
function set(patch) { cart.value = { ...cart.value, ...patch }; persist(); }

/** Cart-level discount in cents from {type:'pct'|'amount', value} */
export function cartDiscountCents(c = cart.value, calcBase) {
  const d = c.cartDiscount;
  if (!d || !d.value) return 0;
  if (d.type === 'amount') return d.value;
  return Math.round((calcBase * d.value) / 100);
}

export const totals = computed(() => {
  const c = cart.value;
  const st = S.settings.value;
  const biz = S.business.value || {};
  const scOn = !st.service_charge_dine_in_only || c.orderType === 'dine_in';
  const opts = { vatRegistered: !!biz.vat_registered, inclusive: st.vat_inclusive !== false, rounding: !!st.rounding, serviceChargePct: scOn ? Number(st.service_charge_pct) || 0 : 0, tip: c.tip || 0 };
  const base = computeCart(c.lines, { ...opts, rounding: false, serviceChargePct: 0, tip: 0 });
  const after = base.subtotal - base.line_discount;
  return computeCart(c.lines, { ...opts, cartDiscount: cartDiscountCents(c, after) });
});

function priceFor(p, { qty = 1, uom } = {}) {
  const c = cart.value;
  const st = S.settings.value;
  const wholesale = c.wholesale || c.customer?.group === 'wholesale';
  const base = unitPrice(p, { uom, wholesale, qty, branchId: S.branch.value?.id, wholesaleAutoQty: st.wholesale_auto_qty !== false });
  if (uom) return { price: base, promo_id: null, orig_price: base };
  const pr = promoFor(p, promos.value, Date.now(), base);
  return pr ? { price: pr.price, promo_id: pr.promo.id, orig_price: base } : { price: base, promo_id: null, orig_price: base };
}

/**
 * Add a product. opts: {qty, uom, price (override, e.g. from price-embedded barcode), serial, modifiers, staff_id, note}
 * Returns the line key.
 */
export function addProduct(p, opts = {}) {
  const c = cart.value;
  const qty = opts.qty ?? 1;
  const uom = opts.uom || null;
  const weighed = p.type === 'weight' || ['kg', 'g', 'l', 'ml', 'm'].includes(p.unit);
  const mergeable = !weighed && !opts.serial && !opts.modifiers?.length && !opts.note && opts.price == null && !p.track_serials;
  if (mergeable) {
    const ex = c.lines.find((l) => l.product_id === p.id && (l.uom || null) === (uom?.name || null) && !l.modifiers?.length && !l.serial && !l.price_override && !l.note);
    if (ex) { setQty(ex.key, ex.qty + qty); selKey.value = ex.key; return ex.key; }
  }
  const pr = opts.price != null ? { price: opts.price, promo_id: null, orig_price: opts.price } : priceFor(p, { qty, uom });
  const line = {
    key: ulid(), product_id: p.id, name: p.name, qty, unit: uom ? uom.name : p.unit || 'pc', factor: uom ? uom.factor : 1, uom: uom?.name || null,
    price: pr.price, orig_price: pr.orig_price, promo_id: pr.promo_id, cost: p.cost || 0, discount: 0, tax: p.tax || S.settings.value.default_tax || 'B',
    modifiers: opts.modifiers || [], note: opts.note || '', staff_id: opts.staff_id || (p.type === 'service' ? S.user.value?.id : null), serial: opts.serial || '',
    price_override: opts.price != null && !!opts.priceOverride, added_at: Date.now()
  };
  set({ lines: [...c.lines, line] });
  selKey.value = line.key;
  return line.key;
}

export function updateLine(key, patch) {
  set({ lines: cart.value.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) });
}
/**
 * Line guards: fn(line, newQty) → false blocks a quantity cut / removal (the guard then handles it itself, e.g. the
 * restaurant module asks for approval to void items already sent to the kitchen and calls setQty/removeLine with force).
 */
export const lineGuards = new Set();
const blocked = (l, qty) => [...lineGuards].some((g) => g(l, qty) === false);
export function setQty(key, qty, force = false) {
  const l = cart.value.lines.find((x) => x.key === key);
  if (!l) return;
  qty = Math.max(0, Math.round(qty * 1000) / 1000);
  if (!force && qty < l.qty && blocked(l, qty)) return false;
  if (qty === 0) return removeLine(key, true);
  const p = catalog.value.byId.get(l.product_id);
  const patch = { qty };
  if (p && !l.price_override && !l.uom) Object.assign(patch, priceFor(p, { qty }));
  if (l.discount && l.discount_pct) patch.discount = Math.round(((patch.price ?? l.price) * qty * l.discount_pct) / 100);
  updateLine(key, patch);
}
export function removeLine(key, force = false) {
  const lines = cart.value.lines;
  const i = lines.findIndex((l) => l.key === key);
  if (!force && i >= 0 && blocked(lines[i], 0)) return false;
  set({ lines: lines.filter((l) => l.key !== key) });
  const next = cart.value.lines[Math.min(i, cart.value.lines.length - 1)];
  selKey.value = next?.key || null;
}
export function restoreCart(snap) { cart.value = snap; persist(); selKey.value = snap.lines[snap.lines.length - 1]?.key || null; }
export function clearCart() { cart.value = empty(); selKey.value = null; persist(); }
export function setCustomer(customer) {
  set({ customer: customer ? { id: customer.id, name: customer.name, phone: customer.phone, group: customer.group, credit_limit: customer.credit_limit, loyalty_points: customer.loyalty_points || 0, kra_pin: customer.kra_pin || '' } : null });
  repriceAll();
}
export function setWholesale(on) { set({ wholesale: on }); repriceAll(); }
function repriceAll() {
  set({
    lines: cart.value.lines.map((l) => {
      if (l.price_override || l.uom) return l;
      const p = catalog.value.byId.get(l.product_id);
      return p ? { ...l, ...priceFor(p, { qty: l.qty }) } : l;
    })
  });
}
export const setCartDiscount = (d) => set({ cartDiscount: d });
export const setNote = (note) => set({ note });
export const setTip = (tip) => set({ tip });
export const setOrderType = (orderType) => set({ orderType });
export function loadHeld(order) {
  cart.value = { ...empty(), lines: order.lines, customer: order.customer_id ? { id: order.customer_id, name: order.customer_name } : null, cartDiscount: order.cart_discount_obj || (order.cart_discount ? { type: 'amount', value: order.cart_discount } : null), note: order.note || '', wholesale: !!order.wholesale, heldId: order.id, heldName: order.name };
  if (order.customer_id) db().customers.get(order.customer_id).then((c) => c && setCustomer(c));
  selKey.value = order.lines[order.lines.length - 1]?.key || null;
  persist();
}
export const lineCount = computed(() => cart.value.lines.length);
export { stockOf };
