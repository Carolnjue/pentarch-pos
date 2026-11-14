// Stock service. The `stock_moves` ledger is the truth; `stock_levels` is a derived cache.
import { db } from './index.js';
import { saveMany, stamp, tx, repoContext, emitChange as emit } from './repo.js';

const r3 = (n) => Math.round(n * 1000) / 1000;

/** Derive levels from moves (pure — exported for tests). Returns Map "pid|bid" → qty */
export function deriveLevels(moves) {
  const m = new Map();
  for (const mv of moves) {
    if (mv.deleted) continue;
    const k = mv.product_id + '|' + mv.branch_id;
    m.set(k, r3((m.get(k) || 0) + mv.qty));
  }
  return m;
}

/**
 * Record stock moves (qty in base units: + in, − out) and update the cache.
 * Each move: {product_id, qty, type, ref_type?, ref_id?, cost?, batch_no?, expiry?, serial?, reason?}
 */
export async function addMoves(moves, opts = {}) {
  if (!moves.length) return [];
  const c = repoContext();
  const rs = moves.map((m) => ({ branch_id: c.branch_id, user_id: c.user_id, ...m }));
  let saved;
  await tx(async () => {
    saved = await saveMany('stock_moves', rs, { silent: true, ...opts });
    await applyToLevels(saved);
  });
  emit('change', 'stock_levels', saved.map((m) => m.product_id));
  return saved;
}

/** Increment cached levels for moves already stored. */
export async function applyToLevels(moves) {
  const delta = deriveLevels(moves);
  const now = Date.now();
  for (const [k, q] of delta) {
    const [product_id, branch_id] = k.split('|');
    const cur = await db().stock_levels.get([product_id, branch_id]);
    await db().stock_levels.put({ product_id, branch_id, qty: r3((cur?.qty || 0) + q), updated_at: now });
  }
}

/** Rebuild cache from the ledger (all products or the given ids). Used after sync pulls. */
export async function rebuildLevels(productIds) {
  const t = db();
  const moves = productIds ? await t.stock_moves.where('product_id').anyOf(productIds).toArray() : await t.stock_moves.toArray();
  const lv = deriveLevels(moves);
  await t.transaction('rw', t.stock_levels, async () => {
    if (productIds) await t.stock_levels.where('product_id').anyOf(productIds).delete();
    else await t.stock_levels.clear();
    const now = Date.now();
    await t.stock_levels.bulkPut([...lv].map(([k, qty]) => { const [product_id, branch_id] = k.split('|'); return { product_id, branch_id, qty, updated_at: now }; }));
  });
  emit('change', 'stock_levels', productIds || null);
}

export async function onHand(productId, branchId) {
  return (await db().stock_levels.get([productId, branchId]))?.qty || 0;
}

/** Remaining qty per batch for product/branch, sorted FEFO (earliest expiry first). */
export async function batchBalances(productId, branchId) {
  const moves = await db().stock_moves.where('[product_id+branch_id]').equals([productId, branchId]).toArray();
  const by = {};
  for (const m of moves) {
    if (!m.batch_no || m.deleted) continue;
    const b = (by[m.batch_no] ||= { batch_no: m.batch_no, expiry: m.expiry || '', qty: 0 });
    b.qty = r3(b.qty + m.qty);
    if (m.expiry && !b.expiry) b.expiry = m.expiry;
  }
  return Object.values(by).filter((b) => b.qty > 0).sort((a, b) => (a.expiry || '9999').localeCompare(b.expiry || '9999'));
}

/** Allocate qty across batches FEFO → [{batch_no, expiry, qty}] (remainder without batch if short). */
export function fefo(balances, qty) {
  const out = [];
  let left = qty;
  for (const b of balances) {
    if (left <= 0) break;
    const take = Math.min(b.qty, left);
    out.push({ batch_no: b.batch_no, expiry: b.expiry, qty: r3(take) });
    left = r3(left - take);
  }
  if (left > 0) out.push({ batch_no: '', expiry: '', qty: left });
  return out;
}

/** Moving-average cost after receiving qty at unitCost (all cents). */
export function movingAverage(curQty, curCost, inQty, inCost) {
  const q0 = Math.max(0, curQty);
  if (q0 + inQty <= 0) return inCost;
  return Math.round((q0 * curCost + inQty * inCost) / (q0 + inQty));
}

export { stamp };
