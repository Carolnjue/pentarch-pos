// Low stock & reorder suggestions → tick items → one purchase order per supplier.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { PageHeader, Btn, Icon, Empty, Badge, Stat } from '../../ui/kit.jsx';
import { VirtualTable } from '../../ui/table.jsx';
import { toast } from '../../ui/overlay.jsx';
import { money, kes } from '../../lib/money.js';
import { navigate } from '../../router.js';
import { can } from '../../auth/permissions.js';
import { reorderSuggestions } from '../../core/inventory.js';
import { savePO, suppliersList } from '../../core/purchasing.js';
import { licenceState } from '../../auth/session.js';
import { StockTabs, QtyIn, fq, unitOf } from './common.jsx';
import * as S from '../../state.js';
import { t, tn } from '../../i18n/index.js';

export default function Reorder() {
  const [rows, setRows] = useState(null);
  const [sups, setSups] = useState([]);
  const [sel, setSel] = useState(new Set());
  const [qty, setQty] = useState({});
  const [sup, setSup] = useState({});
  const [fallback, setFallback] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    Promise.all([reorderSuggestions(S.branch.value?.id), suppliersList()]).then(([r, s]) => {
      setRows(r); setSups(s); setFallback(s[0]?.id || '');
      setSel(new Set(r.filter((x) => x.onOrder < x.suggested).map((x) => x.id)));
    });
  }, []);
  const costs = can('products.cost_view');
  const canOrder = can('purchasing.orders') && licenceState().canPurchase;
  const chosen = useMemo(() => (rows || []).filter((r) => sel.has(r.id)), [rows, sel]);
  const supOf = (r) => sup[r.id] ?? r.supplier_id ?? '';
  const est = chosen.reduce((s, r) => s + Math.round((qty[r.id] ?? r.suggested) * r.cost), 0);
  const groups = useMemo(() => { const g = {}; for (const r of chosen) (g[supOf(r) || fallback] ||= []).push(r); return g; }, [chosen, sup, fallback]);
  const create = async () => {
    if (!Object.keys(groups).every(Boolean)) return toast.warn(t('Choose a supplier'));
    setBusy(true);
    const made = [];
    for (const [sid, list] of Object.entries(groups)) {
      made.push(await savePO({ supplier_id: sid, branch_id: S.branch.value?.id, status: 'draft', lines: list.map((r) => ({ product_id: r.id, name: r.product.name, qty: qty[r.id] ?? r.suggested, cost: r.cost })), notes: '' }));
    }
    toast(tn(made.length, '{n} purchase order created', '{n} purchase orders created'));
    navigate(made.length === 1 ? '/purchasing/orders/' + made[0].id : '/purchasing/orders');
  };
  const supName = (id) => sups.find((s) => s.id === id)?.name;
  return (
    <div class="page wide" style={{ maxWidth: '1500px' }}>
      <PageHeader title={t('Stock')} sub={t('Items at or below their reorder level, with a suggested quantity based on the last 30 days of sales')}
        actions={canOrder && <Btn variant="primary" icon="file" disabled={!chosen.length || busy || !sups.length} onClick={create}>{Object.keys(groups).length > 1 ? t('Create {n} purchase orders', { n: Object.keys(groups).length }) : t('Create purchase order')}</Btn>} />
      <StockTabs active="/inventory/reorder" />
      {rows && rows.length > 0 && <div class="inv-stats">
        <Stat label={t('Need reordering')} value={rows.length} icon="alert" />
        <Stat label={t('Out of stock')} value={<span class={rows.filter((r) => r.onHand <= 0).length ? 'down' : ''}>{rows.filter((r) => r.onHand <= 0).length}</span>} icon="ban" />
        <Stat label={t('Selected')} value={chosen.length} icon="check" />
        {costs && <Stat label={t('Estimated cost')} value={money(est)} icon="wallet" />}
      </div>}
      {rows && rows.length > 0 && canOrder && (
        <div class="card pad mb row wrap">
          <Icon name="store" size={20} />
          <span class="grow">{t('Items without a usual supplier go to:')}</span>
          {sups.length ? <select class="input" style={{ width: 'auto', minWidth: '220px' }} value={fallback} onChange={(e) => setFallback(e.target.value)} aria-label={t('Default supplier')}>{sups.map((s) => <option value={s.id}>{s.name}</option>)}</select>
            : <Btn size="sm" icon="plus" onClick={() => navigate('/purchasing/suppliers?new=1')}>{t('Add a supplier first')}</Btn>}
        </div>
      )}
      {!rows ? <div class="card" style={{ height: '300px' }} /> : (
        <VirtualTable rows={rows} height="calc(100vh - 330px)" rowHeight={62}
          empty={<Empty icon="check-circle" title={t('Nothing to reorder')} text={t('All items are above their reorder level. Set a reorder level on a product to get reminders here.')} />}
          columns={[
            ...(canOrder ? [{ key: 'sel', width: '44px', sortable: false, label: <input type="checkbox" aria-label={t('Select all')} checked={rows.length > 0 && rows.every((r) => sel.has(r.id))} onClick={() => setSel(rows.every((r) => sel.has(r.id)) ? new Set() : new Set(rows.map((r) => r.id)))} />,
              render: (r) => <input type="checkbox" aria-label={t('Select')} checked={sel.has(r.id)} onClick={() => { const n = new Set(sel); n.has(r.id) ? n.delete(r.id) : n.add(r.id); setSel(n); }} /> }] : []),
            { key: 'name', label: t('Item'), width: '2.2fr', sort: (r) => r.product.name, render: (r) => <a class="ellipsis bold" style={{ color: 'inherit', textDecoration: 'none', display: 'block' }} href={'#/inventory/product/' + r.id}>{r.product.name}</a> },
            { key: 'onHand', label: t('In stock'), width: '.8fr', num: true, render: (r) => <Badge tone={r.onHand <= 0 ? 'bad' : 'warn'}>{fq(r.onHand)}{unitOf(r.product)}</Badge> },
            { key: 'onOrder', label: t('On order'), width: '.7fr', num: true, hideMobile: true, render: (r) => (r.onOrder ? fq(r.onOrder) : <span class="mute">—</span>) },
            { key: 'avgDaily', label: t('Per day'), width: '.8fr', num: true, hideMobile: true, render: (r) => (r.avgDaily ? fq(Math.round(r.avgDaily * 10) / 10) : <span class="mute">—</span>) },
            { key: 'daysLeft', label: t('Lasts'), width: '.8fr', num: true, hideMobile: true, sort: (r) => r.daysLeft ?? 999, render: (r) => (r.daysLeft == null ? <span class="mute">—</span> : r.daysLeft < 1 ? <span class="down bold">{t('today')}</span> : tn(Math.floor(r.daysLeft), '{n} day', '{n} days')) },
            { key: 'suggested', label: t('Order'), width: '160px', sortable: false, render: (r) => <QtyIn value={qty[r.id] ?? r.suggested} onValue={(v) => setQty({ ...qty, [r.id]: v })} label={t('Order quantity of {name}', { name: r.product.name })} /> },
            ...(canOrder ? [{ key: 'sup', label: t('Supplier'), width: '1.3fr', hideMobile: true, sort: (r) => supName(supOf(r)) || '', render: (r) => (
              <select class="input" style={{ height: '40px', minHeight: 0 }} value={supOf(r)} onChange={(e) => setSup({ ...sup, [r.id]: e.target.value })} aria-label={t('Supplier')}>
                <option value="">{supName(fallback) || t('Default')}</option>{sups.map((s) => <option value={s.id}>{s.name}</option>)}
              </select>) }] : []),
            ...(costs ? [{ key: 'cost', label: t('Est. cost'), width: '.9fr', num: true, hideMobile: true, render: (r) => kes(Math.round((qty[r.id] ?? r.suggested) * r.cost)) }] : [])
          ]} />
      )}
    </div>
  );
}
