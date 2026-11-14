// Demo data for quotes & invoices (wholesale, hardware, auto spares…): quotes in every state, two invoices from quotes.
import { db } from '../../db/index.js';
import { ulid } from '../../lib/ulid.js';
import { computeCart } from '../../core/pricing.js';

const DAY = 86400000;
const iso = (ms) => { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
export async function demoSeed({ type, business, branch, users, products, customers, now, stamp, rnd }) {
  if (!business.modules?.quotes) return;
  const d = db();
  const owner = users[0];
  const sellable = products.filter((p) => !p.has_variants && p.type !== 'service' && p.price > 0);
  if (!sellable.length || !customers.length) return;
  const trade = customers.filter((c) => c.group === 'wholesale');
  const buyers = trade.length ? trade : customers;
  const opts = { vatRegistered: !!business.vat_registered, inclusive: true };
  const pickLines = (n, seed) => Array.from({ length: n }, (_, i) => sellable[(seed * 13 + i * 7) % sellable.length])
    .filter((p, i, a) => a.indexOf(p) === i)
    .map((p, i) => { const qty = [10, 5, 20, 2, 50, 4][(seed + i) % 6]; const price = p.wholesale_price && qty >= (p.wholesale_min_qty || 1) ? p.wholesale_price : p.price; return { key: ulid(), product_id: p.id, name: p.name, sku: p.sku || '', qty, unit: p.unit || 'pc', factor: 1, price, list_price: price, cost: p.cost || 0, discount: 0, tax: p.tax || 'B', modifiers: [] }; });
  // [days ago, status, customer idx, lines, valid days, notes]
  const plan = [[0, 'draft', 0, 4, 14, ''], [2, 'sent', 1, 5, 14, 'Delivery to site included.'], [5, 'accepted', 2, 3, 14, ''], [24, 'sent', 3, 4, 14, ''], [9, 'declined', 0, 2, 7, ''], [12, 'invoiced', 2, 4, 30, 'LPO attached.'], [3, 'invoiced', 1, 3, 14, '']];
  const code = branch.code || 'POS';
  const quotes = [], sales = [];
  let seq = 0;
  // the latest receipt number for invoices made from quotes
  const meta = await d.meta.get('receipt_seq');
  let rseq = meta?.value || 0;
  for (const [ago, status, ci, n, valid, notes] of plan) {
    const at = now - ago * DAY - 3 * 3600e3;
    const c = buyers[ci % buyers.length];
    const lines = pickLines(n, ago + ci + 1);
    const calc = computeCart(lines, opts);
    const q = { id: ulid(at), no: `Q-${code}1-${String(++seq).padStart(4, '0')}`, customer_id: c.id, customer_name: c.name, lines, subtotal: calc.subtotal, discount: calc.discount, tax_total: calc.tax_total, total: calc.total,
      status, valid_until: iso(at + valid * DAY), notes, lpo_no: status === 'invoiced' && ago > 10 ? 'LPO-2231' : '', created_by: owner.id, branch_id: branch.id, created_at: at };
    if (status === 'invoiced') {
      const sid = ulid(at + 3600e3), no = `${code}1-${String(++rseq).padStart(6, '0')}`;
      const sl = calc.lines.map((l) => ({ product_id: l.product_id, name: l.name, qty: l.qty, unit: l.unit, factor: 1, price: l.price, orig_price: l.price, cost: l.cost, discount: 0, line_discount: 0, tax: l.tax, tax_rate: l.tax_rate, tax_amount: l.tax_amount, total: l.total, batch_no: '', serial: '', staff_id: null, modifiers: [], note: '', promo_id: null, price_override: false }));
      const paid = ago > 10 ? Math.round(calc.total * 0.4) : 0;
      sales.push(stamp({ id: sid, no, branch_id: branch.id, device_id: null, shift_id: null, user_id: owner.id, customer_id: c.id, table_id: null, order_type: 'retail', lines: sl, subtotal: calc.subtotal, discount: 0, cart_discount: 0, tax_total: calc.tax_total,
        service_charge: 0, tip: 0, total: calc.total, rounding: 0, payments: [{ method: 'credit', amount: calc.total, ref: q.no, phone: '' }], paid: 0, change: 0, balance: calc.total, status: 'completed', receipt_note: notes, etims: null, void_reason: '', void_by: null,
        points_earned: 0, points_redeemed: 0, customer_name: c.name, doc_type: 'invoice', quote_id: q.id, quote_no: q.no, lpo_no: q.lpo_no, terms_days: 30, due_date: at + 3600e3 - ((at + 3600e3) % DAY) + 30 * DAY - 3 * 3600e3, created_at: at + 3600e3 }, at + 3600e3));
      if (paid) await d.customer_payments.put(stamp({ id: ulid(at + 5 * DAY), customer_id: c.id, amount: paid, method: 'mpesa', ref: 'TK' + String(Math.floor(rnd() * 1e8)).padStart(8, '0'), sale_ids: [sid], allocations: [{ sale_id: sid, no, amount: paid }], user_id: owner.id, shift_id: null, branch_id: branch.id, created_at: at + 5 * DAY }, at + 5 * DAY));
      Object.assign(q, { invoice_sale_id: sid, invoice_no: no, invoiced_at: at + 3600e3 });
    }
    if (status === 'sent') q.sent_at = at + 600e3;
    quotes.push(stamp(q, at + 600e3));
  }
  await d.quotes.bulkPut(quotes);
  if (sales.length) { await d.sales.bulkPut(sales); await d.meta.put({ key: 'receipt_seq', value: rseq }); }
  await d.meta.put({ key: 'quote_seq', value: seq });
  const settings = { ...business.settings, invoice_terms_days: 30, quote_valid_days: 14, bank_details: 'Equity Bank · ' + (business.town || 'Nairobi') + ' branch\nAccount: 0480 2919 4471 · Name: ' + business.name, quote_terms: 'Prices are in KES' + (business.vat_registered ? ' and include 16% VAT' : '') + '. Delivery within 48 hours of payment.' };
  await d.business.put({ ...business, settings });
  business.settings = settings;
}
