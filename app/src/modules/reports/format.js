// Cell formatting for screen, A4 print and CSV + the A4 report document and CSV export.
import { kes, money } from '../../lib/money.js';
import { esc, toCsv, download, dayKey } from '../../lib/util.js';
import { doc } from '../../print/print.js';
import * as S from '../../state.js';
import { t } from '../../i18n/index.js';

const q2 = (q) => (Number.isInteger(q) ? q.toLocaleString('en-KE') : (Math.round(q * 100) / 100).toLocaleString('en-KE'));
const dOnly = (ms) => new Date(ms).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
const dTime = (ms) => new Date(ms).toLocaleString('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const pad = (n) => String(n).padStart(2, '0');
const isoLocal = (ms) => { const d = new Date(ms); return `${dayKey(ms)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };

export const raw = (c, r) => (r.__foot ? r[c.key] : c.get ? c.get(r) : r[c.key]);
/** Display text (screen fallback & print). */
export function cellText(c, r) {
  if (c.text && r.__foot !== true) { const v = c.text(r); if (v !== undefined) return String(v ?? ''); }
  const v = raw(c, r);
  if (v == null || v === '') return '';
  switch (c.kind) {
    case 'money': return kes(v);
    case 'int': return typeof v === 'number' ? v.toLocaleString('en-KE') : String(v);
    case 'qty': return typeof v === 'number' ? q2(v) : String(v);
    case 'pct': return typeof v === 'number' ? v.toFixed(1) + '%' : String(v);
    case 'date': return typeof v === 'number' ? dOnly(v) : String(v);
    case 'datetime': return typeof v === 'number' && v ? dTime(v) : String(v || '');
    default: return String(v);
  }
}
/** CSV value: plain numbers (KES with 2 decimals), ISO dates. */
export function cellCsv(c, r) {
  const v = raw(c, r);
  if (v == null || v === '') return '';
  switch (c.kind) {
    case 'money': return (v / 100).toFixed(2);
    case 'int': case 'qty': return typeof v === 'number' ? String(Math.round(v * 1000) / 1000) : String(v);
    case 'pct': return typeof v === 'number' ? v.toFixed(1) : String(v);
    case 'date': return typeof v === 'number' ? dayKey(v) : String(v);
    case 'datetime': return typeof v === 'number' && v ? isoLocal(v) : '';
    default: return c.text ? String(c.text(r) ?? '') : String(v);
  }
}
export const kpiText = (k) => (k.kind === 'money' ? money(Math.round(k.value / 100) * 100) : k.kind === 'pct' ? k.value.toFixed(1) + '%' : k.kind === 'qty' ? q2(Math.abs(k.value) >= 100 ? Math.round(k.value) : k.value) : k.kind === 'int' ? Number(k.value).toLocaleString('en-KE') : String(k.value));

export function periodText(ctx) {
  if (!ctx.range) return t('As at {d}', { d: dTime(Date.now()) });
  const a = dOnly(ctx.from), b = dOnly(ctx.to - 1);
  return a === b ? a : a + ' – ' + b;
}

/** CSV of every table in the report (blank line between tables). */
export function exportCsv(def, res, ctx) {
  const parts = res.tables.filter((tb) => tb.rows.length).map((tb) => {
    const cols = tb.columns.map((c) => ({ label: c.label, get: (r) => cellCsv(c, r) }));
    const rows = tb.foot ? [...tb.rows, { ...tb.foot, __foot: true }] : tb.rows;
    return (res.tables.length > 1 ? tb.title + '\r\n' : '') + toCsv(rows, cols);
  });
  const name = `${def.id}-${ctx.range ? dayKey(ctx.from) + '_' + dayKey(ctx.to - 1) : dayKey(Date.now())}.csv`;
  download(name, '﻿' + parts.join('\r\n\r\n'), 'text/csv');
  return name;
}

/** A4 print document. */
export function reportHtml(def, res, ctx) {
  const b = S.business.value || {};
  const br = ctx.branch ? (S.branches.value || []).find((x) => x.id === ctx.branch)?.name : (S.branches.value || []).length > 1 ? t('All branches') : '';
  const kpis = res.kpis.length ? `<div class="kpis">${res.kpis.map((k) => `<div class="k"><div class="kl">${esc(k.label)}</div><div class="kv">${esc(kpiText(k))}</div>${k.sub ? `<div class="ks">${esc(k.sub)}</div>` : ''}</div>`).join('')}</div>` : '';
  const tables = res.tables.filter((tb) => tb.rows.length).map((tb) => {
    const num = (c) => (c.num ? ' class="n"' : '');
    const head = `<tr>${tb.columns.map((c) => `<th${num(c)}>${esc(c.label)}</th>`).join('')}</tr>`;
    const body = tb.rows.map((r) => `<tr${r.cls ? ` class="${esc(r.cls)}"` : ''}>${tb.columns.map((c) => `<td${num(c)}>${esc(cellText(c, r))}</td>`).join('')}</tr>`).join('');
    const foot = tb.foot ? `<tfoot><tr>${tb.columns.map((c) => `<td${num(c)}>${esc(cellText(c, { ...tb.foot, __foot: true }))}</td>`).join('')}</tr></tfoot>` : '';
    return `<h3>${esc(tb.title)}</h3><table><thead>${head}</thead><tbody>${body}</tbody>${foot}</table>`;
  }).join('');
  const body = `<div class="hd"><div><div class="bn">${esc(b.name || '')}</div><div class="s">${esc([br, b.town].filter(Boolean).join(' · '))}${b.kra_pin ? ' · KRA PIN ' + esc(b.kra_pin) : ''}</div></div>
  <div class="r"><div class="ti">${esc(res.title ? t(def.title) + ' — ' + res.title : t(def.title))}</div><div class="s">${esc(periodText(ctx))}</div></div></div>
  ${res.sentence ? `<p class="sen">${esc(res.sentence)}</p>` : ''}${kpis}${tables}
  ${res.note ? `<p class="s">${esc(res.note)}</p>` : ''}
  <div class="ft">${esc(t('Printed {d} by {u}', { d: dTime(Date.now()), u: S.user.value?.name || '' }))} · Pentarch POS</div>`;
  const css = `body{font-size:11px} .hd{display:flex;justify-content:space-between;gap:16px;border-bottom:2px solid #0A1530;padding-bottom:8px;margin-bottom:10px}
  .bn{font-size:17px;font-weight:800} .ti{font-size:15px;font-weight:800;text-align:right} .s{color:#555;font-size:10.5px} .sen{font-size:12px;margin:6px 0 10px}
  .kpis{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px} .k{border:1px solid #ccc;border-radius:6px;padding:6px 9px;min-width:110px} .kl{font-size:9.5px;color:#555;text-transform:uppercase;letter-spacing:.03em}
  .kv{font:700 14px 'JetBrains Mono',monospace} .ks{font-size:9.5px;color:#555} h3{font-size:12.5px;margin:12px 0 4px}
  table{border-collapse:collapse;width:100%} th{background:#EFEBE3;font-size:10px;text-transform:uppercase;letter-spacing:.02em;padding:4px 5px;border-bottom:1px solid #999}
  td{padding:3px 5px;border-bottom:1px solid #e3e0d8} .n{text-align:right;font-family:'JetBrains Mono',monospace;white-space:nowrap} tfoot td{font-weight:800;border-top:2px solid #000;border-bottom:0}
  tr.r-total td{font-weight:800;border-top:1px solid #000} tr.r-grand td{font-weight:800;font-size:13px;border-top:2px solid #000;background:#F7F5F0} tr.r-head td{font-weight:800;padding-top:8px}
  tr{page-break-inside:avoid} thead{display:table-header-group} .ft{margin-top:14px;color:#777;font-size:9.5px;border-top:1px solid #ccc;padding-top:4px}`;
  return doc(body, { paper: 'a4', title: t(def.title), css });
}
