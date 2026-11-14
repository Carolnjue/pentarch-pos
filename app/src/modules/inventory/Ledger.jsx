// Stock history of one product: every move with who, when, document and the balance before/after ("everything is logged").
import { useEffect, useMemo, useState } from 'preact/hooks';
import { catalog } from '../../db/catalog.js';
import { db } from '../../db/index.js';
import { batchBalances } from '../../db/stock.js';
import { PageHeader, Btn, Icon, Badge, Empty, Stat } from '../../ui/kit.jsx';
import { VirtualTable, Table } from '../../ui/table.jsx';
import { money, kes } from '../../lib/money.js';
import { on } from '../../lib/bus.js';
import { navigate } from '../../router.js';
import { can } from '../../auth/permissions.js';
import { productLedger, refLabels } from '../../core/inventory.js';
import { daysUntil } from '../../core/stockmath.js';
import { StockTabs, BranchSelect, fq, unitOf, dtm, userName, moveLabel, reasonLabel, multiBranch, branchName } from './common.jsx';
import { adjustDialog } from './AdjustDialog.jsx';
import * as S from '../../state.js';
import { t, tn } from '../../i18n/index.js';

const KINDS = [['all', 'Everything'], ['in', 'Stock in'], ['out', 'Stock out'], ['sale', 'Sales'], ['purchase', 'Deliveries'], ['adjust', 'Adjustments'], ['count', 'Counts'], ['transfer', 'Transfers']];
const LINK = { sale: (id) => '#/sales/' + id, return: null, grn: (id) => '#/purchasing/grn/' + id, supplier_return: (id) => '#/purchasing/grn/' + id, transfer: (id) => '#/inventory/transfers/' + id, stock_count: (id) => '#/inventory/counts/' + id };

export default function Ledger({ params, query }) {
  const p = catalog.value.byId.get(params.id);
  const [bid, setBid] = useState(query?.branch || S.branch.value?.id);
  const [moves, setMoves] = useState(null);
  const [refs, setRefs] = useState(new Map());
  const [kind, setKind] = useState('all');
  const [perBranch, setPerBranch] = useState([]);
  const [batches, setBatches] = useState([]);
  const [serials, setSerials] = useState([]);
  const load = async () => {
    if (!p) return;
    const m = await productLedger(p.id, bid);
    setMoves(m);
    setRefs(await refLabels(m.slice(0, 3000)));
    setPerBranch(await db().stock_levels.where('product_id').equals(p.id).toArray());
    if (p.track_batches) setBatches(await batchBalances(p.id, bid));
    if (p.track_serials) setSerials((await db().serials.where('product_id').equals(p.id).toArray()).filter((s) => !s.deleted && s.status === 'in_stock' && (!s.branch_id || s.branch_id === bid)));
  };
  useEffect(() => { load(); return on('change', (e) => (e === 'stock_levels' || e === 'stock_moves') && load()); }, [params.id, bid]);
  const rows = useMemo(() => (moves || []).filter((m) => kind === 'all' || (kind === 'in' ? m.qty > 0 : kind === 'out' ? m.qty < 0 : kind === 'sale' ? ['sale', 'void', 'return', 'recipe'].includes(m.type) : kind === 'transfer' ? m.type.startsWith('transfer') : m.type === kind)), [moves, kind]);
  if (!p) return <div class="page"><Empty icon="box" title={t('Product not found')} text={t('It may have been deleted.')}><Btn onClick={() => navigate('/inventory')}>{t('Back to stock')}</Btn></Empty></div>;
  const here = perBranch.find((x) => x.branch_id === bid)?.qty || 0;
  const since = Date.now() - 30 * 86400000;
  const sold30 = (moves || []).filter((m) => m.created_at > since && (m.type === 'sale' || m.type === 'recipe' || m.type === 'void')).reduce((s, m) => s - m.qty, 0);
  const costs = can('products.cost_view');
  const mine = bid === S.branch.value?.id;
  return (
    <div class="page wide" style={{ maxWidth: '1400px' }}>
      <PageHeader back="#/inventory" title={p.name} sub={<span class="mono">{[p.sku, p.barcode].filter(Boolean).join(' · ')}</span>}
        actions={<>
          <BranchSelect value={bid} onValue={setBid} />
          {can('products.view') && <Btn icon="edit" onClick={() => navigate('/products/' + p.id)}>{t('Product details')}</Btn>}
          {can('labels.print') && <Btn icon="barcode" onClick={() => navigate('/products/labels?ids=' + p.id)}>{t('Labels')}</Btn>}
          {can('inventory.adjust') && mine && <Btn variant="primary" icon="sliders" onClick={() => adjustDialog(p)}>{t('Adjust stock')}</Btn>}
        </>} />
      <div class="inv-stats">
        <Stat label={multiBranch() ? t('In stock here') : t('In stock')} value={<span style={{ color: here <= 0 ? 'var(--coral-d)' : here <= (p.reorder_level || 0) ? 'var(--sun-d)' : '' }}>{fq(here)}{unitOf(p)}</span>} icon="layers">
          {p.reorder_level > 0 && <div class="small mute" style={{ marginTop: '4px' }}>{t('Reorder at {n}', { n: fq(p.reorder_level) })}</div>}
        </Stat>
        {multiBranch() && <Stat label={t('All branches')} value={fq(perBranch.reduce((s, x) => s + x.qty, 0)) + unitOf(p)} icon="store">
          <div class="small mute" style={{ marginTop: '4px' }}>{perBranch.map((x) => `${branchName(x.branch_id)}: ${fq(x.qty)}`).join(' · ')}</div></Stat>}
        {costs && <Stat label={t('Cost (average)')} value={money(p.cost || 0)} icon="wallet"><div class="small mute" style={{ marginTop: '4px' }}>{t('Stock value {v}', { v: money(Math.round(Math.max(0, here) * (p.cost || 0))) })}</div></Stat>}
        <Stat label={t('Selling price')} value={money(p.price)} icon="tag" />
        <Stat label={t('Sold in 30 days')} value={fq(sold30) + unitOf(p)} icon="cart"><div class="small mute" style={{ marginTop: '4px' }}>{t('{n} a day', { n: fq(Math.round((sold30 / 30) * 10) / 10) })}</div></Stat>
      </div>
      {(batches.length > 0 || serials.length > 0) && (
        <div class="split-even mb">
          {batches.length > 0 && <div class="card">
            <div class="card-h"><h3>{t('Batches (sold first-expiry-first-out)')}</h3></div>
            <Table dense rows={batches} columns={[
              { key: 'batch_no', label: t('Batch'), render: (b) => <b class="mono">{b.batch_no}</b> },
              { key: 'expiry', label: t('Expiry'), render: (b) => { const d = daysUntil(b.expiry); return <span class="row gap-s">{b.expiry || '—'}{d < 0 ? <Badge tone="bad">{t('Expired')}</Badge> : d <= 30 ? <Badge tone="warn">{tn(d, '{n} day', '{n} days')}</Badge> : null}</span>; } },
              { key: 'qty', label: t('Qty'), num: true, render: (b) => fq(b.qty) }
            ]} />
          </div>}
          {serials.length > 0 && <div class="card">
            <div class="card-h"><h3>{t('Serial / IMEI numbers in stock')}</h3><Badge>{serials.length}</Badge></div>
            <div class="card-b row wrap gap-s" style={{ maxHeight: '220px', overflow: 'auto' }}>{serials.map((s) => <a class="chip mono" href={'#/inventory/serials?q=' + s.serial}>{s.serial}</a>)}</div>
          </div>}
        </div>
      )}
      <div class="row wrap mb gap-s">{KINDS.map(([k, l]) => <button class={'chip' + (kind === k ? ' on' : '')} onClick={() => setKind(k)}>{t(l)}</button>)}</div>
      {!moves ? <div class="card" style={{ height: '300px' }} /> : (
        <VirtualTable rows={rows} height="calc(100vh - 230px)" rowHeight={56}
          empty={<Empty icon="history" title={t('No stock movements yet')} text={t('Sales, deliveries, counts and adjustments of this item will be listed here.')} />}
          columns={[
            { key: 'created_at', label: t('When'), width: '1.1fr', hideMobile: true, render: (m) => <span class="small">{dtm(m.created_at)}</span> },
            { key: 'type', label: t('What happened'), width: '1.8fr', sort: (m) => m.type, render: (m) => (
              <div style={{ minWidth: 0 }}><div class="ellipsis bold">{moveLabel(m.type)}</div><div class="small mute ellipsis"><span class="hide-d">{dtm(m.created_at)}{(m.reason || m.note) ? ' · ' : ''}</span>{[reasonLabel(m.reason), m.note].filter(Boolean).join(' — ')}</div></div>) },
            { key: 'ref', label: t('Document'), width: '1.2fr', hideMobile: true, sortable: false, render: (m) => { const no = refs.get(m.ref_id); const l = LINK[m.ref_type]; return no ? (l ? <a class="mono small" href={l(m.ref_id)} onClick={(e) => e.stopPropagation()}>{no}</a> : <span class="mono small">{no}</span>) : <span class="mute small">{m.batch_no || m.serial || ''}</span>; } },
            { key: 'user_id', label: t('By'), width: '.9fr', hideMobile: true, render: (m) => <span class="small ellipsis">{userName(m.user_id).split(' ')[0] || '—'}</span> },
            { key: 'qty', label: t('Change'), width: '.8fr', num: true, render: (m) => <span class={m.qty > 0 ? 'ledger-in' : 'ledger-out'}>{m.qty > 0 ? '+' : '−'}{fq(Math.abs(m.qty))}</span> },
            { key: 'before', label: t('Before'), width: '.7fr', num: true, hideMobile: true, render: (m) => <span class="mute">{fq(m.before)}</span> },
            { key: 'after', label: t('After'), width: '.7fr', num: true, render: (m) => <b>{fq(m.after)}</b> },
            ...(costs ? [{ key: 'cost', label: t('Unit cost'), width: '.8fr', num: true, hideMobile: true, render: (m) => <span class="small">{kes(m.cost || 0)}</span> }] : [])
          ]} />
      )}
    </div>
  );
}
