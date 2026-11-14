// One report: filters (period, branch, report-specific), plain-language summary, KPI cards, charts, sortable tables,
// A4 print and CSV export. Results are exposed on window.__report for QA cross-checks.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { reportById, REPORTS, moveLabel, actionLabel } from './defs.jsx';
import { cellText, kpiText, exportCsv, reportHtml, periodText, raw } from './format.js';
import { all as allOf } from './data.js';
import { PageHeader, Btn, Icon, Empty, Select, SearchBox, Seg, Skeleton } from '../../ui/kit.jsx';
import { DateRange, rangeFor } from '../../ui/daterange.jsx';
import { previewPrint } from '../../ui/printpreview.jsx';
import { toast } from '../../ui/overlay.jsx';
import { can } from '../../auth/permissions.js';
import { navigate } from '../../router.js';
import { on } from '../../lib/bus.js';
import { startOfDay, DAY, debounce } from '../../lib/util.js';
import * as S from '../../state.js';
import { t, tn } from '../../i18n/index.js';

// period chosen by the user is kept while moving between reports (this session only)
let picked = null;
const PRESETS = ['today', 'yesterday', 'week', 'month', 'lastmonth'];
function initialRange(def, q) {
  if (q.from) { const from = new Date(q.from + 'T00:00').getTime(); const to = new Date((q.to || q.from) + 'T00:00').getTime() + DAY; if (!isNaN(from) && !isNaN(to)) return { preset: 'custom', from, to }; }
  if (q.preset && PRESETS.includes(q.preset)) return { preset: q.preset, ...rangeFor(q.preset) };
  if (picked) return picked;
  const p = def?.preset || 'month';
  if (p === 'last30' || p === 'last90') { const n = p === 'last30' ? 30 : 90; const today = startOfDay(); return { preset: 'custom', from: today - (n - 1) * DAY, to: today + DAY }; }
  return { preset: p, ...rangeFor(p) };
}

export default function ReportPage({ params, query }) {
  const def = reportById(params.id);
  const [range, setRangeS] = useState(() => initialRange(def, query));
  const multi = (S.branches.value || []).filter((b) => !b.deleted).length > 1;
  const [branch, setBranch] = useState(query.branch || '');
  const [f, setF] = useState({ customer: query.customer || '', user: query.user || '', action: query.action || '', days: query.days || '30', moveType: query.type || '' });
  const [q, setQ] = useState('');
  const [qd, setQd] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [tick, setTick] = useState(0);
  const [customers, setCustomers] = useState([]);
  const seq = useRef(0);
  const setRange = (r) => { picked = r; setRangeS(r); };
  const debQ = useMemo(() => debounce(setQd, 200), []);
  useEffect(() => { setRangeS(initialRange(def, query)); setRes(null); setQ(''); setQd(''); setF((x) => ({ ...x, customer: query.customer || '', moveType: query.type || '' })); }, [params.id, query.from, query.to, query.preset, query.customer]);
  useEffect(() => on('change', (e) => ['sales', 'returns', 'expenses', 'stock_levels', 'stock_moves', 'audit', 'shifts', 'customer_payments', 'goods_received', 'supplier_payments', 'products'].includes(e) && setTick((n) => n + 1)), []);
  useEffect(() => { if (def?.filters?.includes('customer')) customerOptions().then(setCustomers); }, [def?.id]);

  const ctx = { id: def?.id, range: !!def?.range, from: range.from, to: range.to, branch: def?.nobranch ? '' : branch, q: qd, ...f };
  useEffect(() => {
    if (!def || !can(def.perm)) return;
    const my = ++seq.current;
    setBusy(true); setErr('');
    const t0 = performance.now();
    def.run(ctx).then((r) => {
      if (my !== seq.current) return;
      const ms = Math.round(performance.now() - t0);
      setRes({ ...r, ms }); setBusy(false);
      window.__report = { id: def.id, ms, from: ctx.from, to: ctx.to, branch, kpis: r.kpis.map((k) => ({ label: k.label, value: k.value })), tables: r.tables.map((tb) => ({ title: tb.title, rows: tb.rows.length, foot: tb.foot || null, data: tb.rows.slice(0, 3000) })), sentence: r.sentence || '' };
    }).catch((e) => { console.error(e); if (my === seq.current) { setErr(e.message || String(e)); setBusy(false); } });
  }, [def?.id, range.from, range.to, branch, qd, f.customer, f.user, f.action, f.days, f.moveType, tick, S.lang.value]);

  if (!def) return <div class="page"><Empty icon="chart" title={t('Report not found')}><Btn onClick={() => navigate('/reports')}>{t('All reports')}</Btn></Empty></div>;
  if (!can(def.perm)) return <div class="page"><PageHeader back="#/reports" title={t(def.title)} /><Empty icon="lock" title={t('You cannot open this report')} text={t('Ask the owner to give your role access in Settings → Staff & roles.')} /></div>;
  const hasData = res && !res.empty && !res.needs;
  const sib = REPORTS.filter((r) => r.group === def.group && r.id !== def.id && can(r.perm));
  return (
    <div class="page rpt">
      <PageHeader back="#/reports" title={t(def.title)} sub={t(def.desc)}
        actions={<>
          <Btn icon="print" disabled={!hasData} onClick={() => previewPrint(reportHtml(def, res, ctx), { paper: 'a4', title: t(def.title) })}>{t('Print')}</Btn>
          <Btn icon="download" disabled={!hasData} onClick={() => { const n = exportCsv(def, res, ctx); toast(t('Saved {f}', { f: n })); }}>{t('Export CSV')}</Btn>
        </>} />
      <div class="rpt-filters">
        {def.range && <DateRange value={range} onValue={setRange} />}
        <div class="row wrap gap-s">
          {multi && !def.nobranch && <Select value={branch} onValue={setBranch} aria-label={t('Branch')} data-filter="branch" options={[{ value: '', label: t('All branches') }, ...S.branches.value.filter((b) => !b.deleted).map((b) => ({ value: b.id, label: b.name }))]} />}
          {def.filters?.includes('customer') && <Select value={f.customer} onValue={(v) => setF({ ...f, customer: v })} aria-label={t('Customer')} data-filter="customer" options={[{ value: '', label: t('Choose a customer…') }, ...customers]} />}
          {def.filters?.includes('user') && <Select value={f.user} onValue={(v) => setF({ ...f, user: v })} aria-label={t('Staff')} data-filter="user" options={[{ value: '', label: t('Everyone') }, ...(S.users.value || []).map((u) => ({ value: u.id, label: u.name }))]} />}
          {def.filters?.includes('action') && <Select value={f.action} onValue={(v) => setF({ ...f, action: v })} aria-label={t('Action')} data-filter="action" options={[{ value: '', label: t('All actions') }, ...(res?.actions || []).map((a) => ({ value: a, label: actionText(a) }))]} />}
          {def.filters?.includes('days') && <><span class="small mute">{t('No sales in the last')}</span><Seg value={f.days} onValue={(v) => setF({ ...f, days: v })} options={['30', '60', '90', '180'].map((d) => ({ value: d, label: tn(+d, '{n} day', '{n} days') }))} /></>}
          {def.search && <SearchBox value={q} onValue={(v) => { setQ(v); debQ(v); }} placeholder={def.id === 'audit' ? t('Search details') : t('Search products')} />}
        </div>
        {def.filters?.includes('moveType') && res?.chips?.length > 0 && (
          <div class="row wrap gap-s rpt-chips">
            <button class={'chip' + (!f.moveType ? ' on' : '')} onClick={() => setF({ ...f, moveType: '' })}>{t('All')}</button>
            {(f.moveType && !res.chips.find((c) => c.value === f.moveType) ? [{ value: f.moveType, label: moveLabel(f.moveType), count: 0 }, ...res.chips] : res.chips).map((c) => <button class={'chip' + (f.moveType === c.value ? ' on' : '')} onClick={() => setF({ ...f, moveType: f.moveType === c.value ? '' : c.value })}>{c.label} <span class="mute small">{c.count}</span></button>)}
          </div>
        )}
      </div>
      {err && <div class="callout bad mb"><Icon name="alert" size={18} /><span>{t('This report could not be built: {e}', { e: err })}</span></div>}
      {!res ? <ReportSkeleton /> : res.needs ? <div class="card"><Empty {...res.needs} /></div> : res.empty ? (
        <div class="card"><Empty icon={res.empty.icon} title={res.empty.title} text={res.empty.text}>{sib.length > 0 && <div class="small mute" style={{ marginTop: '6px' }}>{periodText(ctx)}</div>}</Empty></div>
      ) : (
        <div class={'rpt-body' + (busy ? ' busy' : '')}>
          {res.sentence && <div class="rpt-sentence"><Icon name="sparkle" size={18} /><span>{res.sentence}</span><span class="rpt-period">{periodText(ctx)}{multi && !ctx.branch && !def.nobranch ? ' · ' + t('All branches') : ''}</span></div>}
          {res.kpis.length > 0 && <div class="rpt-kpis">{res.kpis.map((k) => <div class={'card stat' + (k.hero ? ' hero' : '')}><div class="k">{k.label}</div><div class={'v' + (k.kind === 'money' && k.value < 0 ? ' down' : k.hero && k.tone === 'up' ? ' up' : '')}>{kpiText(k)}</div>{k.sub && <div class={'d ' + (k.tone || 'mute')}>{k.sub}</div>}</div>)}</div>}
          {res.charts.length > 0 && <div class="rpt-charts">{res.charts.map((c) => <div class={'card' + (c.wide || res.charts.length === 1 ? ' wide' : '')}><div class="card-h"><h3>{c.title}</h3>{c.sub && <span class="small mute">{c.sub}</span>}</div><div class="card-b">{c.render()}</div></div>)}</div>}
          {res.tables.map((tb) => <ReportTable {...tb} key={def.id + tb.title} />)}
          {res.note && <p class="small mute rpt-note"><Icon name="info" size={14} /> {res.note}</p>}
          <p class="small mute rpt-note" data-ms={res.ms}>{t('Built in {ms} ms', { ms: res.ms })}</p>
        </div>
      )}
      {sib.length > 0 && <div class="rpt-more"><span class="small mute">{t('More reports')}:</span>{sib.map((r) => <a class="chip" href={'#/reports/' + r.id}><Icon name={r.icon} size={15} />{t(r.title)}</a>)}</div>}
    </div>
  );
}
const actionText = (a) => actionLabel(a);

function ReportSkeleton() {
  return <div class="col gap-s"><Skeleton h={54} /><div class="rpt-kpis">{[1, 2, 3, 4].map(() => <Skeleton h={92} />)}</div><Skeleton h={240} /><Skeleton h={300} /></div>;
}

/** Sortable table with a totals row; renders 150 rows then "Show more". */
export function ReportTable({ title, columns, rows, foot, rowClick, initialSort, statement, empty }) {
  const [sort, setSort] = useState(initialSort || null);
  const [limit, setLimit] = useState(150);
  const sorted = useMemo(() => {
    if (!sort || statement) return rows;
    const c = columns.find((x) => x.key === sort.key);
    if (!c) return rows;
    const v = (r) => { const x = raw(c, r); return typeof x === 'string' ? x.toLowerCase() : x ?? -Infinity; };
    return rows.slice().sort((a, b) => { const x = v(a), y = v(b); return (x > y ? 1 : x < y ? -1 : 0) * (sort.dir === 'desc' ? -1 : 1); });
  }, [rows, sort, columns]);
  const cls = (c) => (c.num ? 'num ' : '') + (c.hideMobile ? 'hide-m ' : '');
  const shown = sorted.slice(0, limit);
  return (
    <div class="card rpt-table mb">
      <div class="card-h"><h3>{title}</h3><span class="small mute">{tn(rows.length, '{n} row', '{n} rows')}</span></div>
      {!rows.length ? (empty || <div class="card-b mute">{t('Nothing to show for these filters.')}</div>) : (
        <div class="rpt-scroll">
          <table class={'table' + (statement ? ' stmt' : '')}>
            <thead><tr>{columns.map((c) => <th class={cls(c) + (statement ? '' : 'sortable')} onClick={() => !statement && setSort(sort?.key === c.key ? { key: c.key, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: c.num ? 'desc' : 'asc' })} aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : null}>{c.label}{sort?.key === c.key && <span aria-hidden="true"> {sort.dir === 'asc' ? '↑' : '↓'}</span>}</th>)}</tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr class={(rowClick ? 'click ' : '') + (r.cls || '')} onClick={rowClick && (() => rowClick(r))}>
                  {columns.map((c) => <td class={cls(c) + (c.num ? 'mono' : '')}>{c.render ? c.render(r) : cellText(c, r)}</td>)}
                </tr>
              ))}
            </tbody>
            {foot && <tfoot><tr>{columns.map((c) => <td class={cls(c) + (c.num ? 'mono' : '')}>{cellText(c, { ...foot, __foot: true })}</td>)}</tr></tfoot>}
          </table>
          {sorted.length > limit && <div class="card-b" style={{ textAlign: 'center' }}><Btn onClick={() => setLimit(limit + 500)}>{t('Show {n} more', { n: Math.min(500, sorted.length - limit).toLocaleString('en-KE') })}</Btn> <span class="small mute">{t('{a} of {b} shown — CSV export has all rows', { a: limit.toLocaleString('en-KE'), b: sorted.length.toLocaleString('en-KE') })}</span></div>}
        </div>
      )}
    </div>
  );
}

async function customerOptions() {
  const [cs, { allBalances }] = await Promise.all([allOf('customers'), import('../../core/customers.js')]);
  const bal = await allBalances();
  return cs.filter((c) => !c.deleted).map((c) => ({ c, b: bal.get(c.id) || 0 })).sort((a, b) => b.b - a.b || a.c.name.localeCompare(b.c.name))
    .map(({ c, b }) => ({ value: c.id, label: c.name + (b > 0 ? ' — ' + t('owes {v}', { v: (b / 100).toLocaleString('en-KE') }) : '') }));
}
