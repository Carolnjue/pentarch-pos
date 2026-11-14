// Session: boot, demo/live switching, trial registration (offline-first), sign-in, PIN login, lock, licence.
import { openDb, db, getMeta, setMeta, DB_DEMO, DB_LIVE, deleteDb } from '../db/index.js';
import { ENTITIES, isSynced } from '../db/schema.js';
import { setRepoContext, save, saveMany, audit, all } from '../db/repo.js';
import { loadCatalog, loadLevels, loadSalesRank, wireCatalog } from '../db/catalog.js';
import { rebuildLevels } from '../db/stock.js';
import { sha256 } from '../lib/sha256.js';
import { ulid } from '../lib/ulid.js';
import { on, emit } from '../lib/bus.js';
import { normPhone } from '../lib/util.js';
import { Cloud, setCloudBase } from '../sync/api.js';
import { applyChanges, startSync, syncNow } from '../sync/client.js';
import { evaluateLicence } from './licence.js';
import * as S from '../state.js';
import { t } from '../i18n/index.js';

export const welcomeIntent = { value: null }; // 'demo' when ?demo=1 without type
const LS = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} }
};

// per-tab memory (demo mode); never shared with other tabs or later visits
const SS = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch {} }
};
/** True when the app runs inside an iframe (website demo embed). */
export const inFrame = () => { try { return window.self !== window.top; } catch { return true; } };

export const hashPin = (pin, tid = S.tenantId.value) => sha256(String(tid) + String(pin));
export const hashPassword = (pw) => sha256('ppos-pw:' + pw);
export const agentRef = () => LS.get('ppos.ref') || '';

/** Effective licence (reactive helper — call inside render). */
export const licenceState = () => evaluateLicence(S.licence.value, Date.now(), { demo: S.isDemo.value });

/* ---------------- boot ---------------- */
export async function boot() {
  const q = new URLSearchParams(location.search);
  const ref = q.get('ref');
  if (ref && /^AG-[A-Z0-9]{3,8}$/i.test(ref)) LS.set('ppos.ref', ref.toUpperCase());
  wireCatalog();
  wireState();
  try { navigator.storage?.persist?.(); } catch {}

  // Demo mode is remembered only for the browser tab that opened it (sessionStorage) and never when the app runs inside
  // an iframe (the website's product page embeds /pos/?demo=1&type=… on the same origin). So a visitor who then clicks
  // "Start free trial" (/pos/, /pos/?trial=1, /pos/?ref=…) lands on Welcome — or in their real business if this device has one.
  if (q.get('demo') === '1') {
    const type = q.get('type');
    if (!inFrame()) cleanUrl(['demo', 'type', 'ref']); // in a frame keep the params, so reloading the frame restarts the same demo
    if (type) return startDemo(type);
    welcomeIntent.value = 'demo';
    S.phase.value = 'welcome';
    return;
  }
  const wantTrial = q.get('trial') === '1', wantWelcome = q.get('welcome') === '1';
  if (ref || wantTrial || wantWelcome) cleanUrl(['ref', 'trial', 'welcome']);
  if (LS.get('ppos.mode') === 'demo') LS.set('ppos.mode', null); // builds before 1.1 remembered the demo for every visit
  // a real (live) business on this device always wins
  await openDb(DB_LIVE);
  if (await db().business.count()) {
    S.mode.value = 'live';
    SS.set('ppos.mode', null);
    await loadState();
    return enterAfterLoad();
  }
  // same tab reloaded while trying the demo → stay in the demo (not when a link asked for Welcome / the trial)
  if (!wantTrial && !wantWelcome && !ref && !inFrame() && SS.get('ppos.mode') === 'demo') {
    await openDb(DB_DEMO);
    if (await db().business.count()) { await loadState(); return enterAfterLoad(); }
    await openDb(DB_LIVE);
  }
  SS.set('ppos.mode', null);
  welcomeIntent.value = wantTrial ? 'trial' : null;
  S.phase.value = 'welcome';
}
function cleanUrl(keys) {
  const u = new URL(location.href);
  keys.forEach((k) => u.searchParams.delete(k));
  history.replaceState(null, '', u.pathname + (u.searchParams.toString() ? '?' + u.searchParams : '') + u.hash);
}
async function enterAfterLoad() {
  if (!S.isDemo.value && !(await getMeta('setup_done'))) {
    // wizard needs a signed-in owner
    const owner = S.users.value.find((u) => u.role === 'owner');
    if (owner) setUser(owner, { silent: true });
    S.phase.value = 'wizard';
    return;
  }
  S.phase.value = 'locked';
  if (!S.isDemo.value) { startSync(); completeRegistration().catch(() => {}); refreshLicence(); }
}

/** Load business, branches, users, device, shift, licence and caches into signals. */
export async function loadState() {
  const d = db();
  S.mode.value = d.name === DB_DEMO ? 'demo' : 'live';
  const biz = (await d.business.toArray()).find((b) => !b.deleted) || null;
  S.business.value = biz;
  S.tenantId.value = biz?.id || null;
  setCloudBase(biz?.settings?.cloud_url || '');
  const brs = await all('branches');
  S.branches.value = brs;
  let bid = await getMeta('branch_id');
  if (!brs.find((b) => b.id === bid)) bid = (brs.find((b) => b.is_main) || brs[0])?.id || null;
  S.branch.value = brs.find((b) => b.id === bid) || null;
  let devId = await getMeta('device_id');
  if (!devId) { devId = ulid(); await setMeta('device_id', devId); }
  S.device.value = { id: devId, no: (await getMeta('device_no')) || 1, name: (await getMeta('device_name')) || defaultDeviceName() };
  S.users.value = (await all('users')).filter((u) => u.active !== false);
  setRepoContext({ device_id: devId, branch_id: bid });
  S.licence.value = await getMeta('licence');
  S.sync.value = { ...S.sync.value, state: S.isDemo.value ? 'demo' : S.sync.value.state, lastAt: (await getMeta('last_sync_at')) || 0, pending: await d.outbox.count() };
  await Promise.all([loadCatalog(), loadLevels(bid), loadSalesRank(), loadShift()]);
}
export async function loadShift() {
  const devId = S.device.value.id;
  const open = await db().shifts.where('status').equals('open').toArray();
  S.shift.value = open.find((s) => s.device_id === devId && !s.deleted) || null;
}
function defaultDeviceName() {
  const ua = navigator.userAgent;
  const kind = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows PC' : /Mac/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux PC' : 'Device';
  return kind + ' till';
}

let wiredState = false;
function wireState() {
  if (wiredState) return; wiredState = true;
  on('change', async (entity) => {
    if (!db()) return;
    if (entity === 'business') { const b = (await db().business.toArray()).find((x) => !x.deleted); if (b) { S.business.value = b; setCloudBase(b.settings?.cloud_url || ''); } }
    if (entity === 'users') {
      S.users.value = (await all('users')).filter((u) => u.active !== false);
      if (S.user.value) { const me = S.users.value.find((u) => u.id === S.user.value.id); if (me) S.user.value = me; else lock(); }
    }
    if (entity === 'branches') { S.branches.value = await all('branches'); if (S.branch.value) S.branch.value = S.branches.value.find((b) => b.id === S.branch.value.id) || S.branch.value; }
    if (entity === 'shifts') loadShift();
    if (entity === 'sales') loadSalesRank();
  });
  on('synced', () => { completeRegistration().catch(() => {}); refreshLicence(); });
  // a trial started offline registers as soon as the connection is back (and keeps retrying every minute)
  const retryRegister = () => { if (!S.isDemo.value && db()) completeRegistration().catch(() => {}); };
  window.addEventListener('online', () => setTimeout(retryRegister, 300));
  setInterval(() => { if (navigator.onLine) retryRegister(); }, 60000);
  on('auth-expired', () => emit('notify', { type: 'bad', text: t('This device was signed out by the cloud. Sign in again to keep syncing.') }));
  // idle auto-lock
  let last = Date.now();
  const bump = () => { last = Date.now(); };
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => window.addEventListener(ev, bump, { passive: true, capture: true }));
  setInterval(() => {
    const mins = Number(S.settings.value.auto_lock_min) || 0;
    if (mins > 0 && S.phase.value === 'app' && Date.now() - last > mins * 60000) { lock('idle'); }
  }, 15000);
}

/* ---------------- users / PIN ---------------- */
export function setUser(u, { silent } = {}) {
  S.user.value = u;
  setRepoContext({ user_id: u?.id || null });
  if (!silent) S.phase.value = 'app';
}
export async function loginPin(userId, pin) {
  const u = S.users.value.find((x) => x.id === userId);
  if (!u) return false;
  if (u.pin_hash !== hashPin(pin)) {
    await audit('user.login_failed', 'users', u.id, { method: 'pin' });
    return false;
  }
  setUser(u);
  await audit('user.login', 'users', u.id, { method: 'pin', role: u.role });
  return true;
}
/** Owner unlock with the account password (set at registration / sign-in). */
export async function loginPassword(pw) {
  const h = await getMeta('owner_pw_hash');
  if (!h || h !== hashPassword(pw)) return false;
  const owner = S.users.value.find((u) => u.role === 'owner');
  if (!owner) return false;
  setUser(owner);
  await audit('user.login', 'users', owner.id, { method: 'password' });
  return true;
}
/** Find any active user with this PIN who has permission `key` (manager override). */
export function userByPin(pin) {
  const h = hashPin(pin);
  return S.users.value.find((u) => u.pin_hash === h) || null;
}
export async function setUserPin(userRec, pin) {
  userRec.pin_hash = hashPin(pin);
  const pend = await getMeta('pending_pins');
  if (pend) { pend[userRec.id] = pin; await setMeta('pending_pins', pend); }
  return userRec;
}
export function lock(reason) {
  if (S.user.value) audit('user.lock', 'users', S.user.value.id, { reason: reason || 'manual' }).catch(() => {});
  S.user.value = null;
  setRepoContext({ user_id: null });
  S.phase.value = 'locked';
}
export async function switchBranch(id) {
  const b = S.branches.value.find((x) => x.id === id);
  if (!b) return;
  await setMeta('branch_id', id);
  S.branch.value = b;
  setRepoContext({ branch_id: id });
  await loadLevels(id);
  await loadShift();
  await audit('branch.switch', 'branches', id, { name: b.name });
}

/* ---------------- demo ---------------- */
export async function startDemo(type) {
  S.phase.value = 'boot';
  if (!inFrame()) SS.set('ppos.mode', 'demo'); // remembered for this tab only (see boot)
  await openDb(DB_DEMO);
  const cur = (await db().business.toArray())[0];
  if (!cur || cur.type !== type) {
    if (cur || (await db().sales.count())) { await deleteDb(DB_DEMO); await openDb(DB_DEMO); }
    const { seedDemo } = await import('../presets/seed.js');
    await seedDemo(type);
    // a new demo business: forget the cart of the previous one (its products / table order no longer exist)
    try { localStorage.removeItem('ppos.cart:demo'); } catch {}
    await import('../modules/sell/cart.js').then((m) => { m.cart.value = m.emptyCart(); }).catch(() => {});
  }
  await loadState();
  const owner = S.users.value.find((u) => u.role === 'owner');
  setUser(owner);
  await audit('user.login', 'users', owner.id, { method: 'demo' });
  S.sync.value = { ...S.sync.value, state: 'demo' };
  location.hash = '#/home';
}
export async function resetDemo() {
  const type = S.business.value?.type || 'duka';
  await deleteDb(DB_DEMO);
  await startDemo(type);
}
/** Leave the demo → Welcome (or the trial form with { trial: true }), or this device's real business if it has one.
 *  Inside the website's iframe the page breaks out to the full app (top window). */
export async function exitDemo(opts = {}) {
  SS.set('ppos.mode', null);
  const url = location.pathname + (opts.trial ? '?trial=1' : '?welcome=1');
  if (inFrame()) { try { window.open(url, '_top'); return; } catch {} }
  location.replace(url);
}

/* ---------------- trial registration (offline-first) ---------------- */
/** Network trouble (offline, timeout, server down) — as opposed to the server rejecting the form. */
const isNetworkError = (e) => !e?.status || e.status >= 500;

/**
 * Start a 30-day trial. Online: register with the cloud FIRST, so a rejected form (email already used, invalid
 * phone…) leaves nothing behind and can simply be corrected. Offline (or cloud unreachable): create the business
 * locally with a temporary tenant id and register automatically later (completeRegistration → rekeyTenant).
 * @returns {Promise<boolean>} true when registered with the cloud now
 */
export async function startTrial(form) {
  LS.set('ppos.mode', 'live');
  await openDb(DB_LIVE);
  if (await db().business.count()) throw new Error(t('This device already has a business. Use Sign in or Settings → Backup.'));
  const payload = {
    business_name: form.business_name, business_type: form.business_type, owner_name: form.owner_name,
    phone: normPhone(form.phone), email: form.email.trim().toLowerCase(), password: form.password, town: form.town, county: form.county,
    agent_code: form.agent_code || agentRef() || undefined, device_name: form.device_name || defaultDeviceName(), source: 'app'
  };
  let res = null;
  if (navigator.onLine) {
    try { res = await Cloud.register(payload); }
    catch (e) { if (!isNetworkError(e)) throw e; /* cloud unreachable → start offline, register later */ }
  }
  const { buildBusiness } = await import('../presets/seed.js');
  const tid = res ? res.tenant_id : 'local-' + ulid();
  S.tenantId.value = tid;
  const devId = res ? res.device_id : ulid();
  await setMeta('device_id', devId);
  await setMeta('device_no', 1);
  await setMeta('device_name', payload.device_name);
  setRepoContext({ device_id: devId, user_id: null });
  const ownerId = ulid();
  const { branchId } = await buildBusiness({
    tenantId: tid, type: form.business_type, name: form.business_name, phone: payload.phone, email: payload.email,
    town: form.town, county: form.county, ownerId, ownerName: form.owner_name, ownerPinHash: hashPin(form.pin, tid)
  });
  await setMeta('branch_id', branchId);
  await setMeta('tenant_id', tid);
  await setMeta('owner_pw_hash', hashPassword(form.password));
  if (res) {
    const now = Date.now();
    await setMeta('device_token', res.device_token);
    await setMeta('licence', { ...(res.licence || {}), business_code: res.business_code || res.licence?.business_code || '', fetched_at: now });
    if (res.business_code) await setMeta('business_code', res.business_code);
    await save('devices', { id: devId, name: payload.device_name, branch_id: branchId, no: 1, last_seen: now });
  } else {
    await setMeta('pending_pins', { [ownerId]: form.pin });
    await setMeta('pending_register', payload);
  }
  await loadState();
  setUser(S.users.value.find((u) => u.id === ownerId), { silent: true });
  await audit('business.create', 'business', tid, { type: form.business_type, registered: !!res });
  S.phase.value = 'wizard';
  startSync();
  return !!res;
}

let registering = null;
/** If a registration is pending (trial started offline), register with the cloud and re-key local data. */
export function completeRegistration() {
  if (registering) return registering;
  registering = (async () => {
    if (S.isDemo.value || !db()) return false;
    const p = await getMeta('pending_register');
    if (!p) return false;
    if (!navigator.onLine) return false;
    let res;
    try { res = await Cloud.register(p); }
    catch (e) {
      if (e.status && e.status < 500 && e.status !== 429) {
        // the cloud rejected the details (e.g. email already registered): keep selling, ask the owner to fix it
        await setMeta('register_error', { status: e.status, message: e.body?.message || e.message, fields: e.body?.data?.fields || null, at: Date.now() });
        emit('notify', { type: 'bad', text: t('Your trial could not be registered: {m}. Open Settings → Licence & billing to fix it.', { m: e.body?.message || e.message }) });
      }
      throw e;
    }
    await setMeta('register_error', null);
    await rekeyTenant(res);
    return true;
  })().finally(() => { registering = null; });
  return registering;
}

async function rekeyTenant(res) {
  const d = db();
  const newId = res.tenant_id;
  const pins = (await getMeta('pending_pins')) || {};
  const now = Date.now();
  await d.transaction('rw', [...Object.keys(ENTITIES).map((e) => d.table(e)), d.meta, d.outbox], async () => {
    const biz = (await d.business.toArray())[0];
    if (biz && biz.id !== newId) { await d.business.delete(biz.id); await d.business.put({ ...biz, id: newId, updated_at: now }); }
    for (const u of await d.users.toArray()) {
      if (pins[u.id]) await d.users.put({ ...u, pin_hash: hashPin(pins[u.id], newId), updated_at: now });
    }
    const brId = await getMeta('branch_id');
    await d.devices.put({ id: res.device_id, name: (await getMeta('device_name')) || defaultDeviceName(), branch_id: brId, no: 1, last_seen: now, created_at: now, updated_at: now, deleted: 0 });
    await setMeta('tenant_id', newId);
    await setMeta('device_id', res.device_id);
    await setMeta('device_token', res.device_token);
    await setMeta('licence', { ...(res.licence || {}), business_code: res.business_code || res.licence?.business_code || '', fetched_at: now });
    if (res.business_code) await setMeta('business_code', res.business_code);
    await d.meta.bulkDelete(['pending_register', 'pending_pins']);
    // first push uploads everything that exists locally
    await d.outbox.clear();
    for (const e of Object.keys(ENTITIES)) {
      if (!isSynced(e)) continue;
      const rows = await d.table(e).toArray();
      if (rows.length) await d.outbox.bulkAdd(rows.map((r) => ({ entity: e, id: r.id, op: 'put', record: r, tries: 0 })));
    }
  });
  await loadState();
  if (S.user.value) S.user.value = S.users.value.find((u) => u.id === S.user.value.id) || S.user.value;
  emit('notify', { type: 'ok', text: t('Your business is registered. Free trial active.') });
  syncNow('registered');
}

/* ---------------- sign in to an existing business ---------------- */
export async function signIn(email, password, onProgress = () => {}) {
  LS.set('ppos.mode', 'live');
  await openDb(DB_LIVE);
  if (await db().business.count()) throw new Error(t('This device already has a business. Use Sign in or Settings → Backup.'));
  const device_name = defaultDeviceName();
  const res = await Cloud.login({ email: email.trim().toLowerCase(), password, device_name });
  await setMeta('tenant_id', res.tenant_id);
  await setMeta('device_id', res.device_id);
  await setMeta('device_token', res.device_token);
  await setMeta('device_name', device_name);
  await setMeta('licence', { ...(res.licence || {}), business_code: res.business_code || res.licence?.business_code || '', fetched_at: Date.now() });
  if (res.business_code) await setMeta('business_code', res.business_code);
  await setMeta('owner_pw_hash', hashPassword(password));
  S.tenantId.value = res.tenant_id;
  // initial pull
  let since = 0, total = 0;
  const touched = new Set();
  for (let i = 0; i < 500; i++) {
    const r = await Cloud.pull(since, 1000);
    if (r.changes?.length) { await applyChanges(r.changes, touched); total += r.changes.length; onProgress(total); }
    since = r.next_seq ?? since;
    await setMeta('last_pull_seq', since);
    if (!r.has_more) break;
  }
  await rebuildLevels();
  let biz = (await db().business.toArray()).find((x) => !x.deleted);
  const hasUsers = (await db().users.toArray()).some((u) => !u.deleted && u.active !== false);
  // A trial started by an agent or the website has only a minimal business record (no modules/settings, updated_at:1)
  // and no branch or staff yet: complete it locally (merging, never overwriting real values) and run the setup wizard.
  if (!biz || !biz.modules || !biz.settings || !hasUsers) {
    const { buildBusiness } = await import('../presets/seed.js');
    const ownerId = ulid();
    const { branchId } = await buildBusiness({
      tenantId: res.tenant_id, type: biz?.type || res.business_type || 'duka', name: biz?.name || res.business_name || t('My business'),
      phone: biz?.phone || res.phone || '', email: biz?.email || email, town: biz?.town || res.town || '', county: biz?.county || res.county || '',
      ownerId, ownerName: res.owner_name || biz?.owner_name || t('Owner'), ownerPinHash: hashPin('1234', res.tenant_id), existing: biz, skipOwner: hasUsers
    });
    if (branchId) await setMeta('branch_id', branchId);
    if (!hasUsers) await setMeta('first_pin_hint', true);
    biz = (await db().business.toArray())[0];
  } else {
    await setMeta('setup_done', true);
  }
  const devs = (await db().devices.toArray()).filter((x) => x.id !== res.device_id);
  const no = devs.reduce((m, x) => Math.max(m, x.no || 0), 0) + 1;
  await setMeta('device_no', no);
  const brs = (await db().branches.toArray()).filter((b) => !b.deleted);
  const br = brs.find((b) => b.is_main) || brs[0];
  if (br) await setMeta('branch_id', br.id);
  setRepoContext({ device_id: res.device_id, branch_id: br?.id });
  await save('devices', { id: res.device_id, name: device_name, branch_id: br?.id, no, last_seen: Date.now() });
  await loadState();
  if (!(await getMeta('setup_done'))) { const owner = S.users.value.find((u) => u.role === 'owner'); if (owner) setUser(owner, { silent: true }); S.phase.value = 'wizard'; }
  else S.phase.value = 'locked';
  startSync();
  return total;
}

/** Sign this device out of the cloud and remove local live data (only when nothing is waiting to sync, unless forced). */
export async function signOutDevice({ force } = {}) {
  const pending = await db().outbox.count();
  if (pending && !force) throw new Error(t('{n} changes have not synced yet.', { n: pending }));
  try { await Cloud.logout(); } catch {}
  await deleteDb(DB_LIVE);
  LS.set('ppos.mode', null);
  location.hash = '';
  location.reload();
}

export async function refreshLicence() {
  if (S.isDemo.value || !navigator.onLine || !(await getMeta('device_token'))) return;
  try {
    const lic = await Cloud.licence();
    const v = { ...lic, business_code: lic.business_code || S.licence.value?.business_code || '', fetched_at: Date.now() };
    await setMeta('licence', v);
    S.licence.value = v;
  } catch { /* keep cache */ }
}

/** Fix the details of a trial the cloud rejected (e.g. email already registered) and try again. */
export async function retryRegistration(changes) {
  const p = await getMeta('pending_register');
  if (!p) return false;
  await setMeta('pending_register', { ...p, ...changes });
  if (changes.password) await setMeta('owner_pw_hash', hashPassword(changes.password));
  const ok = await completeRegistration();
  if (ok) refreshLicence();
  return ok;
}

/** Mark the setup wizard finished. */
export async function finishSetup() {
  await setMeta('setup_done', true);
  await audit('setup.done', 'business', S.business.value?.id, {});
  S.phase.value = 'app';
  location.hash = '#/home';
}

/** Save business record (settings, profile, modules) with audit. */
export async function saveBusiness(changes, auditAction = 'settings.change') {
  const cur = S.business.value;
  const next = { ...cur, ...changes, settings: { ...(cur.settings || {}), ...(changes.settings || {}) }, modules: { ...(cur.modules || {}), ...(changes.modules || {}) } };
  const r = await save('business', next, { audit: { action: auditAction, details: { keys: Object.keys(changes.settings || changes) } } });
  S.business.value = r;
  return r;
}
export { saveMany };
