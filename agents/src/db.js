import Dexie from 'dexie';

// Local database for the agent portal. Leads and activities are the source of truth
// on the phone; the outbox queues every change until the cloud accepts it.
export const db = new Dexie('pentarch-agents');

db.version(1).stores({
  meta: 'key',
  leads: 'id, stage, updated_at, next_follow_up, phone, deleted',
  activities: 'id, lead_id, at',
  outbox: '++seq, kind, id',
  cache: 'key'
});

export async function getMeta(key, fallback = null) {
  const row = await db.meta.get(key);
  return row ? row.value : fallback;
}
export function setMeta(key, value) {
  return db.meta.put({ key, value });
}
export async function getCache(key) {
  const row = await db.cache.get(key);
  return row ? row.value : null;
}
export function setCache(key, value) {
  return db.cache.put({ key, value, at: Date.now() });
}

// Crockford ULID (time-sortable, collision-safe ids generated offline).
const A = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function ulid() {
  let t = Date.now();
  let out = '';
  for (let i = 0; i < 10; i++) { out = A[t % 32] + out; t = Math.floor(t / 32); }
  const r = new Uint8Array(16);
  crypto.getRandomValues(r);
  for (let i = 0; i < 16; i++) out += A[r[i] % 32];
  return out;
}

/** Save a lead locally and queue it for sync. */
export async function saveLead(lead) {
  const now = Date.now();
  const rec = { ...lead, updated_at: Math.max(now, (lead.updated_at || 0) + 1), created_at: lead.created_at || now };
  if (!rec.id) rec.id = ulid();
  rec.deleted = rec.deleted ? 1 : 0;
  await db.transaction('rw', db.leads, db.outbox, async () => {
    await db.leads.put(rec);
    await db.outbox.add({ kind: 'leads', id: rec.id, at: now });
  });
  return rec;
}

/** Log an activity (visit, call, WhatsApp, demo, note, stage). */
export async function addActivity(lead_id, type, note = '', extra = {}) {
  const act = { id: ulid(), lead_id, type, note, at: Date.now(), ...extra };
  await db.transaction('rw', db.activities, db.outbox, async () => {
    await db.activities.put(act);
    await db.outbox.add({ kind: 'lead_activities', id: act.id, at: act.at });
  });
  return act;
}

/** Undo helper: drop an activity that has not been sent yet. Returns false if it already synced. */
export async function dropUnsentActivity(id) {
  let dropped = false;
  await db.transaction('rw', db.activities, db.outbox, async () => {
    const rows = await db.outbox.where('id').equals(id).toArray();
    if (rows.length) {
      await db.outbox.bulkDelete(rows.map((r) => r.seq));
      await db.activities.delete(id);
      dropped = true;
    }
  });
  return dropped;
}

/** Queue a server action that must run online (e.g. demo booking). */
export async function queueAction(kind, payload) {
  return db.outbox.add({ kind, id: ulid(), payload, at: Date.now() });
}

export async function wipeLocal() {
  await Promise.all([db.leads.clear(), db.activities.clear(), db.outbox.clear(), db.cache.clear()]);
  const keep = await db.meta.get('lang');
  await db.meta.clear();
  if (keep) await db.meta.put(keep);
}
