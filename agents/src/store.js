import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { liveQuery } from 'dexie';
import { db, getMeta, setMeta, wipeLocal } from './db.js';
import { setToken, api } from './api.js';
import { lang } from './i18n.js';

export const BASE = '/pos/agents/';

// ---- session ----
export const session = signal({ ready: false, token: null, agent: null });

export async function loadSession() {
  const [token, agent, l] = await Promise.all([getMeta('token'), getMeta('agent'), getMeta('lang')]);
  if (l) lang.value = l;
  setToken(token);
  session.value = { ready: true, token, agent };
}

export async function setSession(token, agent) {
  setToken(token);
  await setMeta('token', token);
  await setMeta('agent', agent);
  if (agent && agent.lang && !(await getMeta('lang'))) { lang.value = agent.lang; await setMeta('lang', agent.lang); }
  session.value = { ready: true, token, agent };
}

export async function updateAgent(agent) {
  await setMeta('agent', agent);
  session.value = { ...session.value, agent };
}

export async function signOut() {
  try { if (session.value.token) await api('POST', '/agents/auth/logout', {}); } catch { /* offline is fine */ }
  setToken(null);
  await wipeLocal();
  session.value = { ready: true, token: null, agent: null };
  navigate('/login');
}

export async function setLang(l) {
  lang.value = l;
  await setMeta('lang', l);
  document.documentElement.lang = l === 'sw' ? 'sw' : 'en';
  if (session.value.token && navigator.onLine) { api('POST', '/agents/me', { lang: l }).catch(() => {}); }
}

// ---- routing (history API under /pos/agents/) ----
function currentPath() {
  let p = location.pathname;
  if (p.startsWith(BASE)) p = '/' + p.slice(BASE.length);
  return p.replace(/\/+$/, '') || '/';
}
export const route = signal(currentPath());
export const query = signal(location.search);
export function navigate(path, replace = false) {
  const url = BASE + path.replace(/^\//, '');
  if (replace) history.replaceState({}, '', url); else history.pushState({}, '', url);
  route.value = currentPath();
  query.value = location.search;
  window.scrollTo(0, 0);
}
window.addEventListener('popstate', () => { route.value = currentPath(); query.value = location.search; });

// ---- connectivity / toasts ----
export const online = signal(navigator.onLine);
window.addEventListener('online', () => { online.value = true; });
window.addEventListener('offline', () => { online.value = false; });

export const toast = signal(null);
let toastTimer;
/** Show a toast. `action` = { label, run } adds a button (e.g. Undo) and keeps the toast up longer. */
export function showToast(text, tone = 'ok', action = null) {
  clearTimeout(toastTimer);
  toast.value = { text, tone, action, id: Date.now() };
  toastTimer = setTimeout(() => { toast.value = null; }, action ? 7000 : 3200);
}
export function hideToast() { clearTimeout(toastTimer); toast.value = null; }

// ---- first-run tour ----
export const tourOpen = signal(false);
export async function maybeStartTour() {
  if (!(await getMeta('tour_done'))) tourOpen.value = true;
}
export async function finishTour() {
  tourOpen.value = false;
  await setMeta('tour_done', 1);
}

// ---- Dexie live queries as hooks ----
export function useLive(querier, deps = [], initial = undefined) {
  const [val, setVal] = useState(initial);
  useEffect(() => {
    const sub = liveQuery(querier).subscribe({ next: setVal, error: (e) => console.error(e) });
    return () => sub.unsubscribe();
  }, deps);
  return val;
}

export function useCache(key) {
  return useLive(() => db.cache.get(key).then((r) => (r ? r.value : null)), [key], null);
}

// ---- install prompt ----
export const installEvt = signal(null);
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt.value = e; });
