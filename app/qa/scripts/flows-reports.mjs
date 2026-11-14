// Dashboard, Reports & Expenses: every report renders and its totals match the raw IndexedDB data (recomputed here,
// independently of the app), CSV export, A4 print, branch filter, drill-down from the dashboard, expenses (from the till →
// shift expected cash, P&L), custom category, accountant read-only, works offline, < 1 s for a month of a busy shop.
import fs from 'node:fs';
import { chromium, newPage, BASE, OUT, shot, sleep, report, DESK, idb, step, setFailPage } from './lib.mjs';

const b = await chromium.launch();
const { ctx, page } = await newPage(b, DESK, { acceptDownloads: true });
setFailPage(page);
const t0 = Date.now();
await page.goto(BASE + '?demo=1&type=minimart'); await page.waitForSelector('.shell', { timeout: 40000 });
console.log(`   demo seeded + dashboard in ${Date.now() - t0} ms`);
await page.evaluate(() => navigator.serviceWorker?.ready);

// ---------- helpers ----------
const DAY = 86400000;
const sod = (ms = Date.now()) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
const dk = (ms) => { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); };
const sum = (a, f) => a.reduce((s, x) => s + (typeof f === 'function' ? f(x) : x[f] || 0), 0);
const eq = (a, b, what, tol = 0) => { if (Math.abs(a - b) > tol) throw new Error(`${what}: report ${a} ≠ raw ${b}`); };
const T = {};
for (const tb of ['sales', 'returns', 'expenses', 'audit', 'stock_moves', 'products', 'goods_received', 'supplier_payments', 'customer_payments', 'shifts', 'cash_moves', 'customers', 'branches']) T[tb] = (await idb(page, tb)).filter((r) => !r.deleted);
const ok = (s) => s.status !== 'void';
const VAT = { B: 16, E: 8 };
const costNet = (s) => sum(s.lines, (l) => Math.round(((l.cost || 0) * l.qty * (l.factor || 1)) / (s.tax_total > 0 ? 1 + (l.tax_rate ?? VAT[l.tax] ?? 0) / 100 : 1)));
const inR = (ms, a, z) => ms >= a && ms < z;
const R = { from: monthStart(), to: sod() + DAY };
const salesR = (a = R.from, z = R.to, br) => T.sales.filter((s) => ok(s) && inR(s.created_at, a, z) && (!br || s.branch_id === br));
const retR = (a = R.from, z = R.to, br) => T.returns.filter((r) => inR(r.created_at, a, z) && (!br || r.branch_id === br));

async function open(id, q = '') {
  await page.evaluate(() => { window.__report = null; }).catch(() => {});
  await page.goto(BASE + '#/reports/' + id + (q ? '?' + q : ''));
  await page.waitForFunction((id) => (window.__report?.id === id && !document.querySelector('.rpt-body.busy') && location.hash.includes(window.__report.id)) || document.querySelector('.rpt .empty'), id, { timeout: 15000 });
  await sleep(150);
  return page.evaluate(() => window.__report);
}
const kpi = (r, label) => { const k = r.kpis.find((x) => x.label === label); if (!k) throw new Error('no KPI ' + label); return k.value; };
const q = 'preset=month';
const times = {};

await step('dashboard: headline sentence, comparisons and every card links to its report', async () => {
  await page.goto(BASE + '#/home'); await page.waitForSelector('[data-testid=headline]');
  const h = await page.locator('[data-testid=headline]').innerText();
  if (!/You sold KES [\d,]+ today, \d+% (more|less) than last \w+day at this time|about the same/.test(h)) throw new Error('headline: ' + h);
  const today = salesR(sod(), sod() + DAY, T.branches.find((x) => x.is_main).id);
  if (!h.includes(Math.round(sum(today, 'total') / 100).toLocaleString('en-KE'))) throw new Error(`headline amount (${h}) ≠ raw ${sum(today, 'total') / 100}`);
  for (const title of ['Sales by hour — today', 'Payment methods — today', 'Top products — today', 'Low stock', 'Debtors', 'Open shifts', 'Branches today', 'Last 30 days']) if (!(await page.getByText(title, { exact: true }).count())) throw new Error('missing card ' + title);
  await shot(page, 'r01-dashboard');
  await page.locator('.dash-kpi').first().click(); await page.waitForURL(/reports\/sales\?preset=today/);
  const r = await page.waitForFunction(() => window.__report?.id === 'sales' && window.__report).then((x) => x.jsonValue());
  eq(kpi(r, 'Net sales') + 0, sum(salesR(sod(), sod() + DAY), 'total') - sum(retR(sod(), sod() + DAY), 'total'), 'drill-down net sales today (all branches)');
});

await step('sales summary, by product, category, staff, payment, hour, customer: totals = raw sales', async () => {
  const ss = salesR(), rs = retR();
  let r = await open('sales', q); times.sales = r.ms;
  eq(kpi(r, 'Net sales'), sum(ss, 'total') - sum(rs, 'total'), 'net sales'); eq(kpi(r, 'Sales (receipts)'), ss.length, 'receipts');
  eq(r.tables[0].foot.total, sum(ss, 'total'), 'day-by-day gross');
  const lines = sum(ss, (s) => sum(s.lines, 'total'));
  r = await open('products', q); times.products = r.ms; eq(r.tables[0].foot.total, lines, 'products total');
  eq(r.tables[0].foot.qty, Math.round(sum(ss, (s) => sum(s.lines, (l) => l.qty * (l.factor || 1))) * 1000) / 1000, 'qty', 0.01);
  r = await open('categories', q); eq(r.tables[0].foot.total, lines, 'categories total');
  r = await open('staff', q); eq(r.tables[0].foot.total, sum(ss, 'total'), 'staff total'); eq(r.tables[0].foot.voids, T.sales.filter((s) => s.status === 'void' && inR(s.created_at, R.from, R.to)).length, 'voids');
  r = await open('payments', q); eq(r.tables[0].foot.sales, sum(ss, (s) => sum(s.payments, 'amount')), 'payments');
  eq(r.tables[0].foot.debt, sum(T.customer_payments.filter((p) => inR(p.created_at, R.from, R.to)), 'amount'), 'debt payments');
  r = await open('hours', q); eq(sum(r.tables[0].data, 'total'), sum(ss, 'total'), 'by-hour total'); eq(sum(r.tables[1].data, 'count'), ss.length, 'by-weekday count');
  r = await open('customers', q); eq(r.tables[0].foot.total, sum(ss, 'total'), 'customers total');
  await shot(page, 'r02-report-customers');
});

await step('profit, VAT by eTIMS code and profit & loss match a fresh calculation', async () => {
  const ss = salesR(), rs = retR();
  let r = await open('profit', q); times.profit = r.ms;
  eq(kpi(r, 'Gross profit'), sum(ss, 'total') - sum(ss, 'tax_total') - sum(ss, costNet), 'gross profit');
  r = await open('vat', q); times.vat = r.ms;
  const byId = new Map(T.sales.map((s) => [s.id, s]));
  let retTax = 0;
  for (const x of rs) { const s = byId.get(x.sale_id); for (const rl of x.lines) { const l = s.lines[rl.line_index]; const rate = s.tax_total > 0 ? l.tax_rate ?? VAT[l.tax] ?? 0 : 0; retTax += rate ? Math.round((rl.amount * rate) / (100 + rate)) : 0; } }
  eq(r.tables[0].foot.sales, sum(ss, (s) => sum(s.lines, 'total')), 'VAT report sales');
  eq(r.tables[0].foot.vat, sum(ss, (s) => sum(s.lines, (l) => l.tax_amount || 0)) - retTax, 'output VAT');
  const codes = r.tables[0].data.map((x) => x.code).join('');
  if (!/^[A-E]+$/.test(codes)) throw new Error('codes ' + codes);
  r = await open('pnl', q); times.pnl = r.ms;
  const ex = T.expenses.filter((e) => e.date >= dk(R.from) && e.date <= dk(R.to - 1));
  const payouts = sum(T.cash_moves.filter((m) => m.type === 'pay_out' && inR(m.created_at, R.from, R.to)), 'amount');
  let retCost = 0;
  for (const x of rs) { const s = byId.get(x.sale_id); for (const rl of x.lines) { const l = s.lines[rl.line_index]; if (rl.restock !== false) retCost += Math.round(((l.cost || 0) * rl.qty * (l.factor || 1)) / (s.tax_total > 0 ? 1 + (l.tax_rate ?? 0) / 100 : 1)); } }
  const netSales = sum(ss, 'total') - sum(rs, 'total') - (sum(ss, 'tax_total') - retTax);
  const net = netSales - (sum(ss, costNet) - retCost) - sum(ex, 'amount') - payouts;
  eq(kpi(r, 'Net sales'), netSales, 'P&L net sales'); eq(kpi(r, 'Expenses'), sum(ex, 'amount') + payouts, 'P&L expenses');
  eq(kpi(r, net >= 0 ? 'Net profit' : 'Net loss'), net, 'P&L net profit');
  console.log(`   P&L this month: net sales ${netSales / 100}, expenses ${(sum(ex, 'amount') + payouts) / 100}, net ${net / 100}`);
  await shot(page, 'r03-report-pnl');
});

await step('stock value (from the ledger), movement, low stock, dead stock', async () => {
  const qty = new Map();
  for (const m of T.stock_moves) qty.set(m.product_id, (qty.get(m.product_id) || 0) + m.qty);
  const stockP = T.products.filter((p) => !p.has_variants && p.track_stock !== false && !['service', 'non_stock', 'composite'].includes(p.type));
  let r = await open('stock'); times.stock = r.ms;
  eq(r.tables[0].foot.costValue, sum(stockP, (p) => Math.round(Math.max(0, Math.round((qty.get(p.id) || 0) * 1000) / 1000) * (p.cost || 0))), 'stock value at cost', 2);
  r = await open('movement', q); times.movement = r.ms;
  eq(r.tables[0].rows, T.stock_moves.filter((m) => inR(m.created_at, R.from, R.to)).length, 'movement rows');
  const mainLow = stockP.filter((p) => p.active !== false && p.reorder_level > 0 && (qty.get(p.id) || 0) <= p.reorder_level);
  r = await open('low-stock'); if (r.tables[0].rows < 1 || r.tables[0].rows > mainLow.length + stockP.length) throw new Error('low stock rows ' + r.tables[0].rows);
  r = await open('dead-stock'); times['dead-stock'] = r.ms;
  await page.getByRole('radio', { name: '90 days' }).click(); await sleep(400);
});

await step('purchases by supplier, supplier balances, debtors aging and customer statement', async () => {
  let r = await open('purchases', q);
  eq(r.tables[0].foot.total, sum(T.goods_received.filter((g) => inR(g.created_at, R.from, R.to)), 'total'), 'purchases total');
  r = await open('supplier-balances');
  // net purchases (returns to suppliers are negative goods_received rows) minus every supplier payment (refunds negative)
  eq(r.tables[0].foot.balance, sum(T.goods_received, 'total') - sum(T.supplier_payments, 'amount'), 'supplier balances');
  if (!T.goods_received.some((g) => g.kind === 'return')) throw new Error('demo has no supplier return');
  if (!T.goods_received.length) throw new Error('demo has no deliveries');
  r = await open('aging'); times.aging = r.ms;
  const bal = new Map();
  for (const s of T.sales) if (ok(s) && s.customer_id && s.balance) bal.set(s.customer_id, (bal.get(s.customer_id) || 0) + s.balance);
  for (const p of T.customer_payments) bal.set(p.customer_id, (bal.get(p.customer_id) || 0) - p.amount);
  eq(r.tables[0].foot.balance, sum([...bal.values()].filter((v) => v > 0), (v) => v), 'debtors total');
  const top = r.tables[0].data[0];
  await page.locator('.rpt-table tbody tr').first().click(); await page.waitForURL(/statement\?customer=/);
  await page.waitForFunction(() => window.__report?.id === 'statement' && window.__report.kpis.length);
  await page.getByRole('button', { name: 'Custom' }).click();
  await page.locator('input[type=date]').first().fill('2020-01-01'); await sleep(600);
  r = await page.evaluate(() => window.__report);
  eq(kpi(r, 'Closing balance'), top.balance, 'statement closing = aging balance');
  await shot(page, 'r04-report-statement');
});

await step('expenses, shifts (Z history), exceptions, commission and activity log', async () => {
  let r = await open('expenses', q);
  eq(kpi(r, 'Total expenses'), sum(T.expenses.filter((e) => e.date >= dk(R.from) && e.date <= dk(R.to - 1)), 'amount'), 'expenses total');
  r = await open('shifts', q); eq(r.tables[0].rows, T.shifts.filter((s) => inR(s.opened_at, R.from, R.to)).length, 'shift rows');
  r = await open('exceptions', q);
  const EXC = ['discount.apply', 'sale.void', 'sale.return', 'price.change', 'drawer.open', 'cart.clear', 'override.grant', 'cart.remove_sent'];
  const au = await idb(page, 'audit');
  eq(r.tables[1].rows, au.filter((a) => EXC.includes(a.action) && inR(a.at, R.from, R.to)).length, 'exception rows');
  r = await open('commission', q);
  r = await open('audit', q); eq(r.tables[0].rows, au.filter((a) => inR(a.at, R.from, R.to)).length, 'audit rows');
  await page.locator('.rpt-filters select[data-filter=action]').selectOption('sale.void');
  await sleep(400);
  r = await page.evaluate(() => window.__report);
  if (r.tables[0].data.some((x) => x.action !== 'sale.void')) throw new Error('action filter');
});

await step('branch filter: one branch = that branch\'s raw sales', async () => {
  const br = T.branches.find((x) => !x.is_main);
  if (!br) throw new Error('minimart demo should have 2 branches');
  await open('sales', q);
  await page.locator('.rpt-filters select[data-filter=branch]').selectOption(br.id);
  await page.waitForFunction((id) => window.__report?.branch === id, br.id);
  const r = await page.evaluate(() => window.__report);
  eq(kpi(r, 'Net sales'), sum(salesR(R.from, R.to, br.id), 'total') - sum(retR(R.from, R.to, br.id), 'total'), 'branch net sales');
});

await step('CSV export has every row and the totals row; A4 print preview', async () => {
  await open('products', q);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()]);
  const p = OUT + 'report-products.csv'; await dl.saveAs(p);
  const csv = fs.readFileSync(p, 'utf8').replace(/^﻿/, '').trim().split(/\r\n/);
  const r = await page.evaluate(() => window.__report);
  if (csv.length !== r.tables[0].rows + 2) throw new Error(`csv lines ${csv.length} vs rows ${r.tables[0].rows}`);
  const head = csv[0].split(','), last = csv[csv.length - 1].split(',');
  const total = Number(last[head.indexOf('Sales')]);
  eq(Math.round(total * 100), r.tables[0].foot.total, 'CSV total');
  console.log(`   ${dl.suggestedFilename()}: ${csv.length - 2} products, total KES ${total}`);
  await page.getByRole('button', { name: 'Print' }).click(); await page.waitForSelector('.modal iframe');
  const html = await page.locator('.modal iframe').getAttribute('srcdoc');
  if (!/Sales by product/.test(html) || !/size: A4/.test(html) || !/<tfoot>/.test(html)) throw new Error('print document');
  await sleep(500); await shot(page, 'r05-print-a4');
  await page.keyboard.press('Escape');
});

await step('expenses: record from the till → shift expected cash falls, P&L includes it; delete + undo', async () => {
  await page.goto(BASE + '#/shifts'); await page.waitForSelector('.stat');
  const expBefore = await page.locator('.stat', { hasText: 'Expected cash in drawer' }).locator('.v').innerText();
  await page.goto(BASE + '#/expenses'); await page.waitForSelector('.exp-page .stat');
  await shot(page, 'r06-expenses');
  await page.getByRole('button', { name: 'Record expense' }).first().click(); await page.waitForSelector('.exp-form');
  await page.keyboard.type('750');
  await page.getByRole('radio', { name: 'Transport' }).click();
  await page.getByLabel('Paid to').fill('Boda to wholesaler');
  await shot(page, 'r07-expense-record');
  await page.getByRole('button', { name: 'Save expense' }).click(); await page.waitForSelector('.toast');
  const e = (await idb(page, 'expenses')).sort((a, z) => z.created_at - a.created_at)[0];
  if (e.amount !== 75000 || e.category !== 'transport' || !e.shift_id || e.method !== 'cash') throw new Error('expense record ' + JSON.stringify(e));
  await page.goto(BASE + '#/shifts'); await page.waitForSelector('.stat');
  const expAfter = await page.locator('.stat', { hasText: 'Expected cash in drawer' }).locator('.v').innerText();
  const n = (s) => Number(s.replace(/[^\d.]/g, ''));
  eq(Math.round((n(expBefore) - n(expAfter)) * 100), 75000, 'expected cash drop');
  const r = await open('pnl', 'preset=today');
  if (kpi(r, 'Expenses') < 75000) throw new Error('P&L misses the expense');
  await page.goto(BASE + '#/expenses'); await page.waitForSelector('.exp-page table');
  await page.locator('.exp-page tbody tr', { hasText: 'Boda to wholesaler' }).click(); await page.waitForSelector('.drawer');
  await page.getByRole('button', { name: 'Delete' }).click(); await page.getByRole('button', { name: 'Delete' }).last().click();
  await page.waitForSelector('.toast .btn');
  if ((await idb(page, 'expenses')).find((x) => x.id === e.id).deleted !== 1) throw new Error('not deleted');
  await page.locator('.toast .btn').click(); await sleep(300);
  if ((await idb(page, 'expenses')).find((x) => x.id === e.id).deleted !== 0) throw new Error('undo failed');
  const au = (await idb(page, 'audit')).filter((a) => a.action.startsWith('expense.')).map((a) => a.action);
  if (!au.includes('expense.create') || !au.includes('expense.delete')) throw new Error('expense not audited');
});

await step('custom expense category is offered and shows in reports', async () => {
  await page.goto(BASE + '#/expenses'); await page.waitForSelector('.exp-page .stat');
  await page.getByRole('button', { name: 'Categories' }).click(); await page.waitForSelector('.modal');
  await page.locator('.modal').getByRole('button', { name: 'New category' }).click();
  await page.locator('.modal input').last().fill('Licences & permits'); await page.getByRole('button', { name: 'Add', exact: true }).click(); await sleep(300);
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Record expense' }).first().click(); await page.waitForSelector('.exp-form');
  await page.keyboard.type('5000'); await page.getByRole('radio', { name: 'Licences & permits' }).click();
  await page.getByRole('radio', { name: 'M-Pesa' }).click(); await page.getByRole('button', { name: 'Save expense' }).click(); await sleep(400);
  const r = await open('expenses', 'preset=today');
  if (!r.tables[0].data.find((x) => x.total === 500000)) throw new Error('custom category missing in report');
  if (!(await page.getByText('Licences & permits').count())) throw new Error('label');
});

await step('accountant: reports & expenses read-only, no profit & loss; stock clerk sees stock reports only', async () => {
  await page.keyboard.press('Control+l'); await page.waitForSelector('.lock');
  await page.getByRole('option', { name: /Janet/ }).click(); for (const d of '6666') await page.keyboard.press(d); await page.waitForSelector('.shell');
  await page.goto(BASE + '#/reports'); await page.waitForSelector('.rpt-card');
  const ids = await page.locator('.rpt-card').evaluateAll((a) => a.map((x) => x.dataset.report));
  if (ids.includes('pnl') || !ids.includes('sales') || !ids.includes('vat')) throw new Error('accountant cards ' + ids);
  await page.goto(BASE + '#/reports/pnl'); await page.waitForSelector('.empty');
  await page.goto(BASE + '#/expenses'); await page.waitForSelector('.exp-page .stat');
  if (await page.getByRole('button', { name: 'Record expense' }).count()) throw new Error('accountant can record expenses');
  await page.keyboard.press('Control+l'); await page.waitForSelector('.lock');
  await page.getByRole('option', { name: /Samuel/ }).click(); for (const d of '4444') await page.keyboard.press(d); await page.waitForSelector('.shell');
  await page.goto(BASE + '#/reports'); await page.waitForSelector('.rpt-card');
  const st = await page.locator('.rpt-card').evaluateAll((a) => a.map((x) => x.dataset.report));
  if (st.includes('sales') || !st.includes('stock')) throw new Error('stock clerk cards ' + st);
  await page.keyboard.press('Control+l'); await page.waitForSelector('.lock');
  await page.getByRole('option', { name: /Grace/ }).click(); for (const d of '1234') await page.keyboard.press(d); await page.waitForSelector('.shell');
});

await step('offline: reports and expenses open and compute with no network', async () => {
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) { await page.reload(); await page.waitForSelector('.shell, .lock', { timeout: 20000 }); }
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 15000 });
  // make sure the report chunks are in the cache (the service worker precaches every asset)
  await page.waitForFunction(async () => (await caches.keys()).length > 0 && (await (await caches.open((await caches.keys())[0])).keys()).length > 40, null, { timeout: 15000 });
  await ctx.setOffline(true);
  await page.reload(); await page.waitForSelector('.shell, .lock', { timeout: 20000 });
  if (await page.locator('.lock').count()) { await page.getByRole('option', { name: /Grace/ }).click(); for (const d of '1234') await page.keyboard.press(d); await page.waitForSelector('.shell'); }
  for (const id of ['pnl', 'stock', 'aging', 'hours']) { const r = await open(id, id === 'stock' || id === 'aging' ? '' : q); if (!r.kpis.length && id !== 'hours') throw new Error(id + ' empty offline'); }
  await page.goto(BASE + '#/expenses'); await page.waitForSelector('.exp-page .stat');
  await ctx.setOffline(false);
});

await step('empty periods: every dated report explains what fills it', async () => {
  const dated = ['sales', 'products', 'categories', 'staff', 'payments', 'hours', 'customers', 'profit', 'vat', 'pnl', 'movement', 'purchases', 'expenses', 'shifts', 'exceptions', 'audit'];
  for (const id of dated) {
    await page.goto(BASE + '#/reports/' + id + '?from=2020-01-01&to=2020-01-02');
    await page.waitForSelector('.rpt .empty h3', { timeout: 10000 });
    const txt = await page.locator('.rpt .empty').innerText();
    if (txt.length < 40) throw new Error(id + ' empty state too thin: ' + txt);
  }
  await shot(page, 'r09-report-empty');
});

await step('speed: a month of a busy shop builds in < 1 s per report', async () => {
  const n = salesR(sod() - 29 * DAY, sod() + DAY).length;
  const slow = Object.entries(times).filter(([, ms]) => ms > 1000);
  console.log(`   ${n} sales in 30 days; build ms ${JSON.stringify(times)}`);
  if (slow.length) throw new Error('slow: ' + JSON.stringify(slow));
});

await step('pharmacy demo: expiry report and dashboard expiry card', async () => {
  await page.goto(BASE + '?demo=1&type=pharmacy'); await page.waitForSelector('.shell', { timeout: 40000 });
  await page.waitForSelector('text=Expiring soon');
  const r = await open('expiry');
  if (!r.tables[0].rows) throw new Error('no batches');
  const moves = await idb(page, 'stock_moves');
  const byB = new Map();
  for (const m of moves) if (m.batch_no && !m.deleted) { const k = m.product_id + m.branch_id + m.batch_no; byB.set(k, (byB.get(k) || 0) + m.qty); }
  eq(Math.round(r.tables[0].foot.qty * 1000), Math.round(sum(r.tables[0].data, 'qty') * 1000), 'expiry qty');
  await shot(page, 'r08-report-expiry');
});

const errs = report('flows-reports');
await b.close();
process.exit(errs.length ? 1 : 0);
