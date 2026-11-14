// Shared figures for home widgets (cheap queries on the sales created_at index).
import { db } from '../../db/index.js';
import { startOfDay, DAY } from '../../lib/util.js';
import * as S from '../../state.js';

const VAT_PCT = { B: 16, E: 8 };

export async function salesBetween(from, to, branchId = S.branch.value?.id) {
  const rows = await db().sales.where('created_at').between(from, to, true, false).toArray();
  return rows.filter((s) => !s.deleted && s.status !== 'void' && (!s.branch_id || !branchId || s.branch_id === branchId));
}
export function summarize(sales) {
  let total = 0, cost = 0, tax = 0, items = 0;
  const hours = new Array(24).fill(0), byMethod = {}, byProduct = {};
  for (const s of sales) {
    total += s.total; tax += s.tax_total || 0;
    hours[new Date(s.created_at).getHours()] += s.total;
    for (const p of s.payments) byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
    const vat = (s.tax_total || 0) > 0;
    for (const l of s.lines) {
      // cost prices are what the shop pays (VAT included); a VAT-registered shop reclaims input VAT, so compare net with net
      const rate = vat ? (l.tax_rate ?? VAT_PCT[l.tax] ?? 0) / 100 : 0;
      cost += Math.round(((l.cost || 0) * l.qty * (l.factor || 1)) / (1 + rate));
      items += l.qty;
      const b = (byProduct[l.product_id] ||= { id: l.product_id, name: l.name, qty: 0, total: 0 });
      b.qty += l.qty; b.total += l.total;
    }
  }
  return { count: sales.length, total, profit: Math.round((total - tax - cost) / 100) * 100, avg: sales.length ? Math.round(total / sales.length / 100) * 100 : 0, hours, byMethod, top: Object.values(byProduct).sort((a, b) => b.total - a.total), items };
}
export async function homeFigures() {
  const t0 = startOfDay();
  const now = Date.now();
  const sinceMidnight = now - t0;
  const multi = (S.branches.value || []).filter((b) => !b.deleted).length > 1;
  const [today, yest, yestFull, lastWk, month, allToday, allYest] = await Promise.all([
    salesBetween(t0, t0 + DAY), salesBetween(t0 - DAY, t0 - DAY + sinceMidnight), salesBetween(t0 - DAY, t0), salesBetween(t0 - 7 * DAY, t0 - 7 * DAY + sinceMidnight), salesBetween(t0 - 29 * DAY, t0 + DAY),
    multi ? salesBetween(t0, t0 + DAY, null) : null, multi ? salesBetween(t0 - DAY, t0 - DAY + sinceMidnight, null) : null
  ]);
  const days = [];
  for (let i = 29; i >= 0; i--) { const d0 = t0 - i * DAY; days.push({ d0, total: 0, count: 0 }); }
  for (const s of month) { const i = Math.floor((s.created_at - (t0 - 29 * DAY)) / DAY); if (days[i]) { days[i].total += s.total; days[i].count++; } }
  let branches = null;
  if (multi) {
    branches = S.branches.value.filter((b) => !b.deleted).map((b) => {
      const a = allToday.filter((s) => s.branch_id === b.id), y = allYest.filter((s) => s.branch_id === b.id);
      return { id: b.id, name: b.name, count: a.length, total: a.reduce((x, s) => x + s.total, 0), yest: y.reduce((x, s) => x + s.total, 0) };
    }).sort((a, b) => b.total - a.total);
  }
  return { today: summarize(today), yest: summarize(yest), yestFull: summarize(yestFull), lastWk: summarize(lastWk), days, branches, at: now, mine: summarize(today.filter((s) => s.user_id === S.user.value?.id)) };
}
