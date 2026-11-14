// Expenses: month view with totals by category, 6-month trend, list, record / delete, categories.
import { useEffect, useState } from 'preact/hooks';
import { db } from '../../db/index.js';
import { PageHeader, Btn, Icon, Badge, Empty, SkeletonRows } from '../../ui/kit.jsx';
import { Table } from '../../ui/table.jsx';
import { openModal, Drawer, toast, confirm } from '../../ui/overlay.jsx';
import { Bars, HBars, C } from '../reports/viz.jsx';
import { money, kes } from '../../lib/money.js';
import { on } from '../../lib/bus.js';
import { can } from '../../auth/permissions.js';
import { methodLabel } from '../../print/templates.js';
import { deleteExpense, restoreExpense } from './api.js';
import { recordExpenseDialog, categoriesDialog } from './dialogs.jsx';
import { expenseCatLabel, expenseCatIcon } from './cats.js';
import { catColor } from '../reports/expcolors.js';
import * as S from '../../state.js';
import { t, tn } from '../../i18n/index.js';

const ym = (d) => d.getFullYear() * 12 + d.getMonth();
const monthName = (k, opts = { month: 'long', year: 'numeric' }) => new Date(Math.floor(k / 12), k % 12, 1).toLocaleDateString(S.lang.value === 'sw' ? 'sw-KE' : 'en-KE', opts);
const keyOf = (k) => `${Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, '0')}`;

export default function ExpensesPage({ query }) {
  const now = ym(new Date());
  const [m, setM] = useState(query?.month ? (() => { const [y, mm] = query.month.split('-').map(Number); return y * 12 + mm - 1; })() : now);
  const [rows, setRows] = useState(null);
  const [trend, setTrend] = useState([]);
  const [cat, setCat] = useState('');
  const [users, setUsers] = useState(new Map());
  const load = async () => {
    const a = keyOf(m - 5) + '-01', b = keyOf(m) + '-31';
    const all = (await db().expenses.where('date').between(a, b, true, true).toArray()).filter((x) => !x.deleted && (!x.branch_id || x.branch_id === S.branch.value?.id || (S.branches.value || []).length < 2));
    const cur = all.filter((x) => x.date.startsWith(keyOf(m))).sort((x, y) => (y.date + y.created_at).localeCompare(x.date + x.created_at));
    setRows(cur);
    setTrend(Array.from({ length: 6 }, (_, i) => { const k = m - 5 + i; const p = keyOf(k); return { k, total: all.filter((x) => x.date.startsWith(p)).reduce((s, x) => s + x.amount, 0) }; }));
  };
  useEffect(() => { load(); return on('change', (e) => e === 'expenses' && load()); }, [m, S.branch.value?.id]);
  useEffect(() => { db().users.toArray().then((u) => setUsers(new Map(u.map((x) => [x.id, x])))); }, []);
  const total = rows ? rows.reduce((s, x) => s + x.amount, 0) : 0;
  const prev = trend[4]?.total || 0;
  const cats = new Map();
  for (const x of rows || []) cats.set(x.category, (cats.get(x.category) || 0) + x.amount);
  const catRows = [...cats].sort((a, b) => b[1] - a[1]);
  const shown = (rows || []).filter((x) => !cat || x.category === cat);
  const drawer = (rows || []).filter((x) => x.shift_id && x.method === 'cash').reduce((s, x) => s + x.amount, 0);
  const chg = prev ? ((total - prev) / prev) * 100 : null;
  const rec = can('expenses.record');
  return (
    <div class="page exp-page">
      <PageHeader title={t('Expenses')} sub={t('Rent, salaries, transport and other running costs. They are taken off your profit in Profit & loss.')}
        actions={<>
          {can('expenses.categories') && <Btn icon="tags" onClick={() => categoriesDialog().then(load)}>{t('Categories')}</Btn>}
          {can('reports.open') && can('expenses.view') && <Btn icon="chart" onClick={() => location.assign('#/reports/expenses?from=' + keyOf(m) + '-01&to=' + keyOf(m) + '-' + String(new Date(Math.floor(m / 12), (m % 12) + 1, 0).getDate()).padStart(2, '0'))}>{t('Report')}</Btn>}
          {rec && <Btn variant="primary" icon="plus" onClick={() => recordExpenseDialog()}>{t('Record expense')}</Btn>}
        </>} />
      <div class="exp-month mb">
        <Btn icon="chevron-left" aria-label={t('Previous month')} onClick={() => { setM(m - 1); setCat(''); }} />
        <b class="exp-mname">{monthName(m)}</b>
        <Btn icon="chevron-right" aria-label={t('Next month')} disabled={m >= now} onClick={() => { setM(m + 1); setCat(''); }} />
        {m !== now && <button class="chip" onClick={() => { setM(now); setCat(''); }}>{t('This month')}</button>}
      </div>
      {!rows ? <SkeletonRows n={5} h={70} /> : (
        <>
          <div class="rpt-kpis">
            <div class="card stat"><div class="k"><Icon name="wallet" size={16} />{t('Spent in {m}', { m: monthName(m, { month: 'long' }) })}</div><div class="v">{money(total)}</div><div class="d mute">{tn(rows.length, '{n} expense', '{n} expenses')}</div></div>
            <div class="card stat"><div class="k"><Icon name="calendar" size={16} />{t('Compared with last month')}</div><div class={'v ' + (chg == null ? '' : chg > 0 ? 'down' : 'up')}>{chg == null ? '—' : (chg > 0 ? '+' : '−') + Math.abs(chg).toFixed(0) + '%'}</div><div class="d mute">{monthName(m - 1, { month: 'long' })}: {money(prev)}</div></div>
            <div class="card stat"><div class="k"><Icon name="cash" size={16} />{t('Taken from the till')}</div><div class="v">{money(drawer)}</div><div class="d mute">{t('Included in shift cash counts')}</div></div>
            <div class="card stat"><div class="k"><Icon name="tag" size={16} />{t('Biggest cost')}</div><div class="v ellipsis" style={{ fontSize: '19px', fontFamily: 'var(--f-head)' }}>{catRows[0] ? expenseCatLabel(catRows[0][0]) : '—'}</div><div class="d mute">{catRows[0] ? money(catRows[0][1]) : ''}</div></div>
          </div>
          {!rows.length ? (
            <div class="card"><Empty icon="wallet" title={t('No expenses recorded in {m}', { m: monthName(m) })} text={t('Record rent, salaries, transport, electricity and other costs here. Your Profit & loss report then shows what the business really made.')}>{rec && <Btn variant="primary" icon="plus" onClick={() => recordExpenseDialog()}>{t('Record expense')}</Btn>}</Empty></div>
          ) : (
            <div class="split-even mb" style={{ alignItems: 'start' }}>
              <div class="card">
                <div class="card-h"><h3>{t('By category')}</h3>{cat && <button class="chip" onClick={() => setCat('')}>{t('Show all')} <Icon name="x" size={14} /></button>}</div>
                <div class="card-b"><HBars rows={catRows.map(([id, v], i) => ({ id, label: expenseCatLabel(id), value: v / 100, right: kes(v), color: cat && cat !== id ? '#d9d5cc' : catColor(id, i), sub: total ? Math.round((v / total) * 100) + '%' : '' }))} onPick={(r) => setCat(cat === r.id ? '' : r.id)} /></div>
              </div>
              <div class="card">
                <div class="card-h"><h3>{t('Monthly totals')}</h3><span class="small mute">KES</span></div>
                <div class="card-b"><Bars data={trend.map((x) => ({ label: monthName(x.k, { month: 'short' }), value: x.total / 100 }))} highlight={5} color={C.navy} height={190} onPick={(i) => { setM(trend[i].k); setCat(''); }} /></div>
              </div>
            </div>
          )}
          {rows.length > 0 && (
            <div class="card">
              <div class="card-h"><h3>{cat ? expenseCatLabel(cat) : t('All expenses')}</h3><b class="mono">{money(shown.reduce((s, x) => s + x.amount, 0))}</b></div>
              <Table rows={shown} onRowClick={(x) => openExpense(x, users)} columns={[
                { key: 'date', label: t('Date'), render: (x) => new Date(x.date + 'T00:00').toLocaleDateString('en-KE', { day: '2-digit', month: 'short' }) },
                { key: 'category', label: t('Category'), render: (x) => <span class="row gap-s" style={{ flexWrap: 'nowrap' }}><Icon name={expenseCatIcon(x.category)} size={16} /><span class="ellipsis">{expenseCatLabel(x.category)}</span></span> },
                { key: 'payee', label: t('Paid to'), hideMobile: true, render: (x) => x.payee || <span class="mute">—</span> },
                { key: 'method', label: t('Paid with'), hideMobile: true, render: (x) => <span>{methodLabel(x.method)}{x.shift_id && x.method === 'cash' && <> <Badge tone="warn">{t('From till')}</Badge></>}</span> },
                { key: 'user_id', label: t('Recorded by'), hideMobile: true, render: (x) => users.get(x.user_id)?.name?.split(' ')[0] || '' },
                { key: 'amount', label: t('Amount'), num: true, render: (x) => kes(x.amount) }
              ]} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function openExpense(x, users) {
  return openModal((close) => (
    <Drawer title={expenseCatLabel(x.category)} onClose={() => close()} footer={<>
      {can('expenses.record') && <Btn variant="danger" icon="trash" onClick={async () => {
        if (!(await confirm({ title: t('Delete this expense?'), message: t('{c} of {a} on {d} will be removed from your reports.', { c: expenseCatLabel(x.category), a: money(x.amount), d: x.date }), ok: t('Delete'), danger: true }))) return;
        await deleteExpense(x); close();
        toast(t('Expense deleted'), { action: { label: t('Undo'), fn: () => restoreExpense(x) } });
      }}>{t('Delete')}</Btn>}
      <span class="spacer" /><Btn onClick={() => close()}>{t('Close')}</Btn></>}>
      <div class="big-num mono" style={{ margin: '4px 0 14px' }}>{money(x.amount)}</div>
      <div class="kv">
        {[[t('Date'), new Date(x.date + 'T00:00').toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })], [t('Category'), expenseCatLabel(x.category)], [t('Paid to'), x.payee || '—'], [t('Paid with'), methodLabel(x.method) + (x.shift_id && x.method === 'cash' ? ' · ' + t('taken from the till') : '')], [t('Reference'), x.ref || '—'], [t('Note'), x.note || '—'], [t('Recorded by'), users.get(x.user_id)?.name || '—'], [t('Recorded at'), new Date(x.created_at).toLocaleString('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })]].map(([k, v]) => <div class="row" style={{ padding: '9px 0', borderBottom: '1px solid var(--line)' }}><span class="mute grow">{k}</span><b style={{ textAlign: 'right' }}>{v}</b></div>)}
      </div>
    </Drawer>
  ));
}
