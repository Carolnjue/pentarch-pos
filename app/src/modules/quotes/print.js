// A4 documents: quotation, invoice (payment terms, M-Pesa paybill/till, bank details), delivery note. Plus WhatsApp text.
import { doc } from '../../print/print.js';
import { esc, prettyPhone } from '../../lib/util.js';
import { money, kes } from '../../lib/money.js';
import { breakdownByCode } from '../../core/pricing.js';
import * as S from '../../state.js';
import { t } from '../../i18n/index.js';
import { quoteCalc } from './logic.js';

const d8 = (ms) => new Date(ms).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
const dIso = (s) => (s ? d8(new Date(s + 'T00:00').getTime()) : '');
const qty = (q) => (Number.isInteger(q) ? String(q) : (+q).toFixed(3).replace(/0+$/, '').replace(/\.$/, ''));

const CSS = `
.top { display:flex; justify-content:space-between; gap:24px; align-items:flex-start; }
.brand img { max-height:72px; max-width:210px; margin:0 0 8px; filter:none; display:block }
.biz { font: 800 18px 'Bricolage Grotesque', Arial; }
h1 { font: 800 30px 'Bricolage Grotesque', Arial; margin:0 0 6px; letter-spacing:-.02em; text-align:right }
.strip { height:5px; background:linear-gradient(100deg,#EE4B3B,#F6B22C 48%,#14B1AC); margin:12px 0 16px; border-radius:3px }
.meta td { padding:2px 0 } .meta td:first-child { color:#555; padding-right:14px }
.parties { display:flex; gap:14px } .box { border:1px solid #ccc; border-radius:6px; padding:10px 12px; flex:1 } .lab { color:#555; font-size:10.5px; text-transform:uppercase; letter-spacing:.06em; margin-bottom:3px }
.items { margin-top:16px } .items th { background:#0A1530; color:#fff; padding:8px; font-size:10.5px; text-transform:uppercase; letter-spacing:.05em }
.items td { padding:7px 8px; border-bottom:1px solid #ddd } .items .n { text-align:right; font-family:'JetBrains Mono', monospace; white-space:nowrap }
.items tr:nth-child(even) td { background:#faf9f6 }
.tot { width:310px; margin-left:auto; margin-top:12px } .tot td { padding:4px 8px } .tot .g td { font-weight:800; font-size:16px; border-top:2px solid #000 } .tot .due td { font-weight:800; font-size:15px; background:#FEF4DD }
.pay { display:flex; gap:14px; margin-top:18px } .pay .box { font-size:12px } .pay b { font-size:13px }
.muted { color:#555 } .foot { margin-top:22px; font-size:10.5px; color:#555; border-top:1px solid #ddd; padding-top:8px }
.sign { display:flex; gap:30px; margin-top:34px } .sign div { flex:1; border-top:1px solid #000; padding-top:4px; font-size:11px; color:#333 }
.stamp { position:absolute; right:40mm; top:58mm; border:4px solid #0A7F7B; color:#0A7F7B; font:900 34px Arial; padding:4px 16px; transform:rotate(-12deg); border-radius:8px; opacity:.85 }
.notes { margin-top:14px; font-size:12px; white-space:pre-wrap }`;

function head(title, rows) {
  const b = S.business.value || {}, br = S.branch.value || {};
  return `<div class="top"><div class="brand">${b.logo ? `<img src="${b.logo}" alt="">` : ''}<div class="biz">${esc(b.name)}</div>
    <div class="muted">${esc([br.address || b.address, b.town, b.county].filter(Boolean).join(', '))}<br>${esc(prettyPhone(br.phone || b.phone))}${b.email ? ' · ' + esc(b.email) : ''}${b.kra_pin ? '<br>KRA PIN: ' + esc(b.kra_pin) : ''}</div></div>
    <div><h1>${esc(title)}</h1><table class="meta" style="margin-left:auto">${rows.filter(Boolean).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="b">${esc(v)}</td></tr>`).join('')}</table></div></div><div class="strip"></div>`;
}
function party(label, c, name) {
  return `<div class="box"><div class="lab">${esc(label)}</div><div class="b">${esc(c?.name || name || t('Walk-in customer'))}</div>
    <div class="s">${esc(prettyPhone(c?.phone || ''))}${c?.kra_pin ? ' · PIN ' + esc(c.kra_pin) : ''}${c?.email ? '<br>' + esc(c.email) : ''}</div></div>`;
}
function items(lines, { prices = true } = {}) {
  return `<table class="items"><tr><th>#</th><th>${t('Description')}</th><th class="n">${t('Qty')}</th>${prices ? `<th class="n">${t('Unit price')}</th><th class="n">${t('Discount')}</th>${S.business.value?.vat_registered ? `<th class="n">${t('Tax')}</th>` : ''}<th class="n">${t('Amount')}</th>` : `<th class="n">${t('Unit')}</th><th class="n">${t('Delivered')}</th>`}</tr>
  ${lines.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.name)}${l.sku ? `<div class="s muted">${esc(l.sku)}</div>` : ''}${l.serial ? `<div class="s muted">SN ${esc(l.serial)}</div>` : ''}</td><td class="n">${qty(l.qty)}</td>
    ${prices ? `<td class="n">${kes(l.price)}</td><td class="n">${l.discount_total || l.discount ? kes(l.discount_total || l.discount) : '—'}</td>${S.business.value?.vat_registered ? `<td class="n">${esc(l.tax || '')}</td>` : ''}<td class="n">${kes(l.total)}</td>` : `<td class="n">${esc(l.unit || 'pc')}</td><td class="n">☐</td>`}</tr>`).join('')}</table>`;
}
function totals(calc, extra = '') {
  const vat = S.business.value?.vat_registered ? breakdownByCode(calc.lines).filter((x) => x.tax).map((x) => `<tr><td class="s">VAT ${x.code} (${x.rate}%) ${t('included')}</td><td class="r s">${kes(x.tax)}</td></tr>`).join('') : '';
  return `<table class="tot"><tr><td>${t('Subtotal')}</td><td class="r">${kes(calc.subtotal)}</td></tr>${calc.discount ? `<tr><td>${t('Discount')}</td><td class="r">-${kes(calc.discount)}</td></tr>` : ''}${vat}
  <tr class="g"><td>${t('Total')} (KES)</td><td class="r">${kes(calc.total)}</td></tr>${extra}</table>`;
}
function payBox(ref) {
  const st = S.settings.value;
  const mp = st.mpesa_type === 'paybill' && st.mpesa_paybill ? `<b>M-Pesa Paybill ${esc(st.mpesa_paybill)}</b><br>${t('Account')}: <b>${esc(st.mpesa_account || ref)}</b>` : st.mpesa_till ? `<b>M-Pesa Buy Goods Till ${esc(st.mpesa_till)}</b><br>${t('Reference')}: ${esc(ref)}` : '';
  const bank = (st.bank_details || '').trim();
  if (!mp && !bank) return '';
  return `<div class="pay">${mp ? `<div class="box"><div class="lab">${t('Pay by M-Pesa')}</div>${mp}</div>` : ''}${bank ? `<div class="box"><div class="lab">${t('Bank transfer')}</div>${esc(bank).replace(/\n/g, '<br>')}</div>` : ''}</div>`;
}
const foot = () => `<div class="foot">${esc(S.settings.value.invoice_footer || S.settings.value.receipt_footer || '')}<br>Powered by Pentarch POS · pentarchsystemssolutions.co.ke</div>`;

export function quoteHtml(q, customer) {
  const calc = quoteCalc(q.lines);
  const body = `${head(t('QUOTATION'), [[t('Quote no.'), q.no], [t('Date'), d8(q.created_at || Date.now())], q.valid_until && [t('Valid until'), dIso(q.valid_until)], q.lpo_no && [t('Your ref / LPO'), q.lpo_no]])}
  <div class="parties">${party(t('Quotation for'), customer, q.customer_name)}<div class="box"><div class="lab">${t('Prepared by')}</div><div class="b">${esc(S.users.value.find((u) => u.id === q.created_by)?.name || S.user.value?.name || '')}</div><div class="s">${esc(S.business.value?.name || '')}</div></div></div>
  ${items(calc.lines)}${totals(calc)}
  ${q.notes || S.settings.value.quote_terms ? `<div class="notes"><b>${t('Notes & terms')}</b><br>${esc([q.notes, S.settings.value.quote_terms].filter(Boolean).join('\n'))}</div>` : ''}
  ${payBox(q.no)}
  <div class="sign"><div>${t('Accepted by (name & signature)')}</div><div>${t('Date')}</div></div>${foot()}`;
  return doc(body, { paper: 'a4', title: q.no, css: CSS });
}

export function invoiceA4(sale, customer) {
  const paid = sale.paid_amount ?? sale.paid ?? 0;
  const due = sale.due ?? sale.balance ?? 0;
  const vat = S.business.value?.vat_registered;
  const title = sale.status === 'void' ? t('INVOICE (VOID)') : vat ? t('TAX INVOICE') : t('INVOICE');
  const terms = sale.terms_days ?? (Number(S.settings.value.invoice_terms_days) || 30);
  const dueDate = sale.due_date || sale.created_at + terms * 86400000;
  const calc = { lines: sale.lines, subtotal: sale.subtotal, discount: sale.discount, total: sale.total };
  const body = `${due <= 0 && sale.status !== 'void' ? `<div class="stamp">${t('PAID')}</div>` : ''}
  ${head(title, [[t('Invoice no.'), sale.no], [t('Date'), d8(sale.created_at)], [t('Due date'), d8(dueDate)], [t('Terms'), terms ? t('{n} days', { n: terms }) : t('Due on receipt')], sale.quote_no && [t('Quote'), sale.quote_no], sale.lpo_no && [t('Your ref / LPO'), sale.lpo_no]])}
  <div class="parties">${party(t('Bill to'), customer, sale.customer_name)}</div>
  ${items(sale.lines)}${totals(calc, `${paid ? `<tr><td>${t('Paid')}</td><td class="r">${kes(paid)}</td></tr>` : ''}<tr class="due"><td>${t('Balance due')}</td><td class="r">${kes(Math.max(0, due))}</td></tr>`)}
  ${sale.receipt_note ? `<div class="notes">${esc(sale.receipt_note)}</div>` : ''}
  ${due > 0 ? payBox(sale.no) : ''}
  <div class="notes muted">${t('Please pay by {date}. Quote the invoice number {no} with your payment.', { date: d8(dueDate), no: sale.no })}</div>${foot()}`;
  return doc(body, { paper: 'a4', title: sale.no, css: CSS });
}

export function deliveryNoteHtml(src, customer, { ref } = {}) {
  const lines = src.lines || [];
  const body = `${head(t('DELIVERY NOTE'), [[t('Delivery note'), 'DN-' + (src.no || '')], [t('Date'), d8(Date.now())], [ref ? t('Invoice') : t('Quote'), src.no], src.lpo_no && [t('Your ref / LPO'), src.lpo_no]])}
  <div class="parties">${party(t('Deliver to'), customer, src.customer_name)}<div class="box"><div class="lab">${t('Delivery address')}</div><div style="min-height:34px"></div></div></div>
  ${items(lines, { prices: false })}
  <div class="notes">${t('Total items')}: <b>${qty(lines.reduce((s, l) => s + (+l.qty || 0), 0))}</b></div>
  <div class="sign"><div>${t('Delivered by (name & signature)')}</div><div>${t('Vehicle / rider')}</div></div>
  <div class="sign"><div>${t('Received in good order by (name & signature)')}</div><div>${t('Date & stamp')}</div></div>${foot()}`;
  return doc(body, { paper: 'a4', title: `DN-${src.no}`, css: CSS });
}

export function quoteText(q) {
  const calc = quoteCalc(q.lines);
  const b = S.business.value;
  return `*${t('QUOTATION')} ${q.no}*\n${b.name}\n\n${calc.lines.map((l) => `${qty(l.qty)} x ${l.name} — ${kes(l.total)}`).join('\n')}\n\n*${t('TOTAL')}: ${money(calc.total)}*${q.valid_until ? `\n${t('Valid until')} ${dIso(q.valid_until)}` : ''}${q.notes ? '\n\n' + q.notes : ''}\n\n_${t('Sent from Pentarch POS')}_`;
}
export function invoiceText(sale) {
  const st = S.settings.value;
  const how = st.mpesa_type === 'paybill' && st.mpesa_paybill ? `M-Pesa Paybill ${st.mpesa_paybill}, ${t('Account')} ${st.mpesa_account || sale.no}` : st.mpesa_till ? `M-Pesa Till ${st.mpesa_till}` : '';
  return `*${t('INVOICE')} ${sale.no}*\n${S.business.value.name}\n\n${sale.lines.map((l) => `${qty(l.qty)} x ${l.name} — ${kes(l.total)}`).join('\n')}\n\n*${t('TOTAL')}: ${money(sale.total)}*\n${t('Balance due')}: ${money(sale.due ?? sale.balance)}\n${t('Due date')}: ${d8(sale.due_date || sale.created_at)}${how ? '\n' + t('Pay via {how}', { how }) : ''}\n\n_${t('Sent from Pentarch POS')}_`;
}
