// Report data loading: indexed range queries with a short-lived cache (switching between reports re-uses what is loaded;
// any 'change' event clears it). Every query uses an index (created_at / at / date / opened_at).
import { db } from '../../db/index.js';
import { on } from '../../lib/bus.js';
import { dayKey } from '../../lib/util.js';

const cache = new Map();
const TTL = 60000;
on('change', () => cache.clear());
on('synced', () => cache.clear());
export const clearCache = () => cache.clear();

function memo(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.p;
  const p = fn();
  cache.set(key, { at: Date.now(), p });
  p.catch(() => cache.delete(key));
  return p;
}
const ns = () => db()?.name || '';
const range = (table, index, from, to) => memo(`${ns()}|${table}|${from}|${to}`, () => db().table(table).where(index).between(from, to, true, false).toArray());
const allOf = (table) => memo(`${ns()}|${table}|all`, () => db().table(table).toArray());

/** Sales in [from, to) — including voids (reports decide); deleted rows dropped. */
export const salesIn = async (from, to) => (await range('sales', 'created_at', from, to)).filter((s) => !s.deleted);
export const returnsIn = async (from, to) => (await range('returns', 'created_at', from, to)).filter((r) => !r.deleted);
export const auditIn = async (from, to) => (await range('audit', 'at', from, to)).filter((r) => !r.deleted);
export const cashMovesIn = async (from, to) => (await range('cash_moves', 'created_at', from, to)).filter((r) => !r.deleted);
export const custPaymentsIn = async (from, to) => (await range('customer_payments', 'created_at', from, to)).filter((r) => !r.deleted);
export const grnsIn = async (from, to) => (await range('goods_received', 'created_at', from, to)).filter((r) => !r.deleted);
export const supPaymentsIn = async (from, to) => (await range('supplier_payments', 'created_at', from, to)).filter((r) => !r.deleted);
export const shiftsIn = async (from, to) => (await range('shifts', 'opened_at', from, to)).filter((r) => !r.deleted);
export const movesIn = async (from, to) => (await range('stock_moves', 'created_at', from, to)).filter((r) => !r.deleted);
/** Expenses by their `date` (yyyy-mm-dd, local) within [from, to). */
export const expensesIn = (from, to) => memo(`${ns()}|expenses|${from}|${to}`, async () =>
  (await db().expenses.where('date').between(dayKey(from), dayKey(to - 1), true, true).toArray()).filter((e) => !e.deleted));

export const all = (table) => allOf(table);
export const mapOf = async (table) => new Map((await allOf(table)).map((r) => [r.id, r]));
export const levels = () => memo(`${ns()}|stock_levels`, () => db().stock_levels.toArray());

/** Sales the returns refer to (they may be older than the period). */
export async function salesById(ids, known = []) {
  const m = new Map(known.map((s) => [s.id, s]));
  const miss = [...new Set(ids)].filter((id) => id && !m.has(id));
  if (miss.length) for (const s of await db().sales.bulkGet(miss)) if (s) m.set(s.id, s);
  return m;
}
/** Batch-tracked products' moves (for expiry). */
export async function batchMoves(productIds) {
  if (!productIds.length) return [];
  return db().stock_moves.where('product_id').anyOf(productIds).toArray();
}
/** Last sale move per product (one pass over the sale moves index). */
export const lastSoldMap = () => memo(`${ns()}|lastSold`, async () => {
  const m = new Map();
  await db().stock_moves.where('type').equals('sale').each((mv) => { if (!mv.deleted && (m.get(mv.product_id) || 0) < mv.created_at) m.set(mv.product_id, mv.created_at); });
  return m;
});
