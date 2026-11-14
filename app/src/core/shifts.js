// Cash & shifts: open, cash moves, summary (X report), close with denomination count (Z report).
import { db } from '../db/index.js';
import { save, audit } from '../db/repo.js';
import { emit } from '../lib/bus.js';
import * as S from '../state.js';

export const DENOMS = [100000, 50000, 20000, 10000, 5000, 4000, 2000, 1000, 500, 100]; // cents: KES 1000 … 1

export async function openShift(float, notes = '') {
  const rec = await save('shifts', {
    branch_id: S.branch.value?.id, device_id: S.device.value.id, user_id: S.user.value?.id, opened_at: Date.now(), opening_float: float,
    closed_at: null, counted_cash: 0, expected_cash: 0, variance: 0, totals_by_method: {}, notes, status: 'open'
  }, { audit: { action: 'shift.open', details: { float } } });
  S.shift.value = rec;
  return rec;
}

export async function cashMove(type, amount, reason) {
  if (!S.shift.value) throw new Error('No open shift');
  const rec = await save('cash_moves', { shift_id: S.shift.value.id, type, amount, reason, user_id: S.user.value?.id }, { audit: { action: 'cash.' + type, details: { amount, reason } } });
  emit('change', 'cash_moves', [rec.id]);
  return rec;
}

/** Full shift summary — used for the X report (any time) and Z report (on close). */
export async function shiftSummary(shift) {
  const [sales, moves, rets, pays, exps] = await Promise.all([
    db().sales.where('shift_id').equals(shift.id).toArray(),
    db().cash_moves.where('shift_id').equals(shift.id).toArray(),
    db().returns.where('shift_id').equals(shift.id).toArray(),
    db().customer_payments.where('shift_id').equals(shift.id).toArray(),
    db().expenses.where('shift_id').equals(shift.id).toArray()
  ]);
  const ok = sales.filter((s) => !s.deleted && s.status !== 'void');
  const voids = sales.filter((s) => s.status === 'void');
  const byMethod = {};
  let gross = 0, disc = 0, tax = 0, cost = 0;
  for (const s of ok) {
    gross += s.total; disc += s.discount || 0; tax += s.tax_total || 0;
    for (const l of s.lines) cost += Math.round((l.cost || 0) * l.qty * (l.factor || 1));
    for (const p of s.payments) byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
  }
  const refunds = {};
  for (const r of rets) for (const f of r.refund || []) refunds[f.method] = (refunds[f.method] || 0) + f.amount;
  const cm = { pay_in: 0, pay_out: 0, drop: 0 };
  for (const m of moves) if (!m.deleted) cm[m.type] = (cm[m.type] || 0) + m.amount;
  const debtCash = pays.filter((p) => p.method === 'cash').reduce((s, p) => s + p.amount, 0);
  const debtBy = {};
  for (const p of pays) debtBy[p.method] = (debtBy[p.method] || 0) + p.amount;
  const expCash = exps.filter((e) => e.method === 'cash' && !e.deleted).reduce((s, e) => s + e.amount, 0);
  const expected = shift.opening_float + (byMethod.cash || 0) - (refunds.cash || 0) + cm.pay_in - cm.pay_out - cm.drop + debtCash - expCash;
  return {
    shift, sales: ok.length, voids: voids.length, voidTotal: voids.reduce((s, x) => s + x.total, 0), gross, discount: disc, tax, cost, profit: gross - tax - cost,
    byMethod, refunds, refundTotal: Object.values(refunds).reduce((a, b) => a + b, 0), returns: rets.length, cashMoves: cm, moves,
    debtPayments: debtBy, expensesCash: expCash, expected, items: ok.reduce((s, x) => s + x.lines.length, 0)
  };
}

export async function closeShift(shift, counted, denominations, notes) {
  const sum = await shiftSummary(shift);
  const variance = counted - sum.expected;
  const rec = await save('shifts', {
    ...shift, closed_at: Date.now(), counted_cash: counted, expected_cash: sum.expected, variance, denominations,
    totals_by_method: sum.byMethod, notes: notes || shift.notes || '', status: 'closed', closed_by: S.user.value?.id
  }, { audit: { action: 'shift.close', details: { expected: sum.expected, counted, variance } } });
  if (S.shift.value?.id === shift.id) S.shift.value = null;
  return { rec, sum: { ...sum, shift: rec } };
}
export { audit };
