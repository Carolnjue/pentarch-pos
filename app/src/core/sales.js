// Sale lifecycle: complete (one transaction: receipt no, stock moves incl. batches/serials/recipes, points, audit), void, return.
import { db, getMeta, setMeta } from '../db/index.js';
import { save, patch, audit, tx, stamp, repoContext } from '../db/repo.js';
import { addMoves, batchBalances, fefo } from '../db/stock.js';
import { catalog } from '../db/catalog.js';
import { emit } from '../lib/bus.js';
import { ulid } from '../lib/ulid.js';
import { pointsEarned } from './pricing.js';
import * as S from '../state.js';

export async function nextReceiptNo() {
  const seq = ((await getMeta('receipt_seq')) || 0) + 1;
  await setMeta('receipt_seq', seq);
  return `${S.branch.value?.code || 'POS'}${S.device.value.no || 1}-${String(seq).padStart(6, '0')}`;
}

/**
 * Complete a sale.
 * @param {object} p {calc (computeCart result), payments [{method, amount, ref, phone, tendered}], change, customer, note, order_type, held_id, table_id,
 *                   extra (module fields stored on the sale, e.g. {order_id} / {quote_id, due_date} / {appointment_id})}
 * @returns sale record
 */
export async function completeSale(p) {
  const { calc, payments, change = 0, customer = null, note = '', order_type = 'retail', held_id = null, table_id = null, extra = null } = p;
  const st = S.settings.value;
  const ctx = repoContext();
  let sale;
  const t0 = performance.now();
  await tx(async () => {
    const no = await nextReceiptNo();
    const id = ulid();
    const moves = [];
    const lines = [];
    for (const l of calc.lines) {
      const prod = catalog.value.byId.get(l.product_id) || (await db().products.get(l.product_id));
      const line = {
        product_id: l.product_id, name: l.name, qty: l.qty, unit: l.unit || prod?.unit || 'pc', factor: l.factor || 1, price: l.price, orig_price: l.orig_price ?? l.price,
        cost: prod?.cost ?? l.cost ?? 0, discount: l.discount_total || 0, line_discount: l.discount || 0, tax: l.tax, tax_rate: l.tax_rate, tax_amount: l.tax_amount,
        total: l.total, batch_no: '', serial: l.serial || '', staff_id: l.staff_id || null, modifiers: l.modifiers || [], note: l.note || '',
        promo_id: l.promo_id || null, price_override: !!l.price_override
      };
      if (prod?.type === 'composite' && prod.recipe?.length) {
        for (const r of prod.recipe) moves.push({ product_id: r.product_id, qty: -(r.qty * l.qty), type: 'recipe', ref_type: 'sale', ref_id: id, cost: catalog.value.byId.get(r.product_id)?.cost || 0 });
      } else if (prod?.track_stock) {
        const base = Math.round(l.qty * (l.factor || 1) * 1000) / 1000;
        if (prod.track_batches) {
          const alloc = fefo(await batchBalances(prod.id, ctx.branch_id), base);
          line.batch_no = alloc.map((a) => a.batch_no).filter(Boolean).join(', ');
          line.expiry = alloc[0]?.expiry || '';
          for (const a of alloc) moves.push({ product_id: prod.id, qty: -a.qty, type: 'sale', ref_type: 'sale', ref_id: id, cost: prod.cost, batch_no: a.batch_no || undefined, expiry: a.expiry || undefined });
        } else {
          moves.push({ product_id: prod.id, qty: -base, type: 'sale', ref_type: 'sale', ref_id: id, cost: prod.cost, serial: l.serial || undefined });
        }
        if (l.serial) {
          const sr = await db().serials.where('serial').equals(l.serial).first();
          if (sr) await save('serials', { ...sr, status: 'sold', sale_id: id }, { silent: true });
          else await save('serials', { product_id: prod.id, serial: l.serial, status: 'sold', sale_id: id }, { silent: true });
        }
      }
      lines.push(line);
    }
    const credit = payments.filter((x) => x.method === 'credit').reduce((s, x) => s + x.amount, 0);
    const pointsPay = payments.filter((x) => x.method === 'points').reduce((s, x) => s + x.amount, 0);
    let earned = 0, redeemed = 0;
    if (customer && st.loyalty_enabled) {
      earned = pointsEarned(calc.total - pointsPay - credit, Number(st.loyalty_earn_per) || 100);
      redeemed = pointsPay ? Math.ceil(pointsPay / (Number(st.loyalty_point_value) || 100)) : 0;
    }
    sale = await save('sales', {
      id, no, branch_id: ctx.branch_id, device_id: ctx.device_id, shift_id: S.shift.value?.id || null, user_id: ctx.user_id, customer_id: customer?.id || null,
      table_id, order_type, lines, subtotal: calc.subtotal, discount: calc.discount, cart_discount: calc.cart_discount, tax_total: calc.tax_total,
      service_charge: calc.service_charge || 0, tip: calc.tip || 0, total: calc.total, rounding: calc.rounding,
      payments: payments.map((x) => ({ method: x.method, amount: x.amount, ref: x.ref || '', phone: x.phone || '', ...(x.tendered ? { tendered: x.tendered } : {}) })),
      paid: calc.total - credit, change, balance: credit, status: 'completed', receipt_note: note, etims: null, void_reason: '', void_by: null,
      points_earned: earned, points_redeemed: redeemed, customer_name: customer?.name || '', ...(extra || {})
    }, { silent: true });
    if (moves.length) await addMoves(moves);
    if (customer && (earned || redeemed)) {
      const cur = await db().customers.get(customer.id);
      await save('customers', { ...cur, loyalty_points: Math.max(0, (cur.loyalty_points || 0) + earned - redeemed) }, { silent: true });
    }
    await audit('sale.create', 'sales', id, { no, total: calc.total, methods: payments.map((x) => x.method) });
    if (calc.discount) await audit('discount.apply', 'sales', id, { no, amount: calc.discount, cart: calc.cart_discount });
    for (const l of lines) if (l.price_override) await audit('price.change', 'sales', id, { no, product_id: l.product_id, name: l.name, from: l.orig_price, to: l.price });
    if (held_id) { const h = await db().orders.get(held_id); if (h) await save('orders', { ...h, status: 'paid', sale_id: id }, { silent: true }); }
  });
  sale._ms = Math.round(performance.now() - t0);
  emit('change', 'sales', [sale.id]);
  emit('change', 'customers', null);
  emit('sale', sale);
  return sale;
}

/** Void a completed sale: reverses stock, serials and points. */
export async function voidSale(sale, reason, approver) {
  if (sale.status === 'void') return sale;
  let out;
  await tx(async () => {
    const moves = (await db().stock_moves.where('ref_id').equals(sale.id).toArray()).filter((m) => m.type === 'sale' || m.type === 'recipe');
    await addMoves(moves.map((m) => ({ product_id: m.product_id, qty: -m.qty, type: 'void', ref_type: 'sale', ref_id: sale.id, cost: m.cost, batch_no: m.batch_no, expiry: m.expiry, serial: m.serial, reason })));
    for (const l of sale.lines) if (l.serial) {
      const sr = await db().serials.where('serial').equals(l.serial).first();
      if (sr) await save('serials', { ...sr, status: 'in_stock', sale_id: null }, { silent: true });
    }
    if (sale.customer_id && (sale.points_earned || sale.points_redeemed)) {
      const c = await db().customers.get(sale.customer_id);
      if (c) await save('customers', { ...c, loyalty_points: Math.max(0, (c.loyalty_points || 0) - (sale.points_earned || 0) + (sale.points_redeemed || 0)) }, { silent: true });
    }
    out = await patch('sales', sale.id, { status: 'void', void_reason: reason, void_by: approver?.id || repoContext().user_id, voided_at: Date.now() }, { force: true, silent: true });
    await audit('sale.void', 'sales', sale.id, { no: sale.no, total: sale.total, reason, approved_by: approver?.name });
  });
  emit('change', 'sales', [sale.id]);
  return out;
}

/** Quantities already returned per line index. */
export async function returnedQty(saleId) {
  const rets = (await db().returns.where('sale_id').equals(saleId).toArray()).filter((r) => !r.deleted);
  const m = {};
  for (const r of rets) for (const l of r.lines) m[l.line_index] = (m[l.line_index] || 0) + l.qty;
  return m;
}

/**
 * Return items. items: [{line_index, qty, restock}] refund: [{method, amount}]
 */
export async function processReturn(sale, items, refund, reason, approver) {
  let ret;
  await tx(async () => {
    const lines = items.filter((i) => i.qty > 0).map((i) => {
      const l = sale.lines[i.line_index];
      return { line_index: i.line_index, product_id: l.product_id, name: l.name, qty: i.qty, amount: Math.round((l.total / l.qty) * i.qty), restock: !!i.restock };
    });
    const total = lines.reduce((s, l) => s + l.amount, 0);
    ret = await save('returns', { sale_id: sale.id, sale_no: sale.no, lines, refund, reason, user_id: repoContext().user_id, approved_by: approver?.id || null, shift_id: S.shift.value?.id || null, total, customer_id: sale.customer_id || null }, { silent: true });
    const moves = [];
    for (const l of lines) {
      const sl = sale.lines[l.line_index];
      const prod = catalog.value.byId.get(l.product_id);
      if (!prod?.track_stock) continue;
      const q = l.qty * (sl.factor || 1);
      if (l.restock) moves.push({ product_id: l.product_id, qty: q, type: 'return', ref_type: 'return', ref_id: ret.id, cost: sl.cost, batch_no: sl.batch_no?.split(', ')[0] || undefined, serial: sl.serial || undefined, reason });
      if (sl.serial) {
        const sr = await db().serials.where('serial').equals(sl.serial).first();
        if (sr) await save('serials', { ...sr, status: l.restock ? 'in_stock' : 'returned', sale_id: null }, { silent: true });
      }
    }
    if (moves.length) await addMoves(moves);
    const prev = await returnedQty(sale.id);
    const allBack = sale.lines.every((l, i) => (prev[i] || 0) >= l.qty - 1e-9);
    await patch('sales', sale.id, { status: allBack ? 'returned' : 'partial_return', returned_total: (sale.returned_total || 0) + total }, { force: true, silent: true });
    await audit('sale.return', 'returns', ret.id, { no: sale.no, total, reason, refund: refund.map((r) => r.method), approved_by: approver?.name });
  });
  emit('change', 'sales', [sale.id]);
  emit('change', 'returns', [ret.id]);
  return ret;
}

/** Hold the current cart as an `orders` record (kind 'held'). */
export async function holdCart({ name, lines, customer, cartDiscount, note, wholesale }) {
  return save('orders', { kind: 'held', name, lines, customer_id: customer?.id || null, customer_name: customer?.name || '', cart_discount: cartDiscount || 0, note: note || '', wholesale: !!wholesale, status: 'open', waiter_id: repoContext().user_id, guests: 0 }, { audit: { action: 'sale.hold', details: { name, lines: lines.length } } });
}
export const heldOrders = async () => (await db().orders.where('status').equals('open').toArray()).filter((o) => o.kind === 'held' && !o.deleted && (!o.branch_id || o.branch_id === S.branch.value?.id)).sort((a, b) => b.updated_at - a.updated_at);

export async function openDrawer(reason) {
  await audit('drawer.open', 'shifts', S.shift.value?.id || null, { reason: reason || 'No sale' });
}
export { stamp };
