// Demo data for Inventory & Purchasing: deliveries (GRNs) with payments, purchase orders, adjustments, a stock count,
// a supplier return and (multi-branch) transfers. Runs after seedDemo() has written the catalogue and sales history.
// Writes straight into the demo database with bulkPut (fast; the demo has no outbox).
import { db, setMeta } from '../db/index.js';
import { rebuildLevels } from '../db/stock.js';
import { ulid } from '../lib/ulid.js';

const DAY = 86400000;
let s0 = 1;
const rnd = () => { s0 = (s0 * 1664525 + 1013904223) >>> 0; return s0 / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const imei = () => { const d = [3, 5]; while (d.length < 14) d.push(Math.floor(rnd() * 10)); let s = 0; for (let i = 0; i < 14; i++) { let v = d[i]; if (i % 2) { v *= 2; if (v > 9) v -= 9; } s += v; } return d.join('') + ((10 - (s % 10)) % 10); };

export async function seedStockDemo(type) {
  const d = db();
  s0 = 7331 + type.length * 101;
  const now = Date.now();
  const [biz] = await d.business.toArray();
  const branches = (await d.branches.toArray()).filter((b) => !b.deleted);
  const main = branches.find((b) => b.is_main) || branches[0];
  const other = branches.find((b) => b !== main);
  const users = await d.users.toArray();
  const by = users.find((u) => u.role === 'stock') || users.find((u) => u.role === 'manager') || users[0];
  const owner = users.find((u) => u.role === 'owner') || users[0];
  const devId = (await d.meta.get('device_id'))?.value;
  const suppliers = (await d.suppliers.toArray()).filter((x) => !x.deleted);
  const products = (await d.products.toArray()).filter((p) => !p.deleted && p.track_stock && !p.has_variants && p.active !== false && p.type !== 'composite');
  if (!suppliers.length || !products.length) return;
  const levels = new Map((await d.stock_levels.where('branch_id').equals(main.id).toArray()).map((r) => [r.product_id, r.qty]));
  const healthy = products.filter((p) => (levels.get(p.id) || 0) > (p.reorder_level || 0) && !p.track_serials);
  const code = main.code || 'POS';
  const seq = { GRN: 0, PO: 0, SR: 0, CNT: 0, TR: 0 };
  const no = (k) => `${k}-${code}1-${String(++seq[k]).padStart(4, '0')}`;
  const rec = (r, at) => ({ deleted: 0, ...r, id: r.id || ulid(at), created_at: at, updated_at: at });
  const grns = [], moves = [], pays = [], pos = [], audits = [], batches = [], serials = [], counts = [], transfers = [];
  const audit = (action, entity, entity_id, details, at, user = by) => audits.push(rec({ action, entity, entity_id, details, user_id: user.id, device_id: devId, at }, at));
  const mv = (m, at, user = by) => moves.push(rec({ branch_id: main.id, user_id: user.id, ...m }, at));

  // ---------- deliveries from the first suppliers (oldest first) ----------
  const sup = suppliers.slice(0, Math.min(3, suppliers.length));
  const batchP = products.filter((p) => p.track_batches);
  const serialP = (await d.products.toArray()).filter((p) => p.track_serials && !p.deleted);
  const plan = [[24, 0, 'full'], [17, 1, 'part'], [11, 0, 'full'], [6, 2, 'none'], [3, 1, 'none'], [1, 0, 'none']];
  let poForGrn = null;
  for (const [ago, si, payState] of plan) {
    const s = sup[si % sup.length];
    const d0 = new Date(now - ago * DAY); d0.setHours(0, 0, 0, 0);
    const at = d0.getTime() + (8 + Math.floor(rnd() * 7)) * 3600e3 + Math.floor(rnd() * 50) * 60000;
    const id = ulid(at);
    const pickN = 3 + Math.floor(rnd() * 4);
    const chosen = new Set();
    while (chosen.size < Math.min(pickN, healthy.length)) chosen.add(pick(healthy));
    const lines = [];
    for (const p of chosen) {
      if (p.track_batches) continue;
      const qty = p.unit === 'pc' ? Math.max(6, Math.round((p.reorder_qty || 12) * (0.5 + rnd()))) : Math.round((p.reorder_qty || 10) * (0.5 + rnd()) * 10) / 10;
      lines.push({ product_id: p.id, name: p.name, qty, cost: p.cost, unit_cost: p.cost, batch_no: '', expiry: '', serials: [] });
      mv({ product_id: p.id, qty, type: 'purchase', ref_type: 'grn', ref_id: id, cost: p.cost }, at);
    }
    if (batchP.length && ago === 11) {
      const p = pick(batchP);
      const exp = new Date(now + (380 + Math.floor(rnd() * 200)) * DAY).toISOString().slice(0, 10);
      const bno = 'B' + (60000 + Math.floor(rnd() * 30000));
      const qty = Math.max(10, p.reorder_qty || 10);
      lines.push({ product_id: p.id, name: p.name, qty, cost: p.cost, unit_cost: p.cost, batch_no: bno, expiry: exp, serials: [] });
      mv({ product_id: p.id, qty, type: 'purchase', ref_type: 'grn', ref_id: id, cost: p.cost, batch_no: bno, expiry: exp }, at);
      batches.push(rec({ product_id: p.id, branch_id: main.id, batch_no: bno, expiry: exp, qty_received: qty, grn_id: id }, at));
    }
    if (serialP.length && ago === 6) {
      const p = pick(serialP);
      const list = [imei(), imei(), imei()];
      lines.push({ product_id: p.id, name: p.name, qty: list.length, cost: p.cost, unit_cost: p.cost, batch_no: '', expiry: '', serials: list });
      for (const sn of list) { mv({ product_id: p.id, qty: 1, type: 'purchase', ref_type: 'grn', ref_id: id, cost: p.cost, serial: sn }, at); serials.push(rec({ product_id: p.id, branch_id: main.id, serial: sn, status: 'in_stock', sale_id: null, grn_id: id }, at)); }
    }
    if (!lines.length) continue;
    const total = lines.reduce((x, l) => x + Math.round(l.qty * l.cost), 0);
    const paid = payState === 'full' ? total : 0;
    const g = rec({ id, kind: 'receipt', supplier_id: s.id, branch_id: main.id, po_id: null, no: no('GRN'), supplier_invoice_no: 'INV-' + (20400 + Math.floor(rnd() * 900)), lines, subtotal: total, extra_costs: [], total, paid, note: '', user_id: by.id }, at);
    grns.push(g);
    audit('purchase.receive', 'goods_received', id, { no: g.no, supplier_id: s.id, total, items: lines.length }, at);
    if (paid) pays.push(rec({ supplier_id: s.id, amount: paid, method: pick(['mpesa', 'cash', 'bank']), ref: '', note: 'Paid on delivery ' + g.no, grn_ids: [id], allocations: [{ grn_id: id, amount: paid }], user_id: by.id }, at + 60000));
    if (payState === 'part') {
      const amt = Math.round(total * 0.6 / 100) * 100;
      pays.push(rec({ supplier_id: s.id, amount: amt, method: 'mpesa', ref: 'TK' + Math.floor(rnd() * 9e7 + 1e7), note: '', grn_ids: [id], allocations: [{ grn_id: id, amount: amt }], user_id: owner.id }, at + 4 * DAY));
      audit('supplier.payment', 'supplier_payments', null, { supplier_id: s.id, amount: amt, method: 'mpesa' }, at + 4 * DAY, owner);
    }
    if (ago === 3) poForGrn = g;
  }

  // ---------- purchase orders ----------
  const low = products.filter((p) => (levels.get(p.id) || 0) <= (p.reorder_level || 0)).slice(0, 4);
  const poLines = (list) => list.map((p) => ({ product_id: p.id, name: p.name, qty: Math.max(6, p.reorder_qty || 12), cost: p.cost, received: 0 }));
  const poTotal = (ls) => ls.reduce((x, l) => x + Math.round(l.qty * l.cost), 0);
  if (poForGrn) {
    const at = poForGrn.created_at - 3 * DAY;
    const lines = poForGrn.lines.map((l) => ({ product_id: l.product_id, name: l.name, qty: l.qty, cost: l.cost, received: l.qty }));
    const po = rec({ supplier_id: poForGrn.supplier_id, branch_id: main.id, no: no('PO'), status: 'received', lines, total: poTotal(lines), expected_date: new Date(poForGrn.created_at).toISOString().slice(0, 10), notes: '', created_by: owner.id, sent_at: at, grn_ids: [poForGrn.id] }, at);
    poForGrn.po_id = po.id;
    pos.push(po);
  }
  if (low.length) {
    const s = sup[0];
    const lines = poLines(low.slice(0, 3));
    const at = now - 1 * DAY;
    pos.push(rec({ supplier_id: s.id, branch_id: main.id, no: no('PO'), status: 'sent', lines, total: poTotal(lines), expected_date: new Date(now + 2 * DAY).toISOString().slice(0, 10), notes: 'Deliver before 10 am please.', created_by: owner.id, sent_at: at }, at));
    audit('po.create', 'purchase_orders', null, { supplier_id: s.id, items: lines.length }, at, owner);
  }
  {
    const s = sup[Math.min(1, sup.length - 1)];
    const lines = poLines(healthy.slice(-3));
    pos.push(rec({ supplier_id: s.id, branch_id: main.id, no: no('PO'), status: 'draft', lines, total: poTotal(lines), expected_date: '', notes: '', created_by: by.id }, now - 3 * 3600e3));
  }

  // ---------- adjustments ----------
  const adj = [['damaged', -2, 'Dropped while offloading', 9], ['own_use', -1, 'Used in the shop', 5], ['found', 1, 'Found in the store room', 4], ['theft', -1, '', 2], ['damaged', -1, 'Torn packet', 1]];
  for (const [reason, q, note, ago] of adj) {
    const p = pick(healthy);
    const at = now - ago * DAY - Math.floor(rnd() * 6) * 3600e3;
    const ref = ulid(at);
    const qty = p.unit === 'pc' ? q : q * 0.5;
    mv({ product_id: p.id, qty, type: 'adjust', ref_type: 'adjustment', ref_id: ref, cost: p.cost, reason, note }, at);
    audit('stock.adjust', 'products', p.id, { name: p.name, qty, reason, note, value: Math.round(qty * p.cost), ref_id: ref }, at);
  }

  // ---------- an applied stock count (one category) ----------
  {
    const cat = products[0].category_id;
    const inCat = products.filter((p) => p.category_id === cat && !p.track_batches).slice(0, 12);
    const at = now - 8 * DAY;
    const id = ulid(at);
    let gain = 0, loss = 0;
    const lines = inCat.map((p, i) => {
      const expected = Math.max(0, Math.round(levels.get(p.id) || 0));
      const variance = i === 1 ? -2 : i === 4 ? 1 : i === 6 ? -1 : 0;
      if (variance) { mv({ product_id: p.id, qty: variance, type: 'count', ref_type: 'stock_count', ref_id: id, cost: p.cost, reason: 'Stock count' }, at + 3600e3); if (variance > 0) gain += variance * p.cost; else loss += variance * p.cost; }
      return { product_id: p.id, expected, counted: expected + variance, variance };
    });
    counts.push(rec({ id, branch_id: main.id, no: no('CNT'), name: 'Shelf check', scope: 'category', category_ids: [cat], blind: false, note: '', status: 'applied', started_by: by.id, applied_at: at + 3600e3, applied_by: owner.id, lines, gain, loss }, at));
    audit('stock.count', 'stock_counts', id, { lines: lines.length, gain, loss }, at + 3600e3, owner);
  }

  // ---------- a supplier return ----------
  if (grns.length) {
    const g = grns[0];
    const l = g.lines[0];
    const at = now - 15 * DAY;
    const id = ulid(at);
    const qty = l.qty >= 4 ? 2 : 1;
    grns.push(rec({ id, kind: 'return', supplier_id: g.supplier_id, branch_id: main.id, po_id: null, grn_id: g.id, no: no('SR'), supplier_invoice_no: '', lines: [{ product_id: l.product_id, name: l.name, qty: -qty, cost: l.cost, batch_no: '', serials: [] }], subtotal: -qty * l.cost, extra_costs: [], total: -qty * l.cost, paid: 0, reason: 'Damaged', note: 'Crushed cartons', user_id: by.id }, at));
    mv({ product_id: l.product_id, qty: -qty, type: 'adjust', ref_type: 'supplier_return', ref_id: id, cost: l.cost, reason: 'returned_to_supplier', note: 'Damaged' }, at);
    audit('purchase.return', 'goods_received', id, { supplier_id: g.supplier_id, total: qty * l.cost, reason: 'Damaged' }, at);
  }

  // ---------- transfers (multi-branch) ----------
  if (other) {
    const lv2 = new Map((await d.stock_levels.where('branch_id').equals(other.id).toArray()).map((r) => [r.product_id, r.qty]));
    const sendable = healthy.filter((p) => !p.track_batches && (levels.get(p.id) || 0) > 10).slice(0, 8);
    const mk = (from, to, list, at, status, short) => {
      const id = ulid(at);
      const lines = list.map((p, i) => ({ product_id: p.id, name: p.name, qty: 5, cost: p.cost, batches: [], serials: [], ...(status === 'received' ? { received: short && i === 0 ? 4 : 5 } : {}) }));
      for (const l of lines) {
        moves.push(rec({ product_id: l.product_id, branch_id: from.id, qty: -l.qty, type: 'transfer_out', ref_type: 'transfer', ref_id: id, cost: l.cost, user_id: by.id }, at));
        if (status === 'received') moves.push(rec({ product_id: l.product_id, branch_id: to.id, qty: l.received, type: 'transfer_in', ref_type: 'transfer', ref_id: id, cost: l.cost, user_id: by.id }, at + 5 * 3600e3));
      }
      transfers.push(rec({ id, from_branch_id: from.id, to_branch_id: to.id, no: no('TR'), lines, status, sent_by: by.id, sent_at: at, note: '', received_by: status === 'received' ? by.id : null, received_at: status === 'received' ? at + 5 * 3600e3 : null, ...(status === 'received' ? { short: short ? 1 : 0, over: 0, discrepancy: !!short, receive_note: short ? 'One packet torn' : '' } : {}) }, at));
      audit('transfer.send', 'transfers', id, { to: to.id, items: lines.length }, at);
    };
    if (sendable.length >= 3) mk(main, other, sendable.slice(0, 3), now - 6 * DAY, 'received', true);
    const back = sendable.slice(3, 5).filter((p) => (lv2.get(p.id) || 0) > 6);
    if (back.length) mk(other, main, back, now - 5 * 3600e3, 'sent', false);
  }

  // repack pairing for bulk sugar (wholesale demo)
  const all = await d.products.toArray();
  const bag = all.find((p) => /50kg bag/i.test(p.name) && /sugar/i.test(p.name));
  const kg1 = all.find((p) => /sugar 1kg/i.test(p.name));
  const prodUpd = bag && kg1 ? [{ ...bag, repack: { to_id: kg1.id, yield: 50 } }] : [];

  await d.transaction('rw', [d.goods_received, d.stock_moves, d.supplier_payments, d.purchase_orders, d.audit, d.batches, d.serials, d.stock_counts, d.transfers, d.products, d.meta], async () => {
    await d.goods_received.bulkPut(grns);
    await d.stock_moves.bulkPut(moves);
    await d.supplier_payments.bulkPut(pays);
    await d.purchase_orders.bulkPut(pos);
    await d.audit.bulkPut(audits);
    await d.batches.bulkPut(batches);
    await d.serials.bulkPut(serials);
    await d.stock_counts.bulkPut(counts);
    await d.transfers.bulkPut(transfers);
    if (prodUpd.length) await d.products.bulkPut(prodUpd);
    for (const [k, v] of Object.entries(seq)) await setMeta('seq_' + k, v);
  });
  await rebuildLevels([...new Set(moves.map((m) => m.product_id))]);
  return { grns: grns.length, moves: moves.length, ms: Date.now() - now };
}
