// Print templates: thermal receipt (58/80), A4 invoice, return slip, shift X/Z report, customer statement, test page.
import { doc, qrSvg, barcodeSvg } from './print.js';
import { esc, prettyPhone } from '../lib/util.js';
import { money, kes } from '../lib/money.js';
import { breakdownByCode } from '../core/pricing.js';
import { receiptQr } from '../lib/barcode.js';
import { TAX_CODES } from '../lib/tax.js';
import { t } from '../i18n/index.js';

const dt = (ms) => new Date(ms).toLocaleString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const d8 = (ms) => new Date(ms).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
const qtyS = (q) => (Number.isInteger(q) ? String(q) : q.toFixed(3).replace(/0+$/, ''));
const METHOD = { cash: 'Cash', mpesa: 'M-Pesa', card: 'Card', bank: 'Bank transfer', credit: 'Credit (on account)', voucher: 'Voucher', points: 'Loyalty points' };
export const methodLabel = (m) => t(METHOD[m] || m);

function header(ctx, st) {
  const { business: b, branch } = ctx;
  return `${st.receipt_show_logo && b.logo ? `<img class="logo" src="${b.logo}" alt="">` : ''}
  <div class="c b l">${esc(b.name)}</div>
  <div class="c s">${esc([branch?.name, branch?.address || b.address, b.town].filter(Boolean).join(' · '))}</div>
  <div class="c s">${esc(prettyPhone(branch?.phone || b.phone))}${b.email ? ' · ' + esc(b.email) : ''}</div>
  ${b.kra_pin ? `<div class="c s">KRA PIN: ${esc(b.kra_pin)}</div>` : ''}
  ${st.receipt_header ? `<div class="c s" style="margin-top:3px">${esc(st.receipt_header)}</div>` : ''}`;
}
function mpesaLine(st) {
  if (st.mpesa_type === 'paybill' && st.mpesa_paybill) return `M-Pesa Paybill ${esc(st.mpesa_paybill)}${st.mpesa_account ? ' · Acc ' + esc(st.mpesa_account) : ''}`;
  if (st.mpesa_till) return `M-Pesa Buy Goods Till ${esc(st.mpesa_till)}`;
  return '';
}

/** Thermal receipt. ctx: {business, branch, settings, cashier, customer, copy} */
export async function receiptHtml(sale, ctx, { paper } = {}) {
  const st = ctx.settings;
  const w = paper || st.receipt_width || 80;
  const isCredit = sale.balance > 0;
  const title = sale.status === 'void' ? 'VOID' : isCredit ? t('CREDIT SALE INVOICE') : t('SALES RECEIPT');
  const lines = sale.lines.map((l) => `
    <tr><td colspan="2" class="b">${esc(l.name)}</td></tr>
    <tr><td class="s">${qtyS(l.qty)} ${l.unit && l.unit !== 'pc' ? esc(l.unit) + ' ' : ''}x ${kes(l.price)}${l.tax && ctx.business.vat_registered ? ' ' + esc(l.tax) : ''}</td><td class="r">${kes(Math.round(l.price * l.qty) + (l.modifiers || []).reduce((s, m) => s + m.price, 0) * l.qty)}</td></tr>
    ${(l.modifiers || []).map((m) => `<tr><td class="s">&nbsp;+ ${esc(m.name)}</td><td class="r s">${m.price ? kes(m.price) : ''}</td></tr>`).join('')}
    ${l.serial ? `<tr><td colspan="2" class="s">&nbsp;IMEI/SN: ${esc(l.serial)}</td></tr>` : ''}
    ${l.batch_no ? `<tr><td colspan="2" class="s">&nbsp;Batch ${esc(l.batch_no)}${l.expiry ? ' · Exp ' + esc(l.expiry) : ''}</td></tr>` : ''}
    ${l.line_discount ? `<tr><td class="s">&nbsp;${t('Discount')}</td><td class="r s">-${kes(l.line_discount)}</td></tr>` : ''}
    ${l.note ? `<tr><td colspan="2" class="s">&nbsp;${esc(l.note)}</td></tr>` : ''}`).join('');
  const tax = breakdownByCode(sale.lines);
  const showTax = ctx.business.vat_registered && st.receipt_show_tax;
  const qr = st.receipt_show_qr ? await qrSvg(receiptQr(sale.no), w === 58 ? 2 : 3) : '';
  const bc = st.receipt_show_barcode ? await barcodeSvg(sale.no, { format: 'CODE128', height: 32, width: 1.2, fontSize: 10 }) : '';
  const body = `${header(ctx, st)}
  <div class="hr"></div>
  <div class="c b">${title}${ctx.copy ? ' — ' + t('COPY') : ''}</div>
  <div class="row s"><span>${t('Receipt')}: <b>${esc(sale.no)}</b></span><span>${dt(sale.created_at)}</span></div>
  ${st.receipt_show_cashier && ctx.cashier ? `<div class="s">${t('Served by')}: ${esc(ctx.cashier)}</div>` : ''}
  ${ctx.customer ? `<div class="s">${t('Customer')}: ${esc(ctx.customer.name)}${ctx.customer.phone ? ' · ' + esc(prettyPhone(ctx.customer.phone)) : ''}${ctx.customer.kra_pin ? ' · PIN ' + esc(ctx.customer.kra_pin) : ''}</div>` : ''}
  <div class="hr"></div>
  <table>${lines}</table>
  <div class="hr"></div>
  <div class="row"><span>${t('Subtotal')}</span><span>${kes(sale.subtotal)}</span></div>
  ${sale.discount ? `<div class="row"><span>${t('Discount')}</span><span>-${kes(sale.discount)}</span></div>` : ''}
  ${sale.service_charge ? `<div class="row"><span>${t('Service charge')}</span><span>${kes(sale.service_charge)}</span></div>` : ''}
  ${sale.tip ? `<div class="row"><span>${t('Tip')}</span><span>${kes(sale.tip)}</span></div>` : ''}
  ${sale.rounding ? `<div class="row s"><span>${t('Rounding')}</span><span>${kes(sale.rounding)}</span></div>` : ''}
  <div class="row xl" style="margin:3px 0"><span>${t('TOTAL')}</span><span>${money(sale.total)}</span></div>
  ${showTax ? `<div class="hr"></div><table class="s"><tr><th>${t('Code')}</th><th class="r">${t('Net')}</th><th class="r">VAT</th><th class="r">${t('Total')}</th></tr>
    ${tax.map((x) => `<tr><td>${x.code} ${esc(TAX_CODES[x.code]?.label || '')}</td><td class="r">${kes(x.net)}</td><td class="r">${kes(x.tax)}</td><td class="r">${kes(x.gross)}</td></tr>`).join('')}</table>` : ''}
  <div class="hr"></div>
  ${sale.payments.map((p) => `<div class="row"><span>${esc(methodLabel(p.method))}${p.ref ? ' <span class="s">' + esc(p.ref) + '</span>' : ''}</span><span>${kes(p.tendered || p.amount)}</span></div>`).join('')}
  ${sale.change ? `<div class="row b"><span>${t('Change')}</span><span>${kes(sale.change)}</span></div>` : ''}
  ${sale.balance ? `<div class="row b"><span>${t('Balance on account')}</span><span>${kes(sale.balance)}</span></div>` : ''}
  ${sale.points_earned ? `<div class="s">${t('Points earned')}: ${sale.points_earned}${ctx.customer ? ' · ' + t('Total points') + ': ' + (ctx.customer.loyalty_points || 0) : ''}</div>` : ''}
  ${sale.status === 'void' ? `<div class="c b xl" style="margin:6px 0">*** VOID ***</div><div class="c s">${esc(sale.void_reason || '')}</div>` : ''}
  ${mpesaLine(st) ? `<div class="hr"></div><div class="c b">${mpesaLine(st)}</div>` : ''}
  ${st.etims_enabled ? `<div class="hr"></div><div class="s c">KRA eTIMS · CU invoice: ${esc(sale.etims?.cu_invoice_no || t('pending'))}</div>` : ''}
  ${sale.receipt_note ? `<div class="hr"></div><div class="s">${esc(sale.receipt_note)}</div>` : ''}
  <div class="hr"></div>
  <div class="c s">${esc(ctx.branch?.receipt_footer || st.receipt_footer || '')}</div>
  ${qr ? `<div style="margin:6px 0">${qr}</div>` : ''}${bc}
  <div class="c s" style="margin-top:4px">Powered by Pentarch POS · 0729 455 912</div>`;
  return doc(body, { paper: w, title: sale.no, fontSize: st.receipt_font_size && w === 80 ? st.receipt_font_size : undefined });
}

/** A4 invoice (credit sales, quotes later). */
export async function invoiceHtml(sale, ctx, { title = t('INVOICE'), dueDays = 30 } = {}) {
  const { business: b, branch, settings: st, customer } = ctx;
  const tax = breakdownByCode(sale.lines);
  const css = `
  .top { display:flex; justify-content:space-between; gap:20px; align-items:flex-start; }
  .brand img { max-height:70px; max-width:200px; margin:0 0 8px; filter:none; display:block }
  h1 { font: 800 30px 'Bricolage Grotesque', Arial; margin:0; letter-spacing:-.02em }
  .strip { height:5px; background:linear-gradient(100deg,#EE4B3B,#F6B22C 48%,#14B1AC); margin:10px 0 18px; border-radius:3px }
  .meta td { padding:2px 0 } .meta td:first-child { color:#555; padding-right:12px }
  .items { margin-top:18px } .items th { background:#0A1530; color:#fff; padding:8px; font-size:11px; text-transform:uppercase; letter-spacing:.05em }
  .items td { padding:8px; border-bottom:1px solid #ddd } .items .n { text-align:right; font-family:'JetBrains Mono', monospace }
  .tot { width:300px; margin-left:auto; margin-top:12px } .tot td { padding:4px 8px } .tot .g td { font-weight:800; font-size:16px; border-top:2px solid #000 }
  .box { border:1px solid #ccc; border-radius:6px; padding:10px 12px } .muted { color:#555 } .foot { margin-top:26px; font-size:11px; color:#555 }`;
  const body = `
  <div class="top"><div class="brand">${b.logo ? `<img src="${b.logo}" alt="">` : ''}<div class="b l">${esc(b.name)}</div>
    <div class="muted">${esc([branch?.address || b.address, b.town, b.county].filter(Boolean).join(', '))}<br>${esc(prettyPhone(b.phone))} · ${esc(b.email || '')}${b.kra_pin ? '<br>KRA PIN: ' + esc(b.kra_pin) : ''}</div></div>
    <div class="r"><h1>${esc(title)}</h1><table class="meta" style="margin-left:auto"><tr><td>${t('Number')}</td><td class="b">${esc(sale.no)}</td></tr>
    <tr><td>${t('Date')}</td><td>${d8(sale.created_at)}</td></tr>${sale.balance ? `<tr><td>${t('Due date')}</td><td>${d8(sale.created_at + dueDays * 86400000)}</td></tr>` : ''}</table></div></div>
  <div class="strip"></div>
  <div class="box" style="width:55%"><div class="muted s">${t('Bill to')}</div><div class="b">${esc(customer?.name || t('Walk-in customer'))}</div>
    <div class="s">${esc(prettyPhone(customer?.phone || ''))}${customer?.kra_pin ? ' · PIN ' + esc(customer.kra_pin) : ''}${customer?.email ? ' · ' + esc(customer.email) : ''}</div></div>
  <table class="items"><tr><th>#</th><th>${t('Description')}</th><th class="n">${t('Qty')}</th><th class="n">${t('Unit price')}</th><th class="n">${t('Discount')}</th><th class="n">${t('Tax')}</th><th class="n">${t('Amount')}</th></tr>
  ${sale.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.name)}${l.serial ? '<div class="s muted">SN ' + esc(l.serial) + '</div>' : ''}</td><td class="n">${qtyS(l.qty)} ${esc(l.unit || '')}</td><td class="n">${kes(l.price)}</td><td class="n">${l.discount ? kes(l.discount) : '—'}</td><td class="n">${esc(l.tax || '')}</td><td class="n">${kes(l.total)}</td></tr>`).join('')}</table>
  <table class="tot"><tr><td>${t('Subtotal')}</td><td class="r">${kes(sale.subtotal)}</td></tr>
  ${sale.discount ? `<tr><td>${t('Discount')}</td><td class="r">-${kes(sale.discount)}</td></tr>` : ''}
  ${b.vat_registered ? tax.map((x) => `<tr><td class="s">VAT ${x.code} (${x.rate}%) ${t('included')}</td><td class="r s">${kes(x.tax)}</td></tr>`).join('') : ''}
  <tr class="g"><td>${t('Total')} (KES)</td><td class="r">${kes(sale.total)}</td></tr>
  ${sale.paid ? `<tr><td>${t('Paid')}</td><td class="r">${kes(sale.paid)}</td></tr>` : ''}
  ${sale.balance ? `<tr><td class="b">${t('Balance due')}</td><td class="r b">${kes(sale.balance)}</td></tr>` : ''}</table>
  ${mpesaLine(st) ? `<div class="box" style="margin-top:18px"><b>${t('How to pay')}:</b> ${mpesaLine(st)}</div>` : ''}
  <div class="foot">${esc(st.receipt_footer || '')}<br>Powered by Pentarch POS · pentarchcommunications.com</div>`;
  return doc(body, { paper: 'a4', title: sale.no, css });
}

export async function returnSlipHtml(ret, sale, ctx) {
  const st = ctx.settings;
  const body = `${header(ctx, st)}<div class="hr"></div><div class="c b">${t('RETURN / REFUND')}</div>
  <div class="row s"><span>${t('Original receipt')}: <b>${esc(sale.no)}</b></span><span>${dt(ret.created_at)}</span></div>
  <div class="s">${t('Reason')}: ${esc(ret.reason || '')}</div><div class="hr"></div>
  <table>${ret.lines.map((l) => `<tr><td>${qtyS(l.qty)} x ${esc(l.name)}${l.restock ? '' : ' <span class="s">(' + t('damaged') + ')</span>'}</td><td class="r">${kes(l.amount)}</td></tr>`).join('')}</table>
  <div class="hr"></div><div class="row xl"><span>${t('REFUND')}</span><span>${money(ret.total)}</span></div>
  ${ret.refund.map((r) => `<div class="row"><span>${esc(methodLabel(r.method))}</span><span>${kes(r.amount)}</span></div>`).join('')}
  <div class="hr"></div><div class="s">${t('Customer signature')}: ____________________</div>
  <div class="c s" style="margin-top:6px">Powered by Pentarch POS</div>`;
  return doc(body, { paper: st.receipt_width || 80, title: 'Return ' + sale.no });
}

/** X (mid-shift) or Z (closing) report. */
export function shiftReportHtml(sum, ctx, { kind = 'X', userName, denominations } = {}) {
  const st = ctx.settings;
  const s = sum.shift;
  const r = (k, v, b) => `<div class="row${b ? ' b' : ''}"><span>${k}</span><span>${v}</span></div>`;
  const body = `${header(ctx, st)}<div class="hr"></div>
  <div class="c xl">${kind} ${t('REPORT')}</div><div class="c s">${kind === 'Z' ? t('End of shift') : t('Shift so far — not closed')}</div><div class="hr"></div>
  ${r(t('Cashier'), esc(userName || ''))}${r(t('Opened'), dt(s.opened_at))}${s.closed_at ? r(t('Closed'), dt(s.closed_at)) : r(t('Printed'), dt(Date.now()))}
  <div class="hr"></div>${r(t('Sales'), sum.sales)}${r(t('Gross sales'), kes(sum.gross), 1)}${r(t('Discounts'), kes(sum.discount))}${r(t('VAT included'), kes(sum.tax))}
  ${r(t('Voided sales'), sum.voids + ' · ' + kes(sum.voidTotal))}${r(t('Returns / refunds'), sum.returns + ' · ' + kes(sum.refundTotal))}
  <div class="hr"></div><div class="b">${t('Takings by method')}</div>
  ${Object.entries(sum.byMethod).map(([m, v]) => r(esc(methodLabel(m)), kes(v))).join('') || r(t('No sales'), '—')}
  ${Object.keys(sum.debtPayments).length ? '<div class="b" style="margin-top:4px">' + t('Debt payments received') + '</div>' + Object.entries(sum.debtPayments).map(([m, v]) => r(esc(methodLabel(m)), kes(v))).join('') : ''}
  <div class="hr"></div><div class="b">${t('Cash drawer')}</div>
  ${r(t('Opening float'), kes(s.opening_float))}${r(t('Cash sales'), kes(sum.byMethod.cash || 0))}${r(t('Cash refunds'), '-' + kes(sum.refunds.cash || 0))}
  ${r(t('Pay in'), kes(sum.cashMoves.pay_in || 0))}${r(t('Pay out'), '-' + kes(sum.cashMoves.pay_out || 0))}${r(t('Cash drops'), '-' + kes(sum.cashMoves.drop || 0))}
  ${sum.expensesCash ? r(t('Expenses from drawer'), '-' + kes(sum.expensesCash)) : ''}
  ${r(t('Expected cash'), kes(sum.expected), 1)}
  ${kind === 'Z' ? r(t('Counted cash'), kes(s.counted_cash), 1) + r(t('Variance'), (s.variance > 0 ? '+' : '') + kes(s.variance), 1) : ''}
  ${denominations ? '<div class="hr"></div><div class="b">' + t('Count') + '</div>' + Object.entries(denominations).filter(([, n]) => n).map(([d, n]) => r(`${n} x ${kes(+d)}`, kes(n * d))).join('') : ''}
  ${s.notes ? `<div class="hr"></div><div class="s">${esc(s.notes)}</div>` : ''}
  <div class="hr"></div><div class="s">${t('Signature')}: ____________________</div><div class="c s" style="margin-top:6px">Powered by Pentarch POS</div>`;
  return doc(body, { paper: st.receipt_width || 80, title: kind + ' report' });
}

export function statementHtml(customer, acc, ctx, { from, to } = {}) {
  const { business: b } = ctx;
  const rows = [];
  for (const s of acc.sales) if (s.status !== 'void' && s.balance) rows.push({ at: s.created_at, ref: s.no, desc: t('Credit sale'), debit: s.balance, credit: 0 });
  for (const p of acc.payments) rows.push({ at: p.created_at, ref: p.ref || '', desc: t('Payment') + ' — ' + methodLabel(p.method), debit: 0, credit: p.amount });
  rows.sort((a, z) => a.at - z.at);
  let bal = 0;
  const css = `h1{font:800 26px 'Bricolage Grotesque',Arial;margin:0} .strip{height:5px;background:linear-gradient(100deg,#EE4B3B,#F6B22C 48%,#14B1AC);margin:10px 0 16px;border-radius:3px}
  th{background:#0A1530;color:#fff;padding:7px;font-size:11px;text-transform:uppercase} td{padding:7px;border-bottom:1px solid #ddd} .n{text-align:right;font-family:'JetBrains Mono',monospace}`;
  const body = `<div class="row"><div><div class="b l">${esc(b.name)}</div><div class="s">${esc(prettyPhone(b.phone))} · ${esc(b.town || '')}</div></div><div class="r"><h1>${t('STATEMENT')}</h1><div class="s">${dt(Date.now())}</div></div></div>
  <div class="strip"></div><div><b>${esc(customer.name)}</b> · ${esc(prettyPhone(customer.phone))}</div>
  <table style="margin-top:14px"><tr><th>${t('Date')}</th><th>${t('Reference')}</th><th>${t('Details')}</th><th class="n">${t('Debit')}</th><th class="n">${t('Credit')}</th><th class="n">${t('Balance')}</th></tr>
  ${rows.map((r) => { bal += r.debit - r.credit; return `<tr><td>${d8(r.at)}</td><td>${esc(r.ref)}</td><td>${esc(r.desc)}</td><td class="n">${r.debit ? kes(r.debit) : ''}</td><td class="n">${r.credit ? kes(r.credit) : ''}</td><td class="n">${kes(bal)}</td></tr>`; }).join('')}</table>
  <div class="r xl" style="margin-top:14px">${t('Balance due')}: ${money(acc.balance)}</div>
  ${mpesaLine(ctx.settings) ? `<div style="margin-top:10px">${t('How to pay')}: <b>${mpesaLine(ctx.settings)}</b></div>` : ''}
  <div class="s" style="margin-top:24px;color:#555">Powered by Pentarch POS</div>`;
  return doc(body, { paper: 'a4', title: 'Statement ' + customer.name, css });
}

export async function testPageHtml(ctx, paper) {
  const st = ctx.settings;
  const bc = await barcodeSvg('2000000000015', { height: 36 });
  const qr = await qrSvg('https://pentarchcommunications.com/systems/pos/', 3);
  const body = `${header(ctx, st)}<div class="hr"></div><div class="c xl">${t('PRINTER TEST')}</div>
  <div class="c s">${t('Paper')}: ${paper} mm · ${dt(Date.now())}</div><div class="hr2"></div>
  <div class="row"><span>${t('Left')}</span><span>${t('Right')}</span></div><div class="c">||||||||||||||||||||||||||||||||</div>
  <div class="c b l">KES 1,234.00</div><div style="margin:6px 0">${bc}</div>${qr}
  <div class="hr"></div><div class="c s">${t('If this page is cut cleanly and the text is sharp, your printer is ready.')}</div><div class="c s">Powered by Pentarch POS</div>`;
  return doc(body, { paper, title: 'Test page' });
}

export { dt, d8, qtyS };
