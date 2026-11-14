// Recent sales / receipts: list, receipt detail, reprint, WhatsApp, A4 invoice, void, return.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { db } from '../../db/index.js';
import { PageHeader, Btn, Icon, Badge, SearchBox, Empty, Seg, Select } from '../../ui/kit.jsx';
import { VirtualTable, Table } from '../../ui/table.jsx';
import { DateRange, rangeFor } from '../../ui/daterange.jsx';
import { openModal, Modal, toast, promptText } from '../../ui/overlay.jsx';
import { money, kes } from '../../lib/money.js';
import { norm } from '../../lib/search.js';
import { on } from '../../lib/bus.js';
import { prettyPhone, sumBy } from '../../lib/util.js';
import { navigate } from '../../router.js';
import { can } from '../../auth/permissions.js';
import { requirePerm } from '../../auth/override.jsx';
import { voidSale } from '../../core/sales.js';
import { methodLabel, dt, receiptHtml } from '../../print/templates.js';
import { receiptCtx, printReceipt, previewReceipt, whatsappReceipt, previewInvoice } from './receipt.js';
import { openReturn } from './ReturnDialog.jsx';
import * as S from '../../state.js';
import { t, tn } from '../../i18n/index.js';

const STATUS = { completed: ['ok', 'Completed'], void: ['bad', 'Void'], returned: ['warn', 'Returned'], partial_return: ['warn', 'Part returned'] };
export const StatusBadge = ({ s }) => <Badge tone={STATUS[s]?.[0]}>{t(STATUS[s]?.[1] || s)}</Badge>;

export default function SalesPage() {
  const [range, setRange] = useState({ preset: 'today', ...rangeFor('today') });
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState(null);
  const [users, setUsers] = useState(new Map());
  const [custs, setCusts] = useState(new Map());
  const load = () => db().sales.where('created_at').between(range.from, range.to, true, false).reverse().toArray().then((s) => setRows(s.filter((x) => !x.deleted && (!x.branch_id || x.branch_id === S.branch.value?.id))));
  useEffect(load, [range.from, range.to]);
  useEffect(() => on('change', (e) => e === 'sales' && load()), [range.from, range.to]);
  useEffect(() => { db().users.toArray().then((u) => setUsers(new Map(u.map((x) => [x.id, x])))); db().customers.toArray().then((c) => setCusts(new Map(c.map((x) => [x.id, x])))); }, []);
  const mine = !can('sales.view_all');
  const shown = useMemo(() => {
    if (!rows) return [];
    const n = norm(q);
    return rows.filter((s) => (!status || s.status === status) && (!mine || s.user_id === S.user.value?.id) && (!n || norm(s.no + ' ' + (custs.get(s.customer_id)?.name || '') + ' ' + s.payments.map((p) => p.ref).join(' ')).includes(n)));
  }, [rows, q, status, custs]);
  const ok = shown.filter((s) => s.status !== 'void');
  return (
    <div class="page">
      <PageHeader title={t('Sales & receipts')} sub={t('Tap a receipt to print it again, send it, or return items.')} actions={<Btn variant="primary" icon="cart" onClick={() => navigate('/sell')}>{t('New sale')}</Btn>} />
      <div class="row wrap mb" style={{ gap: '8px' }}>
        <DateRange value={range} onValue={setRange} />
      </div>
      <div class="row wrap mb" style={{ gap: '8px' }}>
        <SearchBox value={q} onValue={setQ} placeholder={t('Receipt no, customer or M-Pesa code')} />
        <Select value={status} onValue={setStatus} options={[{ value: '', label: t('All statuses') }, ...Object.entries(STATUS).map(([k, v]) => ({ value: k, label: t(v[1]) }))]} />
      </div>
      <div class="grid3 mb" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        <div class="card stat"><div class="k">{t('Sales')}</div><div class="v">{ok.length}</div></div>
        <div class="card stat"><div class="k">{t('Total')}</div><div class="v">{money(sumBy(ok, (s) => s.total))}</div></div>
        <div class="card stat"><div class="k">{t('Average sale')}</div><div class="v">{money(ok.length ? Math.round(sumBy(ok, (s) => s.total) / ok.length) : 0)}</div></div>
        <div class="card stat"><div class="k">{t('Voids')}</div><div class="v">{shown.length - ok.length}</div></div>
      </div>
      {rows && (
        <VirtualTable rows={shown} height="calc(100vh - 430px)" onRowClick={(s) => navigate('/sales/' + s.id)}
          empty={<Empty icon="receipt" title={t('No sales in this period')} text={q ? t('Check the receipt number, or choose a longer period above.') : t('Sales appear here as soon as they are made. Choose another period above to see older receipts.')}>
            {can('sell.use') && !q && <Btn variant="primary" icon="cart" onClick={() => navigate('/sell')}>{t('Make a sale')}</Btn>}</Empty>}
          columns={[
            { key: 'no', label: t('Receipt'), width: '1.1fr', render: (s) => <b class="mono">{s.no}</b> },
            { key: 'created_at', label: t('Time'), width: '1fr', render: (s) => new Date(s.created_at).toLocaleString('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) },
            { key: 'customer_id', label: t('Customer'), width: '1.2fr', hideMobile: true, sort: (s) => custs.get(s.customer_id)?.name || '', render: (s) => custs.get(s.customer_id)?.name || <span class="mute">{t('Walk-in')}</span> },
            { key: 'user_id', label: t('Cashier'), width: '1fr', hideMobile: true, sort: (s) => users.get(s.user_id)?.name || '', render: (s) => users.get(s.user_id)?.name?.split(' ')[0] || '' },
            { key: 'pay', label: t('Paid by'), width: '1fr', hideMobile: true, sortable: false, render: (s) => s.payments.map((p) => methodLabel(p.method)).join(' + ') },
            { key: 'status', label: t('Status'), width: '.9fr', hideMobile: true, render: (s) => <StatusBadge s={s.status} /> },
            { key: 'total', label: t('Total'), width: '.9fr', num: true, render: (s) => <span class={s.status === 'void' ? 'mute' : ''} style={s.status === 'void' ? { textDecoration: 'line-through' } : null}>{kes(s.total)}</span> }
          ]} />
      )}
    </div>
  );
}

export function SaleDetail({ params }) {
  const [s, setS] = useState(null);
  const [ctx, setCtx] = useState(null);
  const [html, setHtml] = useState('');
  const [rets, setRets] = useState([]);
  const [trail, setTrail] = useState([]);
  const load = async () => {
    const sale = await db().sales.get(params.id);
    if (!sale) return setS(false);
    setS(sale);
    const c = await receiptCtx(sale, { copy: true });
    setCtx(c);
    setHtml(await receiptHtml(sale, c));
    setRets(await db().returns.where('sale_id').equals(sale.id).toArray());
    setTrail((await db().audit.where('entity_id').equals(sale.id).toArray()).sort((a, b) => a.at - b.at));
  };
  useEffect(() => { load(); }, [params.id]);
  useEffect(() => on('change', (e, ids) => (e === 'sales' || e === 'returns') && load()), [params.id]);
  if (s === false) return <div class="page"><Empty icon="receipt" title={t('Receipt not found')} /></div>;
  if (!s) return <div class="page" />;
  const doVoid = async () => {
    const by = await requirePerm('sell.void', t('Void sale {no}', { no: s.no }));
    if (!by) return;
    const reason = await promptText({ title: t('Void sale {no}', { no: s.no }), label: t('Reason (required)'), required: true, options: [t('Customer changed mind'), t('Wrong item scanned'), t('Duplicate sale'), t('Payment failed')], ok: t('Void sale') });
    if (!reason) return;
    await voidSale(s, reason, by);
    toast(t('Sale {no} voided. Stock returned.', { no: s.no }));
  };
  const users = S.users.value;
  return (
    <div class="page">
      <PageHeader back="#/sales" title={<span class="row gap-s wrap">{t('Receipt')} <span class="mono nowrap">{s.no}</span> <StatusBadge s={s.status} /></span>} sub={dt(s.created_at) + ' · ' + (ctx?.cashier || '')}
        actions={<>
          <Btn icon="print" onClick={() => printReceipt(s, { copy: true })}>{t('Reprint')}</Btn>
          <Btn icon="whatsapp" onClick={() => whatsappReceipt(s)}>{t('WhatsApp')}</Btn>
          <Btn icon="file" onClick={() => previewInvoice(s)}>{t('A4 invoice')}</Btn>
          {s.status !== 'void' && s.status !== 'returned' && <Btn icon="undo" variant="navy" onClick={() => openReturn(s)}>{t('Return items')}</Btn>}
          {s.status === 'completed' && <Btn icon="ban" variant="danger" onClick={doVoid}>{t('Void')}</Btn>}
        </>} />
      <div class="split-360">
        <div class="col gap-l">
          <div class="card">
            <div class="card-h"><h3>{t('Items')}</h3><span class="mute small">{tn(s.lines.length, '{n} item', '{n} items')}</span></div>
            <Table rows={s.lines} columns={[
              { key: 'name', label: t('Item'), render: (l) => <div><b>{l.name}</b><div class="small mute">{[l.serial && 'SN ' + l.serial, l.batch_no && t('Batch') + ' ' + l.batch_no, l.staff_id && users.find((u) => u.id === l.staff_id)?.name, l.note].filter(Boolean).join(' · ')}</div></div> },
              { key: 'qty', label: t('Qty'), num: true, render: (l) => l.qty + (l.unit !== 'pc' ? ' ' + l.unit : '') },
              { key: 'price', label: t('Price'), num: true, render: (l) => kes(l.price), hideMobile: true },
              { key: 'discount', label: t('Discount'), num: true, render: (l) => (l.discount ? '-' + kes(l.discount) : '—'), hideMobile: true },
              { key: 'tax', label: t('Tax'), render: (l) => l.tax, hideMobile: true },
              { key: 'total', label: t('Total'), num: true, render: (l) => <b>{kes(l.total)}</b> }
            ]} />
            <div class="card-b" style={{ borderTop: '1px solid var(--line)' }}>
              <div class="row"><span class="grow mute">{t('Subtotal')}</span><span class="mono">{kes(s.subtotal)}</span></div>
              {s.discount > 0 && <div class="row"><span class="grow mute">{t('Discount')}</span><span class="mono down">-{kes(s.discount)}</span></div>}
              {s.tax_total > 0 && <div class="row"><span class="grow mute">{t('VAT included')}</span><span class="mono">{kes(s.tax_total)}</span></div>}
              <div class="row" style={{ marginTop: '6px' }}><b class="grow">{t('Total')}</b><b class="mono" style={{ fontSize: '22px' }}>{money(s.total)}</b></div>
            </div>
          </div>
          <div class="card">
            <div class="card-h"><h3>{t('Payments')}</h3></div>
            {s.payments.map((p) => <div class="list-item"><Icon name={{ cash: 'cash', mpesa: 'phone', card: 'card', bank: 'bank', credit: 'credit', points: 'star' }[p.method] || 'wallet'} /><span class="grow">{methodLabel(p.method)}{p.ref && <span class="mono mute"> · {p.ref}</span>}{p.phone && <span class="mute"> · {prettyPhone(p.phone)}</span>}</span><b class="mono">{kes(p.amount)}</b></div>)}
            {s.change > 0 && <div class="list-item"><span class="grow mute">{t('Change given')}</span><span class="mono">{kes(s.change)}</span></div>}
            {s.balance > 0 && <div class="list-item"><span class="grow">{t('On account')} — <a href={'#/customers/' + s.customer_id}>{ctx?.customer?.name}</a></span><b class="mono down">{kes(s.balance)}</b></div>}
          </div>
          {rets.length > 0 && (
            <div class="card">
              <div class="card-h"><h3>{t('Returns')}</h3></div>
              {rets.map((r) => <div class="list-item"><Icon name="undo" /><div class="grow"><b>{r.lines.map((l) => `${l.qty} × ${l.name}`).join(', ')}</b><div class="small mute">{dt(r.created_at)} · {r.reason} · {r.refund.map((f) => methodLabel(f.method)).join(', ')}</div></div><b class="mono down">-{kes(r.total)}</b></div>)}
            </div>
          )}
          {s.status === 'void' && <div class="callout bad"><Icon name="ban" /><div><b>{t('Voided')}</b> — {s.void_reason} · {users.find((u) => u.id === s.void_by)?.name}</div></div>}
          {trail.length > 0 && can('audit.view') && (
            <div class="card">
              <div class="card-h"><h3>{t('Activity log')}</h3><Icon name="shield" size={18} /></div>
              {trail.map((a) => <div class="list-item small"><span class="mono mute" style={{ width: '120px' }}>{new Date(a.at).toLocaleString('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span><b class="grow">{a.action}</b><span class="mute">{users.find((u) => u.id === a.user_id)?.name}</span></div>)}
            </div>
          )}
        </div>
        <div class="paper-strip desk-only" style={{ maxHeight: 'none' }}>
          <iframe title={t('Receipt')} srcDoc={html} sandbox="allow-same-origin" style={{ width: '100%', minHeight: '640px', border: 0, background: '#fff', borderRadius: '4px', boxShadow: 'var(--sh-2)' }}
            onLoad={(e) => { try { e.target.style.height = e.target.contentDocument.documentElement.scrollHeight + 20 + 'px'; } catch {} }} />
        </div>
      </div>
    </div>
  );
}
