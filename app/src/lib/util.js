export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const groupBy = (arr, f) => arr.reduce((m, x) => ((m[f(x)] ||= []).push(x), m), {});
export const sumBy = (arr, f) => arr.reduce((s, x) => s + (f(x) || 0), 0);
export const uniq = (arr) => [...new Set(arr)];
export const byKey = (arr, k = 'id') => Object.fromEntries(arr.map((x) => [x[k], x]));
export const cls = (...a) => a.filter(Boolean).join(' ');

/** Normalise Kenyan phone to 2547XXXXXXXX / 2541XXXXXXXX. Returns '' if invalid. */
export function normPhone(p) {
  let s = String(p || '').replace(/[^\d+]/g, '');
  if (s.startsWith('+')) s = s.slice(1);
  if (/^0[17]\d{8}$/.test(s)) s = '254' + s.slice(1);
  if (/^[17]\d{8}$/.test(s)) s = '254' + s;
  return /^254[17]\d{8}$/.test(s) ? s : '';
}
export const prettyPhone = (p) => { const n = normPhone(p); return n ? '0' + n.slice(3, 6) + ' ' + n.slice(6, 9) + ' ' + n.slice(9) : (p || ''); };
export const waLink = (phone, text) => `https://wa.me/${normPhone(phone) || ''}?text=${encodeURIComponent(text)}`;

/** M-Pesa transaction code: 10 chars, A–Z/0–9, starts with a letter, has a digit. */
export const isMpesaCode = (c) => /^[A-Z][A-Z0-9]{9}$/.test(c) && /\d/.test(c);

export const dayKey = (ms) => { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
export const startOfDay = (ms = Date.now()) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const DAY = 86400000;

export function download(name, content, type = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** CSV helpers (RFC4180-ish). */
export function toCsv(rows, cols) {
  const q = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const head = cols.map((c) => q(c.label || c.key)).join(',');
  return [head, ...rows.map((r) => cols.map((c) => q(c.get ? c.get(r) : r[c.key])).join(','))].join('\r\n');
}
export function parseCsv(text) {
  const rows = []; let row = [], f = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
    if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

/** Compress an image File to a small JPEG/WebP dataURL (<= maxBytes). */
export async function compressImage(file, { max = 320, maxBytes = 40000 } = {}) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const s = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    let q = 0.82, out = c.toDataURL('image/jpeg', q);
    while (out.length * 0.75 > maxBytes && q > 0.3) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
    return out;
  } finally { URL.revokeObjectURL(url); }
}

export const relTime = (ms, t = (s) => s) => {
  const d = Date.now() - ms;
  if (d < 45e3) return t('just now');
  if (d < 3600e3) return t('{n} min ago', { n: Math.round(d / 60e3) });
  if (d < 86400e3) return t('{n} h ago', { n: Math.round(d / 3600e3) });
  return t('{n} days ago', { n: Math.round(d / 86400e3) });
};
