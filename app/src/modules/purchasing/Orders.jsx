// Purchase orders list.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { db } from '../../db/index.js';
import { PageHeader, Btn, Empty } from '../../ui/kit.jsx';
import { VirtualTable } from '../../ui/table.jsx';
import { kes } from '../../lib/money.js';
import { on } from '../../lib/bus.js';
import { navigate } from '../../router.js';
import { can } from '../../auth/permissions.js';
import { suppliersList } from '../../core/purchasing.js';
import { BuyTabs, StatusPill, d8 } from '../inventory/common.jsx';
import { t } from '../../i18n/index.js';

const OPEN = ['draft', 'sent', 'partial'];
export default function Orders() {
  const [rows, setRows] = useState(null);
  const [sups, setSups] = useState(new Map());
  const [f, setF] = useState('open');
  const load = async () => {
    const [p, s] = await Promise.all([db().purchase_orders.toArray(), suppliersList()]);
    setRows(p.filter((x) => !x.deleted).sort((a, b) => b.created_at - a.created_at)); setSups(new Map(s.map((x) => [x.id, x])));
  };
  useEffect(() => { load(); return on('change', (e) => e === 'purchase_orders' && load()); }, []);
  const list = useMemo(() => (rows || []).filter((p) => f === 'all' || (f === 'open' ? OPEN.includes(p.status) : p.status === f)), [rows, f]);
  const n = (k) => (rows || []).filter((p) => (k === 'open' ? OPEN.includes(p.status) : p.status === k)).length;
  return (
    <div class="page wide" style={{ maxWidth: '1400px' }}>
      <PageHeader title={t('Purchases')} sub={t('Orders you send to suppliers. Receive the goods against the order when they arrive.')}
        actions={can('purchasing.orders') && <><Btn icon="refresh" onClick={() => navigate('/inventory/reorder')}>{t('From low stock')}</Btn><Btn variant="primary" icon="plus" onClick={() => navigate('/purchasing/orders/new')}>{t('New purchase order')}</Btn></>} />
      <BuyTabs active="/purchasing/orders" />
      <div class="row wrap mb gap-s">{[['open', t('Open')], ['received', t('Received')], ['cancelled', t('Cancelled')], ['all', t('All')]].map(([k, l]) => <button class={'chip' + (f === k ? ' on' : '')} onClick={() => setF(k)}>{l}{k !== 'all' && n(k) ? <span class="badge" style={{ height: '18px' }}>{n(k)}</span> : null}</button>)}</div>
      {!rows ? <div class="card" style={{ height: '300px' }} /> : (
        <VirtualTable rows={list} height="calc(100vh - 260px)" rowHeight={56} onRowClick={(p) => navigate('/purchasing/orders/' + p.id)}
          empty={<Empty icon="file" title={f === 'open' ? t('No open orders') : t('No orders here')} text={t('Create an order and send it to your supplier on WhatsApp or print it. Tip: “From low stock” fills in what you need.')}>{can('purchasing.orders') && <Btn variant="primary" icon="plus" onClick={() => navigate('/purchasing/orders/new')}>{t('New purchase order')}</Btn>}</Empty>}
          columns={[
            { key: 'no', label: t('Order'), width: '1.1fr', render: (p) => <b class="mono">{p.no}</b> },
            { key: 'created_at', label: t('Date'), width: '1fr', render: (p) => d8(p.created_at) },
            { key: 'sup', label: t('Supplier'), width: '1.7fr', sort: (p) => sups.get(p.supplier_id)?.name || '', render: (p) => <span class="ellipsis">{sups.get(p.supplier_id)?.name || '—'}</span> },
            { key: 'items', label: t('Items'), width: '.6fr', num: true, hideMobile: true, render: (p) => p.lines.length },
            { key: 'expected_date', label: t('Expected'), width: '1fr', hideMobile: true, render: (p) => p.expected_date || <span class="mute">—</span> },
            { key: 'total', label: t('Total'), width: '1fr', num: true, render: (p) => kes(p.total || 0) },
            { key: 'status', label: t('Status'), width: '1fr', render: (p) => <StatusPill s={p.status} /> }
          ]} />
      )}
    </div>
  );
}
