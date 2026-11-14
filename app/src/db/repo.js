// Repository API: the ONLY way modules should write data.
// - stamps id (ULID), created_at, updated_at, deleted, branch_id
// - queues synced entities into `outbox` (live mode only)
// - optional audit entry in the same transaction
import { db, isDemoDb } from './index.js';
import { ulid } from '../lib/ulid.js';
import { ENTITIES, isSynced, STORES } from './schema.js';
import Dexie from 'dexie';
import { emit as rawEmit } from '../lib/bus.js';

// Never notify listeners from inside a transaction zone (their queries would join/close it) — defer to a macrotask.
const emit = (...a) => (Dexie.currentTransaction ? setTimeout(() => rawEmit(...a), 0) : rawEmit(...a));
export { emit as emitChange };

const ctx = { user_id: null, device_id: null, branch_id: null };
/** Called by auth/session when the user/branch/device changes. */
export const setRepoContext = (c) => Object.assign(ctx, c);
export const repoContext = () => ({ ...ctx });

const BRANCHED = new Set(['stock_moves', 'batches', 'serials', 'purchase_orders', 'goods_received', 'sales', 'returns', 'orders', 'shifts', 'expenses', 'stock_counts', 'customer_payments', 'cash_moves', 'quotes', 'tables', 'devices']);

export function stamp(entity, rec, now = Date.now()) {
  rec.id ||= ulid(now);
  rec.created_at ||= now;
  rec.updated_at = now;
  rec.deleted ||= 0;
  if (BRANCHED.has(entity) && !rec.branch_id && ctx.branch_id) rec.branch_id = ctx.branch_id;
  return rec;
}

const ALL_TABLES = () => Object.keys(STORES).map((t) => db().table(t));
/** Run fn inside one read-write transaction over all tables (nested calls join it). */
export const tx = (fn) => db().transaction('rw', ALL_TABLES(), fn);

async function queue(entity, recs) {
  if (isDemoDb() || !isSynced(entity)) return;
  await db().outbox.bulkAdd(recs.map((r) => ({ entity, id: r.id, op: r.deleted ? 'delete' : 'put', record: r, tries: 0 })));
}

/**
 * Save (insert or replace) a record. Returns the stamped record.
 * opts.audit: {action, details} → also writes an audit entry
 * opts.keepTimes: do not touch updated_at (used by sync apply / seeding)
 */
export async function save(entity, rec, opts = {}) {
  const r = opts.keepTimes ? rec : stamp(entity, { ...rec });
  await tx(async () => {
    await db().table(entity).put(r);
    if (opts.outbox !== false) await queue(entity, [r]);
    if (opts.audit) await audit(opts.audit.action, entity, r.id, opts.audit.details);
  });
  if (!opts.silent) emit('change', entity, [r.id]);
  return r;
}

export async function saveMany(entity, recs, opts = {}) {
  if (!recs.length) return recs;
  const now = Date.now();
  const rs = opts.keepTimes ? recs : recs.map((r) => stamp(entity, { ...r }, now));
  await tx(async () => {
    await db().table(entity).bulkPut(rs);
    if (opts.outbox !== false) await queue(entity, rs);
  });
  if (!opts.silent) emit('change', entity, rs.map((r) => r.id));
  return rs;
}

/** Merge fields into an existing record (S entities only — ledgers are immutable). */
export async function patch(entity, id, changes, opts = {}) {
  if (ENTITIES[entity] === 'L' && !opts.force) throw new Error(`${entity} is an append-only ledger`);
  const cur = await db().table(entity).get(id);
  if (!cur) throw new Error(`${entity} ${id} not found`);
  return save(entity, { ...cur, ...changes }, opts);
}

/** Soft delete (sets deleted:1) — synced records are never hard-deleted. */
export async function remove(entity, id, opts = {}) {
  const cur = await db().table(entity).get(id);
  if (!cur) return null;
  return save(entity, { ...cur, deleted: 1, active: false }, opts);
}

export const get = (entity, id) => db().table(entity).get(id);
/** All non-deleted records, optionally filtered. */
export const all = async (entity, filter) => {
  const rows = await db().table(entity).toArray();
  return rows.filter((r) => !r.deleted && (!filter || filter(r)));
};

/** Write an audit entry. Call inside or outside a transaction. */
export async function audit(action, entity, entity_id, details = {}) {
  const r = stamp('audit', { action, entity, entity_id, details, user_id: ctx.user_id, device_id: ctx.device_id, at: Date.now() });
  await db().audit.put(r);
  await queue('audit', [r]);
  return r;
}

export const repo = { save, saveMany, patch, remove, get, all, audit, tx, stamp };
export default repo;
