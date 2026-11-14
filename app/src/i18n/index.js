// i18n: English source strings are the keys. Wrap every UI string: t('Add product'), t('{n} items', {n}).
// Kiswahili lives in sw.js as { 'English': 'Kiswahili' }. Same English, different meaning → 'English@@context' key. Run `node scripts/i18n-check.mjs` to list missing keys.
import { lang } from '../state.js';
import sw from './sw.js';

const DICTS = { sw };
export const LANGS = [{ code: 'en', label: 'English' }, { code: 'sw', label: 'Kiswahili' }];

// Strings asked for in Kiswahili that have no translation yet (inspect window.__i18nMissing; QA prints it).
const missing = new Set();
if (typeof window !== 'undefined') window.__i18nMissing = missing;
export function t(s, vars) {
  const l = lang.value;
  const tr = l !== 'en' ? DICTS[l]?.[s] : null;
  if (l !== 'en' && tr == null && s && /[a-z]/i.test(s)) missing.add(s);
  // 'English@@context' keys: same English text, different Kiswahili (e.g. 'Delivery@@goods' = a supplier's delivery)
  let out = tr || (s && s.includes('@@') ? s.slice(0, s.indexOf('@@')) : s);
  if (vars) out = out.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
  return out;
}
/** Pick between singular/plural English keys. */
export const tn = (n, one, many, vars = {}) => t(n === 1 ? one : many, { n, ...vars });

export function setLang(l) {
  lang.value = l;
  try { localStorage.setItem('ppos.lang', l); } catch {}
  document.documentElement.lang = l;
}
export function initLang() {
  let l = 'en';
  try { l = localStorage.getItem('ppos.lang') || 'en'; } catch {}
  setLang(DICTS[l] || l === 'en' ? l : 'en');
}
