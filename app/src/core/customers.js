// Customer accounts: balances, open invoices, payments (oldest-first allocation), aging.
import { db } from '../db/index.js';
import { save, audit } from '../db/repo.js';
import { DAY } from '../lib/util.js';
import * as S from '../state.js';

/** Credit sales with outstanding amounts (oldest first) + totals. */
export async function account(customerId) {
  const [sales, pays, rets] = await Promise.all([
    db().sales.where('customer_id').equals(customerId).toArray(),
    db().customer_payments.where('customer_id').equals(customerId).toArray(),
    db().returns.toArray()
  ]);
  const live = sales.filter((s) => !s.deleted).sort((a, b) => a.created_at - b.created_at);
  const paidTo = {};
  let unallocated = 0;
  for (const p of pays) {
    if (p.deleted) continue;
    if (p.allocations?.length) for (const a of p.allocations) paidTo[a.sale_id] = (paidTo[a.sale_id] || 0) + a.amount;
    else unallocated += p.amount;
  }
  const creditRefunds = {};
  for (const r of rets) if (!r.deleted && r.customer_id === customerId) for (const f of r.refund || []) if (f.method === 'credit') creditRefunds[r.sale_id] = (creditRefunds[r.sale_id] || 0) + f.amount;
  const invoices = [];
  for (const s of live) {
    if (s.status === 'void' || !s.balance) continue;
    const due = s.balance - (paidTo[s.id] || 0) - (creditRefunds[s.id] || 0);
    invoices.push({ sale: s, due: Math.max(0, due), paid: paidTo[s.id] || 0 });
  }
  // apply legacy unallocated payments oldest-first
  for (const inv of invoices) { if (unallocated <= 0) break; const a = Math.min(inv.due, unallocated); inv.due -= a; unallocated -= a; }
  const balance = invoices.reduce((s, i) => s + i.due, 0) - unallocated;
  const spent = live.filter((s) => s.status !== 'void').reduce((s, x) => s + x.total, 0);
  return { sales: live, payments: pays.filter((p) => !p.deleted).sort((a, b) => b.created_at - a.created_at), invoices, open: invoices.filter((i) => i.due > 0), balance, spent, lastVisit: live[live.length - 1]?.created_at || null };
}

export function agingBuckets(open, now = Date.now()) {
  const b = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  for (const i of open) {
    const age = (now - i.sale.created_at) / DAY;
    b[age <= 30 ? '0-30' : age <= 60 ? '31-60' : age <= 90 ? '61-90' : '90+'] += i.due;
  }
  return b;
}

/** Balances for all customers (one pass) → Map id → balance */
export async function allBalances() {
  const [sales, pays, rets] = await Promise.all([db().sales.where('customer_id').above('').toArray(), db().customer_payments.toArray(), db().returns.toArray()]);
  const m = new Map();
  for (const s of sales) if (!s.deleted && s.status !== 'void' && s.balance) m.set(s.customer_id, (m.get(s.customer_id) || 0) + s.balance);
  for (const p of pays) if (!p.deleted) m.set(p.customer_id, (m.get(p.customer_id) || 0) - p.amount);
  for (const r of rets) if (!r.deleted && r.customer_id) for (const f of r.refund || []) if (f.method === 'credit') m.set(r.customer_id, (m.get(r.customer_id) || 0) - f.amount);
  return m;
}

/** Receive a payment and allocate oldest invoice first. */
export async function receivePayment(customer, amount, method, ref) {
  const acc = await account(customer.id);
  let left = amount;
  const allocations = [];
  for (const inv of acc.open) { if (left <= 0) break; const a = Math.min(left, inv.due); allocations.push({ sale_id: inv.sale.id, no: inv.sale.no, amount: a }); left -= a; }
  const rec = await save('customer_payments', {
    customer_id: customer.id, amount, method, ref: ref || '', sale_ids: allocations.map((a) => a.sale_id), allocations, user_id: S.user.value?.id, shift_id: S.shift.value?.id || null
  }, { audit: { action: 'customer.payment', details: { customer: customer.name, amount, method } } });
  return { rec, allocations, overpaid: left };
}
export { audit };
