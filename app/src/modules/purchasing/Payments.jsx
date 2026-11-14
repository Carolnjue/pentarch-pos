// Supplier payments: list + "Pay a supplier".
import { useEffect, useMemo, useState } from 'preact/hooks';
import { PageHeader, Btn, Empty, Stat } from '../../ui/kit.jsx';
import { VirtualTable } from '../../ui/table.jsx';
import { money, kes } from '../../lib/money.js';
import { on } from '../../lib/bus.js';
import { navigate } from '../../router.js';
import { allSupplierPayments, suppliersList, allSupplierBalances } from '../../core/purchasing.js';
import { BuyTabs, d8, userName, payLabel } from '../inventory/common.jsx';
import { payDialog } from './payDialog.jsx';
import { hasModal } from '../../ui/overlay.jsx';
import { t } from '../../i18n/index.js';

export default function Payments({ query }) {
  const [rows, setRows] = useState(null);
  const [sups, setSups] = useState(new Map());
  const [owed, setOwed] = useState(0);
  const load = async () => {
    const [p, s, b] = await Promise.all([allSupplierPayments(), suppliersList(), allSupplierBalances()]);
    setRows(p); setSups(new Map(s.map((x) => [x.id, x]))); setOwed([...b.values()].reduce((x, a) => x + Math.max(0, a.balance), 0));
  };
  useEffect(() => { load(); return on('change', (e) => ['supplier_payments', 'goods_received'].includes(e) && load()); }, []);
  useEffect(() => { if (query?.new && !hasModal()) { const { supplier, grn } = query; navigate('/purchasing/payments', { replace: true }); payDialog(supplier || '', grn || ''); } }, [query?.new]);
  const month0 = useMemo(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.getTime(); }, []);
  const paidMonth = (rows || []).filter((p) => p.created_at >= month0).reduce((s, p) => s + p.amount, 0);
  return (
    <div class="page wide" style={{ maxWidth: '1400px' }}>
      <PageHeader title={t('Purchases')} sub={t('Money paid to suppliers')} actions={<Btn variant="primary" icon="wallet" onClick={() => payDialog()}>{t('Pay a supplier')}</Btn>} />
      <BuyTabs active="/purchasing/payments" />
      <div class="inv-stats">
        <Stat label={t('Paid this month')} value={money(paidMonth)} icon="wallet" />
        <div class="card stat click" role="button" onClick={() => navigate('/purchasing/suppliers')}><div class="k">{t('Still owed')}</div><div class="v">{money(owed)}</div></div>
      </div>
      {!rows ? <div class="card" style={{ height: '300px' }} /> : (
        <VirtualTable rows={rows} height="calc(100vh - 300px)" rowHeight={56} onRowClick={(p) => navigate('/purchasing/suppliers/' + p.supplier_id)}
          empty={<Empty icon="wallet" title={t('No supplier payments yet')} text={t('Record every payment to a supplier so you always know what you still owe.')}><Btn variant="primary" icon="wallet" onClick={() => payDialog()}>{t('Pay a supplier')}</Btn></Empty>}
          columns={[
            { key: 'created_at', label: t('Date'), width: '1fr', render: (p) => d8(p.created_at) },
            { key: 'sup', label: t('Supplier'), width: '1.8fr', sort: (p) => sups.get(p.supplier_id)?.name || '', render: (p) => <span class="ellipsis bold">{sups.get(p.supplier_id)?.name || '—'}</span> },
            { key: 'method', label: t('Method'), width: '1fr', render: (p) => (p.amount < 0 ? t('Refund from supplier') : payLabel(p.method)) },
            { key: 'ref', label: t('Reference'), width: '1fr', hideMobile: true, render: (p) => <span class="mono small">{p.ref || '—'}</span> },
            { key: 'user', label: t('By'), width: '.9fr', hideMobile: true, render: (p) => userName(p.user_id).split(' ')[0] || '—' },
            { key: 'amount', label: t('Amount'), width: '1fr', num: true, render: (p) => <b class={p.amount < 0 ? 'up' : ''}>{kes(p.amount)}</b> }
          ]} />
      )}
    </div>
  );
}
