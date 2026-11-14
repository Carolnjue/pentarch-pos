// Inventory operations: adjustments, stock takes, transfers, repacking, expiry, reorder, serial lookup.
// Every quantity change is a `stock_moves` row (via addMoves) — the ledger is the truth. Every action is audited.
import { db, getMeta, setMeta } from '../db/index.js';
import { save, saveMany, audit, tx, repoContext, emitChange } from '../db/repo.js';
import { addMoves, batchBalances, fefo, movingAverage } from '../db/stock.js';
import { catalog } from '../db/catalog.js';
import { ulid } from '../lib/ulid.js';
import { r3, withRunningBalance, repackCost, splitOverBatches, suggestQty, daysUntil, expiryBucket, DAY_MS } from './stockmath.js';
import * as S from '../state.js';

export { r3 };
export const prod = (id) => catalog.value.byId.get(id);
export const ADJUST_REASONS = [
  { value: 'damaged', label: 'Damaged', dir: -1, icon: 'alert' },
  { value: 'expired', label: 'Expired', dir: -1, icon: 'calendar' },
  { value: 'theft', label: 'Theft / loss', dir: -1, icon: 'shield' },
  { value: 'own_use', label: 'Own use', dir: -1, icon: 'coffee' },
  { value: 'found', label: 'Found', dir: 1, icon: 'search' },
  { value: 'correction', label: 'Correction', dir: 0, icon: 'edit' }
];
export const MOVE_TYPES = {
  sale: 'Sale', return: 'Customer return', void: 'Sale voided', recipe: 'Used in recipe', opening: 'Opening stock', purchase: 'Received from supplier',
  adjust: 'Adjustment', count: 'Stock count', transfer_out: 'Sent to branch', transfer_in: 'Received from branch', repack_out: 'Repacked (out)', repack_in: 'Repacked (in)'
};
export const REASON_LABELS = { damaged: 'Damaged', expired: 'Expired', theft: 'Theft / loss', own_use: 'Own use', found: 'Found', correction: 'Correction', returned_to_supplier: 'Returned to supplier', lost_in_transit: 'Lost in transit' };

/** Approval limit for adjustments / count variances (cents, value at cost). 0 = always ask. */
export const approvalLimit = () => { const v = S.settings.value.inv_approve_over; return v == null ? 100000 : Number(v); };

/** Next document number for this device: e.g. PO-NRB1-0007 */
export async function nextNo(kind) {
  const key = 'seq_' + kind;
  const n = ((await getMeta(key)) || 0) + 1;
  await setMeta(key, n);
  return `${kind}-${S.branch.value?.code || 'POS'}${S.device.value.no || 1}-${String(n).padStart(4, '0')}`;
}

/** Stock levels for a branch → Map product_id → qty (from the stock_levels cache). */
export async function branchLevels(branchId) {
  const rows = await db().stock_levels.where('branch_id').equals(branchId).toArray();
  return new Map(rows.map((r) => [r.product_id, r.qty]));
}
/** Total on hand over every branch (cost is one moving average per product). */
export async function totalOnHand(productId) {
  const rows = await db().stock_levels.where('product_id').equals(productId).toArray();
  return r3(rows.reduce((s, r) => s + r.qty, 0));
}
export async function levelAt(productId, branchId) {
  return (await db().stock_levels.get([productId, branchId]))?.qty || 0;
}

/** Ledger of one product (optionally one branch), newest first with before/after balances. */
export async function productLedger(productId, branchId) {
  const moves = branchId
    ? await db().stock_moves.where('[product_id+branch_id]').equals([productId, branchId]).toArray()
    : await db().stock_moves.where('product_id').equals(productId).toArray();
  return withRunningBalance(moves).reverse();
}

/** Document label for a move's reference (sale no, GRN no…), resolved lazily by the ledger page. */
export async function refLabels(moves) {
  const ids = {};
  for (const m of moves) if (m.ref_id) (ids[m.ref_type || m.type] ||= new Set()).add(m.ref_id);
  const out = new Map();
  const load = async (table, set) => { for (const r of await db().table(table).bulkGet([...set])) if (r) out.set(r.id, r.no || ''); };
  if (ids.sale) await load('sales', ids.sale);
  if (ids.return) await load('returns', ids.return);
  if (ids.grn || ids.supplier_return) await load('goods_received', new Set([...(ids.grn || []), ...(ids.supplier_return || [])]));
  if (ids.transfer) await load('transfers', ids.transfer);
  if (ids.stock_count) await load('stock_counts', ids.stock_count);
  return out;
}

/* ---------------- adjustments ---------------- */
/**
 * Adjust stock of one product in the current branch.
 * {product_id, qty (+/−, base units), reason, note, batch_no, expiry, serial, approver}
 */
export async function adjustStock({ product_id, qty, reason, note = '', batch_no = '', expiry = '', serial = '', approver = null }) {
  const p = prod(product_id) || (await db().products.get(product_id));
  qty = r3(qty);
  if (!p || !qty) return null;
  const bid = repoContext().branch_id;
  const ref_id = ulid();
  const base = { product_id, type: 'adjust', ref_type: 'adjustment', ref_id, cost: p.cost || 0, reason, note };
  let moves;
  await tx(async () => {
    if (p.track_batches && qty < 0 && !batch_no) {
      moves = fefo(await batchBalances(product_id, bid), -qty).map((a) => ({ ...base, qty: -a.qty, batch_no: a.batch_no || undefined, expiry: a.expiry || undefined }));
    } else {
      moves = [{ ...base, qty, batch_no: batch_no || undefined, expiry: expiry || undefined, serial: serial || undefined }];
      if (qty > 0 && p.track_batches && batch_no) {
        const known = (await db().batches.where('[product_id+branch_id]').equals([product_id, bid]).toArray()).find((b) => b.batch_no === batch_no && !b.deleted);
        if (!known) await save('batches', { product_id, branch_id: bid, batch_no, expiry, qty_received: qty }, { silent: true });
      }
    }
    if (serial) {
      const sr = await db().serials.where('serial').equals(serial).first();
      if (qty < 0 && sr) await save('serials', { ...sr, status: 'written_off' }, { silent: true });
      if (qty > 0) await save('serials', { ...(sr || {}), product_id, branch_id: bid, serial, status: 'in_stock', sale_id: null }, { silent: true });
    }
    await addMoves(moves);
    await audit('stock.adjust', 'products', product_id, { name: p.name, qty, reason, note, value: Math.round(qty * (p.cost || 0)), approved_by: approver?.name || null, ref_id });
  });
  return moves;
}

/** Recent adjustments (moves of type adjust) in a branch, newest first. */
export async function recentAdjustments(branchId, limit = 500) {
  const rows = await db().stock_moves.where('type').equals('adjust').toArray();
  return rows.filter((m) => !m.deleted && (!branchId || m.branch_id === branchId)).sort((a, b) => b.created_at - a.created_at).slice(0, limit);
}

/* ---------------- stock takes ---------------- */
/** Products a count covers (stock-tracked, active). */
export function countScope(count) {
  const all = catalog.value.products.filter((p) => p.track_stock && !p.has_variants && p.active !== false);
  if (count.scope === 'category') { const set = new Set(count.category_ids || []); return all.filter((p) => set.has(p.category_id)); }
  if (count.scope === 'custom') { const set = new Set((count.lines || []).map((l) => l.product_id)); return catalog.value.products.filter((p) => set.has(p.id)); }
  return all;
}
export async function createCount({ scope = 'full', category_ids = [], product_ids = [], blind = false, note = '', name = '' }) {
  let rec;
  await tx(async () => {
    const no = await nextNo('CNT');
    rec = await save('stock_counts', {
      no, name, scope, category_ids, blind, note, status: 'open', started_by: repoContext().user_id,
      lines: scope === 'custom' ? product_ids.map((id) => ({ product_id: id, expected: null, counted: null })) : []
    }, { audit: { action: 'stock.count_start', details: { scope, blind } } });
  });
  return rec;
}
/** Save counted quantities: map product_id → counted (null clears). */
export async function saveCountLines(count, counted) {
  const lines = new Map((count.lines || []).map((l) => [l.product_id, { ...l }]));
  for (const [pid, q] of Object.entries(counted)) {
    const cur = lines.get(pid) || { product_id: pid, expected: null, counted: null };
    cur.counted = q === null || q === '' || q === undefined ? null : r3(q);
    cur.counted_at = Date.now();
    lines.set(pid, cur);
  }
  const fresh = await db().stock_counts.get(count.id);
  return save('stock_counts', { ...(fresh || count), lines: [...lines.values()] }, { silent: true });
}
/** Apply a count: writes `count` moves for every difference and closes it. zeroUncounted → items not counted become 0. */
export async function applyCount(count, { zeroUncounted = false, approver = null } = {}) {
  const bid = count.branch_id || repoContext().branch_id;
  const byId = new Map((count.lines || []).map((l) => [l.product_id, l]));
  const scope = countScope(count);
  const out = [];
  let gain = 0, loss = 0;
  await tx(async () => {
    const moves = [];
    for (const p of scope) {
      const l = byId.get(p.id);
      let counted = l?.counted;
      if (counted == null) { if (!zeroUncounted) continue; counted = 0; }
      const expected = await levelAt(p.id, bid);
      const diff = r3(counted - expected);
      out.push({ product_id: p.id, expected, counted, variance: diff });
      if (!diff) continue;
      const value = Math.round(diff * (p.cost || 0));
      if (diff > 0) gain += value; else loss += value;
      const base = { product_id: p.id, type: 'count', ref_type: 'stock_count', ref_id: count.id, cost: p.cost || 0, branch_id: bid, reason: 'Stock count ' + count.no };
      if (p.track_batches && diff < 0) for (const a of fefo(await batchBalances(p.id, bid), -diff)) moves.push({ ...base, qty: -a.qty, batch_no: a.batch_no || undefined, expiry: a.expiry || undefined });
      else moves.push({ ...base, qty: diff });
    }
    if (moves.length) await addMoves(moves);
    await save('stock_counts', { ...count, status: 'applied', applied_at: Date.now(), applied_by: repoContext().user_id, lines: out, gain, loss, zero_uncounted: zeroUncounted },
      { audit: { action: 'stock.count', details: { no: count.no, lines: out.length, differences: moves.length, gain, loss, approved_by: approver?.name || null } } });
  });
  return { lines: out, gain, loss };
}
export async function cancelCount(count) {
  return save('stock_counts', { ...count, status: 'cancelled' }, { audit: { action: 'stock.count_cancel', details: { no: count.no } } });
}

/* ---------------- transfers ---------------- */
/** Send stock from the current branch: lines [{product_id, qty}]. */
export async function sendTransfer({ to_branch_id, lines, note = '' }) {
  const from = repoContext().branch_id;
  let rec;
  await tx(async () => {
    const id = ulid();
    const no = await nextNo('TR');
    const out = [], moves = [];
    for (const l of lines) {
      const p = prod(l.product_id) || (await db().products.get(l.product_id));
      const qty = r3(l.qty);
      if (!p || qty <= 0) continue;
      const line = { product_id: p.id, name: p.name, qty, cost: p.cost || 0, batches: [], serials: [] };
      const base = { product_id: p.id, type: 'transfer_out', ref_type: 'transfer', ref_id: id, cost: p.cost || 0, branch_id: from };
      if (p.track_batches) {
        line.batches = fefo(await batchBalances(p.id, from), qty).map((a) => ({ batch_no: a.batch_no, expiry: a.expiry, qty: a.qty }));
        for (const a of line.batches) moves.push({ ...base, qty: -a.qty, batch_no: a.batch_no || undefined, expiry: a.expiry || undefined });
      } else if (p.track_serials) {
        const avail = (await db().serials.where('product_id').equals(p.id).toArray()).filter((s) => !s.deleted && s.status === 'in_stock' && (!s.branch_id || s.branch_id === from));
        const chosen = (l.serials?.length ? avail.filter((s) => l.serials.includes(s.serial)) : avail).slice(0, Math.floor(qty));
        line.serials = chosen.map((s) => s.serial);
        for (const s of chosen) { moves.push({ ...base, qty: -1, serial: s.serial }); await save('serials', { ...s, status: 'in_transit' }, { silent: true }); }
        const rest = r3(qty - chosen.length);
        if (rest > 0) moves.push({ ...base, qty: -rest });
      } else moves.push({ ...base, qty: -qty });
      out.push(line);
    }
    if (!out.length) throw new Error('nothing to send');
    await addMoves(moves);
    rec = await save('transfers', { id, no, from_branch_id: from, to_branch_id, lines: out, status: 'sent', sent_by: repoContext().user_id, sent_at: Date.now(), note, received_by: null },
      { audit: { action: 'transfer.send', details: { no, to: to_branch_id, items: out.length, qty: out.reduce((s, l) => s + l.qty, 0) } } });
  });
  return rec;
}
/** Receive a transfer at its destination. received: {product_id: qty}. Short items are recorded as lost in transit. */
export async function receiveTransfer(tr, received = {}, note = '') {
  let rec;
  await tx(async () => {
    const moves = [];
    const lines = [];
    let short = 0, over = 0;
    for (const l of tr.lines) {
      const got = r3(received[l.product_id] ?? l.qty);
      const diff = r3(got - l.qty);
      if (diff < 0) short = r3(short - diff); else over = r3(over + diff);
      lines.push({ ...l, received: got });
      if (got <= 0) continue;
      const base = { product_id: l.product_id, type: 'transfer_in', ref_type: 'transfer', ref_id: tr.id, cost: l.cost || 0, branch_id: tr.to_branch_id };
      if (l.batches?.length) for (const b of splitOverBatches(l.batches, got)) moves.push({ ...base, qty: b.qty, batch_no: b.batch_no || undefined, expiry: b.expiry || undefined });
      else if (l.serials?.length) {
        const n = Math.min(l.serials.length, Math.floor(got));
        for (const s of l.serials.slice(0, n)) {
          moves.push({ ...base, qty: 1, serial: s });
          const sr = await db().serials.where('serial').equals(s).first();
          if (sr) await save('serials', { ...sr, branch_id: tr.to_branch_id, status: 'in_stock' }, { silent: true });
        }
        if (got > n) moves.push({ ...base, qty: r3(got - n) });
      } else moves.push({ ...base, qty: got });
      for (const s of (l.serials || []).slice(Math.floor(got))) {
        const sr = await db().serials.where('serial').equals(s).first();
        if (sr) await save('serials', { ...sr, status: 'lost' }, { silent: true });
      }
    }
    if (moves.length) await addMoves(moves);
    rec = await save('transfers', { ...tr, lines, status: 'received', received_by: repoContext().user_id, received_at: Date.now(), receive_note: note, short, over, discrepancy: short > 0 || over > 0 },
      { audit: { action: short || over ? 'transfer.discrepancy' : 'transfer.receive', details: { no: tr.no, short, over, note } } });
  });
  return rec;
}
/** Cancel a transfer that has not been received: the stock goes back to the sending branch. */
export async function cancelTransfer(tr, reason = '') {
  let rec;
  await tx(async () => {
    const moves = [];
    for (const l of tr.lines) {
      const base = { product_id: l.product_id, type: 'transfer_in', ref_type: 'transfer', ref_id: tr.id, cost: l.cost || 0, branch_id: tr.from_branch_id, reason: 'Transfer cancelled' };
      if (l.batches?.length) for (const b of l.batches) moves.push({ ...base, qty: b.qty, batch_no: b.batch_no || undefined, expiry: b.expiry || undefined });
      else if (l.serials?.length) {
        for (const s of l.serials) { moves.push({ ...base, qty: 1, serial: s }); const sr = await db().serials.where('serial').equals(s).first(); if (sr) await save('serials', { ...sr, status: 'in_stock' }, { silent: true }); }
        if (l.qty > l.serials.length) moves.push({ ...base, qty: r3(l.qty - l.serials.length) });
      } else moves.push({ ...base, qty: l.qty });
    }
    await addMoves(moves);
    rec = await save('transfers', { ...tr, status: 'cancelled', cancelled_at: Date.now(), cancel_reason: reason }, { audit: { action: 'transfer.cancel', details: { no: tr.no, reason } } });
  });
  return rec;
}

/* ---------------- repack / convert ---------------- */
/** Turn from_qty of one product into to_qty of another (e.g. 1 × 50 kg bag → 50 × 1 kg). Cost carries over. */
export async function repack({ from_id, from_qty, to_id, to_qty, note = '' }) {
  const a = prod(from_id) || (await db().products.get(from_id));
  const b = prod(to_id) || (await db().products.get(to_id));
  from_qty = r3(from_qty); to_qty = r3(to_qty);
  if (!a || !b || from_qty <= 0 || to_qty <= 0) throw new Error('bad repack');
  const bid = repoContext().branch_id;
  const unitCost = repackCost(a.cost || 0, from_qty, to_qty);
  const ref_id = ulid();
  await tx(async () => {
    const curQty = await totalOnHand(b.id);
    const out = a.track_batches
      ? fefo(await batchBalances(a.id, bid), from_qty).map((x) => ({ qty: -x.qty, batch_no: x.batch_no || undefined, expiry: x.expiry || undefined }))
      : [{ qty: -from_qty }];
    await addMoves([
      ...out.map((x) => ({ product_id: a.id, type: 'repack_out', ref_type: 'repack', ref_id, cost: a.cost || 0, reason: 'Repacked into ' + b.name, note, ...x })),
      { product_id: b.id, qty: to_qty, type: 'repack_in', ref_type: 'repack', ref_id, cost: unitCost, reason: 'Repacked from ' + a.name, note }
    ]);
    await saveMany('products', [{ ...b, cost: movingAverage(curQty, b.cost || 0, to_qty, unitCost) }, ...(a.id !== b.id ? [{ ...a, repack: { to_id: b.id, yield: r3(to_qty / from_qty) } }] : [])].map(({ extra, ...p }) => p));
    await audit('stock.repack', 'products', a.id, { from: a.name, from_qty, to: b.name, to_qty, unit_cost: unitCost, ref_id });
  });
  return { unitCost };
}

/* ---------------- expiry ---------------- */
/** Remaining batches in a branch: [{product, batch_no, expiry, qty, days, bucket, value}] sorted FEFO. */
export async function batchRows(branchId) {
  const list = catalog.value.products.filter((p) => p.track_batches && !p.has_variants);
  const rows = [];
  const now = Date.now();
  for (const p of list) {
    for (const b of await batchBalances(p.id, branchId)) {
      rows.push({ id: p.id + '|' + b.batch_no, product: p, batch_no: b.batch_no, expiry: b.expiry, qty: b.qty, days: daysUntil(b.expiry, now), bucket: expiryBucket(b.expiry, now), value: Math.round(b.qty * (p.cost || 0)) });
    }
  }
  return rows.sort((a, b) => (a.expiry || '9999').localeCompare(b.expiry || '9999'));
}

/* ---------------- reorder suggestions ---------------- */
/** Average daily units sold per product over `days` in a branch. */
export async function salesVelocity(branchId, days = 30) {
  const since = Date.now() - days * DAY_MS;
  const m = new Map();
  await db().stock_moves.where('created_at').above(since).each((mv) => {
    if (mv.deleted || mv.branch_id !== branchId) return;
    if (mv.type === 'sale' || mv.type === 'recipe') m.set(mv.product_id, (m.get(mv.product_id) || 0) - mv.qty);
    else if (mv.type === 'void' || mv.type === 'return') m.set(mv.product_id, (m.get(mv.product_id) || 0) - mv.qty);
  });
  for (const [k, v] of m) m.set(k, Math.max(0, v) / days);
  return m;
}
/** Last supplier per product (from deliveries). */
export async function lastSuppliers() {
  const rows = await db().goods_received.orderBy('created_at').toArray();
  const m = new Map();
  for (const g of rows) if (!g.deleted && g.kind !== 'return') for (const l of g.lines || []) m.set(l.product_id, { supplier_id: g.supplier_id, cost: l.cost, at: g.created_at });
  return m;
}
/** Low-stock products in a branch with a suggested order quantity. */
export async function reorderSuggestions(branchId) {
  const [lv, vel, last, openPos] = await Promise.all([branchLevels(branchId), salesVelocity(branchId), lastSuppliers(), db().purchase_orders.where('status').anyOf('draft', 'sent', 'partial').toArray()]);
  const onOrder = new Map();
  for (const po of openPos) if (!po.deleted && (!po.branch_id || po.branch_id === branchId)) for (const l of po.lines || []) onOrder.set(l.product_id, r3((onOrder.get(l.product_id) || 0) + Math.max(0, l.qty - (l.received || 0))));
  const out = [];
  for (const p of catalog.value.products) {
    if (!p.track_stock || p.has_variants || p.active === false || p.type === 'composite') continue;
    const q = lv.get(p.id) || 0;
    if (q > (p.reorder_level || 0)) continue;
    const avg = vel.get(p.id) || 0;
    const ord = onOrder.get(p.id) || 0;
    const sug = suggestQty({ onHand: q + ord, reorderLevel: p.reorder_level, reorderQty: p.reorder_qty, avgDaily: avg, unit: p.unit });
    const ls = last.get(p.id);
    out.push({ id: p.id, product: p, onHand: q, onOrder: ord, avgDaily: avg, daysLeft: avg > 0 ? Math.max(0, q) / avg : null, suggested: sug, supplier_id: ls?.supplier_id || '', cost: ls?.cost || p.cost || 0 });
  }
  return out.sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999) || a.onHand - b.onHand);
}

/* ---------------- serial / IMEI lookup ---------------- */
export async function findSerial(q) {
  const s = String(q || '').trim();
  if (s.length < 3) return [];
  const exact = await db().serials.where('serial').equals(s).toArray();
  const hits = exact.length ? exact : await db().serials.where('serial').startsWith(s).limit(30).toArray();
  const moves = s ? await db().stock_moves.filter((m) => m.serial && (m.serial === s || (!exact.length && m.serial.startsWith(s)))).limit(200).toArray() : [];
  const bySerial = new Map();
  for (const h of hits) if (!h.deleted) bySerial.set(h.serial, { serial: h.serial, rec: h, moves: [] });
  for (const m of moves) (bySerial.get(m.serial) || bySerial.set(m.serial, { serial: m.serial, rec: null, moves: [] }).get(m.serial)).moves.push(m);
  const out = [];
  for (const x of bySerial.values()) {
    x.moves.sort((a, b) => b.created_at - a.created_at);
    x.product = prod(x.rec?.product_id || x.moves[0]?.product_id) || null;
    x.sale = x.rec?.sale_id ? await db().sales.get(x.rec.sale_id) : null;
    const pm = x.moves.find((m) => m.type === 'purchase');
    x.grn = pm?.ref_id ? await db().goods_received.get(pm.ref_id) : null;
    out.push(x);
  }
  return out;
}

export const notifyStock = () => emitChange('change', 'stock_levels', null);
