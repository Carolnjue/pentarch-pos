// Demo history for reports: a month of realistic expenses (sized to the shop's gross profit, some paid from the till).
// Called by seed.js#seedDemo before its single write transaction. Supplier deliveries, purchase orders, supplier payments
// and returns are seeded in ONE place only — presets/seed-stock.js (Inventory & Purchasing) — so stock on hand,
// supplier balances and the purchases reports agree.
import { ulid } from '../lib/ulid.js';
import { dayKey, startOfDay, DAY } from '../lib/util.js';

const round50 = (c) => Math.max(5000, Math.round(c / 5000) * 5000); // cents → nearest KES 50
const H = 3600e3;

export function seedReportExtras({ now, rnd, pick, mpesaCode, business, branches, main, users, sales, shifts }) {
  const owner = users[0];
  const today0 = startOfDay(now);
  const first = today0 - 29 * DAY;
  const S = (r) => ({ ...r, created_at: r.created_at, updated_at: r.created_at, deleted: 0 });
  // ---------- expenses ----------
  business.settings.expense_categories = [{ id: 'c_security', name: 'Security (askari)' }];
  const expenses = [];
  const shiftOn = new Map(shifts.map((s) => [s.branch_id + '|' + startOfDay(s.opened_at), s]));
  for (const br of branches) {
    let gp = 0;
    for (const s of sales) {
      if (s.branch_id !== br.id || s.status === 'void') continue;
      const v = (s.tax_total || 0) > 0;
      let c = 0;
      for (const l of s.lines) c += ((l.cost || 0) * l.qty * (l.factor || 1)) / (v ? 1 + (l.tax_rate || 0) / 100 : 1);
      gp += s.total - (s.tax_total || 0) - c;
    }
    if (gp <= 0) continue;
    const budget = gp * (0.52 + rnd() * 0.16);
    const plan = [
      // [category, share of budget, occurrences, payees, method, from till?]
      ['rent', 0.3, 1, ['Landlord — Mr. Kamau', 'Plaza management'], 'bank'],
      ['salaries', 0.36, 1, ['Staff salaries'], 'mpesa'],
      ['salaries', 0.04, 3, ['Casual worker', 'Loader (day wage)'], 'cash', true],
      ['utilities', 0.05, 3, ['Kenya Power tokens'], 'mpesa'],
      ['utilities', 0.015, 1, ['Water bill'], 'mpesa'],
      ['transport', 0.06, 9, ['Boda boda', 'Matatu fare', 'Pick-up hire'], 'cash', true],
      ['airtime', 0.015, 4, ['Safaricom airtime', 'Safaricom Home Fibre'], 'mpesa'],
      ['supplies', 0.05, 4, ['Packaging bags', 'Cleaning supplies', 'Till rolls', 'Stationery'], 'cash', true],
      ['repairs', 0.03, 2, ['Fundi — shelves', 'Fridge repair', 'Plumber'], 'mpesa'],
      ['c_security', 0.025, 1, ['Askari — night guard'], 'mpesa'],
      ['other', 0.012, 2, ['County cleaning levy', 'Chama contribution'], 'mpesa']
    ];
    const lastMonthEnd = startOfDay(new Date(new Date(today0).getFullYear(), new Date(today0).getMonth(), 0).getTime());
    for (const [cat, share, n, payees, method, till] of plan) {
      const per = (budget * share * (br === main ? 1 : 0.5)) / n;
      for (let i = 0; i < n; i++) {
        let d0;
        if (cat === 'rent') d0 = startOfDay(new Date(new Date(today0).getFullYear(), new Date(today0).getMonth(), 1).getTime());
        else if (cat === 'salaries' && n === 1) d0 = lastMonthEnd >= first ? lastMonthEnd : today0 - 2 * DAY;
        else if (cat === 'c_security') d0 = Math.min(today0, startOfDay(new Date(new Date(today0).getFullYear(), new Date(today0).getMonth(), 5).getTime()));
        else d0 = first + Math.floor(((i + rnd() * 0.8) / n) * 30) * DAY;
        if (d0 > today0) d0 = today0;
        const at = Math.min(now - 30 * 60e3, d0 + (9 + Math.floor(rnd() * 8)) * H + Math.floor(rnd() * H));
        if (at < first) continue;
        const amount = round50(per * (0.75 + rnd() * 0.5));
        const m = till ? (rnd() < 0.8 ? 'cash' : 'mpesa') : method;
        let shift_id = null;
        const sh = m === 'cash' && till && rnd() < 0.75 ? shiftOn.get(br.id + '|' + startOfDay(at)) : null;
        if (sh && at > sh.opened_at && (!sh.closed_at || at < sh.closed_at)) {
          shift_id = sh.id;
          if (sh.status === 'closed') { sh.expected_cash -= amount; sh.counted_cash -= amount; }
        }
        expenses.push(S({ id: ulid(at), branch_id: br.id, category: cat, amount, method: m, payee: pick(payees), ref: m === 'mpesa' ? mpesaCode() : '', note: '', shift_id, user_id: shift_id ? sh.user_id : owner.id, date: dayKey(at), created_at: at }));
      }
    }
  }
  return { expenses };
}
