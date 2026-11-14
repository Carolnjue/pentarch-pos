// Hash router: #/path/:param?query. Works under any base path and offline.
import { route } from './state.js';
import { emit } from './lib/bus.js';

let table = []; // [{path, re, keys, def}]
export function setRoutes(defs) {
  table = defs.map((d) => {
    const keys = [];
    const re = new RegExp('^' + d.path.replace(/\/:(\w+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; }) + '/?$');
    return { ...d, re, keys };
  });
}
export function match(path) {
  for (const r of table) {
    const m = r.re.exec(path);
    if (m) return { def: r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}
function parse() {
  const h = location.hash.replace(/^#/, '') || '/home';
  const [path, qs] = h.split('?');
  return { path: path || '/home', query: Object.fromEntries(new URLSearchParams(qs || '')) };
}
export function syncRoute() {
  const { path, query } = parse();
  const m = match(path);
  route.value = { path, query, params: m?.params || {}, def: m?.def || null };
  emit('route', route.value);
}
export function navigate(path, { replace } = {}) {
  const h = '#' + path;
  if (location.hash === h) return syncRoute();
  if (replace) history.replaceState(null, '', location.pathname + location.search + h);
  else location.hash = h;
  if (replace) syncRoute();
}
export const back = () => history.length > 1 ? history.back() : navigate('/home');
let started = false;
export function startRouter() {
  if (started) return; started = true;
  window.addEventListener('hashchange', syncRoute);
  syncRoute();
}
export const href = (path) => '#' + path;
