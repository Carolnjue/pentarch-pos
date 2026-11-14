// Report definitions. Each report: {id, group, icon, title, desc, perm, range, filters, run(ctx)} → result
// result: {sentence, kpis:[{label, value, kind, sub, tone}], charts:[{title, render, wide}], tables:[{title, columns, rows, foot, rowClick, empty}], empty}
// Columns: {key, label, kind:'text'|'money'|'int'|'qty'|'pct'|'date'|'datetime', get(row), text(row) (print/CSV), render(row) (screen), hideMobile}
import * as E from './engine.js';
import * as D from './data.js';
import { Bars, HBars, Heat, Stack, C, SERIES, METHOD_COLORS } from './viz.jsx';
import { Donut } from '../../ui/charts.jsx';
import { Badge } from '../../ui/kit.jsx';
import { kes, money } from '../../lib/money.js';
const m0 = (v) => money(Math.round((v || 0) / 100) * 100);
import { DAY, startOfDay, dayKey, prettyPhone } from '../../lib/util.js';
import { TAX_CODES } from '../../lib/tax.js';
import { methodLabel } from '../../print/templates.js';
import { navigate } from '../../router.js';
import { can } from '../../auth/permissions.js';
import { ROLE_LABELS } from '../../auth/permissions.js';
import { expenseCatLabel } from '../expenses/cats.js';
import { catColor } from './expcolors.js';
import * as S from '../../state.js';
import { t, tn } from '../../i18n/index.js';

export const GROUPS = () => [
  { id: 'sales', label: t('Sales'), icon: 'receipt' },
  { id: 'profit', label: t('Profit & tax'), icon: 'chart' },
  { id: 'stock', label: t('Stock'), icon: 'layers' },
  { id: 'purchases', label: t('Purchases & suppliers'), icon: 'truck' },
  { id: 'customers', label: t('Customers'), icon: 'users' },
  { id: 'cash', label: t('Cash & expenses'), icon: 'wallet' },
  { id: 'staff', label: t('Staff & security'), icon: 'shield' }
];

// ---------- helpers ----------
const col = (kind) => (key, label, o = {}) => ({ key, label, kind, num: !['text', 'date', 'datetime'].includes(kind), ...o });
const T = col('text'), M = col('money'), I = col('int'), Q = col('qty'), P = col('pct'), Dt = col('date'), DT = col('datetime');
const sumOf = (rows, k) => rows.reduce((a, r) => a + (typeof k === 'function' ? k(r) : r[k] || 0), 0);
const mapName = (m, id, dflt = '') => m.get(id)?.name || dflt;
const pctS = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(0) + '%');
const dayLabel = (ms) => new Date(ms).toLocaleDateString(S.lang.value === 'sw' ? 'sw-KE' : 'en-KE', { weekday: 'short', day: 'numeric', month: 'short' });
export const DOW = () => [t('Mon'), t('Tue'), t('Wed'), t('Thu'), t('Fri'), t('Sat'), t('Sun')];
const sales = async (ctx, { voids = false } = {}) => (await D.salesIn(ctx.from, ctx.to)).filter((s) => E.inBranch(ctx.branch)(s) && (voids || s.status !== 'void'));
const returns = async (ctx) => (await D.returnsIn(ctx.from, ctx.to)).filter(E.inBranch(ctx.branch));
const usersMap = () => D.mapOf('users');
const staffName = (users, id) => users.get(id)?.name || (id ? t('Former staff') : t('Unknown'));
const canCost = () => can('products.cost_view');
const toPreset = (from, to) => `/reports/sales?from=${dayKey(from)}&to=${dayKey(to - 1)}`;
const ctxDays = (ctx) => Math.max(1, Math.round((ctx.to - ctx.from) / DAY));

/** Chart buckets: hours for one day, days up to ~2 months, months beyond. */
function buckets(ctx, rows) {
  const days = ctxDays(ctx);
  if (days <= 62) return rows.map((d) => ({ label: days <= 7 ? dayLabel(d.d0).split(' ')[0] + ' ' + new Date(d.d0).getDate() : String(new Date(d.d0).getDate()), value: d.total / 100, d0: d.d0, title: dayLabel(d.d0) + ': ' + kes(d.total) }));
  const m = new Map();
  for (const d of rows) { const k = new Date(d.d0).toLocaleDateString('en-KE', { month: 'short', year: '2-digit' }); m.set(k, (m.get(k) || 0) + d.total); }
  return [...m].map(([label, v]) => ({ label, value: v / 100 }));
}

// ---------- the reports ----------
export const REPORTS = [
  // ===== Sales =====
  {
    id: 'sales', group: 'sales', icon: 'receipt', title: 'Sales summary', desc: 'Total sales, receipts, average basket and returns, day by day.', perm: 'reports.view', range: true,
    async run(ctx) {
      const len = ctx.to - ctx.from;
      const [ss, rs, prev, prevR] = await Promise.all([sales(ctx), returns(ctx), D.salesIn(ctx.from - len, ctx.from).then((x) => x.filter(E.inBranch(ctx.branch))), D.returnsIn(ctx.from - len, ctx.from).then((x) => x.filter(E.inBranch(ctx.branch)))]);
      const tt = E.salesTotals(ss, rs), pt = E.salesTotals(prev, prevR);
      const days = E.byDay(ss, rs, ctx.from, ctx.to);
      const oneDay = days.length === 1;
      const h = E.byHour(ss).hours;
      const best = days.filter((d) => d.count).sort((a, b) => b.total - a.total)[0];
      const ch = E.change(tt.net, pt.net);
      const rows = days.slice().reverse().filter((d) => d.d0 <= Date.now());
      return {
        sentence: tt.count ? t('You sold {total} from {n} sales{chg}.', { total: m0(tt.net), n: tt.count.toLocaleString('en-KE'), chg: ch == null ? '' : t(', {p} compared with the period before', { p: pctS(ch) }) }) + (best && days.length > 1 ? ' ' + t('Best day: {d} ({v}).', { d: dayLabel(best.d0), v: m0(best.total) }) : '') : '',
        kpis: [
          { label: t('Net sales'), value: tt.net, kind: 'money', sub: ch == null ? null : pctS(ch) + ' ' + t('vs previous period'), tone: ch == null ? null : ch >= 0 ? 'up' : 'down' },
          { label: t('Sales (receipts)'), value: tt.count, kind: 'int', sub: pt.count ? pctS(E.change(tt.count, pt.count)) + ' ' + t('vs previous period') : null },
          { label: t('Average basket'), value: tt.avg, kind: 'money' },
          { label: t('Items sold'), value: tt.items, kind: 'qty' },
          { label: t('Discounts given'), value: tt.discount, kind: 'money' },
          { label: t('Returns (refunds)'), value: tt.refunds, kind: 'money', tone: tt.refunds ? 'down' : null }
        ],
        charts: tt.count ? [oneDay
          ? { title: t('Sales by hour'), wide: true, render: () => <Bars data={h.slice(6, 23).map((x) => ({ label: String(x.h).padStart(2, '0'), value: x.total / 100 }))} height={220} /> }
          : { title: t('Sales by day'), wide: true, sub: t('Tap a day to see it on its own'), render: () => { const b = buckets(ctx, days); return <Bars data={b} height={220} color={C.navy} onPick={b[0]?.d0 ? (i) => navigate(toPreset(b[i].d0, E.nextDay(b[i].d0))) : null} />; } }] : [],
        tables: [{
          title: oneDay ? t('Totals') : t('Day by day'),
          rowClick: oneDay ? null : (r) => navigate(toPreset(r.d0, E.nextDay(r.d0))),
          columns: [
            Dt('d0', t('Day'), { text: (r) => dayLabel(r.d0) }), I('count', t('Sales')), M('total', t('Gross sales')), M('discount', t('Discounts'), { hideMobile: true }),
            M('refunds', t('Returns'), { hideMobile: true }), M('tax', t('VAT'), { hideMobile: true }), M('net', t('Net sales'))
          ],
          rows, foot: { d0: t('Total'), count: tt.count, total: tt.total, discount: tt.discount, refunds: tt.refunds, tax: tt.tax, net: tt.net }
        }],
        empty: !tt.count && !rs.length && { icon: 'receipt', title: t('No sales in this period'), text: t('Every sale you make on the Sell screen shows here. Choose a longer period above, or make a sale.') }
      };
    }
  },
  {
    id: 'products', group: 'sales', icon: 'box', title: 'Sales by product', desc: 'What sold, how many, and what each item earned.', perm: 'reports.view', range: true, search: true,
    async run(ctx) {
      const [ss, prods, cats] = await Promise.all([sales(ctx), D.mapOf('products'), D.mapOf('categories')]);
      let rows = E.byProduct(ss, prods);
      const total = sumOf(rows, 'total');
      if (ctx.q) rows = rows.filter((r) => r.name.toLowerCase().includes(ctx.q.toLowerCase()));
      const cost = canCost();
      const top = rows.slice(0, 10);
      return {
        sentence: rows.length ? t('{n} different products sold. Top seller: {p} ({v}).', { n: rows.length, p: rows[0].name, v: m0(rows[0].total) }) : '',
        kpis: [
          { label: t('Products sold'), value: rows.length, kind: 'int' }, { label: t('Items sold'), value: sumOf(rows, 'qty'), kind: 'qty' },
          { label: t('Sales'), value: sumOf(rows, 'total'), kind: 'money' }, ...(cost ? [{ label: t('Gross profit'), value: sumOf(rows, 'profit'), kind: 'money' }] : [])
        ],
        charts: top.length ? [{ title: t('Top 10 products'), wide: true, render: () => <HBars rows={top.map((r) => ({ label: r.name, value: r.total / 100, right: kes(r.total), sub: tn(r.qty, '{n} sold', '{n} sold') }))} onPick={(r, i) => navigate('/products/' + top[i].id)} /> }] : [],
        tables: [{
          title: t('All products'), rowClick: (r) => prods.get(r.id) && navigate('/products/' + r.id),
          columns: [T('name', t('Product')), T('category', t('Category'), { get: (r) => mapName(cats, r.category_id), hideMobile: true }), Q('qty', t('Qty sold')), M('total', t('Sales')),
            ...(cost ? [M('cost', t('Cost'), { hideMobile: true }), M('profit', t('Profit'), { hideMobile: true }), P('margin', t('Margin'), { hideMobile: true })] : []), P('share', t('Share'), { hideMobile: true, get: (r) => (total ? (r.total / total) * 100 : 0) })],
          rows, foot: { name: t('Total'), qty: sumOf(rows, 'qty'), total: sumOf(rows, 'total'), cost: sumOf(rows, 'cost'), profit: sumOf(rows, 'profit'), margin: sumOf(rows, 'net') ? (sumOf(rows, 'profit') / sumOf(rows, 'net')) * 100 : 0, share: null }
        }],
        empty: !rows.length && !ctx.q && { icon: 'box', title: t('Nothing sold in this period'), text: t('Products appear here as soon as they are sold. Choose a longer period above.') }
      };
    }
  },
  {
    id: 'categories', group: 'sales', icon: 'tags', title: 'Sales by category', desc: 'Which departments bring in the money.', perm: 'reports.view', range: true,
    async run(ctx) {
      const [ss, prods, cats] = await Promise.all([sales(ctx), D.mapOf('products'), D.mapOf('categories')]);
      const rows = E.byCategory(E.byProduct(ss, prods), cats).map((r, i) => ({ ...r, name: r.name || t('No category'), color: r.color || SERIES[i % SERIES.length] }));
      const cost = canCost();
      const tot = sumOf(rows, 'total');
      return {
        sentence: rows.length ? t('{c} brought in the most: {v} ({p}% of sales).', { c: rows[0].name, v: m0(rows[0].total), p: rows[0].share.toFixed(0) }) : '',
        kpis: [{ label: t('Categories'), value: rows.length, kind: 'int' }, { label: t('Sales'), value: tot, kind: 'money' }, ...(cost ? [{ label: t('Gross profit'), value: sumOf(rows, 'profit'), kind: 'money' }] : [])],
        charts: rows.length ? [{ title: t('Share of sales'), render: () => <div class="row wrap" style={{ gap: '18px', alignItems: 'center' }}><Donut data={rows.slice(0, 8).map((r) => ({ label: r.name, value: r.total, color: r.color }))} size={170} center={rows[0].share.toFixed(0) + '%'} /><div class="col gap-s grow" style={{ minWidth: '180px' }}>{rows.slice(0, 8).map((r) => <div class="row small"><i class="sw-dot" style={{ background: r.color }} /><span class="grow ellipsis">{r.name}</span><b class="mono">{r.share.toFixed(0)}%</b></div>)}</div></div> },
          { title: t('Sales by category'), render: () => <HBars rows={rows.slice(0, 8).map((r) => ({ label: r.name, value: r.total / 100, right: kes(r.total), color: r.color }))} /> }] : [],
        tables: [{ title: t('Categories'), columns: [T('name', t('Category')), I('products', t('Products'), { hideMobile: true }), Q('qty', t('Qty sold'), { hideMobile: true }), M('total', t('Sales')), ...(cost ? [M('profit', t('Profit'), { hideMobile: true }), P('margin', t('Margin'))] : []), P('share', t('Share'), { hideMobile: true })],
          rows, foot: { name: t('Total'), products: sumOf(rows, 'products'), qty: sumOf(rows, 'qty'), total: tot, profit: sumOf(rows, 'profit'), margin: sumOf(rows, 'net') ? (sumOf(rows, 'profit') / sumOf(rows, 'net')) * 100 : 0, share: 100 } }],
        empty: !rows.length && { icon: 'tags', title: t('Nothing sold in this period'), text: t('Sales are grouped by the category of each product. Choose a longer period above.') }
      };
    }
  },
  {
    id: 'staff', group: 'sales', icon: 'users', title: 'Sales by staff', desc: 'Who sold what, with their discounts, voids and returns.', perm: 'reports.view', range: true,
    async run(ctx) {
      const [ss, rs, users] = await Promise.all([sales(ctx, { voids: true }), returns(ctx), usersMap()]);
      const rows = E.byStaff(ss, rs).map((r) => ({ ...r, name: staffName(users, r.id), role: t(ROLE_LABELS[users.get(r.id)?.role] || '') }));
      const top = rows[0];
      return {
        sentence: top?.count ? t('{name} sold the most: {v} from {n} sales.', { name: top.name, v: m0(top.total), n: top.count }) : '',
        kpis: [{ label: t('Staff who sold'), value: rows.filter((r) => r.count).length, kind: 'int' }, { label: t('Sales'), value: sumOf(rows, 'total'), kind: 'money' }, { label: t('Voids'), value: sumOf(rows, 'voids'), kind: 'int', tone: sumOf(rows, 'voids') ? 'down' : null }, { label: t('Discounts given'), value: sumOf(rows, 'discount'), kind: 'money' }],
        charts: rows.length ? [{ title: t('Sales by staff'), wide: true, render: () => <HBars rows={rows.filter((r) => r.total).map((r, i) => ({ label: r.name, sub: r.role, value: r.total / 100, right: kes(r.total), color: SERIES[i % SERIES.length] }))} /> }] : [],
        tables: [{ title: t('Staff'), columns: [T('name', t('Staff')), T('role', t('Role'), { hideMobile: true }), I('count', t('Sales')), M('total', t('Total')), M('avg', t('Average sale'), { hideMobile: true }), M('discount', t('Discounts'), { hideMobile: true }), I('voids', t('Voids')), I('returns', t('Returns'), { hideMobile: true }), M('refunds', t('Refunded'), { hideMobile: true })],
          rows, foot: { name: t('Total'), count: sumOf(rows, 'count'), total: sumOf(rows, 'total'), avg: null, discount: sumOf(rows, 'discount'), voids: sumOf(rows, 'voids'), returns: sumOf(rows, 'returns'), refunds: sumOf(rows, 'refunds') } }],
        empty: !rows.length && { icon: 'users', title: t('No sales in this period'), text: t('Each sale is credited to the staff member who was signed in. Choose a longer period above.') }
      };
    }
  },
  {
    id: 'payments', group: 'sales', icon: 'wallet', title: 'Sales by payment method', desc: 'Cash, M-Pesa, card and credit — what you should have received.', perm: 'reports.view', range: true,
    async run(ctx) {
      const [ss, rs, cp] = await Promise.all([sales(ctx), returns(ctx), D.custPaymentsIn(ctx.from, ctx.to).then((x) => x.filter(E.inBranch(ctx.branch)))]);
      const rows = E.byMethod(ss, rs, cp).map((r) => ({ ...r, name: methodLabel(r.method), color: METHOD_COLORS[r.method] || C.mute }));
      const tot = sumOf(rows, 'sales');
      return {
        sentence: rows.length ? t('{m} brought in {p}% of sales ({v}).', { m: rows[0].name, p: rows[0].share.toFixed(0), v: m0(rows[0].sales) }) : '',
        kpis: [{ label: t('Sales'), value: tot, kind: 'money' }, { label: t('Debt payments received'), value: sumOf(rows, 'debt'), kind: 'money' }, { label: t('Refunds'), value: sumOf(rows, 'refunds'), kind: 'money' }, { label: t('Money received'), value: sumOf(rows, 'received'), kind: 'money', sub: t('Excludes sales on credit') }],
        charts: rows.length ? [{ title: t('Payment methods'), render: () => <div class="row wrap" style={{ gap: '18px', alignItems: 'center' }}><Donut data={rows.map((r) => ({ label: r.name, value: r.sales, color: r.color }))} size={170} center={rows[0].share.toFixed(0) + '%'} /><div class="col gap-s grow" style={{ minWidth: '180px' }}>{rows.map((r) => <div class="row small"><i class="sw-dot" style={{ background: r.color }} /><span class="grow">{r.name}</span><b class="mono">{kes(r.sales)}</b><span class="mute" style={{ width: '40px', textAlign: 'right' }}>{r.share.toFixed(0)}%</span></div>)}</div></div> }] : [],
        tables: [{ title: t('Methods'), columns: [T('name', t('Method')), I('count', t('Payments'), { hideMobile: true }), M('sales', t('Sales')), M('debt', t('Debt payments'), { hideMobile: true }), M('refunds', t('Refunds'), { hideMobile: true }), M('received', t('Received')), P('share', t('Share'), { hideMobile: true })],
          rows, foot: { name: t('Total'), count: sumOf(rows, 'count'), sales: tot, debt: sumOf(rows, 'debt'), refunds: sumOf(rows, 'refunds'), received: sumOf(rows, 'received'), share: 100 } }],
        empty: !rows.length && { icon: 'wallet', title: t('No payments in this period'), text: t('Payments are recorded with every sale. Choose a longer period above.') }
      };
    }
  },
  {
    id: 'hours', group: 'sales', icon: 'clock', title: 'Sales by hour & day of week', desc: 'Your busy hours and days — plan staff and stock.', perm: 'reports.view', range: true, preset: 'last30',
    async run(ctx) {
      const ss = await sales(ctx);
      const h = E.byHour(ss);
      const busyH = h.hours.slice().sort((a, b) => b.total - a.total)[0];
      const busyD = h.dows.slice().sort((a, b) => b.avgDay - a.avgDay)[0];
      const lo = Math.min(...h.hours.filter((x) => x.count).map((x) => x.h), 7), hi = Math.max(...h.hours.filter((x) => x.count).map((x) => x.h), 20);
      const hrs = h.hours.slice(lo, hi + 1);
      const dw = DOW();
      return {
        sentence: ss.length ? t('Busiest hour: {h}:00–{h2}:00. Best day of the week: {d} (about {v} a day).', { h: String(busyH.h).padStart(2, '0'), h2: String(busyH.h + 1).padStart(2, '0'), d: dw[busyD.d], v: m0(busyD.avgDay) }) : '',
        kpis: [],
        charts: ss.length ? [
          { title: t('Sales by hour'), render: () => <Bars data={hrs.map((x) => ({ label: String(x.h).padStart(2, '0'), value: x.total / 100 }))} highlight={hrs.indexOf(busyH)} height={220} /> },
          { title: t('Average sales per day of the week'), render: () => <Bars data={h.dows.map((x) => ({ label: dw[x.d], value: x.avgDay / 100 }))} color={C.teal} highlight={busyD.d} height={220} /> },
          { title: t('When customers buy (darker = more sales)'), wide: true, render: () => <Heat grid={h.grid.map((r) => r.slice(lo, hi + 1).map((v) => v / 100))} rowLabels={dw} colLabels={hrs.map((x) => String(x.h).padStart(2, '0'))} title={t('Sales heatmap')} /> }
        ] : [],
        tables: [{ title: t('By hour'), columns: [T('label', t('Hour')), I('count', t('Sales')), M('total', t('Total')), M('avg', t('Average sale'))], rows: hrs.filter((x) => x.count).map((x) => ({ id: x.h, label: String(x.h).padStart(2, '0') + ':00–' + String(x.h + 1).padStart(2, '0') + ':00', count: x.count, total: x.total, avg: Math.round(x.total / x.count) })) },
          { title: t('By day of week'), columns: [T('label', t('Day')), I('days', t('Days in period'), { hideMobile: true }), I('count', t('Sales')), M('total', t('Total')), M('avgDay', t('Average per day'))], rows: h.dows.map((x) => ({ ...x, id: x.d, label: dw[x.d] })) }],
        empty: !ss.length && { icon: 'clock', title: t('No sales in this period'), text: t('Choose a longer period (for example Last 30 days) to see clear patterns.') }
      };
    }
  },
  {
    id: 'customers', group: 'sales', icon: 'user', title: 'Sales by customer', desc: 'Your best customers, how often they come and what they owe.', perm: 'reports.view', range: true,
    async run(ctx) {
      const [ss, custs] = await Promise.all([sales(ctx), D.mapOf('customers')]);
      const { allBalances } = await import('../../core/customers.js');
      const bal = await allBalances();
      const rows = E.byCustomer(ss, bal).map((r) => ({ ...r, name: r.id ? mapName(custs, r.id, t('Deleted customer')) : t('Walk-in customers'), phone: custs.get(r.id)?.phone || '' }));
      const named = rows.filter((r) => r.id);
      const tot = sumOf(rows, 'total');
      return {
        sentence: named.length ? t('{p}% of sales came from {n} named customers. Best customer: {c} ({v}).', { p: tot ? ((sumOf(named, 'total') / tot) * 100).toFixed(0) : 0, n: named.length, c: named[0].name, v: m0(named[0].total) }) : '',
        kpis: [{ label: t('Named customers'), value: named.length, kind: 'int' }, { label: t('Their purchases'), value: sumOf(named, 'total'), kind: 'money' }, { label: t('Walk-in sales'), value: rows.find((r) => !r.id)?.total || 0, kind: 'money' }, { label: t('Sold on credit'), value: sumOf(rows, 'credit'), kind: 'money' }],
        charts: named.length ? [{ title: t('Top customers'), wide: true, render: () => <HBars rows={named.slice(0, 10).map((r) => ({ label: r.name, sub: tn(r.count, '{n} visit', '{n} visits'), value: r.total / 100, right: kes(r.total) }))} onPick={(r, i) => navigate('/customers/' + named[i].id)} color={C.teal} /> }] : [],
        tables: [{ title: t('Customers'), rowClick: (r) => r.id && navigate('/customers/' + r.id), columns: [T('name', t('Customer')), T('phone', t('Phone'), { hideMobile: true, get: (r) => prettyPhone(r.phone) }), I('count', t('Visits')), M('total', t('Spent')), M('avg', t('Average sale'), { hideMobile: true }), DT('last', t('Last visit'), { hideMobile: true }), M('balance', t('Owes now'))],
          rows, foot: { name: t('Total'), count: sumOf(rows, 'count'), total: tot, avg: null, balance: sumOf(rows, 'balance') } }],
        empty: !rows.length && { icon: 'user', title: t('No sales in this period'), text: t('Attach a customer to a sale (F9 on the Sell screen) to see who buys the most.') }
      };
    }
  },
  // ===== Profit & tax =====
  {
    id: 'profit', group: 'profit', icon: 'chart', title: 'Profit & margin', desc: 'Gross profit per day and per product, after VAT and cost.', perm: 'reports.profit', range: true,
    async run(ctx) {
      const [ss, prods] = await Promise.all([sales(ctx), D.mapOf('products')]);
      const tt = E.salesTotals(ss);
      const days = E.byDay(ss, [], ctx.from, ctx.to).filter((d) => d.d0 <= Date.now());
      const rows = E.byProduct(ss, prods);
      const net = tt.total - tt.tax;
      const margin = net ? (tt.profit / net) * 100 : 0;
      const low = rows.filter((r) => r.net > 0 && r.margin < 10);
      return {
        sentence: tt.count ? t('You made {p} gross profit on {s} of sales — a margin of {m}%.', { p: m0(tt.profit), s: m0(tt.total), m: margin.toFixed(1) }) + (low.length ? ' ' + tn(low.length, '{n} product sells at under 10% margin.', '{n} products sell at under 10% margin.') : '') : '',
        kpis: [{ label: t('Sales (incl. VAT)'), value: tt.total, kind: 'money' }, { label: t('Sales excl. VAT'), value: net, kind: 'money' }, { label: t('Cost of goods sold'), value: tt.cost, kind: 'money' }, { label: t('Gross profit'), value: tt.profit, kind: 'money', tone: tt.profit >= 0 ? 'up' : 'down' }, { label: t('Margin'), value: margin, kind: 'pct' }],
        charts: tt.count && days.length > 1 ? [{ title: t('Sales and gross profit by day'), wide: true, sub: t('Bars: sales · line: profit'), render: () => <Bars data={days.map((d) => ({ label: String(new Date(d.d0).getDate()), value: d.total / 100, title: dayLabel(d.d0) + ': ' + kes(d.total) + ' · ' + t('Profit') + ' ' + kes(d.profit) }))} line={days.map((d) => ({ value: d.profit / 100 }))} color="#c9d3e8" height={230} /> }] : [],
        tables: [{ title: t('Profit by product'), rowClick: (r) => prods.get(r.id) && navigate('/products/' + r.id), initialSort: { key: 'profit', dir: 'desc' },
          columns: [T('name', t('Product')), Q('qty', t('Qty sold'), { hideMobile: true }), M('total', t('Sales')), M('cost', t('Cost'), { hideMobile: true }), M('profit', t('Profit')), P('margin', t('Margin'), { render: (r) => <Badge tone={r.margin < 10 ? 'bad' : r.margin < 20 ? 'warn' : 'ok'}>{r.margin.toFixed(1)}%</Badge> })],
          rows, foot: { name: t('Total'), qty: sumOf(rows, 'qty'), total: sumOf(rows, 'total'), cost: sumOf(rows, 'cost'), profit: sumOf(rows, 'profit'), margin: sumOf(rows, 'net') ? (sumOf(rows, 'profit') / sumOf(rows, 'net')) * 100 : 0 } }],
        empty: !tt.count && { icon: 'chart', title: t('No sales in this period'), text: t('Profit = sales without VAT minus what the goods cost you. Set cost prices on your products to see it.') }
      };
    }
  },
  {
    id: 'vat', group: 'profit', icon: 'percent', title: 'VAT & tax (eTIMS codes)', desc: 'Sales and VAT by KRA tax code A–E, for your VAT return.', perm: 'reports.view', range: true, preset: 'lastmonth',
    async run(ctx) {
      const [ss, rs] = await Promise.all([sales(ctx), returns(ctx)]);
      const byId = await D.salesById(rs.map((r) => r.sale_id), ss);
      const rows = E.vatByCode(ss, rs, byId).map((r) => ({ ...r, id: r.code, label: t(TAX_CODES[r.code]?.label || r.code) }));
      const vat = sumOf(rows, 'vat');
      const reg = S.business.value?.vat_registered;
      return {
        sentence: reg ? (rows.length ? t('VAT collected in this period: {v} on {s} of taxable sales.', { v: m0(vat), s: m0(sumOf(rows.filter((r) => r.rate > 0), 'netSales')) }) : '') : t('Your business is not registered for VAT, so no VAT is charged. Codes still show how your products are classified.'),
        note: t('Check these figures against your eTIMS records before filing your VAT return on iTax.'),
        kpis: [{ label: t('Sales (incl. VAT)'), value: sumOf(rows, 'sales'), kind: 'money' }, { label: t('Returns'), value: sumOf(rows, 'returns'), kind: 'money' }, { label: t('Net sales'), value: sumOf(rows, 'netSales'), kind: 'money' }, { label: t('Output VAT'), value: vat, kind: 'money' }],
        charts: [],
        tables: [{ title: t('By tax code'), columns: [T('code', t('Code')), T('label', t('Description')), P('rate', t('Rate'), { text: (r) => r.rate + '%', render: (r) => r.rate + '%' }), M('sales', t('Sales')), M('returns', t('Returns'), { hideMobile: true }), M('netSales', t('Net sales')), M('exVat', t('Excl. VAT'), { hideMobile: true }), M('vat', t('VAT'))],
          rows, foot: { code: t('Total'), label: '', rate: null, sales: sumOf(rows, 'sales'), returns: sumOf(rows, 'returns'), netSales: sumOf(rows, 'netSales'), exVat: sumOf(rows, 'exVat'), vat } }],
        empty: !rows.length && { icon: 'percent', title: t('No sales in this period'), text: t('Each product has a KRA tax code (A Exempt, B 16%, C 0%, D Non-VAT, E 8%). Sales are added up by code here.') }
      };
    }
  },
  {
    id: 'pnl', group: 'profit', icon: 'bars', title: 'Profit & loss', desc: 'Sales minus cost of goods minus expenses = what the business really made.', perm: 'reports.pnl', range: true,
    async run(ctx) {
      const [ss, rs, ex, cm] = await Promise.all([sales(ctx), returns(ctx), D.expensesIn(ctx.from, ctx.to).then((x) => x.filter(E.inBranch(ctx.branch))), D.cashMovesIn(ctx.from, ctx.to).then((x) => x.filter(E.inBranch(ctx.branch)))]);
      const byId = await D.salesById(rs.map((r) => r.sale_id), ss);
      const p = E.profitAndLoss({ sales: ss, returns: rs, expenses: ex, cashMoves: cm, saleById: byId });
      const of = (v) => (p.netSales ? (v / p.netSales) * 100 : null);
      const L = (label, amount, cls, extra = {}) => ({ id: label, label, amount, pct: amount == null ? null : of(amount), cls: 'r-' + cls, ...extra });
      const rows = [
        L(t('Sales (incl. VAT)'), p.sales, 'sub'), L(t('Less returns'), -p.returns, 'sub'), L(t('Less VAT collected'), -p.vat, 'sub'),
        L(t('Net sales'), p.netSales, 'total'), L(t('Cost of goods sold'), -p.cogs, 'sub'), L(t('Gross profit'), p.gross, 'total'),
        L(t('Expenses'), null, 'head'),
        ...p.expenses.cats.map((c) => L('   ' + expenseCatLabel(c.id), -c.total, 'sub', { cat: c.id })),
        ...(p.payouts ? [L('   ' + t('Cash paid out from the till'), -p.payouts, 'sub')] : []),
        L(t('Total expenses'), -p.totalExp, 'total'), L(p.net >= 0 ? t('Net profit') : t('Net loss'), p.net, 'grand')
      ];
      return {
        sentence: p.count ? (p.net >= 0 ? t('After paying for goods and expenses, the business made {v} ({m}% of net sales).', { v: m0(p.net), m: p.netMargin.toFixed(1) }) : t('Expenses were higher than gross profit: a loss of {v}.', { v: m0(-p.net) })) : '',
        kpis: [{ label: t('Net sales'), value: p.netSales, kind: 'money' }, { label: t('Gross profit'), value: p.gross, kind: 'money', sub: p.grossMargin.toFixed(1) + '% ' + t('margin') }, { label: t('Expenses'), value: p.totalExp, kind: 'money' }, { label: p.net >= 0 ? t('Net profit') : t('Net loss'), value: p.net, kind: 'money', tone: p.net >= 0 ? 'up' : 'down', hero: true }],
        charts: p.count ? [{ title: t('Where each shilling of sales went'), wide: true, render: () => {
          const parts = [{ label: t('Cost of goods'), value: p.cogs, color: C.navy }, { label: t('Expenses'), value: p.totalExp, color: C.sun }, { label: p.net >= 0 ? t('Net profit') : t('Net loss'), value: Math.max(0, p.net), color: C.teal }, { label: t('VAT'), value: p.vat, color: C.mute }];
          const tot = parts.reduce((a, x) => a + Math.max(0, x.value), 0) || 1;
          return <div><Stack parts={parts} height={22} /><div class="legend" style={{ marginTop: '10px' }}>{parts.map((x) => <span><i style={{ background: x.color }} />{x.label} <b class="mono">{((Math.max(0, x.value) / tot) * 100).toFixed(0)}%</b></span>)}</div></div>;
        } }] : [],
        tables: [{ title: t('Profit & loss statement'), statement: true, columns: [T('label', t('Item')), M('amount', t('Amount (KES)')), P('pct', t('% of net sales'), { hideMobile: true })], rows }],
        empty: !p.count && !ex.length && { icon: 'bars', title: t('Nothing to show for this period'), text: t('Profit & loss uses your sales, the cost price of what you sold and the expenses you record. Choose a longer period above.') }
      };
    }
  },
  // ===== Stock =====
  {
    id: 'stock', group: 'stock', icon: 'layers', title: 'Stock on hand & value', desc: 'How much stock you hold and what it is worth at cost and selling price.', perm: 'reports.stock', range: false, search: true,
    async run(ctx) {
      const [prods, lv, cats] = await Promise.all([D.all('products'), D.levels(), D.mapOf('categories')]);
      let rows = E.stockValuation(prods, lv, ctx.branch);
      const all = rows;
      if (ctx.q) rows = rows.filter((r) => r.name.toLowerCase().includes(ctx.q.toLowerCase()));
      const cost = canCost();
      const neg = all.filter((r) => r.qty < 0).length;
      const cv = sumOf(all, 'costValue'), rv = sumOf(all, 'retailValue');
      const byCat = new Map();
      for (const r of all) byCat.set(r.category_id || '', (byCat.get(r.category_id || '') || 0) + (cost ? r.costValue : r.retailValue));
      const catRows = [...byCat].sort((a, b) => b[1] - a[1]).slice(0, 8);
      return {
        sentence: all.length ? (cost ? t('You hold {c} of stock at cost, which sells for {r} — {p} potential profit.', { c: m0(cv), r: m0(rv), p: m0(rv - cv) }) : t('Your stock sells for {r}.', { r: m0(rv) })) + (neg ? ' ' + tn(neg, '{n} product shows below zero — count it.', '{n} products show below zero — count them.') : '') : '',
        kpis: [{ label: t('Products in stock'), value: all.filter((r) => r.qty > 0).length, kind: 'int' }, { label: t('Units on hand'), value: sumOf(all, (r) => Math.max(0, r.qty)), kind: 'qty' }, ...(cost ? [{ label: t('Value at cost'), value: cv, kind: 'money' }] : []), { label: t('Value at selling price'), value: rv, kind: 'money' }, ...(cost ? [{ label: t('Potential profit'), value: rv - cv, kind: 'money' }] : [])],
        charts: all.length ? [{ title: cost ? t('Stock value at cost by category') : t('Stock value by category'), wide: true, render: () => <HBars rows={catRows.map(([id, v], i) => ({ label: mapName(cats, id, t('No category')), value: v / 100, right: kes(v), color: cats.get(id)?.color || SERIES[i % SERIES.length] }))} /> }] : [],
        tables: [{ title: t('Products'), rowClick: (r) => navigate('/products/' + r.id), columns: [T('name', t('Product')), T('category', t('Category'), { hideMobile: true, get: (r) => mapName(cats, r.category_id) }), Q('qty', t('On hand'), { render: (r) => <span class={r.qty < 0 ? 'down bold' : r.reorder && r.qty <= r.reorder ? 'warnc bold' : ''}>{fmtQ(r.qty)}</span> }),
          ...(cost ? [M('cost', t('Cost'), { hideMobile: true }), M('costValue', t('Value at cost'))] : []), M('price', t('Price'), { hideMobile: true }), M('retailValue', t('Value at price'), { hideMobile: !cost ? false : true })],
          rows, foot: { name: t('Total'), qty: sumOf(rows, (r) => Math.max(0, r.qty)), costValue: sumOf(rows, 'costValue'), retailValue: sumOf(rows, 'retailValue'), cost: null, price: null } }],
        empty: !all.length && { icon: 'layers', title: t('No stock items yet'), text: t('Add products that track stock, then receive goods or set opening stock to see your stock value.') }
      };
    }
  },
  {
    id: 'movement', group: 'stock', icon: 'history', title: 'Stock movement', desc: 'Every item in and out: sales, deliveries, adjustments, transfers.', perm: 'reports.stock', range: true, search: true, filters: ['moveType'], preset: 'week',
    async run(ctx) {
      const [mv, prods, users] = await Promise.all([D.movesIn(ctx.from, ctx.to), D.mapOf('products'), usersMap()]);
      let rows = mv.filter((m) => (!ctx.branch || m.branch_id === ctx.branch) && (!ctx.moveType || m.type === ctx.moveType));
      if (ctx.q) { const q = ctx.q.toLowerCase(); rows = rows.filter((m) => (prods.get(m.product_id)?.name || '').toLowerCase().includes(q)); }
      rows = rows.sort((a, b) => b.created_at - a.created_at).map((m) => ({ ...m, name: prods.get(m.product_id)?.name || '—', type_l: moveLabel(m.type), by: staffName(users, m.user_id), value: Math.round(Math.abs(m.qty) * (m.cost || prods.get(m.product_id)?.cost || 0)) * Math.sign(m.qty) }));
      const byType = new Map();
      for (const m of rows) { const b = byType.get(m.type) || { type: m.type, n: 0, qty: 0 }; b.n++; b.qty = Math.round((b.qty + m.qty) * 1000) / 1000; byType.set(m.type, b); }
      const tin = sumOf(rows.filter((m) => m.qty > 0), 'qty'), tout = -sumOf(rows.filter((m) => m.qty < 0), 'qty');
      return {
        sentence: rows.length ? t('{n} stock movements: {i} units in, {o} units out.', { n: rows.length.toLocaleString('en-KE'), i: fmtQ(tin), o: fmtQ(tout) }) : '',
        kpis: [{ label: t('Movements'), value: rows.length, kind: 'int' }, { label: t('Units in'), value: tin, kind: 'qty', tone: 'up' }, { label: t('Units out'), value: tout, kind: 'qty', tone: 'down' }],
        chips: [...byType.values()].sort((a, b) => b.n - a.n).map((b) => ({ value: b.type, label: moveLabel(b.type), count: b.n })),
        charts: [],
        tables: [{ title: t('Movements'), big: true, columns: [DT('created_at', t('Time')), T('name', t('Product')), T('type_l', t('Movement'), { render: (r) => <Badge tone={r.qty > 0 ? 'ok' : r.type === 'sale' ? null : 'warn'}>{r.type_l}</Badge> }), Q('qty', t('Qty'), { render: (r) => <span class={r.qty > 0 ? 'up bold' : 'down'}>{r.qty > 0 ? '+' : ''}{fmtQ(r.qty)}</span> }), ...(canCost() ? [M('value', t('Value at cost'), { hideMobile: true })] : []), T('by', t('By'), { hideMobile: true }), T('reason', t('Note'), { hideMobile: true, get: (r) => r.reason || r.batch_no || r.serial || '' })], rows }],
        empty: !rows.length && { icon: 'history', title: t('No stock movements in this period'), text: t('Every sale, delivery, adjustment, stock take and transfer is logged here with who did it.') }
      };
    }
  },
  {
    id: 'low-stock', group: 'stock', icon: 'alert', title: 'Low stock & reorder', desc: 'Items at or below their reorder level, with how much to order.', perm: 'reports.stock', range: false,
    async run(ctx) {
      const [prods, lv, sups] = await Promise.all([D.all('products'), D.levels(), D.mapOf('suppliers')]);
      void sups;
      const rows = E.lowStock(E.stockValuation(prods, lv, ctx.branch));
      const out = rows.filter((r) => r.qty <= 0).length;
      const cost = canCost();
      return {
        sentence: rows.length ? t('{n} items need reordering ({o} are out of stock).', { n: rows.length, o: out }) + (cost ? ' ' + t('Suggested order costs about {v}.', { v: m0(sumOf(rows, 'orderCost')) }) : '') : '',
        kpis: [{ label: t('To reorder'), value: rows.length, kind: 'int', tone: rows.length ? 'down' : null }, { label: t('Out of stock'), value: out, kind: 'int', tone: out ? 'down' : null }, ...(cost ? [{ label: t('Suggested order cost'), value: sumOf(rows, 'orderCost'), kind: 'money' }] : [])],
        charts: [],
        tables: [{ title: t('Reorder list'), rowClick: (r) => navigate('/products/' + r.id), columns: [T('name', t('Product')), Q('qty', t('On hand'), { render: (r) => <Badge tone={r.qty <= 0 ? 'bad' : 'warn'}>{fmtQ(r.qty)}</Badge> }), Q('reorder', t('Reorder level')), Q('suggest', t('Suggested order')), ...(cost ? [M('cost', t('Cost'), { hideMobile: true }), M('orderCost', t('Order cost'))] : [])],
          rows, foot: cost ? { name: t('Total'), orderCost: sumOf(rows, 'orderCost') } : null }],
        empty: !rows.length && { icon: 'check', title: t('Stock levels look good'), text: t('Set a reorder level on each product (Products → edit) and items that run low appear here.') }
      };
    }
  },
  {
    id: 'expiry', group: 'stock', icon: 'calendar', title: 'Expiry', desc: 'Batches that have expired or expire within 30, 60 and 90 days.', perm: 'reports.stock', range: false,
    async run(ctx) {
      const prods = await D.all('products');
      const ids = prods.filter((p) => !p.deleted && p.track_batches).map((p) => p.id);
      const all = E.expiryList(await D.batchMoves(ids), new Map(prods.map((p) => [p.id, p])), ctx.branch);
      const rows = all.filter((r) => r.days <= 90);
      const g = (b) => rows.filter((r) => r.bucket === b);
      const cost = canCost();
      return {
        sentence: rows.length ? t('{e} batches have expired and {s} expire within 30 days.', { e: g('expired').length, s: g('30').length }) + (cost && g('expired').length ? ' ' + t('Expired stock is worth {v} at cost — remove it from the shelf.', { v: m0(sumOf(g('expired'), 'value')) }) : '') : '',
        kpis: [{ label: t('Expired'), value: g('expired').length, kind: 'int', tone: g('expired').length ? 'down' : null, sub: cost ? m0(sumOf(g('expired'), 'value')) : null }, { label: t('Within 30 days'), value: g('30').length, kind: 'int', sub: cost ? m0(sumOf(g('30'), 'value')) : null }, { label: t('31–60 days'), value: g('60').length, kind: 'int' }, { label: t('61–90 days'), value: g('90').length, kind: 'int' }],
        charts: [],
        tables: [{ title: t('Batches'), rowClick: (r) => navigate('/products/' + r.product_id), columns: [T('name', t('Product')), T('batch_no', t('Batch')), Dt('expiry', t('Expiry'), { get: (r) => new Date(r.expiry + 'T00:00').getTime() }), I('days', t('Days left'), { render: (r) => <Badge tone={r.days < 0 ? 'bad' : r.days <= 30 ? 'warn' : null}>{r.days < 0 ? t('Expired') : tn(r.days, '{n} day', '{n} days')}</Badge>, text: (r) => r.days }), Q('qty', t('Qty')), ...(cost ? [M('value', t('Value at cost'))] : [])],
          rows, foot: cost ? { name: t('Total'), qty: sumOf(rows, 'qty'), value: sumOf(rows, 'value') } : null }],
        empty: !rows.length && { icon: 'calendar', title: ids.length ? t('Nothing expires in the next 90 days') : t('No products track batches and expiry'), text: ids.length ? t('Batches with an expiry date appear here 90 days before they expire.') : t('Switch on "Track batches & expiry" on a product (pharmacy, agrovet, food) and enter expiry dates when you receive goods.') }
      };
    }
  },
  {
    id: 'dead-stock', group: 'stock', icon: 'pause', title: 'Dead & slow stock', desc: 'Stock that has not sold for a long time — money sitting on the shelf.', perm: 'reports.stock', range: false, filters: ['days'],
    async run(ctx) {
      const days = +ctx.days || 30;
      const t1 = startOfDay() + DAY;
      const [prods, lv, ss, last] = await Promise.all([D.all('products'), D.levels(), D.salesIn(t1 - days * DAY, t1).then((x) => x.filter((s) => E.inBranch(ctx.branch)(s) && s.status !== 'void')), D.lastSoldMap()]);
      const rows = E.deadStock(E.stockValuation(prods, lv, ctx.branch), ss, days, last).map((r) => ({ ...r, status: r.sold === 0 ? t('Not sold') : t('Slow') }));
      const dead = rows.filter((r) => r.sold === 0);
      const cost = canCost();
      return {
        sentence: rows.length ? t('{n} products did not sell in the last {d} days.', { n: dead.length, d: days }) + (cost ? ' ' + t('Stock tied up: {v} at cost.', { v: m0(sumOf(rows, 'costValue')) }) : '') + ' ' + t('Consider a promotion or stop reordering them.') : '',
        kpis: [{ label: t('Not sold'), value: dead.length, kind: 'int', tone: dead.length ? 'down' : null }, { label: t('Slow sellers'), value: rows.length - dead.length, kind: 'int' }, ...(cost ? [{ label: t('Money tied up (at cost)'), value: sumOf(rows, 'costValue'), kind: 'money' }] : [])],
        charts: [],
        tables: [{ title: t('Products'), rowClick: (r) => navigate('/products/' + r.id), columns: [T('name', t('Product')), T('status', t('Status'), { render: (r) => <Badge tone={r.sold === 0 ? 'bad' : 'warn'}>{r.status}</Badge> }), Q('qty', t('On hand')), Q('sold', t('Sold in period')), I('idle', t('Days since last sale'), { text: (r) => r.idle ?? '', render: (r) => (r.idle == null ? t('Never') : r.idle) }), ...(cost ? [M('costValue', t('Value at cost'))] : [])],
          rows, foot: cost ? { name: t('Total'), qty: sumOf(rows, 'qty'), costValue: sumOf(rows, 'costValue') } : null }],
        empty: !rows.length && { icon: 'check', title: t('All your stock is moving'), text: t('Products that have stock but no sales in the chosen number of days appear here.') }
      };
    }
  },
  // ===== Purchases =====
  {
    id: 'purchases', group: 'purchases', icon: 'truck', title: 'Purchases by supplier', desc: 'Goods received from each supplier and what you paid.', perm: 'reports.purchases', range: true,
    async run(ctx) {
      const [g, sp, sups] = await Promise.all([D.grnsIn(ctx.from, ctx.to).then((x) => x.filter(E.inBranch(ctx.branch))), D.supPaymentsIn(ctx.from, ctx.to), D.mapOf('suppliers')]);
      const rows = E.purchasesBySupplier(g, sp).map((r) => ({ ...r, name: mapName(sups, r.id, t('No supplier')) }));
      const tot = sumOf(rows, 'total');
      return {
        sentence: rows.length && tot ? t('You received goods worth {v} from {n} suppliers. Biggest: {s} ({p}%).', { v: m0(tot), n: rows.filter((r) => r.total).length, s: rows[0].name, p: ((rows[0].total / tot) * 100).toFixed(0) }) : '',
        kpis: [{ label: t('Deliveries'), value: sumOf(rows, 'grns'), kind: 'int' }, { label: t('Purchased'), value: tot, kind: 'money' }, { label: t('Paid'), value: sumOf(rows, 'paid'), kind: 'money' }],
        charts: tot ? [{ title: t('Purchases by supplier'), wide: true, render: () => <HBars rows={rows.filter((r) => r.total).slice(0, 10).map((r) => ({ label: r.name, sub: tn(r.grns, '{n} delivery', '{n} deliveries'), value: r.total / 100, right: kes(r.total) }))} color={C.tealD} /> }] : [],
        tables: [{ title: t('Suppliers'), columns: [T('name', t('Supplier')), I('grns', t('Deliveries')), ...(sumOf(rows, 'returns') ? [M('received', t('Received'), { hideMobile: true }), M('returns', t('Returned'), { hideMobile: true })] : []), M('total', t('Purchased')), M('paidAtDelivery', t('Paid on delivery'), { hideMobile: true }), M('payments', t('Later payments'), { hideMobile: true }), M('paid', t('Total paid')), DT('last', t('Last delivery'), { hideMobile: true })],
          rows, foot: { name: t('Total'), grns: sumOf(rows, 'grns'), received: sumOf(rows, 'received'), returns: sumOf(rows, 'returns'), total: tot, paidAtDelivery: sumOf(rows, 'paidAtDelivery'), payments: sumOf(rows, 'payments'), paid: sumOf(rows, 'paid') } }],
        empty: !rows.length && { icon: 'truck', title: t('No goods received in this period'), text: t('Purchases appear here when you receive goods from a supplier (Purchasing → Receive goods).') }
      };
    }
  },
  {
    id: 'supplier-balances', nobranch: true, group: 'purchases', icon: 'credit', title: 'Supplier balances', desc: 'What you owe each supplier and since when.', perm: 'reports.purchases', range: false,
    async run() {
      const [sups, g, sp] = await Promise.all([D.all('suppliers'), D.all('goods_received'), D.all('supplier_payments')]);
      const rows = E.supplierBalances(sups, g, sp);
      const owe = rows.filter((r) => r.balance > 0);
      const overdue = owe.filter((r) => r.overdue > 0);
      return {
        sentence: owe.length ? t('You owe {n} suppliers a total of {v}.', { n: owe.length, v: m0(sumOf(owe, 'balance')) }) + (overdue.length ? ' ' + tn(overdue.length, '{n} is past its payment terms.', '{n} are past their payment terms.') : '') : '',
        kpis: [{ label: t('Suppliers'), value: rows.length, kind: 'int' }, { label: t('You owe'), value: sumOf(owe, 'balance'), kind: 'money', tone: owe.length ? 'down' : null }, { label: t('Overdue'), value: sumOf(overdue, 'balance'), kind: 'money', tone: overdue.length ? 'down' : null }],
        charts: [],
        tables: [{ title: t('Suppliers'), columns: [T('name', t('Supplier')), T('phone', t('Phone'), { hideMobile: true, get: (r) => prettyPhone(r.phone) }), I('terms', t('Terms (days)'), { hideMobile: true }), M('total', t('Purchased')), M('paid', t('Paid'), { hideMobile: true }), M('balance', t('Balance'), { render: (r) => <b class={r.balance > 0 ? 'down' : ''}>{kes(r.balance)}</b> }), I('overdue', t('Days overdue'), { render: (r) => (r.overdue ? <Badge tone="bad">{r.overdue}</Badge> : '—'), text: (r) => r.overdue || '' })],
          rows, foot: { name: t('Total'), total: sumOf(rows, 'total'), paid: sumOf(rows, 'paid'), balance: sumOf(rows, 'balance') } }],
        empty: !rows.length && { icon: 'credit', title: t('No suppliers yet'), text: t('Add suppliers and receive goods on credit; balances and payments show here.') }
      };
    }
  },
  // ===== Customers =====
  {
    id: 'aging', nobranch: true, group: 'customers', icon: 'credit', title: 'Debtors aging', desc: 'Who owes you, how much and for how long (0–30, 31–60, 61–90, 90+ days).', perm: 'reports.view', range: false,
    async run() {
      const [cs, ss, cp, rs] = await Promise.all([D.all('customers'), db_creditSales(), D.all('customer_payments'), D.all('returns')]);
      const rows = E.debtorsAging(cs, ss, cp, rs);
      const tot = sumOf(rows, 'balance');
      const old = sumOf(rows, 'b60') + sumOf(rows, 'b90');
      const over = rows.filter((r) => r.limit && r.balance > r.limit).length;
      return {
        sentence: rows.length ? t('{n} customers owe you {v}.', { n: rows.length, v: m0(tot) }) + (old ? ' ' + t('{v} is older than 60 days — follow up first.', { v: m0(old) }) : '') + (over ? ' ' + tn(over, '{n} customer is over their credit limit.', '{n} customers are over their credit limit.') : '') : '',
        kpis: [{ label: t('Total owed'), value: tot, kind: 'money', tone: tot ? 'down' : null }, { label: t('0–30 days'), value: sumOf(rows, 'b0'), kind: 'money' }, { label: t('31–60 days'), value: sumOf(rows, 'b30'), kind: 'money' }, { label: t('61–90 days'), value: sumOf(rows, 'b60'), kind: 'money' }, { label: t('Over 90 days'), value: sumOf(rows, 'b90'), kind: 'money', tone: sumOf(rows, 'b90') ? 'down' : null }],
        charts: tot ? [{ title: t('Age of debt'), wide: true, render: () => { const parts = [{ label: t('0–30 days'), value: sumOf(rows, 'b0'), color: C.teal }, { label: t('31–60 days'), value: sumOf(rows, 'b30'), color: C.sun }, { label: t('61–90 days'), value: sumOf(rows, 'b60'), color: '#e8833a' }, { label: t('Over 90 days'), value: sumOf(rows, 'b90'), color: C.coral }]; return <div><Stack parts={parts} height={22} /><div class="legend" style={{ marginTop: '10px' }}>{parts.map((x) => <span><i style={{ background: x.color }} />{x.label} <b class="mono">{kes(x.value)}</b></span>)}</div></div>; } }] : [],
        tables: [{ title: t('Debtors'), rowClick: (r) => navigate('/reports/statement?customer=' + r.id), columns: [T('name', t('Customer')), T('phone', t('Phone'), { hideMobile: true, get: (r) => prettyPhone(r.phone) }), M('b0', t('0–30'), { hideMobile: true }), M('b30', t('31–60'), { hideMobile: true }), M('b60', t('61–90'), { hideMobile: true }), M('b90', t('90+'), { hideMobile: true }), M('balance', t('Total'), { render: (r) => <b class="down">{kes(r.balance)}</b> }), M('limit', t('Credit limit'), { hideMobile: true, render: (r) => (r.limit ? <span class={r.balance > r.limit ? 'down bold' : ''}>{kes(r.limit)}</span> : '—') })],
          rows, foot: { name: t('Total'), b0: sumOf(rows, 'b0'), b30: sumOf(rows, 'b30'), b60: sumOf(rows, 'b60'), b90: sumOf(rows, 'b90'), balance: tot, limit: null } }],
        empty: !rows.length && { icon: 'smile', title: t('Nobody owes you money'), text: t('Credit sales (pay later) appear here until the customer pays.') }
      };
    }
  },
  {
    id: 'statement', nobranch: true, group: 'customers', icon: 'file', title: 'Customer statement', desc: 'Credit sales, payments and running balance for one customer.', perm: 'reports.view', range: true, filters: ['customer'], preset: 'last90',
    async run(ctx) {
      const cs = (await D.all('customers')).filter((c) => !c.deleted);
      if (!ctx.customer) return { needs: { icon: 'user', title: t('Choose a customer'), text: t('Pick a customer above to see their statement. Customers who owe money are listed first.') }, kpis: [], charts: [], tables: [] };
      const c = cs.find((x) => x.id === ctx.customer);
      const [ss, cp, rs] = await Promise.all([db_creditSales(), D.all('customer_payments'), D.all('returns')]);
      const st = E.statement(ctx.customer, ss, cp, rs, ctx.from, ctx.to);
      const rows = st.rows.map((r) => ({ ...r, desc: r.kind === 'sale' ? t('Credit sale') + ' ' + r.ref : r.kind === 'payment' ? t('Payment') + ' · ' + methodLabel(r.method) + (r.ref ? ' ' + r.ref : '') : t('Returned goods') }));
      return {
        title: c ? c.name : '',
        sentence: c ? t('{c} owes {v} at the end of this period.', { c: c.name, v: m0(st.closing) }) : '',
        kpis: [{ label: t('Opening balance'), value: st.opening, kind: 'money' }, { label: t('Credit sales'), value: st.debits, kind: 'money' }, { label: t('Payments & credits'), value: st.credits, kind: 'money' }, { label: t('Closing balance'), value: st.closing, kind: 'money', tone: st.closing > 0 ? 'down' : 'up' }],
        charts: [],
        tables: [{ title: t('Statement'), columns: [DT('at', t('Date')), T('desc', t('Details')), M('debit', t('Charged'), { render: (r) => (r.debit ? kes(r.debit) : '') }), M('credit', t('Paid'), { render: (r) => (r.credit ? kes(r.credit) : '') }), M('balance', t('Balance'))],
          rows: [{ id: 'open', at: ctx.from, desc: t('Opening balance'), debit: 0, credit: 0, balance: st.opening, cls: 'r-sub' }, ...rows], foot: { at: null, desc: t('Closing balance'), debit: st.debits, credit: st.credits, balance: st.closing } }],
        empty: null
      };
    }
  },
  // ===== Cash & expenses =====
  {
    id: 'expenses', group: 'cash', icon: 'wallet', title: 'Expenses', desc: 'Rent, salaries, transport and other running costs by category.', perm: 'expenses.view', range: true, preset: 'month',
    async run(ctx) {
      const [ex, users] = await Promise.all([D.expensesIn(ctx.from, ctx.to).then((x) => x.filter(E.inBranch(ctx.branch))), usersMap()]);
      const s = E.expensesSummary(ex);
      const rows = ex.slice().sort((a, b) => (b.date + b.created_at).localeCompare(a.date + a.created_at)).map((e) => ({ ...e, cat: expenseCatLabel(e.category), by: staffName(users, e.user_id), method_l: methodLabel(e.method) }));
      return {
        sentence: s.count ? t('You spent {v} on {n} expenses. Biggest: {c} ({p}%).', { v: m0(s.total), n: s.count, c: expenseCatLabel(s.cats[0].id), p: s.cats[0].share.toFixed(0) }) : '',
        kpis: [{ label: t('Total expenses'), value: s.total, kind: 'money' }, { label: t('Expenses recorded'), value: s.count, kind: 'int' }, { label: t('Paid from the till'), value: s.drawer, kind: 'money' }],
        charts: s.count ? [{ title: t('By category'), wide: true, render: () => <HBars rows={s.cats.map((c, i) => ({ label: expenseCatLabel(c.id), sub: tn(c.count, '{n} expense', '{n} expenses'), value: c.total / 100, right: kes(c.total), color: catColor(c.id, i) }))} /> }] : [],
        tables: [{ title: t('By category'), columns: [T('name', t('Category'), { get: (r) => expenseCatLabel(r.id) }), I('count', t('Expenses')), M('total', t('Total')), P('share', t('Share'))], rows: s.cats, foot: { name: t('Total'), count: s.count, total: s.total, share: 100 } },
          { title: t('All expenses'), columns: [Dt('date', t('Date'), { get: (r) => new Date(r.date + 'T00:00').getTime() }), T('cat', t('Category')), T('payee', t('Paid to')), T('method_l', t('Paid with'), { hideMobile: true }), T('by', t('Recorded by'), { hideMobile: true }), M('amount', t('Amount'))], rows, foot: { date: null, cat: t('Total'), amount: s.total } }],
        empty: !s.count && { icon: 'wallet', title: t('No expenses recorded in this period'), text: t('Record rent, salaries, transport and other costs under Expenses so your profit & loss is complete.') }
      };
    }
  },
  {
    id: 'shifts', group: 'cash', icon: 'clock', title: 'Shift & Z report history', desc: 'Every closed till: expected vs counted cash and the variance.', perm: 'shift.view_all', range: true, preset: 'last30',
    async run(ctx) {
      const [sh, users, devices, brs] = await Promise.all([D.shiftsIn(ctx.from, ctx.to), usersMap(), D.mapOf('devices'), D.mapOf('branches')]);
      const rows = E.shiftRows(sh, ctx.branch).map((s) => ({ ...s, who: staffName(users, s.user_id), till: devices.get(s.device_id)?.name || '', branch: brs.get(s.branch_id)?.name || '' }));
      const closed = rows.filter((r) => r.status === 'closed');
      const short = closed.filter((r) => r.variance < 0);
      return {
        sentence: closed.length ? t('{n} shifts closed. {s} were short by {v} in total.', { n: closed.length, s: short.length, v: m0(-sumOf(short, 'variance')) }) : '',
        kpis: [{ label: t('Shifts'), value: rows.length, kind: 'int' }, { label: t('Takings'), value: sumOf(rows, 'takings'), kind: 'money' }, { label: t('Cash short'), value: -sumOf(short, 'variance'), kind: 'money', tone: short.length ? 'down' : null }, { label: t('Cash over'), value: sumOf(closed.filter((r) => r.variance > 0), 'variance'), kind: 'money' }],
        charts: closed.length > 1 ? [{ title: t('Cash variance per shift'), wide: true, sub: t('Red = short, teal = over'), render: () => { const r2 = closed.slice(0, 40).reverse(); return <Bars data={r2.map((r) => ({ label: String(new Date(r.opened_at).getDate()), value: Math.abs(r.variance) / 100, color: r.variance < 0 ? C.coral : C.teal, title: dayLabel(r.opened_at) + ' · ' + r.who + ': ' + kes(r.variance) }))} height={180} />; } }] : [],
        tables: [{ title: t('Shifts'), columns: [DT('opened_at', t('Opened')), DT('closed_at', t('Closed'), { hideMobile: true, text: (r) => (r.closed_at ? '' : t('Open')) }), T('who', t('Cashier')), T('till', t('Till'), { hideMobile: true }), M('takings', t('Takings')), M('expected_cash', t('Expected cash'), { hideMobile: true }), M('counted_cash', t('Counted'), { hideMobile: true }), M('variance', t('Variance'), { render: (r) => (r.status === 'open' ? <Badge tone="navy">{t('Open')}</Badge> : <Badge tone={r.variance < 0 ? 'bad' : r.variance > 0 ? 'warn' : 'ok'}>{r.variance > 0 ? '+' : ''}{kes(r.variance)}</Badge>) })],
          rows, foot: { opened_at: null, who: t('Total'), takings: sumOf(rows, 'takings'), expected_cash: sumOf(closed, 'expected_cash'), counted_cash: sumOf(closed, 'counted_cash'), variance: sumOf(closed, 'variance') } }],
        empty: !rows.length && { icon: 'clock', title: t('No shifts in this period'), text: t('Open a shift with a float on the Cash & shifts page; each closed shift (Z report) is listed here.') }
      };
    }
  },
  // ===== Staff & security =====
  {
    id: 'exceptions', nobranch: true, group: 'staff', icon: 'shield', title: 'Discounts, voids, returns & price changes', desc: 'Exceptions that can hide theft — who did what and how often.', perm: 'reports.exceptions', range: true, preset: 'month',
    async run(ctx) {
      const [au, users] = await Promise.all([D.auditIn(ctx.from, ctx.to), usersMap()]);
      const x = E.exceptions(au);
      const rows = x.rows.map((a) => ({ ...a, who: staffName(users, a.user_id), what: actionLabel(a.action), ref: a.details?.no || '', amount: E.amountOf(a), note: a.details?.reason || a.details?.note || '' }));
      const s = (k) => x.sum[k] || { count: 0, amount: 0 };
      const staff = x.staff.map((p) => ({ ...p, name: staffName(users, p.id), discounts: p.byAction['discount.apply'] || 0, voids: p.byAction['sale.void'] || 0, returns: p.byAction['sale.return'] || 0, prices: p.byAction['price.change'] || 0, drawer: p.byAction['drawer.open'] || 0 }));
      const top = staff[0];
      return {
        sentence: rows.length ? t('{n} exceptions recorded.', { n: rows.length }) + (top && staff.length > 1 ? ' ' + t('Most by {name} ({c}). Check that each one has a good reason.', { name: top.name, c: top.count }) : '') : '',
        kpis: [{ label: t('Discounts'), value: s('discount.apply').amount, kind: 'money', sub: tn(s('discount.apply').count, '{n} time', '{n} times') }, { label: t('Voided sales'), value: s('sale.void').amount, kind: 'money', sub: tn(s('sale.void').count, '{n} time', '{n} times'), tone: s('sale.void').count ? 'down' : null }, { label: t('Returns'), value: s('sale.return').amount, kind: 'money', sub: tn(s('sale.return').count, '{n} time', '{n} times') }, { label: t('Price changes'), value: s('price.change').count, kind: 'int' }, { label: t('Drawer opened (no sale)'), value: s('drawer.open').count, kind: 'int', tone: s('drawer.open').count ? 'down' : null }],
        charts: [],
        tables: [{ title: t('By staff'), columns: [T('name', t('Staff')), I('discounts', t('Discounts')), I('voids', t('Voids')), I('returns', t('Returns')), I('prices', t('Price changes'), { hideMobile: true }), I('drawer', t('Drawer opens'), { hideMobile: true }), M('amount', t('Value'))], rows: staff },
          { title: t('Every exception'), columns: [DT('at', t('Time')), T('what', t('What happened'), { render: (r) => <Badge tone={r.action === 'sale.void' ? 'bad' : 'warn'}>{r.what}</Badge> }), T('who', t('By')), T('ref', t('Receipt'), { hideMobile: true }), M('amount', t('Amount'), { render: (r) => (r.amount ? kes(r.amount) : '') }), T('note', t('Reason'), { hideMobile: true })], rows }],
        empty: !rows.length && { icon: 'shield', title: t('No exceptions in this period'), text: t('Discounts, voids, returns, price changes and drawer openings are recorded automatically and listed here.') }
      };
    }
  },
  {
    id: 'commission', group: 'staff', icon: 'percent', title: 'Staff commission', desc: 'Sales credited to each staff member × their commission rate.', perm: 'reports.view', range: true,
    async run(ctx) {
      const [ss, us] = await Promise.all([sales(ctx), D.all('users')]);
      const rows = E.commission(ss, us).map((r) => ({ ...r, role_l: t(ROLE_LABELS[r.role] || r.role) }));
      const due = sumOf(rows, 'commission');
      return {
        sentence: due ? t('Commission due for this period: {v}.', { v: m0(due) }) : rows.some((r) => r.rate) ? '' : t('No staff has a commission rate yet. Set it in Settings → Staff & roles.'),
        kpis: [{ label: t('Commission due'), value: due, kind: 'money' }, { label: t('Sales credited'), value: sumOf(rows, 'base'), kind: 'money' }, { label: t('Staff on commission'), value: rows.filter((r) => r.rate).length, kind: 'int' }],
        charts: [],
        note: t('Service lines are credited to the staff chosen on the line; other items to the cashier who made the sale.'),
        tables: [{ title: t('Staff'), columns: [T('name', t('Staff')), T('role_l', t('Role'), { hideMobile: true }), M('services', t('Services'), { hideMobile: true }), M('other', t('Other sales'), { hideMobile: true }), M('base', t('Sales credited')), P('rate', t('Rate'), { text: (r) => r.rate + '%', render: (r) => r.rate + '%' }), M('commission', t('Commission'))],
          rows, foot: { name: t('Total'), services: sumOf(rows, 'services'), other: sumOf(rows, 'other'), base: sumOf(rows, 'base'), rate: null, commission: due } }],
        empty: !rows.length && { icon: 'percent', title: t('No sales in this period'), text: t('Set a commission % for each staff member in Settings → Staff & roles.') }
      };
    }
  },
  {
    id: 'audit', nobranch: true, group: 'staff', icon: 'history', title: 'Activity log', desc: 'Every sensitive action: who, what, when and on which till.', perm: 'audit.view', range: true, search: true, filters: ['user', 'action'], preset: 'week',
    async run(ctx) {
      const [au, users, devices, branches, sups, custs] = await Promise.all([D.auditIn(ctx.from, ctx.to), usersMap(), D.mapOf('devices'), D.mapOf('branches'), D.mapOf('suppliers'), D.mapOf('customers')]);
      // ids in details shown as names (branch, supplier, customer, staff)
      const names = new Map();
      for (const m of [branches, sups, custs, devices]) for (const [id, r] of m) if (r?.name) names.set(id, r.name);
      for (const [id, u] of users) if (u?.name) names.set(id, u.name);
      const actions = [...new Set(au.map((a) => a.action))].sort();
      let rows = au.filter((a) => (!ctx.user || a.user_id === ctx.user) && (!ctx.action || a.action === ctx.action));
      if (ctx.q) { const q = ctx.q.toLowerCase(); rows = rows.filter((a) => JSON.stringify(a.details || {}).toLowerCase().includes(q) || a.action.includes(q)); }
      rows = rows.sort((a, b) => b.at - a.at).map((a) => ({ ...a, who: staffName(users, a.user_id), what: actionLabel(a.action), till: devices.get(a.device_id)?.name || '', info: detailText(a.details, names) }));
      return {
        actions,
        sentence: rows.length ? tn(rows.length, '{n} action recorded.', '{n} actions recorded.') : '',
        kpis: [],
        charts: [],
        tables: [{ title: t('Activity'), big: true, columns: [DT('at', t('Time')), T('what', t('Action'), { render: (r) => <Badge tone={TONE[r.action]}>{r.what}</Badge> }), T('who', t('By')), T('till', t('Till'), { hideMobile: true }), T('info', t('Details'), { hideMobile: true, render: (r) => <span class="small mute">{r.info}</span> })], rows }],
        empty: !rows.length && !ctx.user && !ctx.action && !ctx.q && { icon: 'shield', title: t('Nothing recorded in this period'), text: t('Sign-ins, voids, discounts, price changes, stock adjustments and settings changes are recorded automatically.') }
      };
    }
  }
];
export const reportById = (id) => REPORTS.find((r) => r.id === id);

// ---------- labels ----------
export const fmtQ = (q) => (q == null ? '' : Number.isInteger(q) ? q.toLocaleString('en-KE') : (Math.round(q * 100) / 100).toLocaleString('en-KE'));
const MOVES = { sale: 'Sold', return: 'Returned by customer', void: 'Sale voided', purchase: 'Received from supplier', adjust: 'Adjustment', count: 'Stock take', transfer_out: 'Sent to branch', transfer_in: 'Received from branch', opening: 'Opening stock', repack_in: 'Repacked in', repack_out: 'Repacked out', recipe: 'Used in recipe', supplier_return: 'Returned to supplier' };
export const moveLabel = (k) => t(MOVES[k] || k);
export const MOVE_TYPES = Object.keys(MOVES);
const ACTIONS = {
  'sale.create': 'Sale made', 'sale.void': 'Sale voided', 'sale.return': 'Items returned', 'discount.apply': 'Discount given', 'price.change': 'Price changed on a sale',
  'drawer.open': 'Cash drawer opened (no sale)', 'cart.clear': 'Cart cleared', 'cart.remove_sent': 'Sent item removed', 'override.grant': 'Manager approval given', 'user.login': 'Signed in',
  'user.login_failed': 'Wrong PIN entered', 'user.lock': 'Screen locked', 'shift.open': 'Shift opened', 'shift.close': 'Shift closed', 'cash.pay_in': 'Cash paid in', 'cash.pay_out': 'Cash paid out',
  'cash.drop': 'Cash drop', 'stock.adjust': 'Stock adjusted', 'settings.change': 'Settings changed', 'settings.tax': 'Tax settings changed', 'business.update': 'Business details changed',
  'product.create': 'Product added', 'product.update': 'Product edited', 'product.delete': 'Product deleted', 'customer.payment': 'Debt payment received', 'expense.create': 'Expense recorded',
  'expense.delete': 'Expense deleted', 'backup.restore': 'Backup restored', 'staff.update': 'Staff changed',
  'backup.download': 'Backup downloaded', 'branch.switch': 'Branch switched', 'business.create': 'Business created', 'category.delete': 'Category deleted', 'customer.create': 'Customer added', 'customer.delete': 'Customer deleted', 'expense.restore': 'Expense restored', 'export.all': 'All data exported', 'export.customers': 'Customers exported', 'export.products': 'Products exported', 'export.stock': 'Stock exported', 'labels.print': 'Labels printed', 'modifiers.create': 'Options added', 'order.bill': 'Bill printed', 'order.cancel': 'Order cancelled', 'order.merge': 'Tables merged', 'order.open': 'Order opened', 'order.send': 'Sent to the kitchen', 'order.status': 'Order status changed', 'order.transfer': 'Order moved to another table', 'order.void_item': 'Sent item removed (VOID)', 'po.create': 'Purchase order created', 'product.bulk_edit': 'Products edited together', 'product.clear_unused': 'Unused products removed', 'product.import': 'Products imported', 'purchase.receive': 'Goods received', 'purchase.return': 'Goods returned to supplier', 'quote.delete': 'Quote deleted', 'quote.invoiced': 'Quote turned into an invoice', 'receipt.reprint': 'Receipt reprinted', 'receipt.whatsapp': 'Receipt sent on WhatsApp', 'sale.hold': 'Sale put on hold', 'sale.hold_delete': 'Held sale deleted', 'setup.done': 'Setup finished', 'stock.count': 'Stock take applied', 'stock.count_cancel': 'Stock take cancelled', 'stock.count_start': 'Stock take started', 'stock.opening': 'Opening stock entered', 'stock.repack': 'Stock repacked', 'supplier.delete': 'Supplier deleted', 'supplier.payment': 'Supplier paid', 'table.delete': 'Table removed', 'transfer.cancel': 'Transfer cancelled', 'transfer.send': 'Stock sent to a branch', 'transfer.receive': 'Stock received from a branch', 'transfer.discrepancy': 'Transfer short or over'
};
export const actionLabel = (a) => t(ACTIONS[a] || a);
const TONE = { 'sale.void': 'bad', 'sale.return': 'warn', 'price.change': 'warn', 'discount.apply': 'warn', 'drawer.open': 'warn', 'user.login_failed': 'bad', 'override.grant': 'navy', 'product.delete': 'bad', 'backup.restore': 'bad', 'shift.close': 'ok', 'expense.delete': 'bad' };
const MONEYK = ['total', 'amount', 'from', 'to', 'variance', 'expected', 'float', 'counted'];
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const detailText = (d, names = new Map()) => Object.entries(d || {}).filter(([k, v]) => k !== 'id' && !(typeof v === 'string' && ULID.test(v) && !names.has(v))).map(([k, v]) => `${k.replace(/_id$/, '')}: ${typeof v === 'number' && MONEYK.includes(k) ? kes(v) : typeof v === 'string' && names.has(v) ? names.get(v) : Array.isArray(v) ? v.join(', ') : typeof v === 'object' && v ? JSON.stringify(v) : v}`).join(' · ');

/** All credit sales (customer attached) — for aging & statements. */
async function db_creditSales() {
  const { db } = await import('../../db/index.js');
  return db().sales.where('customer_id').above('').toArray();
}
