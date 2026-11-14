// Purchases home: deliveries received (GRNs), what we owe, quick actions.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { PageHeader, Btn, Empty, Badge, Stat, SearchBox } from '../../ui/kit.jsx';
import { VirtualTable } from '../../ui/table.jsx';
import { money, kes } from '../../lib/money.js';
import { on } from '../../lib/bus.js';
import { navigate } from '../../router.js';
import { can } from '../../auth/permissions.js';
import { allDocs, allSupplierBalances, suppliersList } from '../../core/purchasing.js';
import { BuyTabs, ActTile, d8, branchName, multiBranch } from '../inventory/common.jsx';
import { t } from '../../i18n/index.js';

export default function Deliveries() {
  const [docs, setDocs] = useState(null);
  const [bal, setBal] = useState(new Map());
  const [sups, setSups] = useState(new Map());
  const [q, setQ] = useState('');
  const load = async () => {
    const [d, b, s] = await Promise.all([allDocs('receipt'), allSupplierBalances(), suppliersList()]);
    setDocs(d); setBal(b); setSups(new Map(s.map((x) => [x.id, x])));
  };
  useEffect(() => { load(); return on('change', (e) => ['goods_received', 'supplier_payments', 'suppliers'].includes(e) && load()); }, []);
  const due = useMemo(() => { const m = new Map(); for (const a of bal.values()) for (const o of a.open) m.set(o.grn.id, o.due); return m; }, [bal]);
  const rows = useMemo(() => (docs || []).filter((g) => !q.trim() || [g.no, g.supplier_invoice_no, sups.get(g.supplier_id)?.name].join(' ').toLowerCase().includes(q.toLowerCase())), [docs, q, sups]);
  const month0 = new Date(); month0.setDate(1); month0.setHours(0, 0, 0, 0);
  const thisMonth = (docs || []).filter((g) => g.created_at >= month0.getTime()).reduce((s, g) => s + g.total, 0);
  const owed = [...bal.values()].reduce((s, a) => s + Math.max(0, a.balance), 0);
  const overdue = [...bal.entries()].reduce((s, [id, a]) => s + a.open.filter((o) => o.age > (sups.get(id)?.terms_days || 0)).reduce((x, o) => x + o.due, 0), 0);
  return (
    <div class="page wide" style={{ maxWidth: '1400px' }}>
      <PageHeader title={t('Purchases')} sub={t('Deliveries from suppliers, orders, payments and returns')} />
      <div class="inv-actions">
        {can('purchasing.receive') && <ActTile main icon="truck" title={t('Receive stock')} sub={t('A delivery has arrived')} href="#/purchasing/receive" />}
        {can('purchasing.orders') && <ActTile icon="file" tone="coral" title={t('New purchase order')} sub={t('Order from a supplier')} href="#/purchasing/orders/new" />}
        {can('purchasing.pay') && <ActTile icon="wallet" tone="teal" title={t('Pay a supplier')} sub={t('Record a payment')} href="#/purchasing/payments?new=1" />}
        {can('purchasing.returns') && <ActTile icon="undo" tone="sun" title={t('Return goods')} sub={t('Send items back to a supplier')} href="#/purchasing/returns/new" />}
      </div>
      <BuyTabs active="/purchasing" />
      <div class="inv-stats">
        <Stat label={t('Bought this month')} value={money(thisMonth)} icon="truck" />
        <div class="card stat click" role="button" onClick={() => navigate('/purchasing/suppliers')}><div class="k">{t('We owe suppliers')}</div><div class="v">{money(owed)}</div>{overdue > 0 && <div class="small down bold">{t('{v} overdue', { v: money(overdue) })}</div>}</div>
        <Stat label={t('Deliveries')} value={(docs || []).length} icon="receipt" />
      </div>
      <div class="row wrap mb"><SearchBox value={q} onValue={setQ} placeholder={t('Search delivery no., invoice no. or supplier')} /></div>
      {!docs ? <div class="card" style={{ height: '300px' }} /> : (
        <VirtualTable rows={rows} height="calc(100vh - 300px)" rowHeight={58} onRowClick={(g) => navigate('/purchasing/grn/' + g.id)}
          empty={<Empty icon="truck" title={t('No deliveries yet')} text={t('When stock arrives, tap “Receive stock” and scan the items. Your stock and cost prices update automatically.')}>{can('purchasing.receive') && <Btn variant="primary" icon="truck" onClick={() => navigate('/purchasing/receive')}>{t('Receive stock')}</Btn>}</Empty>}
          columns={[
            { key: 'no', label: t('Delivery@@goods'), width: '1.1fr', render: (g) => <div><b class="mono">{g.no}</b>{g.supplier_invoice_no && <div class="small mute">{t('Inv.')} {g.supplier_invoice_no}</div>}</div> },
            { key: 'created_at', label: t('Date'), width: '1fr', render: (g) => d8(g.created_at) },
            { key: 'sup', label: t('Supplier'), width: '1.6fr', sort: (g) => sups.get(g.supplier_id)?.name || '', render: (g) => <span class="ellipsis">{sups.get(g.supplier_id)?.name || <span class="mute">{t('No supplier')}</span>}</span> },
            ...(multiBranch() ? [{ key: 'b', label: t('Branch'), width: '1fr', hideMobile: true, render: (g) => branchName(g.branch_id) }] : []),
            { key: 'items', label: t('Items'), width: '.6fr', num: true, hideMobile: true, render: (g) => g.lines.length },
            { key: 'total', label: t('Total'), width: '1fr', num: true, render: (g) => <b>{kes(g.total)}</b> },
            { key: 'paid', label: t('Payment'), width: '1fr', sortable: false, hideMobile: true, render: (g) => { const d = g.supplier_id ? due.get(g.id) || 0 : 0; return d <= 0 ? <Badge tone="ok">{t('Paid')}</Badge> : d < g.total ? <Badge tone="warn">{t('{v} due', { v: kes(d) })}</Badge> : <Badge tone="bad">{t('Unpaid')}</Badge>; } }
          ]} />
      )}
    </div>
  );
}
