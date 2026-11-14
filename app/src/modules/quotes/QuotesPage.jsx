// Quotes & invoices list: quotes (status, validity) and invoices (credit sales: due date, paid, balance, overdue).
import { useEffect, useMemo, useState } from 'preact/hooks';
import { PageHeader, Btn, Icon, Badge, Empty, Tabs, SearchBox, Stat } from '../../ui/kit.jsx';
import { VirtualTable } from '../../ui/table.jsx';
import { Dropdown, toast } from '../../ui/overlay.jsx';
import { previewPrint } from '../../ui/printpreview.jsx';
import { db } from '../../db/index.js';
import { on } from '../../lib/bus.js';
import { navigate } from '../../router.js';
import { money, kes } from '../../lib/money.js';
import { waLink, normPhone } from '../../lib/util.js';
import { norm } from '../../lib/search.js';
import { can } from '../../auth/permissions.js';
import * as S from '../../state.js';
import { t, tn } from '../../i18n/index.js';
import { STATUS, quoteStatus, loadInvoices, INV_STATUS } from './logic.js';
import { invoiceA4, deliveryNoteHtml, invoiceText } from './print.js';
import './quotes.css';

const d8 = (ms) => new Date(ms).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
export default function QuotesPage({ query }) {
  const [tab, setTab] = useState(query?.tab === 'invoices' ? 'invoices' : 'quotes');
  const [quotes, setQuotes] = useState(null);
  const [invoices, setInvoices] = useState(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const load = async () => {
    const qs = (await db().quotes.toArray()).filter((x) => !x.deleted && (!x.branch_id || x.branch_id === S.branch.value?.id)).sort((a, b) => b.created_at - a.created_at);
    setQuotes(qs);
    setInvoices(await loadInvoices());
  };
  useEffect(() => { load(); return on('change', (e) => ['quotes', 'sales', 'customer_payments', 'returns'].includes(e) && load()); }, []);
  const fq = useMemo(() => (quotes || []).filter((x) => (!q || norm(x.no + ' ' + (x.customer_name || '')).includes(norm(q))) && (filter === 'all' || quoteStatus(x) === filter)), [quotes, q, filter]);
  const fi = useMemo(() => (invoices || []).filter((x) => (!q || norm(x.no + ' ' + (x.customer_name || '')).includes(norm(q))) && (filter === 'all' || x.inv_status === filter || (filter === 'open' && x.due > 0 && x.inv_status !== 'void'))), [invoices, q, filter]);
  const inv = invoices || [];
  const owed = inv.filter((x) => x.inv_status !== 'void').reduce((s, x) => s + Math.max(0, x.due), 0);
  const overdue = inv.filter((x) => x.inv_status === 'overdue').reduce((s, x) => s + x.due, 0);
  const openQ = (quotes || []).filter((x) => ['draft', 'sent', 'accepted'].includes(quoteStatus(x)));
  const pickTab = (v) => { setTab(v); setFilter('all'); };
  const qFilters = [['all', t('All')], ['draft', t('Draft')], ['sent', t('Sent')], ['accepted', t('Accepted')], ['expired', t('Expired')], ['invoiced', t('Invoiced')], ['sold', t('Sold')]];
  const iFilters = [['all', t('All')], ['open', t('Not paid')], ['overdue', t('Overdue')], ['part', t('Part paid')], ['paid', t('Paid')]];
  return (
    <div class="page wide">
      <PageHeader title={t('Quotes & invoices')} sub={t('Quote a customer, turn it into an invoice or a sale, and track who has paid.')}
        actions={can('quotes.use') && <>
          {can('invoices.create') && <Btn icon="file" onClick={() => navigate('/quotes/new?invoice=1')}>{t('New invoice')}</Btn>}
          <Btn variant="primary" icon="plus" onClick={() => navigate('/quotes/new')}>{t('New quote')}</Btn>
        </>} />
      <div class="grid3 kpi-grid mb">
        <Stat label={t('Open quotes')} value={openQ.length} icon="file"><div class="small mute">{money(openQ.reduce((s, x) => s + (x.total || 0), 0))}</div></Stat>
        <Stat label={t('Owed on invoices')} value={money(owed)} icon="credit" />
        <Stat label={t('Overdue')} value={<span class={overdue ? 'down' : ''}>{money(overdue)}</span>} icon="alert" />
        <Stat label={t('Invoices this month')} value={inv.filter((x) => x.created_at >= new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()).length} icon="receipt" />
      </div>
      <Tabs value={tab} onValue={pickTab} tabs={[{ value: 'quotes', label: t('Quotes'), icon: 'file', count: (quotes || []).length }, { value: 'invoices', label: t('Invoices'), icon: 'receipt', count: inv.length }]} />
      <div class="row wrap mt mb" style={{ gap: '8px' }}>
        <SearchBox value={q} onValue={setQ} placeholder={t('Search number or customer')} />
        <div class="cat-tabs" style={{ padding: 0 }}>{(tab === 'quotes' ? qFilters : iFilters).map(([v, l]) => <button class={'chip' + (filter === v ? ' on' : '')} onClick={() => setFilter(v)}>{l}</button>)}</div>
      </div>
      {tab === 'quotes' ? (
        !quotes ? <div class="card" style={{ minHeight: '200px' }} /> : !quotes.length ? (
          <div class="card"><Empty icon="file" title={t('No quotes yet')} text={t('Make a quote when a customer asks for prices. Print it or send it on WhatsApp, then turn it into an invoice or a sale.')}>{can('quotes.use') && <Btn variant="primary" icon="plus" onClick={() => navigate('/quotes/new')}>{t('New quote')}</Btn>}</Empty></div>
        ) : (
          <VirtualTable rows={fq} height={Math.min(560, 56 * fq.length + 46)} rowHeight={56} onRowClick={(r) => navigate('/quotes/' + r.id)}
            empty={<Empty icon="search" title={t('No quote matches')} />} columns={[
              { key: 'no', label: t('Number'), width: '170px', render: (r) => <b class="mono">{r.no}</b> },
              { key: 'customer_name', label: t('Customer'), width: 'minmax(140px, 1.4fr)', render: (r) => r.customer_name || <span class="mute">{t('No customer')}</span> },
              { key: 'created_at', label: t('Date'), width: '120px', hideMobile: true, render: (r) => d8(r.created_at) },
              { key: 'valid_until', label: t('Valid until'), width: '120px', hideMobile: true, render: (r) => r.valid_until ? d8(new Date(r.valid_until + 'T00:00').getTime()) : '—' },
              { key: 'status', label: t('Status'), width: '120px', render: (r) => { const s = quoteStatus(r); const [l, tone] = STATUS[s] || STATUS.draft; return <Badge tone={tone}>{t(l)}</Badge>; } },
              { key: 'total', label: t('Total'), width: '130px', num: true, render: (r) => <span class="mono">{kes(r.total || 0)}</span> }
            ]} />
        )
      ) : (
        !invoices ? <div class="card" style={{ minHeight: '200px' }} /> : !invoices.length ? (
          <div class="card"><Empty icon="receipt" title={t('No invoices yet')} text={t('Invoices are credit sales. Convert a quote to an invoice, or sell on credit on the Sell screen.')}>{can('invoices.create') && <Btn variant="primary" icon="file" onClick={() => navigate('/quotes/new?invoice=1')}>{t('New invoice')}</Btn>}</Empty></div>
        ) : (
          <VirtualTable rows={fi} height={Math.min(560, 58 * fi.length + 46)} rowHeight={58} onRowClick={(r) => invoiceActions(r)}
            empty={<Empty icon="search" title={t('No invoice matches')} />} columns={[
              { key: 'no', label: t('Invoice'), width: '160px', render: (r) => <span><b class="mono">{r.no}</b>{r.quote_no && <div class="tiny mute mono">{r.quote_no}</div>}</span> },
              { key: 'customer_name', label: t('Customer'), width: 'minmax(140px, 1.4fr)' },
              { key: 'due_date', label: t('Due date'), width: '120px', hideMobile: true, render: (r) => <span class={r.inv_status === 'overdue' ? 'down bold' : ''}>{d8(r.due_date)}</span> },
              { key: 'total', label: t('Total'), width: '120px', num: true, hideMobile: true, render: (r) => <span class="mono">{kes(r.total)}</span> },
              { key: 'due', label: t('Balance due'), width: '130px', num: true, render: (r) => <b class="mono">{kes(Math.max(0, r.due))}</b> },
              { key: 'inv_status', label: t('Status'), width: '110px', render: (r) => { const [l, tone] = INV_STATUS[r.inv_status]; return <Badge tone={tone}>{t(l)}</Badge>; } }
            ]} />
        )
      )}
    </div>
  );
}

/** Actions for an invoice row (print, delivery note, payment, WhatsApp, open receipt). */
async function invoiceActions(r) {
  const { openModal, Modal } = await import('../../ui/overlay.jsx');
  const [l, tone] = INV_STATUS[r.inv_status];
  openModal((close) => (
    <Modal title={t('Invoice {no}', { no: r.no })} icon="receipt" size="sm" center onClose={() => close()}>
      <div class="card pad mb" style={{ background: 'var(--paper)' }}>
        <div class="row"><b class="grow">{r.customer_name}</b><Badge tone={tone}>{t(l)}</Badge></div>
        <div class="row small mute" style={{ marginTop: '6px' }}><span class="grow">{t('Total')}</span><span class="mono">{money(r.total)}</span></div>
        <div class="row small mute"><span class="grow">{t('Paid')}</span><span class="mono">{money(r.paid_amount)}</span></div>
        <div class="row"><span class="grow bold">{t('Balance due')}</span><b class="mono">{money(Math.max(0, r.due))}</b></div>
        <div class="small mute" style={{ marginTop: '4px' }}>{t('Due {date}', { date: d8(r.due_date) })}</div>
      </div>
      <div class="col gap-s">
        {r.due > 0 && r.inv_status !== 'void' && can('customers.payments') && r.customer && <Btn variant="primary" size="lg" icon="wallet" onClick={async () => { close(); const [{ payDialog }, { account }] = await Promise.all([import('../customers/CustomerProfile.jsx'), import('../../core/customers.js')]); await payDialog(r.customer, await account(r.customer.id)); }}>{t('Receive payment')}</Btn>}
        <Btn icon="print" onClick={() => { close(); previewPrint(invoiceA4(r, r.customer), { title: t('Invoice {no}', { no: r.no }), paper: 'a4' }); }}>{t('Print invoice (A4)')}</Btn>
        <Btn icon="truck" onClick={() => { close(); previewPrint(deliveryNoteHtml(r, r.customer, { ref: 'invoice' }), { title: t('Delivery note'), paper: 'a4' }); }}>{t('Delivery note')}</Btn>
        {r.customer?.phone && <Btn icon="whatsapp" onClick={() => { window.open(waLink(r.customer.phone, invoiceText(r)), '_blank', 'noopener'); }}>{t('Send on WhatsApp')}</Btn>}
        <Btn variant="ghost" icon="eye" onClick={() => { close(); navigate('/sales/' + r.id); }}>{t('Open sale record')}</Btn>
      </div>
    </Modal>
  ));
}
