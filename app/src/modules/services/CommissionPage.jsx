// Staff commission report: period, staff, services done, sales amount, commission — print & CSV.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { PageHeader, Btn, Icon, Stat, Empty, Select, Avatar, Badge } from '../../ui/kit.jsx';
import { Table } from '../../ui/table.jsx';
import { DateRange, rangeFor } from '../../ui/daterange.jsx';
import { previewPrint } from '../../ui/printpreview.jsx';
import { doc } from '../../print/print.js';
import { money, kes } from '../../lib/money.js';
import { esc, toCsv, download } from '../../lib/util.js';
import { navigate } from '../../router.js';
import * as S from '../../state.js';
import { t, tn } from '../../i18n/index.js';
import { commissionRows, byStaff, serviceStaff } from './logic.js';
import './services.css';

const dfmt = (ms) => new Date(ms).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
export default function CommissionPage({ query }) {
  const [range, setRange] = useState(() => ({ preset: 'month', ...rangeFor('month') }));
  const [staff, setStaff] = useState(query?.staff || '');
  const [rows, setRows] = useState(null);
  useEffect(() => { setRows(null); commissionRows(range.from, range.to - 1, staff).then(setRows); }, [range.from, range.to, staff]);
  const groups = useMemo(() => byStaff(rows || []), [rows]);
  const tot = groups.reduce((s, g) => ({ amount: s.amount + g.amount, commission: s.commission + g.commission, services: s.services + g.services }), { amount: 0, commission: 0, services: 0 });
  const people = serviceStaff();
  const csv = () => download(`commission-${new Date(range.from).toISOString().slice(0, 10)}.csv`, toCsv(rows, [
    // CSV column names stay English (spreadsheets re-import them)
    { key: 'date', get: (r) => new Date(r.at).toISOString().slice(0, 16).replace('T', ' ') }, { key: 'receipt', get: (r) => r.no }, { key: 'staff' },
    { key: 'item', get: (r) => r.name }, { key: 'qty' }, { key: 'amount', get: (r) => (r.amount / 100).toFixed(2) }, { key: 'rate_pct', get: (r) => r.rate },
    { key: 'commission', get: (r) => (r.commission / 100).toFixed(2) }]), 'text/csv');
  const print = () => {
    const b = S.business.value;
    const body = `<h2 style="margin:0">${esc(b.name)}</h2><div class="s">${t('Staff commission')} · ${dfmt(range.from)} – ${dfmt(range.to - 1)}</div><div class="hr2"></div>
    <table><tr><th>${t('Staff')}</th><th class="r">${t('Services')}</th><th class="r">${t('Sales')}</th><th class="r">${t('Commission')}</th></tr>
    ${groups.map((g) => `<tr><td>${esc(g.staff)}</td><td class="r">${g.services}</td><td class="r">${kes(g.amount)}</td><td class="r b">${kes(g.commission)}</td></tr>`).join('')}
    <tr><td class="b">${t('Total')}</td><td class="r b">${tot.services}</td><td class="r b">${kes(tot.amount)}</td><td class="r b">${kes(tot.commission)}</td></tr></table>
    ${staff ? `<div class="hr"></div><table class="s"><tr><th>${t('Date')}</th><th>${t('Receipt')}</th><th>${t('Item')}</th><th class="r">${t('Amount')}</th><th class="r">%</th><th class="r">${t('Commission')}</th></tr>${rows.map((r) => `<tr><td>${dfmt(r.at)}</td><td>${esc(r.no)}</td><td>${esc(r.name)}</td><td class="r">${kes(r.amount)}</td><td class="r">${r.rate}</td><td class="r">${kes(r.commission)}</td></tr>`).join('')}</table>` : ''}
    <div class="hr"></div><div class="s">${t('Signed')}: ____________________ &nbsp; ${t('Date')}: ____________</div>`;
    previewPrint(doc(body, { paper: 'a4', title: t('Staff commission'), css: 'td,th{padding:5px 6px;border-bottom:1px solid #ddd}' }), { title: t('Staff commission'), paper: 'a4' });
  };
  return (
    <div class="page wide">
      <PageHeader title={t('Staff commission')} sub={t('Commission earned on services, per staff member')}
        actions={<><Btn icon="print" onClick={print} disabled={!rows?.length}>{t('Print')}</Btn><Btn icon="download" onClick={csv} disabled={!rows?.length}>CSV</Btn></>} />
      <div class="row wrap mb" style={{ gap: '10px' }}>
        <DateRange value={range} onValue={setRange} />
        <Select value={staff} onValue={setStaff} options={[{ value: '', label: t('All staff') }, ...people.map((u) => ({ value: u.id, label: u.name }))]} aria-label={t('Staff')} />
      </div>
      <div class="grid3 kpi-grid mb">
        <Stat label={t('Commission to pay')} value={money(tot.commission)} icon="wallet" />
        <Stat label={t('Sales by staff')} value={money(tot.amount)} icon="receipt" />
        <Stat label={t('Services done')} value={tot.services} icon="scissors" />
        <Stat label={t('Staff')} value={groups.length} icon="users" />
      </div>
      {!rows ? <div class="card" style={{ minHeight: '200px' }} /> : !rows.length ? (
        <div class="card"><Empty icon="scissors" title={t('No services in this period')} text={t('Choose who did each service on the Sell screen (tap the scissors chip on the line). Commission shows here.')}><Btn onClick={() => navigate('/settings/services')} icon="percent">{t('Set commission rates')}</Btn></Empty></div>
      ) : (
        <div class="split-even">
          <div class="card">
            <div class="card-h"><h3>{t('By staff')}</h3></div>
            {groups.map((g) => {
              const u = S.users.value.find((x) => x.id === g.staff_id);
              return (
                <div class={'list-item click' + (staff === g.staff_id ? ' sel-row' : '')} onClick={() => setStaff(staff === g.staff_id ? '' : g.staff_id)}>
                  <Avatar name={g.staff} />
                  <div class="grow"><b>{g.staff}</b><div class="small mute">{tn(g.services, '{n} service', '{n} services')}{g.items ? ' · ' + tn(g.items, '{n} product', '{n} products') : ''} · {money(g.amount)}{u?.commission_pct ? ' · ' + u.commission_pct + '%' : ''}</div></div>
                  <b class="mono up">{money(g.commission)}</b>
                </div>
              );
            })}
          </div>
          <div class="card">
            <div class="card-h"><h3>{staff ? t('Services by {name}', { name: people.find((u) => u.id === staff)?.name || '' }) : t('Latest services')}</h3>{staff && <Btn size="sm" variant="ghost" icon="x" onClick={() => setStaff('')}>{t('All staff')}</Btn>}</div>
            <div style={{ maxHeight: '520px', overflow: 'auto' }}>
              <Table rows={rows.slice(0, 300)} dense columns={[
                { key: 'at', label: t('Date'), render: (r) => <span class="small">{new Date(r.at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}</span> },
                { key: 'name', label: t('Service'), render: (r) => <span>{r.name}{!staff && <div class="tiny mute">{r.staff}</div>}</span> },
                { key: 'amount', label: t('Amount'), num: true, render: (r) => <span class="mono">{kes(r.amount)}</span> },
                { key: 'rate', label: '%', num: true, hideMobile: true, render: (r) => <span class="mono">{r.rate}</span> },
                { key: 'commission', label: t('Commission'), num: true, render: (r) => <b class="mono">{kes(r.commission)}</b> }
              ]} onRowClick={(r) => navigate('/sales/' + r.sale_id)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
