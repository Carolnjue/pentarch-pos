import { signal } from '@preact/signals';
import { db, getMeta, setMeta, setCache } from './db.js';
import { api, ApiError } from './api.js';
import { session, updateAgent, online, showToast, signOut } from './store.js';
import { t } from './i18n.js';

// state: idle | syncing | offline | error ; pending = queued changes ; last = ms
export const syncState = signal({ state: navigator.onLine ? 'idle' : 'offline', pending: 0, last: 0 });

const BATCH = 200;
let running = null;
let queued = null;
let retryTimer = null;
let backoff = 5000;
let debounceTimer = null;

async function refreshPending() {
  const pending = await db.outbox.count();
  syncState.value = { ...syncState.value, pending };
  return pending;
}

/** Push queued leads/activities in batches; returns number pushed. */
async function pushLeads() {
  let total = 0;
  for (let guard = 0; guard < 50; guard++) {
    const items = await db.outbox.where('kind').anyOf('leads', 'lead_activities').limit(BATCH).toArray();
    if (!items.length) break;
    const seqs = items.map((i) => i.seq);
    const changes = [];
    const seen = new Set();
    for (const it of items) {
      const key = it.kind + ':' + it.id;
      if (seen.has(key)) continue;
      seen.add(key);
      if (it.kind === 'leads') {
        const l = await db.leads.get(it.id);
        if (!l) continue;
        const { activities, ...data } = l;
        changes.push({ entity: 'leads', id: l.id, data, updated_at: l.updated_at, deleted: l.deleted ? 1 : 0 });
      } else {
        const a = await db.activities.get(it.id);
        if (!a) continue;
        changes.push({ entity: 'lead_activities', id: a.id, data: a, updated_at: a.at });
      }
    }
    if (changes.length) {
      const res = await api('POST', '/agents/leads/push', { changes });
      const done = new Set([...(res.accepted || []), ...(res.rejected || []).map((r) => r.id)]);
      if (res.rejected && res.rejected.length) console.warn('Rejected by server', res.rejected);
      // Only remove the outbox rows we sent (newer edits queued meanwhile stay).
      const sent = items.filter((i) => done.has(i.id) || !changes.find((c) => c.id === i.id)).map((i) => i.seq);
      await db.outbox.bulkDelete(sent);
      total += changes.length;
    } else {
      await db.outbox.bulkDelete(seqs);
    }
  }
  return total;
}

/** Run queued online-only actions (demo bookings made while offline). */
async function runActions() {
  const items = await db.outbox.where('kind').equals('demo_booking').toArray();
  for (const it of items) {
    try {
      const res = await api('POST', '/agents/demo-bookings', it.payload);
      await db.outbox.delete(it.seq);
      showToast(t('Demo booked') + ' · ' + res.ref);
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 429) {
        await db.outbox.delete(it.seq);
        showToast(e.message || t('Something went wrong. Please try again.'), 'err');
      } else {
        throw e;
      }
    }
  }
}

async function pull() {
  let since = (await getMeta('last_seq', 0)) || 0;
  for (let guard = 0; guard < 100; guard++) {
    const res = await api('GET', `/agents/leads/pull?since=${since}&limit=1000`);
    const pendingIds = new Set((await db.outbox.where('kind').equals('leads').toArray()).map((o) => o.id));
    await db.transaction('rw', db.leads, db.activities, async () => {
      for (const c of res.changes) {
        const { activities = [], ...data } = c.data || {};
        const local = await db.leads.get(c.id);
        const keepLocal = local && pendingIds.has(c.id) && (local.updated_at || 0) > (c.updated_at || 0);
        if (!keepLocal) {
          await db.leads.put({ ...data, id: c.id, updated_at: c.updated_at, deleted: c.deleted ? 1 : 0 });
        }
        if (activities.length) await db.activities.bulkPut(activities.map((a) => ({ ...a, lead_id: a.lead_id || c.id })));
      }
    });
    since = res.next_seq;
    await setMeta('last_seq', since);
    if (!res.has_more) break;
  }
}

async function refreshCaches() {
  const jobs = [
    api('GET', '/agents/me').then(async (r) => { await updateAgent(r.agent); await setCache('stats', r.stats); await setCache('contact', r.contact); }),
    api('GET', '/agents/resources').then((r) => setCache('resources', r)),
    api('GET', '/public/config').then((r) => setCache('config', r))
  ];
  if (session.value.agent && session.value.agent.status === 'active') {
    jobs.push(
      api('GET', '/agents/commissions').then((r) => setCache('commissions', r)),
      api('GET', '/agents/trials').then((r) => setCache('trials', r.items)),
      api('GET', '/agents/leaderboard').then((r) => setCache('leaderboard', r))
    );
  }
  await Promise.allSettled(jobs);
}

/** Full sync cycle. Safe to call often; concurrent calls share one run. */
export function syncNow({ quiet = true } = {}) {
  // A sync already running may be past the push step: chain one more run so
  // changes made just now (e.g. a demo booking) go out straight away.
  if (running) {
    if (!queued) queued = running.then(() => { queued = null; return syncNow({ quiet }); });
    return queued;
  }
  running = (async () => {
    clearTimeout(retryTimer);
    if (!session.value.token) return;
    if (!navigator.onLine) { syncState.value = { ...syncState.value, state: 'offline' }; await refreshPending(); return; }
    syncState.value = { ...syncState.value, state: 'syncing' };
    try {
      // Refresh status first so a newly approved agent can sync straight away.
      const me = await api('GET', '/agents/me');
      await updateAgent(me.agent);
      await setCache('stats', me.stats);
      if (me.agent.status === 'active') {
        await pushLeads();
        await runActions();
        await pull();
      }
      await refreshCaches();
      backoff = 5000;
      const pending = await db.outbox.count();
      syncState.value = { state: 'idle', pending, last: Date.now() };
      await setMeta('last_sync', Date.now());
      if (!quiet) showToast(t('Synced'));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { await signOut(); return; }
      if (e instanceof ApiError && e.code === 'agent_suspended') { showToast(t('Your account is suspended. Contact Pentarch.'), 'err'); await signOut(); return; }
      const offline = !navigator.onLine || (e instanceof ApiError && (e.code === 'offline' || e.code === 'network'));
      syncState.value = { ...syncState.value, state: offline ? 'offline' : 'error' };
      await refreshPending();
      retryTimer = setTimeout(() => syncNow(), backoff);
      backoff = Math.min(backoff * 2, 5 * 60 * 1000);
      if (!quiet) showToast(offline ? t('You are offline. Changes are saved on this phone.') : t('Something went wrong. Please try again.'), 'err');
    }
  })().finally(() => { running = null; });
  return running;
}

/** Debounced sync after a local change. */
export function syncSoon() {
  refreshPending();
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => syncNow(), 1500);
}

export async function startSync() {
  syncState.value = { ...syncState.value, last: (await getMeta('last_sync', 0)) || 0 };
  await refreshPending();
  syncNow();
  setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 60000);
  window.addEventListener('online', () => { online.value = true; syncNow(); });
  window.addEventListener('offline', () => { syncState.value = { ...syncState.value, state: 'offline' }; });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
}
