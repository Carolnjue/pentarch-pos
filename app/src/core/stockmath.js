// Pure stock & purchasing maths (no DB, no DOM) — unit-tested in test/inventory.test.mjs.
export const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
export const DAY_MS = 86400000;

/** Moves (any order) → oldest-first with `before` / `after` running balance (per branch if several). */
export function withRunningBalance(moves) {
  const asc = moves.filter((m) => !m.deleted).slice().sort((a, b) => a.created_at - b.created_at || (a.id < b.id ? -1 : 1));
  const bal = new Map();
  return asc.map((m) => {
    const before = bal.get(m.branch_id) || 0;
    const after = r3(before + m.qty);
    bal.set(m.branch_id, after);
    return { ...m, before, after };
  });
}

/**
 * Spread extra costs (transport, loading…) over received lines by value (by quantity when no line has a cost).
 * lines: [{qty, cost}] cost = unit cost in cents. Returns unit landed costs (cents, rounded) in the same order.
 */
export function landedCosts(lines, extraTotal = 0) {
  const vals = lines.map((l) => Math.max(0, l.qty * l.cost));
  const totalVal = vals.reduce((a, b) => a + b, 0);
  const totalQty = lines.reduce((a, l) => a + Math.max(0, l.qty), 0);
  return lines.map((l, i) => {
    if (!extraTotal || l.qty <= 0) return Math.round(l.cost);
    const share = totalVal > 0 ? (extraTotal * vals[i]) / totalVal : totalQty > 0 ? (extraTotal * l.qty) / totalQty : 0;
    return Math.round(l.cost + share / l.qty);
  });
}

/**
 * Supplier account. docs = goods_received rows (kind 'receipt' with + total, kind 'return' with − total);
 * payments = supplier_payments (refunds from the supplier are negative). Credits pay the oldest deliveries first.
 * → {balance, purchased, returned, paid, open:[{grn, due, age}], last}
 */
export function supplierAccount(docs, payments, now = Date.now()) {
  const live = docs.filter((d) => !d.deleted);
  const receipts = live.filter((d) => d.kind !== 'return').sort((a, b) => a.created_at - b.created_at);
  const returns = live.filter((d) => d.kind === 'return');
  const pays = payments.filter((p) => !p.deleted);
  const purchased = receipts.reduce((s, d) => s + (d.total || 0), 0);
  const returned = returns.reduce((s, d) => s - (d.total || 0), 0);
  const paid = pays.reduce((s, p) => s + (p.amount || 0), 0);
  let credit = returned + paid;
  const open = [];
  for (const g of receipts) {
    const take = Math.max(0, Math.min(credit, g.total || 0));
    credit -= take;
    const due = (g.total || 0) - take;
    if (due > 0) open.push({ grn: g, due, age: Math.floor((now - g.created_at) / DAY_MS) });
  }
  const last = receipts.length ? receipts[receipts.length - 1].created_at : 0;
  return { balance: purchased - returned - paid, purchased, returned, paid, open, last };
}

/** Allocate an amount to open deliveries, oldest first (or only the chosen ids). → [{grn_id, amount}] */
export function allocateOldest(open, amount, onlyIds) {
  const out = [];
  let left = amount;
  for (const o of open) {
    if (left <= 0) break;
    if (onlyIds && !onlyIds.includes(o.grn.id)) continue;
    const a = Math.min(left, o.due);
    if (a > 0) { out.push({ grn_id: o.grn.id, amount: a }); left -= a; }
  }
  return out;
}

/**
 * Suggested order quantity: enough for `cover` days of sales above the reorder level,
 * never less than the product's reorder quantity, rounded up for piece items.
 */
export function suggestQty({ onHand, reorderLevel = 0, reorderQty = 0, avgDaily = 0, unit = 'pc', cover = 14 }) {
  const need = Math.max(reorderQty || 0, avgDaily * cover + (reorderLevel || 0) - onHand, (reorderLevel || 0) * 2 - onHand, 1);
  return unit === 'pc' || !unit ? Math.ceil(need) : Math.ceil(need * 10) / 10;
}

/** Count lines → variance summary. lines [{product_id, expected, counted}], costOf(id) cents. */
export function countVariance(lines, costOf = () => 0, priceOf = () => 0) {
  let gainQty = 0, lossQty = 0, gain = 0, loss = 0, counted = 0, diffs = 0, retail = 0;
  const rows = [];
  for (const l of lines) {
    if (l.counted == null || l.counted === '') continue;
    counted++;
    const v = r3(Number(l.counted) - (l.expected || 0));
    const value = Math.round(v * costOf(l.product_id));
    if (v !== 0) diffs++;
    if (v > 0) { gainQty = r3(gainQty + v); gain += value; }
    if (v < 0) { lossQty = r3(lossQty + v); loss += value; }
    retail += Math.round(v * priceOf(l.product_id));
    rows.push({ ...l, variance: v, value });
  }
  return { rows, counted, diffs, gainQty, lossQty, gain, loss, net: gain + loss, retail };
}

/** Days from today (local) until yyyy-mm-dd (negative = expired). */
export function daysUntil(expiry, now = Date.now()) {
  if (!expiry) return Infinity;
  const [y, m, d] = String(expiry).split('-').map(Number);
  const e = new Date(y, (m || 1) - 1, d || 1).getTime();
  const t = new Date(now); t.setHours(0, 0, 0, 0);
  return Math.round((e - t.getTime()) / DAY_MS);
}
export function expiryBucket(expiry, now = Date.now()) {
  const d = daysUntil(expiry, now);
  if (d === Infinity) return 'none';
  if (d < 0) return 'expired';
  if (d <= 30) return '30';
  if (d <= 60) return '60';
  if (d <= 90) return '90';
  return 'later';
}

/** PO status after deliveries: received {product_id: qty} summed over all deliveries for that order. */
export function poStatus(po, received) {
  if (po.status === 'cancelled') return 'cancelled';
  const lines = po.lines || [];
  if (!lines.length) return po.status;
  const any = lines.some((l) => (received[l.product_id] || 0) > 0);
  const all = lines.every((l) => (received[l.product_id] || 0) >= l.qty - 1e-9);
  return all ? 'received' : any ? 'partial' : po.status === 'draft' ? 'draft' : 'sent';
}

/** Outstanding qty per PO line given received map. */
export const poOutstanding = (po, received) => (po.lines || []).map((l) => ({ ...l, received: received[l.product_id] || 0, left: Math.max(0, r3(l.qty - (received[l.product_id] || 0))) }));

/** Split received qty over the batches that were sent (in order). */
export function splitOverBatches(batches, qty) {
  const out = [];
  let left = qty;
  for (const b of batches || []) {
    if (left <= 0) break;
    const q = Math.min(b.qty, left);
    out.push({ ...b, qty: r3(q) });
    left = r3(left - q);
  }
  if (left > 0) {
    if (out.length) out[out.length - 1].qty = r3(out[out.length - 1].qty + left);
    else out.push({ batch_no: '', expiry: '', qty: left });
  }
  return out;
}

/** Cost per new unit when repacking: (from cost × from qty) / to qty. */
export const repackCost = (fromCost, fromQty, toQty) => (toQty > 0 ? Math.round((fromCost * fromQty) / toQty) : 0);
