import { t, lang } from './i18n.js';

export function normPhone(raw) {
  let d = String(raw || '').replace(/\D+/g, '');
  if (d.startsWith('00254')) d = d.slice(2);
  if (d.length === 10 && d[0] === '0') d = '254' + d.slice(1);
  else if (d.length === 9 && (d[0] === '7' || d[0] === '1')) d = '254' + d;
  return /^254[17]\d{8}$/.test(d) ? d : '';
}
export function prettyPhone(p) {
  const m = /^254(\d{3})(\d{3})(\d{3})$/.exec(p || '');
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : p || '';
}
/** Format a Kenyan number while typing: 0712345678 → "0712 345 678", 254712… → "+254 712 345 678". */
export function formatPhoneTyping(raw) {
  const v = String(raw || '');
  let d = v.replace(/\D+/g, '');
  if (!d) return v.trim().startsWith('+') ? '+' : '';
  if (d.startsWith('254')) {
    d = d.slice(0, 12);
    return ('+254 ' + [d.slice(3, 6), d.slice(6, 9), d.slice(9, 12)].filter(Boolean).join(' ')).trim();
  }
  if (d[0] === '0') {
    d = d.slice(0, 10);
    return [d.slice(0, 4), d.slice(4, 7), d.slice(7, 10)].filter(Boolean).join(' ');
  }
  d = d.slice(0, 9);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean).join(' ');
}
/** "+254 712 345 678" for a normalised 2547… number. */
export function intlPhone(p) {
  const m = /^254(\d{3})(\d{3})(\d{3})$/.exec(p || '');
  return m ? `+254 ${m[1]} ${m[2]} ${m[3]}` : p || '';
}

export const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '').trim());

export function kes(cents, sym = true) {
  const v = Math.round((cents || 0) / 100);
  return (sym ? 'KES ' : '') + v.toLocaleString('en-KE');
}
export function kesWhole(n) { return 'KES ' + Math.round(n || 0).toLocaleString('en-KE'); }

export function waLink(phone, text) {
  const p = normPhone(phone) || String(phone || '').replace(/\D+/g, '');
  return `https://wa.me/${p}${text ? '?text=' + encodeURIComponent(text) : ''}`;
}

/** Days from today to an ISO date (negative = past). */
export function daysUntil(iso) {
  if (!iso) return null;
  const a = new Date(todayISO() + 'T00:00:00'), b = new Date(String(iso).slice(0, 10) + 'T00:00:00');
  return Math.round((b - a) / 864e5);
}

export function todayISO(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 864e5);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_SW = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ago', 'Sep', 'Okt', 'Nov', 'Des'];
export function shortDate(iso) {
  if (!iso) return '';
  const d = typeof iso === 'number' ? new Date(iso) : new Date(String(iso).length === 10 ? iso + 'T00:00:00' : iso);
  if (isNaN(d)) return '';
  return `${d.getDate()} ${(lang.value === 'sw' ? MONTHS_SW : MONTHS_EN)[d.getMonth()]}`;
}
export function dateTime(ms) {
  const d = new Date(ms);
  return `${shortDate(ms)}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
export function followLabel(iso) {
  if (!iso) return '';
  const today = todayISO();
  if (iso < today) return t('Overdue');
  if (iso === today) return t('Today');
  if (iso === todayISO(1)) return t('Tomorrow');
  return shortDate(iso);
}
export function ago(ms) {
  if (!ms) return '';
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return t('just now');
  if (s < 3600) return Math.floor(s / 60) + ' ' + t('min ago');
  if (s < 86400) return Math.floor(s / 3600) + ' ' + t('h ago');
  return shortDate(ms);
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove(); return ok;
  }
}

export async function shareLink({ title, text, url }) {
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); return 'shared'; } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  }
  return (await copyText(`${text ? text + ' ' : ''}${url}`)) ? 'copied' : 'failed';
}

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? t('Good morning') : h < 17 ? t('Good afternoon') : t('Good evening');
}
