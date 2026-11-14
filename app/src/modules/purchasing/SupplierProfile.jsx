// Supplier profile: balance (what we owe, overdue), statement (print / WhatsApp), deliveries, payments, orders.
import { useEffect, useState } from 'preact/hooks';
import { db } from '../../db/index.js';
import { PageHeader, Btn, Icon, Empty, Badge, Stat, Tabs, Avatar } from '../../ui/kit.jsx';
import { Table } from '../../ui/table.jsx';
import { confirm, toast } from '../../ui/overlay.jsx';
import { previewPrint } from '../../ui/printpreview.jsx';
import { money, kes } from '../../lib/money.js';
import { prettyPhone, waLink } from '../../lib/util.js';
import { remove } from '../../db/repo.js';
import { on } from '../../lib/bus.js';
import { navigate } from '../../router.js';
import { can } from '../../auth/permissions.js';
import { supplierAcc } from '../../core/purchasing.js';
import { supplierStatementHtml } from '../../print/stockdocs.js';
import { StatusPill, d8, ctxPrint, payLabel } from '../inventory/common.jsx';
import { editSupplier } from './supplierDialog.jsx';
import { payDialog } from './payDialog.jsx';
import * as S from '../../state.js';
import { t, tn } from '../../i18n/index.js';

export default function SupplierProfile({ params }) {
  const [s, setS] = useState(null);
  const [acc, setAcc] = useState(null);
  const [tab, setTab] = useState('open');
  const load = async () => { const x = await db().suppliers.get(params.id); if (!x || x.deleted) return setS(false); setS(x); setAcc(await supplierAcc(x.id)); };
  useEffect(() => { load(); return on('change', (e) => ['suppliers', 'goods_received', 'supplier_payments', 'purchase_orders'].includes(e) && load()); }, [params.id]);
  if (s === false) return <div class="page"><Empty icon="store" title={t('Supplier not found')} /></div>;
  if (!s || !acc) return <div class="page" />;
  const overdue = acc.open.filter((o) => o.age > (s.terms_days || 0)).reduce((x, o) => x + o.due, 0);
  const statement = () => previewPrint(supplierStatementHtml(s, acc, ctxPrint()), { title: t('Statement — {name}', { name: s.name }), paper: 'a4', actions: () => s.phone && <Btn icon="whatsapp" onClick={sendWa}>{t('Send on WhatsApp')}</Btn> });
  const sendWa = () => {
    const lines = acc.open.slice(0, 10).map((o) => `• ${o.grn.no}${o.grn.supplier_invoice_no ? ' (' + o.grn.supplier_invoice_no + ')' : ''} ${d8(o.grn.created_at)}: ${kes(o.due)}`).join('\n');
    const text = t('Hello {name}, this is {biz}. Our records show a balance of {bal} with you.', { name: (s.contact || s.name).split(' ')[0], biz: S.business.value.name, bal: money(Math.max(0, acc.balance)) }) + (lines ? '\n' + lines : '') + '\n\n' + t('Please confirm. Thank you.');
    window.open(waLink(s.phone, text), '_blank', 'noopener');
  };
  const del = async () => {
    if (acc.balance !== 0) return toast.warn(t('Settle the balance before deleting this supplier'));
    if (!(await confirm({ title: t('Delete {name}?', { name: s.name }), message: t('Past deliveries and payments are kept.'), danger: true, ok: t('Delete') }))) return;
    await remove('suppliers', s.id, { audit: { action: 'supplier.delete', details: { name: s.name } } });
    navigate('/purchasing/suppliers');
  };
  return (
    <div class="page" style={{ maxWidth: '1250px' }}>
      <PageHeader back="#/purchasing/suppliers" title={<span class="row" style={{ gap: '12px' }}><Avatar name={s.name} size={44} />{s.name}</span>}
        sub={<span class="row wrap gap-s">{[prettyPhone(s.phone), s.contact, s.email, s.kra_pin && 'PIN ' + s.kra_pin].filter(Boolean).join(' · ')}<Badge>{s.terms_days ? t('Pay within {n} days', { n: s.terms_days }) : t('Pay on delivery')}</Badge></span>}
        actions={<>
          {s.phone && <a class="btn" href={'tel:+' + s.phone}><Icon name="phone" />{t('Call')}</a>}
          {can('suppliers.edit') && <Btn icon="edit" onClick={async () => { if (await editSupplier(s)) load(); }}>{t('Edit')}</Btn>}
          {can('purchasing.orders') && <Btn icon="file" onClick={() => navigate('/purchasing/orders/new?supplier=' + s.id)}>{t('New order')}</Btn>}
          {can('purchasing.receive') && <Btn icon="truck" onClick={() => navigate('/purchasing/receive?supplier=' + s.id)}>{t('Receive stock')}</Btn>}
          {can('purchasing.pay') && acc.balance > 0 && <Btn variant="primary" icon="wallet" onClick={() => payDialog(s.id)}>{t('Pay supplier')}</Btn>}
        </>} />
      <div class="inv-stats">
        <Stat label={t('We owe')} value={<span class={acc.balance > 0 ? 'down' : ''}>{money(Math.max(0, acc.balance))}</span>} icon="credit">{acc.balance < 0 && <div class="small up">{t('{v} credit with them', { v: money(-acc.balance) })}</div>}{overdue > 0 && <div class="small down bold">{t('{v} overdue', { v: money(overdue) })}</div>}</Stat>
        <Stat label={t('Bought (all time)')} value={money(acc.purchased)} icon="truck" />
        <Stat label={t('Paid')} value={money(acc.paid)} icon="wallet">{acc.returned > 0 && <div class="small mute">{t('Returns {v}', { v: money(acc.returned) })}</div>}</Stat>
        <Stat label={t('Last delivery')} value={acc.last ? d8(acc.last) : '—'} icon="calendar" />
      </div>
      <div class="row wrap mb gap-s">
        <Btn size="sm" icon="file" onClick={statement}>{t('Statement')}</Btn>
        {s.phone && <Btn size="sm" icon="whatsapp" onClick={sendWa}>{t('Confirm balance on WhatsApp')}</Btn>}
        {can('purchasing.returns') && <Btn size="sm" icon="undo" onClick={() => navigate('/purchasing/returns/new?supplier=' + s.id)}>{t('Return goods')}</Btn>}
        <span class="spacer" />
        {can('suppliers.edit') && <Btn size="sm" variant="ghost" icon="trash" onClick={del}>{t('Delete')}</Btn>}
      </div>
      <Tabs value={tab} onValue={setTab} tabs={[{ value: 'open', label: t('Unpaid'), count: acc.open.length }, { value: 'docs', label: t('Deliveries & returns'), count: acc.docs.length }, { value: 'pay', label: t('Payments'), count: acc.payments.length }, { value: 'orders', label: t('Orders'), count: acc.orders.length }]} />
      <div class="card">
        {tab === 'open' && <Table rows={acc.open} onRowClick={(o) => navigate('/purchasing/grn/' + o.grn.id)} empty={<Empty icon="smile" title={t('Nothing unpaid')} text={t('You do not owe this supplier anything.')} />} columns={[
          { key: 'no', label: t('Delivery@@goods'), render: (o) => <b class="mono">{o.grn.no}</b> }, { key: 'inv', label: t('Their invoice'), hideMobile: true, render: (o) => o.grn.supplier_invoice_no || '—' },
          { key: 'd', label: t('Date'), hideMobile: true, render: (o) => d8(o.grn.created_at) }, { key: 'age', label: t('Age'), render: (o) => <Badge tone={o.age > (s.terms_days || 0) ? 'bad' : ''}>{tn(o.age, '{n} day', '{n} days')}</Badge> },
          { key: 'tot', label: t('Total'), num: true, hideMobile: true, render: (o) => kes(o.grn.total) }, { key: 'due', label: t('To pay'), num: true, render: (o) => <b>{kes(o.due)}</b> }]} />}
        {tab === 'docs' && <Table rows={acc.docs} onRowClick={(g) => navigate('/purchasing/grn/' + g.id)} empty={<Empty icon="truck" title={t('No deliveries yet')} />} columns={[
          { key: 'no', label: t('Document'), render: (g) => <span class="row gap-s"><b class="mono">{g.no}</b>{g.kind === 'return' && <Badge tone="warn">{t('Return')}</Badge>}</span> }, { key: 'd', label: t('Date'), render: (g) => d8(g.created_at) },
          { key: 'inv', label: t('Their invoice'), hideMobile: true, render: (g) => g.supplier_invoice_no || '—' }, { key: 'n', label: t('Items'), num: true, hideMobile: true, render: (g) => g.lines.length },
          { key: 'tot', label: t('Amount'), num: true, render: (g) => <span class={g.total < 0 ? 'up' : ''}>{kes(g.total)}</span> }]} />}
        {tab === 'pay' && <Table rows={acc.payments} empty={<Empty icon="wallet" title={t('No payments yet')} />} columns={[
          { key: 'd', label: t('Date'), render: (p) => d8(p.created_at) }, { key: 'm', label: t('Method'), render: (p) => (p.amount < 0 ? t('Refund from supplier') : payLabel(p.method)) },
          { key: 'ref', label: t('Reference'), render: (p) => <span class="mono">{p.ref || '—'}</span> }, { key: 'note', label: t('Note'), hideMobile: true, render: (p) => <span class="small">{p.note}</span> },
          { key: 'a', label: t('Amount'), num: true, render: (p) => <b>{kes(p.amount)}</b> }]} />}
        {tab === 'orders' && <Table rows={acc.orders} onRowClick={(p) => navigate('/purchasing/orders/' + p.id)} empty={<Empty icon="file" title={t('No orders yet')} />} columns={[
          { key: 'no', label: t('Order'), render: (p) => <b class="mono">{p.no}</b> }, { key: 'd', label: t('Date'), render: (p) => d8(p.created_at) },
          { key: 'tot', label: t('Total'), num: true, render: (p) => kes(p.total || 0) }, { key: 's', label: t('Status'), render: (p) => <StatusPill s={p.status} /> }]} />}
      </div>
    </div>
  );
}
