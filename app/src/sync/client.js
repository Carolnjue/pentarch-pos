// Sync loop — SPEC §4. outbox → push (≤500/batch, exponential backoff) → pull since last_pull_seq → apply → rebuild stock_levels.
import { db, getMeta, setMeta, isDemoDb } from '../db/index.js';
import { ENTITIES } from '../db/schema.js';
import { rebuildLevels } from '../db/stock.js';
import { Cloud, ApiError } from './api.js';
import { emit, on } from '../lib/bus.js';
import { sync, online, isDemo } from '../state.js';

const PUSH_BATCH = 500;
let running = null;
let backoff = 0;
let timer = null;
let debounceT = null;
let started = false;
let stage = 'idle';

export async function pendingCount() {
  return db() ? db().outbox.count() : 0;
}

async function refreshPending(state) {
  const pending = await pendingCount();
  sync.value = { ...sync.value, pending, ...(state ? { state } : {}) };
}

/** Run one full sync cycle (push then pull). Safe to call often — concurrent calls share one run. */
export function syncNow(reason = 'manual') {
  if (isDemo.value || isDemoDb()) { sync.value = { ...sync.value, state: 'demo' }; return Promise.resolve(); }
  if (running) return running;
  running = (async () => {
    try {
      stage = 'token';
      if (!(await getMeta('device_token'))) { await refreshPending('idle'); return; }
      if (!navigator.onLine) { online.value = false; await refreshPending('offline'); return; }
      online.value = true;
      sync.value = { ...sync.value, state: 'syncing', error: '' };
      try {
        stage = 'push';
        await pushAll();
        stage = 'pull';
        await pullAll();
        backoff = 0;
        sync.value = { ...sync.value, state: 'idle', lastAt: Date.now(), error: '' };
        await setMeta('last_sync_at', Date.now());
        emit('synced', reason);
      } catch (e) {
        backoff = Math.min(backoff ? backoff * 2 : 5000, 5 * 60000);
        const offline = !navigator.onLine || e.name === 'AbortError' || e instanceof TypeError;
        sync.value = { ...sync.value, state: offline ? 'offline' : 'error', error: e.message || String(e) };
        if (e instanceof ApiError && e.status === 401) emit('auth-expired');
        schedule(backoff);
      }
    } finally {
      // always release the lock — early returns (offline / not registered) included
      stage = 'idle';
      running = null;
      await refreshPending().catch(() => {});
    }
  })();
  return running;
}

async function pushAll() {
  for (;;) {
    const batch = await db().outbox.orderBy('seq').limit(PUSH_BATCH).toArray();
    if (!batch.length) return;
    // de-duplicate: newest queued version of each record wins
    const latest = new Map();
    for (const o of batch) latest.set(o.entity + ':' + o.id, o);
    const changes = [...latest.values()].map((o) => ({
      entity: o.entity, id: o.id, branch_id: o.record.branch_id || null,
      data: o.record, updated_at: o.record.updated_at, deleted: o.record.deleted ? 1 : 0
    }));
    const res = await Cloud.push(changes);
    const accepted = new Set(res?.accepted || []);
    const rejected = new Map((res?.rejected || []).map((r) => [r.id, r.reason]));
    // `superseded` ids (server already has a newer version) are part of `accepted`: drop them; the pull that follows brings the newer row
    for (const sid of res?.superseded || []) accepted.add(sid);
    const done = [], retry = [];
    for (const o of batch) {
      if (accepted.has(o.id)) done.push(o.seq);
      else if (rejected.has(o.id)) {
        // permanent rejections are parked (never dropped) with the reason, after 5 tries
        o.tries = (o.tries || 0) + 1; o.error = rejected.get(o.id);
        retry.push(o);
      } else done.push(o.seq); // not mentioned = server ignored as duplicate → treat accepted
    }
    await db().transaction('rw', db().outbox, async () => {
      await db().outbox.bulkDelete(done);
      for (const o of retry) await db().outbox.put(o);
    });
    if (retry.length && retry.length === batch.length) {
      await setMeta('outbox_rejected', retry.map((o) => ({ entity: o.entity, id: o.id, reason: o.error })).slice(0, 50));
      return; // avoid hot loop on stuck items; retried next cycle
    }
  }
}

async function pullAll() {
  let since = (await getMeta('last_pull_seq')) || 0;
  const touched = new Set();
  let entitiesTouched = new Set();
  for (let guard = 0; guard < 200; guard++) {
    const res = await Cloud.pull(since, 1000);
    const changes = res?.changes || [];
    if (changes.length) {
      await applyChanges(changes, touched, entitiesTouched);
    }
    since = res?.next_seq ?? since;
    await setMeta('last_pull_seq', since);
    if (!res?.has_more) break;
  }
  if (touched.size) await rebuildLevels([...touched]);
  for (const e of entitiesTouched) emit('change', e, null);
}

/**
 * Should a pulled version replace the local row? S and L entities alike: only a strictly newer `updated_at`
 * (ledger rows change only for status, e.g. sale → void; an equal or older copy — including our own echo — is skipped).
 */
export const shouldApply = (cur, rec) => !cur || (cur.updated_at || 0) < (rec.updated_at || 0);

/** Apply pulled changes. S: last-write-wins (skip if local newer). L: insert once. Exported for tests. */
export async function applyChanges(changes, touchedProducts = new Set(), entitiesTouched = new Set()) {
  const t = db();
  await t.transaction('rw', Object.keys(ENTITIES).map((e) => t.table(e)), async () => {
    for (const c of changes) {
      if (!ENTITIES[c.entity]) continue;
      const table = t.table(c.entity);
      const rec = { ...(c.data || {}), id: c.id, updated_at: c.updated_at ?? c.data?.updated_at, deleted: c.deleted ? 1 : (c.data?.deleted || 0) };
      if (c.branch_id && !rec.branch_id) rec.branch_id = c.branch_id;
      const cur = await table.get(c.id);
      if (!shouldApply(cur, rec)) continue;
      await table.put(rec);
      entitiesTouched.add(c.entity);
      if (c.entity === 'stock_moves') touchedProducts.add(rec.product_id);
    }
  });
}

function schedule(ms) {
  clearTimeout(timer);
  timer = setTimeout(() => syncNow('timer'), ms);
}

/** Start the background loop: on start, every 60 s, after sales (debounced 5 s), on `online`. */
export function startSync() {
  if (started) return; started = true;
  window.addEventListener('online', () => { online.value = true; syncNow('online'); });
  window.addEventListener('offline', () => { online.value = false; sync.value = { ...sync.value, state: 'offline' }; });
  setInterval(() => syncNow('interval'), 60000);
  on('sale', () => { clearTimeout(debounceT); debounceT = setTimeout(() => syncNow('sale'), 5000); });
  on('change', () => { if (!isDemo.value) refreshPending(); });
  syncNow('start');
}
// QA / support hook (read-only state + manual trigger); harmless in production.
if (typeof window !== 'undefined') window.__pposSync = { syncNow, state: () => ({ ...sync.value, running: !!running, stage }) };
