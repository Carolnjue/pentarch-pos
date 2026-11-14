// Reports engine — pure functions over raw rows (no Dexie, no UI) so they are fast, unit-testable and reusable by the
// dashboard. Money is integer cents. "ok" sales = not deleted and not void (returned / part-returned sales still count;
// their refunds are subtracted separately, so the numbers match the till and the Z reports).
import { taxRate, taxInclusive } from '../../lib/tax.js';

export const DAY = 86400000;
const VAT_PCT = { B: 16, E: 8 };
export const okSale = (s) => !s.deleted && s.status !== 'void';
export const live = (r) => !r.deleted;
export const inBranch = (branchId) => (r) => !branchId || !r.branch_id || r.branch_id === branchId;
const r3 = (n) => Math.round(n * 1000) / 1000;

/** Cost of a sale line, net of input VAT when the sale carried VAT (same rule as the dashboard). */
export function lineCost(l, saleHasVat) {
  const rate = saleHasVat ? (l.tax_rate ?? VAT_PCT[l.tax] ?? 0) / 100 : 0;
  return Math.round(((l.cost || 0) * (l.qty || 0) * (l.factor || 1)) / (1 + rate));
}
/** Net (ex-VAT) amount of a line. */
export const lineNet = (l) => (l.total || 0) - (l.tax_amount || 0);
export const saleCost = (s) => { const v = (s.tax_total || 0) > 0; let c = 0; for (const l of s.lines) c += lineCost(l, v); return c; };

/** Headline totals for a set of sales + returns. */
export function salesTotals(sales, returns = []) {
  let total = 0, tax = 0, cost = 0, discount = 0, items = 0, count = 0, rounding = 0;
  for (const s of sales) {
    if (!okSale(s)) continue;
    count++; total += s.total; tax += s.tax_total || 0; discount += s.discount || 0; rounding += s.rounding || 0;
    cost += saleCost(s);
    for (const l of s.lines) items += l.qty || 0;
  }
  const refunds = returns.filter(live).reduce((a, r) => a + returnTotal(r), 0);
  return { count, total, tax, cost, discount, items: r3(items), rounding, refunds, net: total - refunds, profit: total - tax - cost, avg: count ? Math.round(total / count) : 0 };
}
export const returnTotal = (r) => r.total ?? (r.refund || []).reduce((a, f) => a + f.amount, 0);

/** Group sales by local calendar day between from and to (ms). */
export function byDay(sales, returns, from, to) {
  const days = [];
  for (let d = from; d < to; d = nextDay(d)) days.push({ d0: d, count: 0, total: 0, discount: 0, tax: 0, refunds: 0, cost: 0 });
  const idx = (ms) => { let lo = 0, hi = days.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (days[m].d0 <= ms) lo = m; else hi = m - 1; } return lo; };
  for (const s of sales) {
    if (!okSale(s) || s.created_at < from || s.created_at >= to) continue;
    const r = days[idx(s.created_at)];
    r.count++; r.total += s.total; r.discount += s.discount || 0; r.tax += s.tax_total || 0; r.cost += saleCost(s);
  }
  for (const x of returns) if (live(x) && x.created_at >= from && x.created_at < to) days[idx(x.created_at)].refunds += returnTotal(x);
  for (const r of days) { r.net = r.total - r.refunds; r.profit = r.total - r.tax - r.cost; }
  return days;
}
export function nextDay(ms) { const d = new Date(ms); d.setDate(d.getDate() + 1); d.setHours(0, 0, 0, 0); return d.getTime(); }

/** Sales by product (gross line totals; returns are shown in the exceptions report). */
export function byProduct(sales, products = new Map()) {
  const m = new Map();
  let all = 0;
  for (const s of sales) {
    if (!okSale(s)) continue;
    const v = (s.tax_total || 0) > 0;
    for (const l of s.lines) {
      const b = m.get(l.product_id) || { id: l.product_id, name: products.get(l.product_id)?.name || l.name, category_id: products.get(l.product_id)?.category_id || null, qty: 0, total: 0, net: 0, cost: 0, sales: 0 };
      b.qty = r3(b.qty + (l.qty || 0) * (l.factor || 1)); b.total += l.total || 0; b.net += lineNet(l); b.cost += lineCost(l, v); b.sales++;
      m.set(l.product_id, b); all += l.total || 0;
    }
  }
  return [...m.values()].map((b) => ({ ...b, profit: b.net - b.cost, margin: b.net ? ((b.net - b.cost) / b.net) * 100 : 0, share: all ? (b.total / all) * 100 : 0 })).sort((a, b) => b.total - a.total);
}
export function byCategory(prodRows, categories = new Map()) {
  const m = new Map();
  let all = 0;
  for (const p of prodRows) {
    const k = p.category_id || '';
    const b = m.get(k) || { id: k, name: categories.get(k)?.name || '', color: categories.get(k)?.color || null, qty: 0, total: 0, net: 0, cost: 0, products: 0 };
    b.qty = r3(b.qty + p.qty); b.total += p.total; b.net += p.net; b.cost += p.cost; b.products++;
    m.set(k, b); all += p.total;
  }
  return [...m.values()].map((b) => ({ ...b, profit: b.net - b.cost, margin: b.net ? ((b.net - b.cost) / b.net) * 100 : 0, share: all ? (b.total / all) * 100 : 0 })).sort((a, b) => b.total - a.total);
}

/** Sales by staff (the cashier who rang the sale) + exceptions they made. */
export function byStaff(sales, returns, audits) {
  const m = new Map();
  const get = (id) => { if (!m.has(id)) m.set(id, { id, count: 0, total: 0, discount: 0, voids: 0, voidTotal: 0, returns: 0, refunds: 0, profit: 0 }); return m.get(id); };
  for (const s of sales) {
    if (s.deleted) continue;
    const b = get(s.user_id || '');
    if (s.status === 'void') { b.voids++; b.voidTotal += s.total; continue; }
    b.count++; b.total += s.total; b.discount += s.discount || 0; b.profit += s.total - (s.tax_total || 0) - saleCost(s);
  }
  for (const r of returns) if (live(r)) { const b = get(r.user_id || ''); b.returns++; b.refunds += returnTotal(r); }
  void audits;
  return [...m.values()].map((b) => ({ ...b, avg: b.count ? Math.round(b.total / b.count) : 0 })).sort((a, b) => b.total - a.total);
}

/** Takings by payment method (sales), debt payments received and refunds. */
export function byMethod(sales, returns = [], custPayments = []) {
  const m = new Map();
  const get = (k) => { if (!m.has(k)) m.set(k, { method: k, count: 0, sales: 0, debt: 0, refunds: 0 }); return m.get(k); };
  for (const s of sales) if (okSale(s)) for (const p of s.payments || []) { const b = get(p.method); b.count++; b.sales += p.amount; }
  for (const p of custPayments) if (live(p)) get(p.method).debt += p.amount;
  for (const r of returns) if (live(r)) for (const f of r.refund || []) get(f.method).refunds += f.amount;
  const rows = [...m.values()].map((b) => ({ ...b, received: b.method === 'credit' ? 0 : b.sales + b.debt - b.refunds }));
  const all = rows.reduce((a, r) => a + r.sales, 0);
  return rows.map((r) => ({ ...r, share: all ? (r.sales / all) * 100 : 0 })).sort((a, b) => b.sales - a.sales);
}

/** Hour-of-day × day-of-week matrix (Monday first). */
export function byHour(sales) {
  const grid = Array.from({ length: 7 }, () => new Array(24).fill(0));
  const cnt = Array.from({ length: 7 }, () => new Array(24).fill(0));
  const hours = Array.from({ length: 24 }, (_, h) => ({ h, count: 0, total: 0 }));
  const dows = Array.from({ length: 7 }, (_, d) => ({ d, count: 0, total: 0, days: new Set() }));
  for (const s of sales) {
    if (!okSale(s)) continue;
    const dt = new Date(s.created_at);
    const h = dt.getHours(), d = (dt.getDay() + 6) % 7;
    grid[d][h] += s.total; cnt[d][h]++;
    hours[h].count++; hours[h].total += s.total;
    dows[d].count++; dows[d].total += s.total; dows[d].days.add(dt.toDateString());
  }
  return { grid, cnt, hours, dows: dows.map((x) => ({ d: x.d, count: x.count, total: x.total, days: x.days.size, avgDay: x.days.size ? Math.round(x.total / x.days.size) : 0 })) };
}

/** Sales by customer (walk-in = id ''). balances: Map id → balance */
export function byCustomer(sales, balances = new Map()) {
  const m = new Map();
  for (const s of sales) {
    if (!okSale(s)) continue;
    const k = s.customer_id || '';
    const b = m.get(k) || { id: k, count: 0, total: 0, last: 0, credit: 0 };
    b.count++; b.total += s.total; b.last = Math.max(b.last, s.created_at); b.credit += s.balance || 0;
    m.set(k, b);
  }
  return [...m.values()].map((b) => ({ ...b, avg: b.count ? Math.round(b.total / b.count) : 0, balance: balances.get(b.id) || 0 })).sort((a, b) => b.total - a.total);
}

/** VAT by eTIMS code. Returns are matched to their sale line (line_index) for the code; tax on them follows the line rate. */
export function vatByCode(sales, returns = [], saleById = new Map()) {
  const by = {};
  const get = (code) => (by[code] ||= { code, rate: taxRate(code), sales: 0, tax: 0, returns: 0, returnsTax: 0, lines: 0 });
  for (const s of sales) {
    if (!okSale(s)) continue;
    for (const l of s.lines) { const b = get(l.tax || 'B'); b.sales += l.total || 0; b.tax += l.tax_amount || 0; b.lines++; }
  }
  for (const r of returns) {
    if (!live(r)) continue;
    const s = saleById.get(r.sale_id);
    for (const rl of r.lines || []) {
      const sl = s?.lines?.[rl.line_index] || s?.lines?.find((x) => x.product_id === rl.product_id);
      const code = sl?.tax || 'B';
      const b = get(code);
      const rate = s && (s.tax_total || 0) > 0 ? (sl?.tax_rate ?? taxRate(code)) : 0;
      b.returns += rl.amount || 0; b.returnsTax += taxInclusive(rl.amount || 0, rate);
    }
  }
  return 'ABCDE'.split('').map((c) => by[c]).filter(Boolean).map((b) => ({ ...b, netSales: b.sales - b.returns, vat: b.tax - b.returnsTax, exVat: b.sales - b.returns - (b.tax - b.returnsTax) }));
}

/** Exceptions (anti-theft) from the audit log. */
export const EXCEPTION_ACTIONS = ['discount.apply', 'sale.void', 'sale.return', 'price.change', 'drawer.open', 'cart.clear', 'override.grant', 'cart.remove_sent'];
export function exceptions(audits) {
  const rows = audits.filter((a) => live(a) && EXCEPTION_ACTIONS.includes(a.action)).sort((a, b) => b.at - a.at);
  const sum = {};
  const staff = new Map();
  for (const a of rows) {
    const amt = amountOf(a);
    const s = (sum[a.action] ||= { action: a.action, count: 0, amount: 0 });
    s.count++; s.amount += amt;
    const p = staff.get(a.user_id || '') || { id: a.user_id || '', count: 0, amount: 0, byAction: {} };
    p.count++; p.amount += amt; p.byAction[a.action] = (p.byAction[a.action] || 0) + 1;
    staff.set(a.user_id || '', p);
  }
  return { rows, sum, staff: [...staff.values()].sort((a, b) => b.count - a.count) };
}
export const amountOf = (a) => { const d = a.details || {}; const v = d.amount ?? d.total ?? (d.from != null && d.to != null ? Math.abs(d.from - d.to) : 0); return typeof v === 'number' ? v : 0; };

/** Stock on hand & valuation. levels: [{product_id, branch_id, qty}] */
export function stockValuation(products, levels, branchId) {
  const q = new Map();
  for (const l of levels) if (!branchId || l.branch_id === branchId) q.set(l.product_id, r3((q.get(l.product_id) || 0) + l.qty));
  const rows = [];
  for (const p of products) {
    if (p.deleted || p.has_variants || p.track_stock === false || p.type === 'service' || p.type === 'non_stock' || p.type === 'composite') continue;
    const qty = q.get(p.id) || 0;
    const price = branchId ? (p.branch_prices?.[branchId] ?? p.price) : p.price;
    rows.push({ id: p.id, name: p.name, category_id: p.category_id, unit: p.unit, qty, cost: p.cost || 0, price: price || 0, costValue: Math.round(Math.max(0, qty) * (p.cost || 0)), retailValue: Math.round(Math.max(0, qty) * (price || 0)), reorder: p.reorder_level || 0, reorder_qty: p.reorder_qty || 0, active: p.active !== false });
  }
  for (const r of rows) r.potential = r.retailValue - r.costValue;
  return rows.sort((a, b) => b.costValue - a.costValue);
}
export function lowStock(valRows) {
  return valRows.filter((r) => r.active && r.reorder > 0 && r.qty <= r.reorder).map((r) => {
    const suggest = r.reorder_qty > 0 ? r.reorder_qty : Math.max(1, Math.ceil(r.reorder * 2 - r.qty));
    return { ...r, suggest, orderCost: Math.round(suggest * r.cost) };
  }).sort((a, b) => a.qty / (a.reorder || 1) - b.qty / (b.reorder || 1));
}

export { expiryList } from './expiry.js';

/** Dead / slow stock: products with stock and few or no sales in the window. lastSold: Map id → ms */
export function deadStock(valRows, sales, days, lastSold = new Map(), now = Date.now()) {
  const sold = new Map();
  for (const s of sales) if (okSale(s)) for (const l of s.lines) sold.set(l.product_id, r3((sold.get(l.product_id) || 0) + (l.qty || 0) * (l.factor || 1)));
  return valRows.filter((r) => r.qty > 0).map((r) => {
    const q = sold.get(r.id) || 0;
    const last = lastSold.get(r.id) || 0;
    return { ...r, sold: q, last, idle: last ? Math.floor((now - last) / DAY) : null, cover: q > 0 ? Math.round((r.qty / q) * days) : null };
  }).filter((r) => r.sold === 0 || r.cover > days * 3).sort((a, b) => (a.sold - b.sold) || (b.costValue - a.costValue));
}

/** Purchases by supplier in a period and supplier balances overall.
 * goods_received holds deliveries (kind 'receipt', + total) and returns to the supplier (kind 'return', − qty/total):
 * purchases are NET of returns. Money paid comes only from supplier_payments (a refund from a supplier is a negative
 * payment); `grn.paid` is informational — receiveGoods() also writes the matching payment, so it is never added again. */
const AT_DELIVERY_MS = 3600e3;
export function purchasesBySupplier(grns, payments = []) {
  const m = new Map();
  const get = (id) => { if (!m.has(id)) m.set(id, { id, grns: 0, returnsCount: 0, received: 0, returns: 0, total: 0, paidAtDelivery: 0, payments: 0, paid: 0, lines: 0, last: 0 }); return m.get(id); };
  const byId = new Map();
  for (const g of grns) {
    if (!live(g)) continue;
    byId.set(g.id, g);
    const b = get(g.supplier_id || '');
    if (g.kind === 'return' || (g.total || 0) < 0) { b.returnsCount++; b.returns += -(g.total || 0); }
    else { b.grns++; b.received += g.total || 0; b.lines += (g.lines || []).length; b.last = Math.max(b.last, g.created_at); }
    b.total += g.total || 0;
  }
  for (const p of payments) {
    if (!live(p)) continue;
    const b = get(p.supplier_id || '');
    const gid = (p.allocations && p.allocations.length === 1 && p.allocations[0].grn_id) || (p.grn_ids && p.grn_ids.length === 1 && p.grn_ids[0]);
    const g = gid && byId.get(gid);
    const onDelivery = g && p.created_at >= g.created_at && p.created_at - g.created_at <= AT_DELIVERY_MS;
    if (onDelivery) b.paidAtDelivery += p.amount || 0; else b.payments += p.amount || 0;
    b.paid += p.amount || 0;
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}
export function supplierBalances(suppliers, grns, payments, now = Date.now()) {
  const rows = purchasesBySupplier(grns, payments);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return suppliers.filter(live).map((s) => {
    const r = byId.get(s.id) || { grns: 0, total: 0, received: 0, returns: 0, paid: 0, last: 0 };
    const balance = r.total - r.paid;
    // oldest unpaid delivery (payments and returns settle the oldest deliveries first)
    let left = r.paid + r.returns, oldest = 0;
    for (const g of grns.filter((g) => live(g) && g.supplier_id === s.id && g.kind !== 'return' && (g.total || 0) > 0).sort((a, b) => a.created_at - b.created_at)) { left -= g.total || 0; if (left < 0) { oldest = g.created_at; break; } }
    const due = oldest ? oldest + (s.terms_days || 0) * DAY : 0;
    return { id: s.id, name: s.name, phone: s.phone, terms: s.terms_days || 0, total: r.total, received: r.received, returns: r.returns, paid: r.paid, balance, last: r.last, oldest, overdue: balance > 0 && due && due < now ? Math.floor((now - due) / DAY) : 0 };
  }).sort((a, b) => b.balance - a.balance || b.total - a.total);
}

/** Debtors aging for all customers in one pass (same rules as core/customers.js#account). */
export function debtorsAging(customers, sales, payments, returns, now = Date.now()) {
  const paidTo = {}, unalloc = new Map(), creditRefunds = {};
  for (const p of payments) {
    if (!live(p)) continue;
    if (p.allocations?.length) for (const a of p.allocations) paidTo[a.sale_id] = (paidTo[a.sale_id] || 0) + a.amount;
    else unalloc.set(p.customer_id, (unalloc.get(p.customer_id) || 0) + p.amount);
  }
  for (const r of returns) if (live(r) && r.customer_id) for (const f of r.refund || []) if (f.method === 'credit') creditRefunds[r.sale_id] = (creditRefunds[r.sale_id] || 0) + f.amount;
  const inv = new Map();
  for (const s of sales.slice().sort((a, b) => a.created_at - b.created_at)) {
    if (s.deleted || s.status === 'void' || !s.balance || !s.customer_id) continue;
    const due = Math.max(0, s.balance - (paidTo[s.id] || 0) - (creditRefunds[s.id] || 0));
    (inv.get(s.customer_id) || inv.set(s.customer_id, []).get(s.customer_id)).push({ at: s.created_at, due });
  }
  const rows = [];
  for (const c of customers) {
    if (c.deleted) continue;
    const list = inv.get(c.id) || [];
    let un = unalloc.get(c.id) || 0;
    for (const i of list) { if (un <= 0) break; const a = Math.min(i.due, un); i.due -= a; un -= a; }
    const b = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    let oldest = 0;
    for (const i of list) {
      if (i.due <= 0) continue;
      const age = (now - i.at) / DAY;
      b[age <= 30 ? '0-30' : age <= 60 ? '31-60' : age <= 90 ? '61-90' : '90+'] += i.due;
      if (!oldest) oldest = i.at;
    }
    const balance = list.reduce((a, i) => a + i.due, 0) - un;
    if (balance <= 0) continue;
    rows.push({ id: c.id, name: c.name, phone: c.phone, limit: c.credit_limit || 0, b0: b['0-30'], b30: b['31-60'], b60: b['61-90'], b90: b['90+'], balance, oldest, days: oldest ? Math.floor((now - oldest) / DAY) : 0 });
  }
  return rows.sort((a, b) => b.balance - a.balance);
}

/** Customer statement rows with running balance. */
export function statement(customerId, sales, payments, returns, from, to) {
  const ev = [];
  for (const s of sales) if (!s.deleted && s.status !== 'void' && s.customer_id === customerId && s.balance) ev.push({ at: s.created_at, kind: 'sale', ref: s.no, debit: s.balance, credit: 0, total: s.total });
  for (const p of payments) if (live(p) && p.customer_id === customerId) ev.push({ at: p.created_at, kind: 'payment', ref: p.ref || '', method: p.method, debit: 0, credit: p.amount });
  for (const r of returns) if (live(r) && r.customer_id === customerId) for (const f of r.refund || []) if (f.method === 'credit') ev.push({ at: r.created_at, kind: 'return', ref: r.no || '', debit: 0, credit: f.amount });
  ev.sort((a, b) => a.at - b.at);
  let bal = 0, opening = 0;
  const rows = [];
  for (const e of ev) {
    bal += e.debit - e.credit;
    if (e.at < from) { opening = bal; continue; }
    if (e.at >= to) break;
    rows.push({ ...e, id: e.kind + e.at + e.ref, balance: bal });
  }
  const closing = rows.length ? rows[rows.length - 1].balance : opening;
  return { opening, closing, rows, debits: rows.reduce((a, r) => a + r.debit, 0), credits: rows.reduce((a, r) => a + r.credit, 0) };
}

/** Expenses by category / method. */
export function expensesSummary(expenses) {
  const cats = new Map(), methods = new Map();
  let total = 0, drawer = 0;
  for (const e of expenses) {
    if (!live(e)) continue;
    total += e.amount;
    if (e.shift_id && e.method === 'cash') drawer += e.amount;
    const c = cats.get(e.category) || { id: e.category, count: 0, total: 0 };
    c.count++; c.total += e.amount; cats.set(e.category, c);
    methods.set(e.method, (methods.get(e.method) || 0) + e.amount);
  }
  return { total, drawer, count: expenses.filter(live).length, cats: [...cats.values()].map((c) => ({ ...c, share: total ? (c.total / total) * 100 : 0 })).sort((a, b) => b.total - a.total), methods };
}

/** Profit & loss for a period. */
export function profitAndLoss({ sales, returns, expenses, cashMoves = [], saleById = new Map() }) {
  const t = salesTotals(sales, []);
  let retTotal = 0, retTax = 0, retCost = 0;
  for (const r of returns) {
    if (!live(r)) continue;
    retTotal += returnTotal(r);
    const s = saleById.get(r.sale_id);
    const vat = s && (s.tax_total || 0) > 0;
    for (const rl of r.lines || []) {
      const sl = s?.lines?.[rl.line_index] || s?.lines?.find((x) => x.product_id === rl.product_id);
      if (vat) retTax += taxInclusive(rl.amount || 0, sl?.tax_rate ?? taxRate(sl?.tax || 'B'));
      if (sl && rl.restock !== false) retCost += lineCost({ ...sl, qty: rl.qty }, vat);
    }
  }
  const ex = expensesSummary(expenses);
  // pay-outs are petty expenses — except supplier payments from the till (stock is costed through COGS, not as an expense)
  const isSupplierPay = (m) => m.purpose === 'supplier' || m.ref_type === 'supplier_payment' || /^supplier:/i.test(m.reason || '');
  const payouts = cashMoves.filter((m) => live(m) && m.type === 'pay_out' && !isSupplierPay(m)).reduce((a, m) => a + m.amount, 0);
  const vat = t.tax - retTax;
  const netSales = t.total - retTotal - vat;
  const cogs = t.cost - retCost;
  const gross = netSales - cogs;
  const totalExp = ex.total + payouts;
  const net = gross - totalExp;
  return { sales: t.total, count: t.count, returns: retTotal, vat, netSales, cogs, gross, grossMargin: netSales ? (gross / netSales) * 100 : 0, expenses: ex, payouts, totalExp, net, netMargin: netSales ? (net / netSales) * 100 : 0 };
}

/** Staff commission: services lines credit the line's staff, everything else the cashier. */
export function commission(sales, users) {
  const m = new Map();
  for (const s of sales) {
    if (!okSale(s)) continue;
    for (const l of s.lines) {
      const id = l.staff_id || s.user_id || '';
      const b = m.get(id) || { id, services: 0, other: 0, lines: 0 };
      if (l.staff_id) b.services += l.total || 0; else b.other += l.total || 0;
      b.lines++; m.set(id, b);
    }
  }
  return users.filter((u) => !u.deleted).map((u) => {
    const b = m.get(u.id) || { services: 0, other: 0, lines: 0 };
    const rate = u.commission_pct || 0;
    const base = b.services + b.other;
    return { id: u.id, name: u.name, role: u.role, rate, services: b.services, other: b.other, base, lines: b.lines, commission: Math.round((base * rate) / 100) };
  }).filter((r) => r.base > 0 || r.rate > 0).sort((a, b) => b.commission - a.commission || b.base - a.base);
}

/** Shift history rows. salesByShift: Map shift_id → {count,total} */
export function shiftRows(shifts, branchId) {
  return shifts.filter((s) => live(s) && (!branchId || s.branch_id === branchId)).map((s) => ({
    ...s, takings: Object.values(s.totals_by_method || {}).reduce((a, b) => a + b, 0), cash: (s.totals_by_method || {}).cash || 0, mpesa: (s.totals_by_method || {}).mpesa || 0
  })).sort((a, b) => b.opened_at - a.opened_at);
}

/** Percentage change, null when there is nothing to compare with. */
export const change = (now, before) => (before ? ((now - before) / Math.abs(before)) * 100 : null);
