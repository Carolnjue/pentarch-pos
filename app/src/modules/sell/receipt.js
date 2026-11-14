// Receipt helpers: build print context, print, preview, WhatsApp text.
import { db } from '../../db/index.js';
import * as S from '../../state.js';
import { receiptHtml, invoiceHtml, methodLabel } from '../../print/templates.js';
import { printHtml } from '../../print/print.js';
import { previewPrint } from '../../ui/printpreview.jsx';
import { promptText, toast } from '../../ui/overlay.jsx';
import { money, kes } from '../../lib/money.js';
import { waLink, normPhone } from '../../lib/util.js';
import { audit } from '../../db/repo.js';
import { t } from '../../i18n/index.js';

export async function receiptCtx(sale, extra = {}) {
  const [cashier, customer] = await Promise.all([db().users.get(sale.user_id), sale.customer_id ? db().customers.get(sale.customer_id) : null]);
  const branch = S.branches.value.find((b) => b.id === sale.branch_id) || S.branch.value;
  return { business: S.business.value, branch, settings: S.settings.value, cashier: cashier?.name || '', customer, ...extra };
}
export async function printReceipt(sale, { copy = false, paper } = {}) {
  const ctx = await receiptCtx(sale, { copy });
  const html = await receiptHtml(sale, ctx, { paper });
  await printHtml(html, { copies: copy ? 1 : Number(S.settings.value.print_copies) || 1 });
  if (copy) await audit('receipt.reprint', 'sales', sale.id, { no: sale.no });
}
export async function previewReceipt(sale, { copy = false, actions } = {}) {
  const ctx = await receiptCtx(sale, { copy });
  const html = await receiptHtml(sale, ctx);
  if (copy) audit('receipt.reprint', 'sales', sale.id, { no: sale.no });
  return previewPrint(html, { title: t('Receipt {no}', { no: sale.no }), paper: S.settings.value.receipt_width || 80, actions });
}
export async function previewInvoice(sale) {
  const ctx = await receiptCtx(sale);
  return previewPrint(await invoiceHtml(sale, ctx, { title: sale.balance ? t('INVOICE') : t('TAX INVOICE') }), { title: t('Invoice {no}', { no: sale.no }), paper: 'a4' });
}

export function receiptText(sale, ctx) {
  const b = ctx.business;
  const lines = sale.lines.map((l) => `${l.qty} x ${l.name} — ${kes(l.total)}`).join('\n');
  const pays = sale.payments.map((p) => `${methodLabel(p.method)}${p.ref ? ' (' + p.ref + ')' : ''}: ${kes(p.tendered || p.amount)}`).join('\n');
  return `*${b.name}*\n${t('Receipt')} ${sale.no} · ${new Date(sale.created_at).toLocaleString('en-KE')}\n\n${lines}\n\n*${t('TOTAL')}: ${money(sale.total)}*\n${pays}${sale.change ? `\n${t('Change')}: ${kes(sale.change)}` : ''}${sale.balance ? `\n${t('Balance on account')}: ${kes(sale.balance)}` : ''}\n\n${S.settings.value.receipt_footer || ''}\n_${t('Sent from Pentarch POS')}_`;
}
export async function whatsappReceipt(sale) {
  const ctx = await receiptCtx(sale);
  let phone = ctx.customer?.phone || '';
  if (!phone) {
    phone = await promptText({ title: t('WhatsApp receipt'), label: t('Customer phone number'), placeholder: '07xx xxx xxx', type: 'tel', ok: t('Open WhatsApp') });
    if (phone == null) return;
  }
  if (!normPhone(phone)) { toast.error(t('Enter a valid Kenyan phone number')); return; }
  window.open(waLink(phone, receiptText(sale, ctx)), '_blank', 'noopener');
  audit('receipt.whatsapp', 'sales', sale.id, { no: sale.no });
}
