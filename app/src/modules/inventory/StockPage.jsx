// Stock on hand per branch: value at cost & retail, filters, search, quick actions. Scan → that item's history.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { catalog } from '../../db/catalog.js';
import { db } from '../../db/index.js';
import { PageHeader, Btn, Icon, Badge, SearchBox, Empty, Stat } from '../../ui/kit.jsx';
import { VirtualTable } from '../../ui/table.jsx';
import { money, kes } from '../../lib/money.js';
import { search as runSearch, buildIndex } from '../../lib/search.js';
import { toCsv, download, DAY } from '../../lib/util.js';
import { audit } from '../../db/repo.js';
import { navigate } from '../../router.js';
import { can } from '../../auth/permissions.js';
import { StockTabs, ActTile, BranchSelect, useBranchLevels, useScan, resolveCode, fq, unitOf, multiBranch, branchName } from './common.jsx';
import { adjustDialog } from './AdjustDialog.jsx';
import * as S from '../../state.js';
import { t } from '../../i18n/index.js';

const FILTERS = [['all', 'All items'], ['in', 'In stock'], ['low', 'Low stock'], ['out', 'Out of stock'], ['neg', 'Below zero'], ['expiring', 'Expiring soon']];

export default function StockPage({ query }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [filter, setFilter] = useState(query?.filter || 'all');
  const [bid, setBid] = useState(S.branch.value?.id);
  const [expiring, setExpiring] = useState(new Set());
  const c = catalog.value;
  const lv = useBranchLevels(bid);
  const costs = can('products.cost_view');
  const mods = S.modulesOn.value;
  useEffect(() => { setFilter(query?.filter || 'all'); }, [query?.filter]);
  useEffect(() => {
    const lim = new Date(Date.now() + (S.settings.value.notify_expiry_days || 30) * DAY).toISOString().slice(0, 10);
    db().batches.where('expiry').below(lim).toArray().then((b) => setExpiring(new Set(b.filter((x) => !x.deleted && (!x.branch_id || x.branch_id === bid)).map((x) => x.product_id))));
  }, [bid]);
  useScan((code) => { const r = resolveCode(code); if (r) navigate('/inventory/product/' + r.product.id); });
  const tracked = useMemo(() => c.products.filter((p) => p.track_stock && !p.has_variants), [c.version]);
  const idx = useMemo(() => buildIndex(tracked), [tracked]);
  const priceAt = (p) => p.branch_prices?.[bid] || p.price;
  const all = useMemo(() => tracked.map((p) => ({ ...p, _q: lv.get(p.id) || 0 })), [tracked, lv]);
  const totals = useMemo(() => {
    let cost = 0, retail = 0, items = 0, low = 0, out = 0;
    for (const p of all) {
      if (p._q > 0) { items++; cost += Math.round(p._q * (p.cost || 0)); retail += Math.round(p._q * priceAt(p)); }
      if (p.active !== false && p._q <= 0) out++;
      else if (p.active !== false && p._q <= (p.reorder_level || 0)) low++;
    }
    return { cost, retail, items, low, out };
  }, [all]);
  const rows = useMemo(() => {
    let list = all;
    if (q.trim()) { const ids = new Set(runSearch(idx, q, { limit: 5000 }).map((p) => p.id)); list = list.filter((p) => ids.has(p.id)); }
    if (cat) list = list.filter((p) => p.category_id === cat);
    if (filter === 'in') list = list.filter((p) => p._q > 0);
    if (filter === 'low') list = list.filter((p) => p.active !== false && p._q <= (p.reorder_level || 0));
    if (filter === 'out') list = list.filter((p) => p._q <= 0);
    if (filter === 'neg') list = list.filter((p) => p._q < 0);
    if (filter === 'expiring') list = list.filter((p) => expiring.has(p.id));
    return list;
  }, [all, q, cat, filter, expiring]);
  const shown = rows.reduce((a, p) => ({ cost: a.cost + Math.max(0, p._q) * (p.cost || 0), retail: a.retail + Math.max(0, p._q) * priceAt(p) }), { cost: 0, retail: 0 });
  const exportCsv = () => {
    const csv = toCsv(rows, [
      { key: 'name', label: 'name' }, { key: 'sku', label: 'sku' }, { key: 'barcode', label: 'barcode' }, { label: 'category', get: (p) => c.catById.get(p.category_id)?.name || '' },
      { key: 'unit', label: 'unit' }, { label: 'stock', get: (p) => p._q }, { key: 'reorder_level', label: 'reorder_level' },
      ...(costs ? [{ label: 'cost', get: (p) => p.cost / 100 }, { key: 'value_at_cost', get: (p) => Math.round(Math.max(0, p._q) * p.cost) / 100 }] : []),
      { label: 'price', get: (p) => priceAt(p) / 100 }, { key: 'value_at_retail', get: (p) => Math.round(Math.max(0, p._q) * priceAt(p)) / 100 }
    ]);
    download(`stock-${(branchName(bid) || 'branch').replace(/\W+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`, '﻿' + csv, 'text/csv');
    audit('export.stock', 'products', null, { rows: rows.length, branch_id: bid });
  };
  const otherBranch = bid !== S.branch.value?.id;
  return (
    <div class="page wide" style={{ maxWidth: '1500px' }}>
      <PageHeader title={t('Stock')} sub={multiBranch() ? t('Showing {b}', { b: branchName(bid) }) : t('Everything you have, what it is worth, and what is running low')}
        actions={<>
          <BranchSelect value={bid} onValue={setBid} />
          <Btn icon="download" onClick={exportCsv}>{t('Export')}</Btn>
        </>} />
      <div class="inv-actions">
        {can('purchasing.receive') && <ActTile main icon="truck" title={t('Receive stock')} sub={t('A delivery has arrived')} href="#/purchasing/receive" />}
        {can('inventory.count') && <ActTile icon="list" tone="teal" title={t('Count stock')} sub={t('Stock take: count what is on the shelf')} href="#/inventory/counts?new=1" />}
        {can('inventory.adjust') && <ActTile icon="sliders" tone="sun" title={t('Adjust stock')} sub={t('Damaged, expired, lost or found')} onClick={() => adjustDialog()} />}
        {(multiBranch() || mods.multi_branch) && can('inventory.transfer') && <ActTile icon="refresh" title={t('Move stock')} sub={t('Send and receive between branches')} href="#/inventory/transfers/new" />}
        {can('inventory.repack') && <ActTile icon="scale" tone="teal" title={t('Repack stock')} sub={t('e.g. a 50 kg bag into 1 kg packets')} href="#/inventory/repack" />}
        {can('purchasing.orders') && <ActTile icon="file" tone="coral" title={t('Order stock')} sub={t('{n} items need reordering', { n: totals.low + totals.out })} href="#/inventory/reorder" />}
      </div>
      <StockTabs active="/inventory" />
      <div class="inv-stats">
        <Stat label={t('Items in stock')} value={totals.items.toLocaleString('en-KE')} icon="layers" />
        {costs && <Stat label={t('Value at cost')} value={money(totals.cost, { dec: false })} icon="wallet" />}
        <Stat label={t('Value at selling price')} value={money(totals.retail, { dec: false })} icon="tag" />
        <div class="card stat click" onClick={() => setFilter('low')} role="button"><div class="k"><Icon name="alert" size={16} />{t('Low stock')}</div><div class="v" style={{ color: totals.low ? 'var(--sun-d)' : '' }}>{totals.low}</div></div>
        <div class="card stat click" onClick={() => setFilter('out')} role="button"><div class="k"><Icon name="ban" size={16} />{t('Out of stock')}</div><div class="v" style={{ color: totals.out ? 'var(--coral-d)' : '' }}>{totals.out}</div></div>
      </div>
      <div class="row wrap mb" style={{ gap: '8px' }}>
        <SearchBox value={q} onValue={setQ} placeholder={t('Search name, SKU or barcode (or scan)')} />
        <select class="input" style={{ width: 'auto', maxWidth: '200px' }} value={cat} onChange={(e) => setCat(e.target.value)} aria-label={t('Category')}>
          <option value="">{t('All categories')}</option>{c.categories.map((k) => <option value={k.id}>{k.name}</option>)}
        </select>
        <div class="row wrap gap-s">{FILTERS.map(([k, l]) => <button class={'chip' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>{t(l)}</button>)}</div>
      </div>
      {otherBranch && <div class="callout mb"><Icon name="info" size={18} />{t('You are looking at another branch. Changes you make here (adjustments, counts) apply to your own branch: {b}.', { b: S.branch.value?.name })}</div>}
      <VirtualTable rows={rows} height="max(420px, calc(100vh - 200px))" rowHeight={58} onRowClick={(p) => navigate('/inventory/product/' + p.id + (otherBranch ? '?branch=' + bid : ''))}
        empty={!tracked.length ? <Empty icon="layers" title={t('No stock items yet')} text={t('Add products with “Track stock” switched on, or receive your first delivery.')}>{can('purchasing.receive') && <Btn variant="primary" icon="truck" onClick={() => navigate('/purchasing/receive')}>{t('Receive stock')}</Btn>}</Empty>
          : <Empty icon="search" title={t('No items match')} text={t('Try another word, scan the barcode again, or choose “All items”.')} />}
        footer={<div class="row small" style={{ padding: '10px 14px', borderTop: '1px solid var(--line)', background: 'var(--paper)' }}><span class="grow mute">{t('{n} items shown', { n: rows.length.toLocaleString('en-KE') })}</span>{costs && <span>{t('At cost')} <b class="mono">{money(Math.round(shown.cost))}</b></span>}<span>{t('At selling price')} <b class="mono">{money(Math.round(shown.retail))}</b></span></div>}
        columns={[
          { key: 'name', label: t('Item'), width: '2.6fr', render: (p) => (
            <div style={{ minWidth: 0 }}><div class="ellipsis bold">{p.name}</div><div class="small mute ellipsis mono">{[p.sku, p.barcode].filter(Boolean).join(' · ') || '—'}</div></div>) },
          { key: 'cat', label: t('Category'), width: '1.1fr', hideMobile: true, sort: (p) => c.catById.get(p.category_id)?.name || '', render: (p) => <span class="row gap-s ellipsis"><i class="sw-dot" style={{ background: c.catById.get(p.category_id)?.color || '#ccc' }} />{c.catById.get(p.category_id)?.name || '—'}</span> },
          { key: '_q', label: t('In stock'), width: '1fr', num: true, render: (p) => <Badge tone={p._q <= 0 ? 'bad' : p._q <= (p.reorder_level || 0) ? 'warn' : 'ok'}>{fq(p._q)}{unitOf(p)}</Badge> },
          { key: 'reorder_level', label: t('Reorder at'), width: '.8fr', num: true, hideMobile: true, render: (p) => (p.reorder_level ? fq(p.reorder_level) : <span class="mute">—</span>) },
          ...(costs ? [{ key: 'vcost', label: t('Value at cost'), width: '1fr', num: true, hideMobile: true, sort: (p) => p._q * p.cost, render: (p) => kes(Math.round(Math.max(0, p._q) * (p.cost || 0))) }] : []),
          { key: 'vret', label: t('Value at price'), width: '1fr', num: true, hideMobile: true, sort: (p) => p._q * priceAt(p), render: (p) => kes(Math.round(Math.max(0, p._q) * priceAt(p))) },
          { key: 'go', label: '', width: '44px', sortable: false, render: () => <Icon name="chevron-right" size={18} /> }
        ]} />
    </div>
  );
}
