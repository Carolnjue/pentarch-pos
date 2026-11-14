// Expenses: record (optionally paid from the till → reduces the open shift's expected cash), delete (soft), categories.
import { db } from '../../db/index.js';
import { save, patch } from '../../db/repo.js';
import { saveBusiness } from '../../auth/session.js';
import { dayKey } from '../../lib/util.js';
import { ulid } from '../../lib/ulid.js';
import { customCats } from './cats.js';
import * as S from '../../state.js';

/** e: {category, amount (cents), method, payee, ref, note, date (yyyy-mm-dd), fromDrawer} */
export async function recordExpense(e) {
  if (!(e.amount > 0)) throw new Error('Amount must be more than zero');
  const drawer = !!(e.fromDrawer && e.method === 'cash' && S.shift.value);
  const rec = {
    branch_id: S.branch.value?.id, category: e.category || 'other', amount: Math.round(e.amount), method: e.method || 'cash', payee: (e.payee || '').trim(),
    ref: (e.ref || '').trim(), note: (e.note || '').trim(), shift_id: drawer ? S.shift.value.id : null, user_id: S.user.value?.id || null, date: e.date || dayKey(Date.now())
  };
  return save('expenses', rec, { audit: { action: 'expense.create', details: { category: rec.category, amount: rec.amount, payee: rec.payee, from_till: drawer } } });
}
/** Expenses are a ledger: deleting marks the row deleted (synced) and is audited. */
export const deleteExpense = (x) => patch('expenses', x.id, { deleted: 1 }, { force: true, audit: { action: 'expense.delete', details: { category: x.category, amount: x.amount, payee: x.payee } } });
export const restoreExpense = (x) => patch('expenses', x.id, { deleted: 0 }, { force: true, audit: { action: 'expense.restore', details: { category: x.category, amount: x.amount } } });

export async function expensesForMonth(y, m) {
  const a = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const b = `${y}-${String(m + 1).padStart(2, '0')}-31`;
  return (await db().expenses.where('date').between(a, b, true, true).toArray()).filter((x) => !x.deleted);
}
/** Recent payees for quick fill (most used first). */
export async function recentPayees(limit = 12) {
  const rows = await db().expenses.orderBy('date').reverse().limit(300).toArray();
  const m = new Map();
  for (const r of rows) if (!r.deleted && r.payee) { const k = r.payee.trim(); const v = m.get(k) || { payee: k, category: r.category, n: 0 }; v.n++; m.set(k, v); }
  return [...m.values()].sort((a, b) => b.n - a.n).slice(0, limit);
}

export async function addCategory(name) {
  const n = name.trim();
  if (!n) return null;
  const list = customCats();
  const ex = list.find((c) => c.name.toLowerCase() === n.toLowerCase());
  if (ex) { if (ex.hidden) await saveBusiness({ settings: { expense_categories: list.map((c) => (c.id === ex.id ? { ...c, hidden: false } : c)) } }, 'expense.category'); return ex; }
  const c = { id: 'c_' + ulid().slice(-8).toLowerCase(), name: n };
  await saveBusiness({ settings: { expense_categories: [...list, c] } }, 'expense.category');
  return c;
}
export async function hideCategory(id) {
  await saveBusiness({ settings: { expense_categories: customCats().map((c) => (c.id === id ? { ...c, hidden: true } : c)) } }, 'expense.category');
}
