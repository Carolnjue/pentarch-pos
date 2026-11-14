// Quotes & invoices logic (no JSX). A quote is a `quotes` record; converting it to an invoice writes a credit sale
// (sales.balance = amount due, extra fields quote_id / due_date / terms_days) so debts, statements and customer
// payments work exactly as for any credit sale. Converting to a sale loads the quote into the Sell cart.
import { db, getMeta, setMeta } from '../../db/index.js';
import { save, patch } from '../../db/repo.js';
import { catalog } from '../../db/catalog.js';
import { computeCart, unitPrice } from '../../core/pricing.js';
import { completeSale } from '../../core/sales.js';
import { account } from '../../core/customers.js';
import { cart, emptyCart, restoreCart } from '../sell/cart.js';
import { holdCart } from '../../core/sales.js';
import { ulid } from '../../lib/ulid.js';
import { DAY, startOfDay, dayKey } from '../../lib/util.js';
import * as S from '../../state.js';

export const STATUS = { draft: ['Draft', ''], sent: ['Sent', 'navy'], accepted: ['Accepted', 'ok'], invoiced: ['Invoiced', 'ok'], sold: ['Sold', 'ok'], expired: ['Expired', 'bad'], declined: ['Declined', 'bad'] };
const here = (r) => !r.deleted && (!r.branch_id || !S.branch.value?.id || r.branch_id === S.branch.value.id);

export async function nextQuoteNo() {
  const seq = ((await getMeta('quote_seq')) || 0) + 1;
  await setMeta('quote_seq', seq);
  return `Q-${S.branch.value?.code || 'POS'}${S.device.value?.no || 1}-${String(seq).padStart(4, '0')}`;
}
/** Shown status: open quotes past their validity are "expired". */
export function quoteStatus(q, now = Date.now()) {
  if (['draft', 'sent'].includes(q.status) && q.valid_until && now > new Date(q.valid_until + 'T23:59:59').getTime()) return 'expired';
  return q.status || 'draft';
}
export const calcOpts = () => { const st = S.settings.value; return { vatRegistered: !!S.business.value?.vat_registered, inclusive: st.vat_inclusive !== false, rounding: !!st.rounding }; };
export const quoteCalc = (lines) => computeCart(lines || [], calcOpts());
export const addDays = (days, from = Date.now()) => dayKey(startOfDay(from) + days * DAY);

/** A quote line from a product, priced for the customer (wholesale group / quantity tiers). */
export function lineFor(p, qty = 1, customer = null) {
  const price = unitPrice(p, { wholesale: customer?.group === 'wholesale', qty, branchId: S.branch.value?.id, wholesaleAutoQty: S.settings.value.wholesale_auto_qty !== false });
  return { key: ulid(), product_id: p.id, name: p.name, sku: p.sku || '', qty, unit: p.unit || 'pc', factor: 1, price, list_price: price, cost: p.cost || 0, discount: 0, tax: p.tax || S.settings.value.default_tax || 'B', modifiers: [] };
}
export function reprice(l, customer) {
  const p = catalog.value.byId.get(l.product_id);
  if (!p || l.price_edited) return l;
  const price = unitPrice(p, { wholesale: customer?.group === 'wholesale', qty: l.qty, branchId: S.branch.value?.id, wholesaleAutoQty: S.settings.value.wholesale_auto_qty !== false });
  return { ...l, price, list_price: price };
}

export async function saveQuote(q) {
  const calc = quoteCalc(q.lines);
  const rec = { ...q, subtotal: calc.subtotal, discount: calc.discount, tax_total: calc.tax_total, total: calc.total, branch_id: q.branch_id || S.branch.value?.id || null };
  if (!rec.no) rec.no = await nextQuoteNo();
  if (!rec.created_by) rec.created_by = S.user.value?.id || null;
  return save('quotes', rec, { audit: { action: q.id ? 'quote.edit' : 'quote.create', details: { no: rec.no, total: rec.total } } });
}
export const setQuoteStatus = (q, status, extra = {}) => patch('quotes', q.id, { status, [status + '_at']: Date.now(), ...extra }, { audit: { action: 'quote.' + status, details: { no: q.no } } });

const custSnap = (c) => c && ({ id: c.id, name: c.name, phone: c.phone, group: c.group, credit_limit: c.credit_limit, loyalty_points: c.loyalty_points || 0, kra_pin: c.kra_pin || '' });

/** Credit check before invoicing: {balance, limit, over}. */
export async function creditCheck(customerId, amount) {
  const c = await db().customers.get(customerId);
  const acc = await account(customerId);
  const limit = c?.credit_limit || 0;
  return { balance: acc.balance, limit, over: limit > 0 && acc.balance + amount > limit };
}

/** Convert a quote into an invoice (credit sale). Returns the sale. */
export async function createInvoice(q, { termsDays } = {}) {
  const customer = await db().customers.get(q.customer_id);
  if (!customer) throw new Error('customer missing');
  const calc = quoteCalc(q.lines);
  const days = termsDays ?? (Number(S.settings.value.invoice_terms_days) || 30);
  const sale = await completeSale({
    calc, payments: [{ method: 'credit', amount: calc.total, ref: q.no }], change: 0, customer: custSnap(customer), note: q.notes || '', order_type: 'retail',
    extra: { doc_type: 'invoice', quote_id: q.id, quote_no: q.no, lpo_no: q.lpo_no || '', terms_days: days, due_date: startOfDay() + days * DAY }
  });
  await patch('quotes', q.id, { status: 'invoiced', invoiced_at: Date.now(), invoice_sale_id: sale.id, invoice_no: sale.no }, { audit: { action: 'quote.invoiced', details: { no: q.no, invoice: sale.no, total: sale.total } } });
  return sale;
}

/** Load a quote into the Sell cart (cash / M-Pesa sale). The quote is marked sold when that sale completes. */
export async function quoteToCart(q) {
  const c = cart.value;
  if (c.lines.length) await holdCart({ name: c.customer?.name || 'Held sale', lines: c.lines, customer: c.customer, cartDiscount: 0, note: c.note, wholesale: c.wholesale });
  const customer = q.customer_id ? await db().customers.get(q.customer_id) : null;
  const lines = q.lines.map((l) => {
    const p = catalog.value.byId.get(l.product_id);
    const list = p ? unitPrice(p, { wholesale: customer?.group === 'wholesale', qty: l.qty, branchId: S.branch.value?.id }) : l.price;
    return { key: ulid(), product_id: l.product_id, name: l.name, qty: l.qty, unit: l.unit || 'pc', factor: 1, uom: null, price: l.price, orig_price: list, promo_id: null, cost: p?.cost ?? l.cost ?? 0,
      discount: l.discount || 0, tax: l.tax, modifiers: [], note: '', staff_id: null, serial: '', price_override: l.price !== list, added_at: Date.now() };
  });
  restoreCart({ ...emptyCart(), lines, customer: custSnap(customer), wholesale: customer?.group === 'wholesale', note: q.notes || '', meta: { quote_id: q.id, quote_no: q.no } });
}

/** Invoices = credit sales (from quotes or from the Sell screen) with paid / due / status. */
export async function loadInvoices() {
  const sales = (await db().sales.where('customer_id').above('').toArray()).filter((s) => here(s) && s.balance > 0);
  const custIds = [...new Set(sales.map((s) => s.customer_id))];
  const accs = await Promise.all(custIds.map((id) => account(id)));
  const custs = new Map((await db().customers.bulkGet(custIds)).filter(Boolean).map((c) => [c.id, c]));
  const info = new Map();
  for (const a of accs) for (const i of a.invoices) info.set(i.sale.id, i);
  const terms = Number(S.settings.value.invoice_terms_days) || 30;
  const now = Date.now();
  return sales.map((s) => {
    const i = info.get(s.id);
    const due = s.status === 'void' ? 0 : i ? i.due : s.balance;
    const dueDate = s.due_date || startOfDay(s.created_at) + (s.terms_days ?? terms) * DAY;
    const status = s.status === 'void' ? 'void' : due <= 0 ? 'paid' : now > dueDate + DAY - 1 ? 'overdue' : due < s.balance ? 'part' : 'unpaid';
    return { ...s, customer: custs.get(s.customer_id) || null, due, paid_amount: s.paid + (s.balance - due), due_date: dueDate, inv_status: status };
  }).sort((a, b) => b.created_at - a.created_at);
}
export const INV_STATUS = { unpaid: ['Unpaid', 'warn'], part: ['Part paid', 'navy'], paid: ['Paid', 'ok'], overdue: ['Overdue', 'bad'], void: ['Void', ''] };
