// Purchasing: suppliers, purchase orders, goods received (GRN), supplier payments and returns.
// goods_received is a ledger: deliveries (kind 'receipt', + total) and returns to the supplier (kind 'return', − qty/total).
import { db } from '../db/index.js';
import { save, saveMany, audit, tx, repoContext } from '../db/repo.js';
import { addMoves, batchBalances, fefo, movingAverage } from '../db/stock.js';
import { ulid } from '../lib/ulid.js';
import { nextNo, prod, totalOnHand, r3 } from './inventory.js';
import { landedCosts, supplierAccount, allocateOldest, poStatus } from './stockmath.js';
import * as S from '../state.js';

const strip = ({ extra, _stock, ...p }) => p;

/* ---------------- suppliers ---------------- */
export async function saveSupplier(s) {
  const isNew = !s.id;
  return save('suppliers', { name: '', phone: '', email: '', kra_pin: '', contact: '', terms_days: 0, notes: '', address: '', ...s },
    { audit: { action: isNew ? 'supplier.create' : 'supplier.edit', details: { name: s.name } } });
}
export const suppliersList = async () => (await db().suppliers.toArray()).filter((s) => !s.deleted).sort((a, b) => a.name.localeCompare(b.name));

/** Account of one supplier: deliveries, returns, payments, balance, unpaid deliveries. */
export async function supplierAcc(supplierId) {
  const [docs, pays, pos] = await Promise.all([
    db().goods_received.where('supplier_id').equals(supplierId).toArray(),
    db().supplier_payments.where('supplier_id').equals(supplierId).toArray(),
    db().purchase_orders.where('supplier_id').equals(supplierId).toArray()
  ]);
  const acc = supplierAccount(docs, pays);
  return { ...acc, docs: docs.filter((d) => !d.deleted).sort((a, b) => b.created_at - a.created_at), payments: pays.filter((p) => !p.deleted).sort((a, b) => b.created_at - a.created_at), orders: pos.filter((p) => !p.deleted).sort((a, b) => b.created_at - a.created_at) };
}
/** Balances of all suppliers → Map id → {balance, last, purchased} */
export async function allSupplierBalances() {
  const [docs, pays] = await Promise.all([db().goods_received.toArray(), db().supplier_payments.toArray()]);
  const by = new Map();
  for (const d of docs) (by.get(d.supplier_id) || by.set(d.supplier_id, { docs: [], pays: [] }).get(d.supplier_id)).docs.push(d);
  for (const p of pays) (by.get(p.supplier_id) || by.set(p.supplier_id, { docs: [], pays: [] }).get(p.supplier_id)).pays.push(p);
  const out = new Map();
  for (const [id, x] of by) out.set(id, supplierAccount(x.docs, x.pays));
  return out;
}

/* ---------------- purchase orders ---------------- */
export async function savePO(po) {
  const isNew = !po.id;
  let rec;
  await tx(async () => {
    const no = po.no || (await nextNo('PO'));
    const lines = (po.lines || []).filter((l) => l.product_id && l.qty > 0).map((l) => ({ product_id: l.product_id, name: l.name || prod(l.product_id)?.name || '', qty: r3(l.qty), cost: Math.round(l.cost || 0), received: l.received || 0 }));
    const total = lines.reduce((s, l) => s + Math.round(l.qty * l.cost), 0);
    rec = await save('purchase_orders', { status: 'draft', expected_date: '', notes: '', ...po, no, lines, total, created_by: po.created_by || repoContext().user_id },
      { audit: { action: isNew ? 'po.create' : 'po.edit', details: { no, supplier_id: po.supplier_id, total, items: lines.length } } });
  });
  return rec;
}
export async function setPOStatus(po, status, extra = {}) {
  return save('purchase_orders', { ...po, ...extra, status, ...(status === 'sent' ? { sent_at: Date.now() } : {}) }, { audit: { action: 'po.' + status, details: { no: po.no } } });
}
/** Received quantity per product over every delivery against an order. */
export async function poReceived(poId) {
  const m = {};
  for (const g of await db().goods_received.where('po_id').equals(poId).toArray()) if (!g.deleted && g.kind !== 'return') for (const l of g.lines) m[l.product_id] = r3((m[l.product_id] || 0) + l.qty);
  return m;
}

/* ---------------- receive goods ---------------- */
/**
 * Receive a delivery into the current branch — one transaction: GRN, stock moves (batches, serials),
 * moving-average cost, optional new selling prices, payment on delivery and PO status.
 * lines: [{product_id, qty (base units), cost (cents per base unit), batch_no, expiry, serials[], pack, price}]
 */
export async function receiveGoods({ supplier_id, po_id = null, supplier_invoice_no = '', lines, extra_costs = [], paid = 0, pay_method = 'cash', pay_ref = '', note = '', from_drawer = false }) {
  const clean = lines.filter((l) => l.product_id && l.qty > 0).map((l) => ({ ...l, qty: r3(l.qty), cost: Math.round(l.cost || 0) }));
  if (!clean.length) throw new Error('no lines');
  const extraTotal = extra_costs.reduce((s, x) => s + (x.amount || 0), 0);
  const landed = landedCosts(clean, extraTotal);
  const bid = repoContext().branch_id;
  let grn;
  await tx(async () => {
    const id = ulid();
    const no = await nextNo('GRN');
    const moves = [], outLines = [], prodUpd = new Map(), priceAudits = [];
    let subtotal = 0;
    for (let i = 0; i < clean.length; i++) {
      const l = clean[i];
      const p = prodUpd.get(l.product_id) || strip(prod(l.product_id) || (await db().products.get(l.product_id)));
      const unit = landed[i];
      subtotal += Math.round(l.qty * l.cost);
      if (p.track_stock !== false || p.type === 'stock') {
        const cur = r3((await totalOnHand(p.id)) + (prodUpd.has(p.id) ? (prodUpd.get(p.id)._inQty || 0) : 0));
        p.cost = movingAverage(cur, p.cost || 0, l.qty, unit);
        p._inQty = r3((p._inQty || 0) + l.qty);
      }
      if (l.price && l.price !== p.price) { priceAudits.push({ product_id: p.id, name: p.name, from: p.price, to: l.price }); p.price = l.price; }
      prodUpd.set(p.id, p);
      const base = { product_id: p.id, type: 'purchase', ref_type: 'grn', ref_id: id, cost: unit, reason: '' };
      const serials = (l.serials || []).map((s) => String(s).trim()).filter(Boolean);
      if (serials.length) {
        for (const s of serials) {
          moves.push({ ...base, qty: 1, serial: s });
          const sr = await db().serials.where('serial').equals(s).first();
          await save('serials', { ...(sr || {}), product_id: p.id, branch_id: bid, serial: s, status: 'in_stock', sale_id: null, grn_id: id }, { silent: true });
        }
        if (l.qty > serials.length) moves.push({ ...base, qty: r3(l.qty - serials.length) });
      } else moves.push({ ...base, qty: l.qty, batch_no: l.batch_no || undefined, expiry: l.expiry || undefined });
      if (l.batch_no) await save('batches', { product_id: p.id, branch_id: bid, batch_no: l.batch_no, expiry: l.expiry || '', qty_received: l.qty, grn_id: id }, { silent: true });
      outLines.push({ product_id: p.id, name: p.name, qty: l.qty, cost: l.cost, unit_cost: unit, batch_no: l.batch_no || '', expiry: l.expiry || '', serials, ...(l.pack ? { pack: l.pack } : {}) });
    }
    const total = subtotal + extraTotal;
    const payNow = Math.max(0, Math.min(paid, total));
    await addMoves(moves);
    await saveMany('products', [...prodUpd.values()].map(({ _inQty, ...p }) => p), { silent: false });
    grn = await save('goods_received', { id, kind: 'receipt', supplier_id, branch_id: bid, po_id, no, supplier_invoice_no, lines: outLines, subtotal, extra_costs, total, paid: payNow, note, user_id: repoContext().user_id },
      { audit: { action: 'purchase.receive', details: { no, supplier_id, total, items: outLines.length, invoice: supplier_invoice_no } } });
    if (payNow > 0) await recordPayment({ supplier_id, amount: payNow, method: pay_method, ref: pay_ref, note: 'Paid on delivery ' + no, allocations: [{ grn_id: id, amount: payNow }], from_drawer });
    for (const a of priceAudits) await audit('price.change', 'products', a.product_id, { ...a, via: no });
    if (po_id) {
      const po = await db().purchase_orders.get(po_id);
      if (po) {
        const rec = await poReceived(po_id); // includes this delivery (same transaction)
        const lines2 = po.lines.map((x) => ({ ...x, received: rec[x.product_id] || 0 }));
        await save('purchase_orders', { ...po, lines: lines2, status: poStatus(po, rec), grn_ids: [...(po.grn_ids || []), id] }, { silent: true });
      }
    }
  });
  return grn;
}

/* ---------------- payments ---------------- */
async function recordPayment({ supplier_id, amount, method, ref = '', note = '', allocations = [], from_drawer = false }) {
  const rec = await save('supplier_payments', { supplier_id, amount, method, ref, note, grn_ids: allocations.map((a) => a.grn_id), allocations, user_id: repoContext().user_id },
    { audit: { action: 'supplier.payment', details: { supplier_id, amount, method, ref } } });
  if (from_drawer && method === 'cash' && S.shift.value?.id && amount > 0) {
    const sup = await db().suppliers.get(supplier_id);
    await save('cash_moves', { shift_id: S.shift.value.id, type: 'pay_out', amount, reason: 'Supplier: ' + (sup?.name || ''), purpose: 'supplier', ref_type: 'supplier_payment', ref_id: rec.id, user_id: repoContext().user_id }, { silent: true });
  }
  return rec;
}
/** Pay a supplier; allocated to the oldest unpaid deliveries (or only `grn_ids`). */
export async function paySupplier({ supplier_id, amount, method = 'mpesa', ref = '', note = '', grn_ids = null, from_drawer = false }) {
  let rec;
  await tx(async () => {
    const acc = await supplierAcc(supplier_id);
    const allocations = allocateOldest(acc.open, amount, grn_ids);
    rec = await recordPayment({ supplier_id, amount, method, ref, note, allocations, from_drawer });
  });
  return rec;
}
export async function allSupplierPayments() {
  return (await db().supplier_payments.toArray()).filter((p) => !p.deleted).sort((a, b) => b.created_at - a.created_at);
}

/* ---------------- returns to supplier ---------------- */
/** Send goods back: stock out (adjust, reason returned_to_supplier) and a credit on the supplier account. */
export async function returnToSupplier({ supplier_id, lines, reason = '', note = '', refund = 0, refund_method = 'cash', grn_id = null }) {
  const bid = repoContext().branch_id;
  let doc;
  await tx(async () => {
    const id = ulid();
    const no = await nextNo('SR');
    const moves = [], outLines = [];
    let total = 0;
    for (const l of lines) {
      const p = prod(l.product_id) || (await db().products.get(l.product_id));
      const qty = r3(l.qty);
      if (!p || qty <= 0) continue;
      const cost = Math.round(l.cost ?? p.cost ?? 0);
      total += Math.round(qty * cost);
      const base = { product_id: p.id, type: 'adjust', ref_type: 'supplier_return', ref_id: id, cost: p.cost || 0, reason: 'returned_to_supplier', note: reason };
      const serials = (l.serials || []).filter(Boolean);
      if (serials.length) {
        for (const s of serials) {
          moves.push({ ...base, qty: -1, serial: s });
          const sr = await db().serials.where('serial').equals(s).first();
          if (sr) await save('serials', { ...sr, status: 'returned' }, { silent: true });
        }
        if (qty > serials.length) moves.push({ ...base, qty: -r3(qty - serials.length) });
      } else if (p.track_batches) {
        const alloc = l.batch_no ? [{ batch_no: l.batch_no, expiry: l.expiry || '', qty }] : fefo(await batchBalances(p.id, bid), qty);
        for (const a of alloc) moves.push({ ...base, qty: -a.qty, batch_no: a.batch_no || undefined, expiry: a.expiry || undefined });
      } else moves.push({ ...base, qty: -qty });
      outLines.push({ product_id: p.id, name: p.name, qty: -qty, cost, batch_no: l.batch_no || '', serials });
    }
    if (!outLines.length) throw new Error('no lines');
    await addMoves(moves);
    doc = await save('goods_received', { id, kind: 'return', supplier_id, branch_id: bid, po_id: null, grn_id, no, supplier_invoice_no: '', lines: outLines, subtotal: -total, extra_costs: [], total: -total, paid: 0, reason, note, user_id: repoContext().user_id },
      { audit: { action: 'purchase.return', details: { no, supplier_id, total, reason } } });
    if (refund > 0) await recordPayment({ supplier_id, amount: -Math.min(refund, total), method: refund_method, note: 'Refund for ' + no });
  });
  return doc;
}

export const allDocs = async (kind) => (await db().goods_received.orderBy('created_at').reverse().toArray()).filter((d) => !d.deleted && (kind === 'return' ? d.kind === 'return' : d.kind !== 'return'));
