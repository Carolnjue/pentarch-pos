// A4 stock & purchasing documents: purchase order, goods received note, supplier return note, transfer note,
// stock count sheet, supplier statement. Plus the WhatsApp text of a purchase order.
import { doc } from './print.js';
import { esc, prettyPhone } from '../lib/util.js';
import { money, kes } from '../lib/money.js';
import { t } from '../i18n/index.js';
const PAY = { cash: 'Cash', mpesa: 'M-Pesa', bank: 'Bank', cheque: 'Cheque', card: 'Card' };
const methodLabel = (m) => t(PAY[m] || m);

const d8 = (ms) => new Date(ms).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
const q = (n) => { const v = Math.round((Number(n) || 0) * 1000) / 1000; return Number.isInteger(v) ? String(v) : String(v); };
const CSS = `h1{font:800 24px 'Bricolage Grotesque',Arial;margin:0;letter-spacing:-.01em} .strip{height:5px;background:linear-gradient(100deg,#EE4B3B,#F6B22C 48%,#14B1AC);margin:10px 0 14px;border-radius:3px}
th{background:#0A1530;color:#fff;padding:7px;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em} td{padding:6px 7px;border-bottom:1px solid #ddd} .n{text-align:right;font-family:'JetBrains Mono',monospace;white-space:nowrap}
.box{border:1px solid #ccc;border-radius:6px;padding:8px 10px} .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px} .k{font-size:10px;text-transform:uppercase;color:#555;letter-spacing:.05em}
.blank{display:inline-block;min-width:70px;border-bottom:1px solid #000;height:16px} .sig{margin-top:30px;display:grid;grid-template-columns:1fr 1fr;gap:30px} .sig div{border-top:1px solid #000;padding-top:4px;font-size:11px}
.foot{margin-top:22px;color:#555;font-size:10.5px}`;

function head(ctx, title, no, date) {
  const b = ctx.business, br = ctx.branch;
  return `<div class="row"><div>${b.logo ? `<img src="${b.logo}" alt="" style="max-height:54px;max-width:160px;display:block;margin-bottom:4px">` : ''}<div class="b l">${esc(b.name)}</div>
  <div class="s">${esc([br?.name, br?.address || b.address, b.town].filter(Boolean).join(' · '))}</div><div class="s">${esc(prettyPhone(br?.phone || b.phone))}${b.email ? ' · ' + esc(b.email) : ''}${b.kra_pin ? ' · KRA PIN ' + esc(b.kra_pin) : ''}</div></div>
  <div class="r"><h1>${esc(title)}</h1><div class="b">${esc(no || '')}</div><div class="s">${d8(date || Date.now())}</div></div></div><div class="strip"></div>`;
}
const partyBox = (label, s) => s ? `<div class="box"><div class="k">${esc(label)}</div><b>${esc(s.name)}</b>${s.contact ? `<div class="s">${esc(s.contact)}</div>` : ''}<div class="s">${esc(prettyPhone(s.phone))}${s.email ? ' · ' + esc(s.email) : ''}</div>${s.kra_pin ? `<div class="s">KRA PIN ${esc(s.kra_pin)}</div>` : ''}</div>` : '<div></div>';
const foot = () => `<div class="foot">${t('Printed {d}', { d: new Date().toLocaleString('en-KE') })} · Powered by Pentarch POS</div>`;

export function poHtml(po, supplier, ctx) {
  const rows = po.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.name)}</td><td class="n">${q(l.qty)}</td><td class="n">${kes(l.cost)}</td><td class="n">${kes(Math.round(l.qty * l.cost))}</td></tr>`).join('');
  const body = `${head(ctx, t('PURCHASE ORDER'), po.no, po.created_at)}
  <div class="grid">${partyBox(t('Supplier'), supplier)}<div class="box"><div class="k">${t('Deliver to@@po')}</div><b>${esc(ctx.business.name)}</b><div class="s">${esc(ctx.branch?.name || '')}</div>
  ${po.expected_date ? `<div class="s">${t('Expected by')}: <b>${esc(po.expected_date)}</b></div>` : ''}${supplier?.terms_days ? `<div class="s">${t('Payment terms')}: ${t('{n} days', { n: supplier.terms_days })}</div>` : ''}</div></div>
  <table><tr><th>#</th><th>${t('Item')}</th><th class="n">${t('Qty')}</th><th class="n">${t('Unit cost')}</th><th class="n">${t('Amount')}</th></tr>${rows}</table>
  <div class="r xl" style="margin-top:12px">${t('Total')}: ${money(po.total || 0)}</div>
  ${po.notes ? `<div class="box" style="margin-top:12px"><div class="k">${t('Notes')}</div>${esc(po.notes)}</div>` : ''}
  ${ctx.settings?.po_footer ? `<div class="s" style="margin-top:10px">${esc(ctx.settings.po_footer)}</div>` : ''}
  <div class="sig"><div>${t('Authorised by')}</div><div>${t('Supplier acknowledgement')}</div></div>${foot()}`;
  return doc(body, { paper: 'a4', title: po.no, css: CSS });
}
/** Plain text for WhatsApp. */
export function poText(po, supplier, ctx) {
  const lines = po.lines.map((l) => `• ${l.name} × ${q(l.qty)}${l.cost ? ` @ ${kes(l.cost)}` : ''}`).join('\n');
  return `${t('Hello {name},', { name: (supplier?.contact || supplier?.name || '').split(' ')[0] })}\n${t('Please supply the following for {biz} ({branch}):', { biz: ctx.business.name, branch: ctx.branch?.name || '' })}\n\n${t('Order')} ${po.no}\n${lines}\n\n${t('Total')}: ${money(po.total || 0)}${po.expected_date ? '\n' + t('Expected by') + ': ' + po.expected_date : ''}${po.notes ? '\n' + po.notes : ''}\n\n${t('Thank you.')}`;
}

export function grnHtml(g, supplier, ctx, userName = '') {
  const ret = g.kind === 'return';
  const rows = g.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.name)}${l.batch_no ? `<div class="s">${t('Batch')} ${esc(l.batch_no)}${l.expiry ? ' · ' + t('Exp') + ' ' + esc(l.expiry) : ''}</div>` : ''}${l.serials?.length ? `<div class="s">${t('Serials')}: ${esc(l.serials.join(', '))}</div>` : ''}${l.pack ? `<div class="s">${q(l.pack.qty)} × ${esc(l.pack.name)}</div>` : ''}</td>
    <td class="n">${q(Math.abs(l.qty))}</td><td class="n">${kes(l.cost)}</td><td class="n">${kes(Math.round(Math.abs(l.qty) * l.cost))}</td></tr>`).join('');
  const extras = (g.extra_costs || []).filter((x) => x.amount).map((x) => `<div class="row"><span>${esc(x.label || t('Extra cost'))}</span><span class="n">${kes(x.amount)}</span></div>`).join('');
  const body = `${head(ctx, ret ? t('GOODS RETURN NOTE') : t('GOODS RECEIVED NOTE'), g.no, g.created_at)}
  <div class="grid">${partyBox(t('Supplier'), supplier)}<div class="box">${g.supplier_invoice_no ? `<div class="k">${t('Supplier invoice no.')}</div><b>${esc(g.supplier_invoice_no)}</b>` : ''}
  ${ret && g.reason ? `<div class="k">${t('Reason')}</div><b>${esc(g.reason)}</b>` : ''}${userName ? `<div class="s">${ret ? t('Returned by') : t('Received by')}: ${esc(userName)}</div>` : ''}</div></div>
  <table><tr><th>#</th><th>${t('Item')}</th><th class="n">${t('Qty')}</th><th class="n">${t('Unit cost')}</th><th class="n">${t('Amount')}</th></tr>${rows}</table>
  <div style="margin-left:auto;width:280px;margin-top:10px">${extras ? `<div class="row"><span>${t('Goods')}</span><span class="n">${kes(Math.abs(g.subtotal))}</span></div>${extras}` : ''}
  <div class="row xl"><span>${ret ? t('Credit (return)') : t('Total')}</span><span>${money(Math.abs(g.total))}</span></div>${g.paid ? `<div class="row"><span>${t('Paid on delivery')}</span><span class="n">${kes(g.paid)}</span></div>` : ''}</div>
  ${g.note ? `<div class="box" style="margin-top:12px"><div class="k">${t('Notes')}</div>${esc(g.note)}</div>` : ''}
  <div class="sig"><div>${ret ? t('Returned by') : t('Received by')}</div><div>${t('Supplier / driver')}</div></div>${foot()}`;
  return doc(body, { paper: 'a4', title: g.no, css: CSS });
}

export function transferHtml(tr, ctx, branchName) {
  const done = tr.status === 'received';
  const rows = tr.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.name)}${l.batches?.filter((b) => b.batch_no).length ? `<div class="s">${l.batches.filter((b) => b.batch_no).map((b) => `${esc(b.batch_no)} (${q(b.qty)})`).join(', ')}</div>` : ''}${l.serials?.length ? `<div class="s">${esc(l.serials.join(', '))}</div>` : ''}</td>
    <td class="n">${q(l.qty)}</td><td class="n">${done ? q(l.received) : '<span class="blank"></span>'}</td></tr>`).join('');
  const body = `${head(ctx, t('STOCK TRANSFER'), tr.no, tr.sent_at || tr.created_at)}
  <div class="grid"><div class="box"><div class="k">${t('From')}</div><b>${esc(branchName(tr.from_branch_id))}</b></div><div class="box"><div class="k">${t('To')}</div><b>${esc(branchName(tr.to_branch_id))}</b></div></div>
  <table><tr><th>#</th><th>${t('Item')}</th><th class="n">${t('Qty sent')}</th><th class="n">${t('Qty received')}</th></tr>${rows}</table>
  ${tr.note ? `<div class="box" style="margin-top:12px"><div class="k">${t('Notes')}</div>${esc(tr.note)}</div>` : ''}
  <div class="sig"><div>${t('Sent by')}</div><div>${t('Received by')}</div></div>${foot()}`;
  return doc(body, { paper: 'a4', title: tr.no, css: CSS });
}

/** rows: [{product, expected, counted}] */
export function countSheetHtml(count, rows, ctx, { blind }) {
  const body = `${head(ctx, t('STOCK COUNT SHEET'), count.no, count.created_at)}
  <div class="s" style="margin-bottom:8px">${t('Write the quantity you find on the shelf. Count every item, including the store room.')}</div>
  <table><tr><th>#</th><th>${t('Item')}</th><th>${t('Barcode / SKU')}</th>${blind ? '' : `<th class="n">${t('System')}</th>`}<th class="n">${t('Counted')}</th></tr>
  ${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.product.name)}</td><td class="s">${esc(r.product.barcode || r.product.sku || '')}</td>${blind ? '' : `<td class="n">${q(r.expected)} ${esc(r.product.unit !== 'pc' ? r.product.unit : '')}</td>`}<td class="n">${r.counted != null ? q(r.counted) : '<span class="blank"></span>'}</td></tr>`).join('')}</table>
  <div class="sig"><div>${t('Counted by')}</div><div>${t('Checked by')}</div></div>${foot()}`;
  return doc(body, { paper: 'a4', title: count.no, css: CSS });
}

export function supplierStatementHtml(s, acc, ctx) {
  const rows = [];
  for (const d of acc.docs) rows.push({ at: d.created_at, ref: d.no + (d.supplier_invoice_no ? ' / ' + d.supplier_invoice_no : ''), desc: d.kind === 'return' ? t('Goods returned') : t('Goods received'), debit: d.kind === 'return' ? -d.total : 0, credit: d.kind === 'return' ? 0 : d.total });
  for (const p of acc.payments) rows.push({ at: p.created_at, ref: p.ref || '', desc: p.amount < 0 ? t('Refund from supplier') : t('Payment') + ' — ' + methodLabel(p.method), debit: p.amount > 0 ? p.amount : 0, credit: p.amount < 0 ? -p.amount : 0 });
  rows.sort((a, z) => a.at - z.at);
  let bal = 0;
  const body = `${head(ctx, t('SUPPLIER STATEMENT'), '', Date.now())}${partyBox(t('Supplier'), s)}
  <table style="margin-top:12px"><tr><th>${t('Date')}</th><th>${t('Reference')}</th><th>${t('Details')}</th><th class="n">${t('Paid / returned')}</th><th class="n">${t('Supplied')}</th><th class="n">${t('Balance')}</th></tr>
  ${rows.map((r) => { bal += r.credit - r.debit; return `<tr><td>${d8(r.at)}</td><td>${esc(r.ref)}</td><td>${esc(r.desc)}</td><td class="n">${r.debit ? kes(r.debit) : ''}</td><td class="n">${r.credit ? kes(r.credit) : ''}</td><td class="n">${kes(bal)}</td></tr>`; }).join('')}</table>
  <div class="r xl" style="margin-top:14px">${t('We owe')}: ${money(acc.balance)}</div>${foot()}`;
  return doc(body, { paper: 'a4', title: 'Statement ' + s.name, css: CSS });
}
