// Built-in home (dashboard) widgets. Other modules add theirs via `widgets: [{id, order, size:'sm'|'md'|'lg'|'full', component, perm}]`.
// Every card links to the report behind it (when the user may open reports).
import { useEffect, useState } from 'preact/hooks';
import { Icon, Badge, Empty, Progress } from '../../ui/kit.jsx';
import { Donut, Sparkline } from '../../ui/charts.jsx';
import { Bars, HBars, C, METHOD_COLORS } from '../reports/viz.jsx';
import { expiryList } from '../reports/expiry.js';
import { money, kes, pct } from '../../lib/money.js';
import { lowStockList } from '../../shell/Notifications.jsx';
import { levels, catalog } from '../../db/catalog.js';
import { db, getMeta, setMeta } from '../../db/index.js';
import { allBalances } from '../../core/customers.js';
import { methodLabel } from '../../print/templates.js';
import { licenceState } from '../../auth/session.js';
import { navigate } from '../../router.js';
import { can } from '../../auth/permissions.js';
import { dayKey, DAY } from '../../lib/util.js';
import * as S from '../../state.js';
import { t } from '../../i18n/index.js';

const delta = (a, b) => (b ? ((a - b) / b) * 100 : null);
const go = (perm, path) => (can(perm) ? () => navigate(path) : null);
const locale = () => (S.lang.value === 'sw' ? 'sw-KE' : 'en-KE');
const weekday = (ms) => new Date(ms).toLocaleDateString(locale(), { weekday: 'long' });

/** Card with a title that links to its report. */
function WCard({ title, sub, onOpen, children, class: c, right }) {
  return (
    <div class={'card dash-card' + (onOpen ? ' linked' : '') + (c ? ' ' + c : '')}>
      <div class="card-h">
        <h3>{onOpen ? <a href="javascript:void 0" onClick={(e) => { e.preventDefault(); onOpen(); }}>{title}</a> : title}</h3>
        {right}
        {sub && <span class="small mute">{sub}</span>}
        {onOpen && <button class="btn ghost xs dash-open" onClick={onOpen} aria-label={t('Open report')}>{t('Report')}<Icon name="chevron-right" size={14} /></button>}
      </div>
      {children}
    </div>
  );
}

/** Plain-language headline: "You sold KES 23,400 today, 12% more than last Monday at this time." */
export function headline(f) {
  const tot = f.today.total, wk = f.lastWk.total, y = f.yest.total;
  if (!f.today.count) return y ? t('No sales yet today. By this time yesterday you had sold {v}.', { v: money(y) }) : t('No sales yet today.');
  const day = weekday(f.at - 7 * DAY);
  if (wk) {
    const d = delta(tot, wk);
    if (Math.abs(d) < 1) return t('You sold {v} today, about the same as last {day} at this time.', { v: money(tot), day });
    return d > 0 ? t('You sold {v} today, {p}% more than last {day} at this time.', { v: money(tot), p: Math.round(d), day }) : t('You sold {v} today, {p}% less than last {day} at this time.', { v: money(tot), p: Math.round(-d), day });
  }
  if (y) { const d = delta(tot, y); return d >= 0 ? t('You sold {v} today, {p}% more than yesterday at this time.', { v: money(tot), p: Math.round(d) }) : t('You sold {v} today, {p}% less than yesterday at this time.', { v: money(tot), p: Math.round(-d) }); }
  return t('You sold {v} today from {n} sales.', { v: money(tot), n: f.today.count });
}

function Kpi({ label, value, now, yest, wk, icon, spark, onOpen }) {
  const d1 = delta(now, yest), d7 = delta(now, wk);
  const Tag = onOpen ? 'button' : 'div';
  return (
    <Tag type={onOpen ? 'button' : undefined} class={'card stat dash-kpi' + (onOpen ? ' click' : '')} onClick={onOpen} style={{ position: 'relative', overflow: 'hidden' }}>
      <div class="k"><Icon name={icon} size={16} />{label}</div>
      <div class="v">{value}</div>
      <div class="small" style={{ marginTop: '6px', lineHeight: 1.5 }}>
        {d1 != null && <div><span class={d1 >= 0 ? 'up bold' : 'down bold'}>{d1 >= 0 ? '▲' : '▼'} {Math.abs(d1).toFixed(0)}%</span> <span class="mute">{t('vs yesterday')}</span></div>}
        {d7 != null && <div class="mute">{d7 >= 0 ? '+' : '−'}{Math.abs(d7).toFixed(0)}% {t('vs same day last week')}</div>}
        {d1 == null && d7 == null && <div class="mute">{t('No sales yet at this time yesterday')}</div>}
      </div>
      {spark && <div class="kpi-spark" style={{ position: 'absolute', right: '12px', top: '14px', opacity: 0.9 }}><Sparkline data={spark} width={90} height={30} /></div>}
    </Tag>
  );
}
export function KpiRow({ f }) {
  const today = '?preset=today';
  return (
    <div class="col" style={{ gap: '12px' }}>
      <div class="dash-headline" data-testid="headline">
        <span class="dh-ico"><Icon name="sparkle" size={18} /></span>
        <span class="grow">{headline(f)}{f.today.top[0] ? <span class="mute"> {t('Best seller: {p}.', { p: f.today.top[0].name })}</span> : null}</span>
        {can('reports.view') && <a class="btn sm" href={'#/reports/sales' + today}>{t('Today\'s report')}<Icon name="chevron-right" size={15} /></a>}
      </div>
      <div class="grid3 kpi-grid">
        <Kpi label={t('Sales today')} icon="receipt" value={money(f.today.total)} now={f.today.total} yest={f.yest.total} wk={f.lastWk.total} spark={f.days.map((d) => d.total)} onOpen={go('reports.view', '/reports/sales' + today)} />
        <Kpi label={t('Transactions')} icon="cart" value={f.today.count} now={f.today.count} yest={f.yest.count} wk={f.lastWk.count} onOpen={go('reports.view', '/reports/hours' + today)} />
        <Kpi label={t('Average basket')} icon="bag" value={money(f.today.avg)} now={f.today.avg} yest={f.yest.avg} wk={f.lastWk.avg} onOpen={go('reports.view', '/reports/products' + today)} />
        {can('products.cost_view') && <Kpi label={t('Gross profit')} icon="chart" value={money(f.today.profit)} now={f.today.profit} yest={f.yest.profit} wk={f.lastWk.profit} onOpen={go('reports.profit', '/reports/profit' + today)} />}
      </div>
    </div>
  );
}
export function HourlyWidget({ f }) {
  const nowH = new Date(f.at).getHours();
  const act = (i) => f.today.hours[i] > 0 || f.yestFull.hours[i] > 0;
  let h0 = 6, h1 = 20;
  for (let i = 0; i < 24; i++) if (act(i)) { h0 = Math.min(h0, i); h1 = Math.max(h1, i); }
  const range = [];
  for (let h = h0; h <= h1; h++) range.push(h);
  return (
    <WCard title={t('Sales by hour — today')} onOpen={go('reports.view', '/reports/sales?preset=today')}>
      <div class="card-b">
        <div class="legend small" style={{ marginBottom: '6px' }}><span><i style={{ background: C.navy }} />{t('Today')}</span><span><i style={{ background: '#8f99ad', height: '3px' }} />{t('Yesterday')}</span></div><Bars data={range.map((h) => ({ label: String(h).padStart(2, '0'), value: h <= nowH ? f.today.hours[h] / 100 : 0, title: `${String(h).padStart(2, '0')}:00 — ${t('Today')} ${kes(f.today.hours[h])} · ${t('Yesterday')} ${kes(f.yestFull.hours[h])}` }))} line={range.map((h) => ({ value: f.yestFull.hours[h] / 100 }))} lineColor="#8f99ad" lineDash="5 4" color={C.navy} height={210} highlight={range.indexOf(nowH)} ariaLabel={t('Sales by hour — today')} /></div>
    </WCard>
  );
}
export function TrendWidget({ f }) {
  const from = dayKey(f.days[0].d0), to = dayKey(f.days[29].d0);
  return (
    <WCard title={t('Last 30 days')} right={<b class="mono small">{money(f.days.reduce((s, d) => s + d.total, 0))}</b>} onOpen={go('reports.view', `/reports/sales?from=${from}&to=${to}`)}>
      <div class="card-b"><Bars data={f.days.map((d) => ({ label: new Date(d.d0).getDate() + '', value: d.total / 100, title: new Date(d.d0).toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' }) + ': ' + kes(d.total) }))} color={C.teal} highlight={29} height={170} onPick={can('reports.view') ? (i) => navigate(`/reports/sales?from=${dayKey(f.days[i].d0)}&to=${dayKey(f.days[i].d0)}`) : null} /></div>
    </WCard>
  );
}
export function PaymentsWidget({ f }) {
  const data = Object.entries(f.today.byMethod).map(([m, v], i) => ({ label: methodLabel(m), value: v, color: METHOD_COLORS[m] || [C.navy, C.teal, C.plum][i % 3] })).sort((a, b) => b.value - a.value);
  const tot = data.reduce((s, d) => s + d.value, 0);
  return (
    <WCard title={t('Payment methods — today')} onOpen={go('reports.view', '/reports/payments?preset=today')}>
      <div class="card-b row" style={{ gap: '18px', flexWrap: 'wrap' }}>
        {tot ? <><Donut data={data} size={140} center={Math.round(pct(data[0].value, tot)) + '%'} />
          <div class="col gap-s grow" style={{ minWidth: '150px' }}>{data.map((d) => <div class="row small"><i class="sw-dot" style={{ background: d.color }} /><span class="grow">{d.label}</span><b class="mono">{kes(d.value)}</b><span class="mute" style={{ width: '38px', textAlign: 'right' }}>{pct(d.value, tot).toFixed(0)}%</span></div>)}</div></>
          : <Empty icon="wallet" title={t('No payments yet today')} />}
      </div>
    </WCard>
  );
}
export function TopProductsWidget({ f }) {
  const top = f.today.top.slice(0, 6);
  return (
    <WCard title={t('Top products — today')} onOpen={go('reports.view', '/reports/products?preset=today')}>
      <div class="card-b">
        {top.length ? <HBars stack rows={top.map((p) => ({ label: p.name, sub: Math.round(p.qty * 100) / 100 + '×', value: p.total, right: kes(Math.round(p.total / 100) * 100) }))} color={C.navy} onPick={can('products.view') ? (r, i) => navigate('/products/' + top[i].id) : null} />
          : <Empty icon="box" title={t('Nothing sold yet today')} />}
      </div>
    </WCard>
  );
}
// Low stock — one widget for every business (inventory's richer drill-downs when the user may open Stock).
const stockPath = (id) => (can('inventory.view') ? '/inventory/product/' + id : '/products/' + id);
export function LowStockWidget() {
  const all = lowStockList();
  const list = all.slice().sort((a, b) => (levels.value.get(a.id) || 0) - (levels.value.get(b.id) || 0)).slice(0, 6);
  return (
    <WCard class="col" title={t('Low stock')} right={all.length > 0 && <Badge tone="warn">{all.length}</Badge>} onOpen={go('reports.stock', '/reports/low-stock') || go('inventory.view', '/inventory?filter=low')}>
      <div class="grow">
        {list.map((p) => { const q = levels.value.get(p.id) || 0; return <div class="list-item click" onClick={() => navigate(stockPath(p.id))}><span class="grow ellipsis">{p.name}</span><Badge tone={q <= 0 ? 'bad' : 'warn'}>{t('{n} left', { n: Math.round(q * 100) / 100 })}</Badge><span class="small mute nowrap">{t('min. {n}', { n: p.reorder_level })}</span></div>; })}
        {!list.length && <Empty icon="check" title={t('Stock levels look good')} />}
      </div>
      {all.length > 0 && can('purchasing.orders') && <div class="dash-foot"><button class="btn sm block" onClick={() => navigate('/inventory/reorder')}><Icon name="file" size={16} />{t('Order these items')}</button></div>}
    </WCard>
  );
}
export function ExpiryWidget() {
  const [rows, setRows] = useState(null);
  const days = S.settings.value.notify_expiry_days || 30;
  useEffect(() => {
    (async () => {
      const ids = catalog.value.products.filter((p) => p.track_batches).map((p) => p.id);
      if (!ids.length) return setRows([]);
      const moves = await db().stock_moves.where('product_id').anyOf(ids).toArray();
      setRows(expiryList(moves, catalog.value.byId, S.branch.value?.id).filter((r) => r.days <= days));
    })();
  }, [S.branch.value?.id]);
  if (!rows || (!rows.length && !catalog.value.products.some((p) => p.track_batches))) return null;
  return (
    <WCard title={t('Expiring soon')} sub={t('next {n} days', { n: days })} onOpen={go('reports.stock', '/reports/expiry') || go('inventory.view', '/inventory/expiry')}>
      {rows.slice(0, 6).map((r) => <div class="list-item click" onClick={() => navigate(can('inventory.view') ? '/inventory/expiry' : '/products/' + r.product_id)}><span class="grow ellipsis">{r.name}<small class="mute" style={{ display: 'block' }}>{t('Batch')} {r.batch_no} · {t('{n} left', { n: Math.round(r.qty * 100) / 100 })}</small></span><Badge tone={r.days < 0 ? 'bad' : 'warn'}>{r.days < 0 ? t('Expired') : r.days === 0 ? t('Today') : t('in {n} days', { n: r.days })}</Badge></div>)}
      {!rows.length && <Empty icon="check" title={t('Nothing expires soon')} />}
    </WCard>
  );
}
export function DebtorsWidget() {
  const [rows, setRows] = useState(null);
  useEffect(() => { Promise.all([allBalances(), db().customers.toArray()]).then(([b, cs]) => setRows(cs.filter((c) => !c.deleted && (b.get(c.id) || 0) > 0).map((c) => ({ ...c, bal: b.get(c.id) })).sort((a, z) => z.bal - a.bal))); }, []);
  if (!rows) return <div class="card" />;
  return (
    <WCard title={t('Debtors')} right={<b class="mono down">{money(rows.reduce((s, r) => s + r.bal, 0))}</b>} onOpen={go('reports.view', '/reports/aging')}>
      {rows.slice(0, 6).map((c) => <div class="list-item click" onClick={() => navigate('/customers/' + c.id)}><span class="grow ellipsis">{c.name}</span><b class="mono down">{kes(c.bal)}</b></div>)}
      {!rows.length && <Empty icon="smile" title={t('Nobody owes you money')} />}
    </WCard>
  );
}
export function OpenShiftsWidget() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    (async () => {
      const open = (await db().shifts.where('status').equals('open').toArray()).filter((s) => !s.deleted);
      const [users, devices, brs] = await Promise.all([db().users.toArray(), db().devices.toArray(), db().branches.toArray()]);
      const name = (list, id) => list.find((x) => x.id === id)?.name || '';
      setRows(await Promise.all(open.map(async (s) => {
        const ss = (await db().sales.where('shift_id').equals(s.id).toArray()).filter((x) => !x.deleted && x.status !== 'void');
        return { ...s, who: name(users, s.user_id), till: name(devices, s.device_id), branch: name(brs, s.branch_id), total: ss.reduce((a, x) => a + x.total, 0), count: ss.length };
      })));
    })();
  }, [S.shift.value?.id]);
  if (!rows) return <div class="card" />;
  const multi = (S.branches.value || []).length > 1;
  return (
    <WCard title={t('Open shifts')} right={<Badge tone={rows.length ? 'ok' : null}>{rows.length}</Badge>} onOpen={can('shift.view_all') && can('reports.open') ? () => navigate('/reports/shifts') : can('shift.open_close') ? () => navigate('/shifts') : null}>
      {rows.map((s) => <div class="list-item"><span class="dot ok" /><span class="grow ellipsis"><b>{s.who || t('Unknown')}</b><small class="mute" style={{ display: 'block' }}>{[s.till, multi ? s.branch : '', t('since {h}', { h: new Date(s.opened_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) })].filter(Boolean).join(' · ')}</small></span><b class="mono">{kes(s.total)}</b></div>)}
      {!rows.length && <Empty icon="clock" title={t('No till is open')} text={t('Open a shift to count the cash at the end of the day.')} />}
    </WCard>
  );
}
export function BranchesWidget({ f }) {
  if (!f.branches) return null;
  const tot = f.branches.reduce((a, b) => a + b.total, 0);
  return (
    <WCard title={t('Branches today')} right={<b class="mono small">{money(tot)}</b>} onOpen={go('reports.view', '/reports/sales?preset=today')}>
      <div class="card-b"><HBars rows={f.branches.map((b, i) => { const d = delta(b.total, b.yest); return { label: b.name, sub: t('{n} sales', { n: b.count }) + (d == null ? '' : ' · ' + (d >= 0 ? '▲ ' : '▼ ') + Math.abs(d).toFixed(0) + '% ' + t('vs yesterday')), value: b.total, right: kes(b.total), color: [C.navy, C.teal, C.sun, C.plum][i % 4] }; })} /></div>
    </WCard>
  );
}
export function TrialWidget() {
  const lic = licenceState();
  if (S.isDemo.value || lic.status !== 'trial' || lic.days_left == null || !can('billing.manage')) return null;
  const left = Math.max(0, lic.days_left);
  return (
    <div class={'card dash-trial' + (left <= 7 ? ' soon' : '')}>
      <span class="dh-ico"><Icon name="calendar" size={18} /></span>
      <div class="grow"><b>{left === 0 ? t('Your free trial ends today') : t('Free trial: {n} days left', { n: left })}</b><div class="small mute">{t('Everything you record is kept when you subscribe. Pay by M-Pesa in a minute.')}</div></div>
      <Progress value={((30 - left) / 30) * 100} />
      <a class="btn sun sm" href="#/settings/licence">{t('See plans')}</a>
    </div>
  );
}

export function SetupChecklist() {
  const [st, setSt] = useState(null);
  const biz = S.business.value;
  useEffect(() => {
    (async () => {
      const [hidden, products, staff, sales, backup] = await Promise.all([getMeta('checklist_hidden'), db().products.count(), db().users.count(), db().sales.count(), getMeta('last_backup_at')]);
      setSt({ hidden, items: [
        { k: 'profile', done: !!(biz.phone && biz.town), label: t('Add business details & logo'), href: '#/settings/business' },
        { k: 'tax', done: biz.kra_pin !== undefined && (biz.kra_pin || biz.vat_registered === false) && !!biz.settings?.tax_reviewed, label: t('Confirm KRA PIN & VAT'), href: '#/settings/tax' },
        { k: 'pay', done: !!(biz.settings?.mpesa_till || biz.settings?.mpesa_paybill), label: t('Add your M-Pesa till or paybill'), href: '#/settings/payments' },
        { k: 'products', done: products > 0, label: t('Add your products'), href: '#/products' },
        { k: 'staff', done: staff > 1, label: t('Add staff with their own PINs'), href: '#/settings/staff' },
        { k: 'print', done: !!biz.settings?.printer_tested, label: t('Print a test receipt'), href: '#/settings/printing' },
        { k: 'sale', done: sales > 0, label: t('Make your first sale'), href: '#/sell' },
        { k: 'backup', done: !!backup, label: t('Download your first backup'), href: '#/settings/backup' }
      ] });
    })();
  }, [biz?.updated_at]);
  if (!st || st.hidden || S.isDemo.value || !can('settings.edit')) return null;
  const done = st.items.filter((i) => i.done).length;
  if (done === st.items.length) return null;
  return (
    <div class="card">
      <div class="card-h"><h3>{t('Get set up')}</h3><span class="small mute">{done}/{st.items.length}</span><button class="btn ghost xs" onClick={() => { setMeta('checklist_hidden', true); setSt({ ...st, hidden: true }); }}>{t('Hide')}</button></div>
      <div class="card-b" style={{ paddingTop: '10px' }}>
        <Progress value={(done / st.items.length) * 100} />
        <div class="checklist" style={{ marginTop: '8px' }}>
          {st.items.map((i) => <a class={'ci' + (i.done ? ' done' : '')} href={i.href} style={{ textDecoration: 'none', color: 'inherit' }}><span class="b">{i.done && <Icon name="check" size={14} stroke={3} />}</span><span class="tx grow">{i.label}</span>{!i.done && <Icon name="chevron-right" size={16} />}</a>)}
        </div>
      </div>
    </div>
  );
}

