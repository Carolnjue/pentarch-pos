import { useEffect, useMemo, useState } from 'preact/hooks';
import { catalog, levels } from '../../db/catalog.js';
import { db } from '../../db/index.js';
import { saveMany, audit } from '../../db/repo.js';
import { PageHeader, Btn, Icon, Badge, SearchBox, Select, Empty, Check } from '../../ui/kit.jsx';
import { VirtualTable } from '../../ui/table.jsx';
import { openModal, Modal, toast, Dropdown, confirm } from '../../ui/overlay.jsx';
import { MoneyInput, Seg } from '../../ui/kit.jsx';
import { money, kes, parseMoney } from '../../lib/money.js';
import { search as runSearch, buildIndex } from '../../lib/search.js';
import { StartCatalog } from './StartCatalog.jsx';
import { toCsv, download, DAY } from '../../lib/util.js';
import { on } from '../../lib/bus.js';
import { navigate } from '../../router.js';
import { can } from '../../auth/permissions.js';
import * as S from '../../state.js';
import { t } from '../../i18n/index.js';

const FILTERS = [['all', 'All'], ['low', 'Low stock'], ['out', 'Out of stock'], ['expiring', 'Expiring'], ['inactive', 'Inactive'], ['nobarcode', 'No barcode'], ['services', 'Services']];

export default function ProductsPage({ query }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [filter, setFilter] = useState(query?.filter || 'all');
  const [sel, setSel] = useState(new Set());
  const [expiring, setExpiring] = useState(new Set());
  const c = catalog.value;
  const lv = levels.value;
  const costs = can('products.cost_view');
  useEffect(() => {
    const lim = new Date(Date.now() + (S.settings.value.notify_expiry_days || 30) * DAY).toISOString().slice(0, 10);
    db().batches.where('expiry').below(lim).toArray().then((b) => setExpiring(new Set(b.map((x) => x.product_id))));
  }, []);
  useEffect(() => on('scan', (code) => { const h = catalog.value.byCode.get(code); if (h) navigate('/products/' + h.product.id); else if (can('products.edit')) navigate('/products/new?barcode=' + code); }), []);
  const idx = useMemo(() => buildIndex(c.products), [c.version]);
  const rows = useMemo(() => {
    let list = c.products.filter((p) => !p.parent_id);
    if (q.trim()) {
      const hits = runSearch(idx, q, { limit: 5000 });
      const ids = new Set(hits.map((p) => p.parent_id || p.id));
      list = list.filter((p) => ids.has(p.id));
    }
    if (cat) list = list.filter((p) => p.category_id === cat);
    const st = (p) => (p.has_variants ? c.products.filter((v) => v.parent_id === p.id).reduce((s, v) => s + (lv.get(v.id) || 0), 0) : lv.get(p.id) || 0);
    if (filter === 'low') list = list.filter((p) => p.track_stock && p.active !== false && st(p) <= (p.reorder_level || 0));
    if (filter === 'out') list = list.filter((p) => (p.track_stock || p.has_variants) && st(p) <= 0);
    if (filter === 'inactive') list = list.filter((p) => p.active === false);
    if (filter === 'nobarcode') list = list.filter((p) => !p.barcode && !p.has_variants && p.type !== 'service');
    if (filter === 'services') list = list.filter((p) => p.type === 'service');
    if (filter === 'expiring') list = list.filter((p) => expiring.has(p.id));
    if (filter !== 'inactive' && filter !== 'all') list = list.filter((p) => p.active !== false);
    return list.map((p) => ({ ...p, _stock: st(p) }));
  }, [c.version, lv, q, cat, filter, expiring]);
  const toggle = (id) => { const n = new Set(sel); n.has(id) ? n.delete(id) : n.add(id); setSel(n); };
  const value = rows.reduce((s, p) => s + (p.track_stock || p.has_variants ? Math.max(0, p._stock) * (costs ? p.cost : p.price) : 0), 0);
  const exportCsv = () => {
    const all = c.products.filter((p) => !p.has_variants);
    const csv = toCsv(all, [
      { key: 'name', label: 'name' }, { key: 'sku', label: 'sku' }, { key: 'barcode', label: 'barcode' }, { label: 'category', get: (p) => c.catById.get(p.category_id)?.name || '' },
      { key: 'type', label: 'type' }, { key: 'unit', label: 'unit' }, { label: 'price', get: (p) => p.price / 100 }, ...(costs ? [{ label: 'cost', get: (p) => p.cost / 100 }] : []),
      { key: 'tax', label: 'tax' }, { label: 'stock', get: (p) => lv.get(p.id) || 0 }, { key: 'reorder_level', label: 'reorder_level' },
      { label: 'wholesale_price', get: (p) => (p.wholesale_price || 0) / 100 }, { key: 'wholesale_min_qty', label: 'wholesale_min_qty' }, { label: 'active', get: (p) => (p.active === false ? 'no' : 'yes') }
    ]);
    download(`products-${new Date().toISOString().slice(0, 10)}.csv`, '﻿' + csv, 'text/csv');
    audit('export.products', 'products', null, { rows: all.length });
  };
  const selected = rows.filter((p) => sel.has(p.id));
  return (
    <div class="page wide" style={{ maxWidth: '1500px' }}>
      <PageHeader title={t('Products')} sub={t('{n} products · stock value {v}', { n: c.products.filter((p) => !p.parent_id).length, v: money(value) }) + (costs ? ' ' + t('(at cost)') : '')}
        actions={<>
          {can('products.import') && <Dropdown trigger={({ toggle }) => <Btn icon="upload" onClick={toggle}>{t('Import / export')}</Btn>}>
            <a href="#/products/import"><Icon name="upload" size={18} />{t('Import from CSV / Excel')}</a>
            <button onClick={exportCsv}><Icon name="download" size={18} />{t('Export to CSV')}</button>
          </Dropdown>}
          {can('labels.print') && <Btn icon="barcode" onClick={() => navigate('/products/labels' + (sel.size ? '?ids=' + [...sel].join(',') : ''))}>{t('Print labels')}</Btn>}
          {can('products.edit') && <Btn icon="tags" onClick={() => navigate('/products/categories')}>{t('Categories')}</Btn>}
          {can('products.edit') && <Btn variant="primary" icon="plus" onClick={() => navigate('/products/new')}>{t('Add product')}</Btn>}
        </>} />
      <div class="row wrap mb" style={{ gap: '8px' }}>
        <SearchBox value={q} onValue={setQ} placeholder={t('Search name, SKU or barcode (or scan)')} />
        <select class="input" style={{ width: 'auto', maxWidth: '220px' }} value={cat} onChange={(e) => setCat(e.target.value)} aria-label={t('Category')}>
          <option value="">{t('All categories')}</option>{c.categories.map((k) => <option value={k.id}>{k.name}</option>)}
        </select>
      </div>
      <div class="row wrap mb gap-s">{FILTERS.map(([k, l]) => <button class={'chip' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>{t(l)}</button>)}</div>
      {sel.size > 0 && can('products.edit') && (
        <div class="card pad mb row wrap" style={{ background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)', padding: '10px 14px' }}>
          <b>{t('{n} selected', { n: sel.size })}</b>
          <span class="spacer" />
          {can('products.price') && <Btn size="sm" icon="tag" onClick={() => bulkPrice(selected).then(() => setSel(new Set()))}>{t('Change price')}</Btn>}
          <Btn size="sm" icon="tags" onClick={() => bulkCategory(selected).then(() => setSel(new Set()))}>{t('Set category')}</Btn>
          <Btn size="sm" icon="star" onClick={() => bulkSet(selected, (p) => ({ favourite: !selected.every((x) => x.favourite) }), 'favourite')}>{t('Favourite')}</Btn>
          <Btn size="sm" icon="eye-off" onClick={async () => { const on = selected.every((x) => x.active === false); await bulkSet(selected, () => ({ active: on }), on ? 'activate' : 'deactivate'); setSel(new Set()); }}>{selected.every((x) => x.active === false) ? t('Activate') : t('Deactivate')}</Btn>
          <Btn size="sm" icon="barcode" onClick={() => navigate('/products/labels?ids=' + [...sel].join(','))}>{t('Labels')}</Btn>
          <Btn size="sm" variant="ghost" icon="x" style={{ color: '#fff' }} onClick={() => setSel(new Set())} aria-label={t('Clear selection')} />
        </div>
      )}
      <VirtualTable rows={rows} height="calc(100vh - 300px)" rowHeight={58} onRowClick={(p) => navigate('/products/' + p.id)}
        empty={!catalog.value.products.length && !q ? <StartCatalog /> : <Empty icon="box" title={t('No products match')} text={t('Try another word, scan the barcode again, or choose “All”.')} />}
        columns={[
          ...(can('products.edit') ? [{ key: 'sel', label: <input type="checkbox" aria-label={t('Select all')} checked={rows.length > 0 && rows.every((p) => sel.has(p.id))} onClick={(e) => { e.stopPropagation(); setSel(rows.every((p) => sel.has(p.id)) ? new Set() : new Set(rows.map((p) => p.id))); }} />, width: '44px', sortable: false, render: (p) => <input type="checkbox" checked={sel.has(p.id)} aria-label={t('Select')} onClick={(e) => { e.stopPropagation(); toggle(p.id); }} /> }] : []),
          { key: 'name', label: t('Product'), width: '2.6fr', render: (p) => (
            <div class="row" style={{ gap: '10px', minWidth: 0 }}>
              {p.image ? <img src={p.image} alt="" style={{ width: '36px', height: '36px', borderRadius: '9px', objectFit: 'cover', flex: 'none' }} /> : <span class="ico-bub" style={{ width: '36px', height: '36px', background: (c.catById.get(p.category_id)?.color || '#1F3C7A') + '1f', color: c.catById.get(p.category_id)?.color || 'var(--navy)' }}><Icon name={c.catById.get(p.category_id)?.icon || 'box'} size={17} /></span>}
              <div style={{ minWidth: 0 }}><div class="ellipsis bold">{p.favourite && <Icon name="star" size={13} style={{ display: 'inline', color: 'var(--sun-d)', marginRight: '4px', verticalAlign: '-1px' }} />}{p.name}</div>
                <div class="small mute ellipsis mono">{[p.sku, p.barcode, p.has_variants && t('{n} variants', { n: c.products.filter((v) => v.parent_id === p.id).length })].filter(Boolean).join(' · ')}</div></div>
            </div>) },
          { key: 'cat', label: t('Category'), width: '1.2fr', hideMobile: true, sort: (p) => c.catById.get(p.category_id)?.name || '', render: (p) => <span class="row gap-s"><i class="sw-dot" style={{ background: c.catById.get(p.category_id)?.color || '#ccc' }} />{c.catById.get(p.category_id)?.name || '—'}</span> },
          { key: '_stock', label: t('Stock'), width: '.9fr', num: true, render: (p) => (p.track_stock || p.has_variants ? <Badge tone={p._stock <= 0 ? 'bad' : p._stock <= (p.reorder_level || 0) ? 'warn' : ''}>{Math.round(p._stock * 100) / 100} {p.unit !== 'pc' ? p.unit : ''}</Badge> : <span class="mute small">{p.type === 'service' ? t('Service') : '—'}</span>) },
          ...(costs ? [{ key: 'cost', label: t('Cost'), width: '.9fr', num: true, hideMobile: true, render: (p) => kes(p.cost) }] : []),
          { key: 'price', label: t('Price'), width: '.9fr', num: true, render: (p) => <b>{kes(p.price)}</b> },
          ...(costs ? [{ key: 'margin', label: t('Margin'), width: '.7fr', num: true, hideMobile: true, sort: (p) => (p.price ? (p.price - p.cost) / p.price : 0), render: (p) => { const m = p.price ? ((p.price - p.cost) / p.price) * 100 : 0; return <span class={m < 5 ? 'down' : ''}>{m.toFixed(0)}%</span>; } }] : []),
          { key: 'active', label: '', width: '80px', sortable: false, hideMobile: true, render: (p) => (p.active === false ? <Badge>{t('Inactive')}</Badge> : '') }
        ]} />
    </div>
  );
}

async function bulkSet(list, fn, what) {
  await saveMany('products', list.map(({ _stock, ...p }) => ({ ...p, ...fn(p) })));
  await audit('product.bulk_edit', 'products', null, { what, count: list.length });
  toast(t('{n} products updated', { n: list.length }));
}
function bulkPrice(list) {
  return openModal((close) => <BulkPrice list={list} close={close} />);
}
function BulkPrice({ list, close }) {
  const [mode, setMode] = useState('pct');
  const [v, setV] = useState('');
  const [round, setRound] = useState(true);
  const calc = (p) => {
    const n = parseFloat(v) || 0;
    let np = mode === 'pct' ? p.price * (1 + n / 100) : mode === 'amount' ? p.price + n * 100 : mode === 'margin' ? (p.cost ? p.cost / (1 - n / 100) : p.price) : n * 100;
    if (round) np = Math.round(np / 500) * 500 || Math.round(np / 100) * 100;
    return Math.max(0, Math.round(np));
  };
  const apply = async () => {
    const changed = list.map(({ _stock, ...p }) => ({ ...p, price: calc(p) }));
    await saveMany('products', changed);
    await audit('price.change', 'products', null, { bulk: true, count: list.length, mode, value: v });
    toast(t('{n} prices updated', { n: list.length }));
    close(true);
  };
  return (
    <Modal title={t('Change price of {n} products', { n: list.length })} icon="tag" size="lg" onClose={() => close(false)}
      footer={<><Btn onClick={() => close(false)}>{t('Cancel')}</Btn><Btn variant="primary" onClick={apply} disabled={!v}>{t('Update prices')}</Btn></>}>
      <div class="row wrap mb gap-s">
        <Seg value={mode} onValue={setMode} options={[{ value: 'pct', label: t('± %') }, { value: 'amount', label: t('± KES') }, { value: 'margin', label: t('Margin %') }, { value: 'set', label: t('Set price') }]} />
        <input class="input mono num" style={{ width: '140px' }} value={v} onInput={(e) => setV(e.target.value)} placeholder={mode === 'pct' ? '10' : '50'} aria-label={t('Value')} autoFocus />
        <label class="check"><input type="checkbox" checked={round} onChange={(e) => setRound(e.target.checked)} />{t('Round to KES 5')}</label>
      </div>
      <div class="card" style={{ maxHeight: '320px', overflow: 'auto' }}>
        {list.slice(0, 100).map((p) => <div class="list-item small"><span class="grow ellipsis">{p.name}</span><span class="mono mute">{kes(p.price)}</span><Icon name="arrow-right" size={14} /><b class="mono">{kes(calc(p))}</b></div>)}
      </div>
    </Modal>
  );
}
function bulkCategory(list) {
  return openModal((close) => (
    <Modal title={t('Move {n} products to…', { n: list.length })} icon="tags" size="sm" center onClose={() => close(false)}>
      <div class="col gap-s">{catalog.value.categories.map((k) => <button class="btn" style={{ justifyContent: 'flex-start' }} onClick={async () => { await bulkSet(list, () => ({ category_id: k.id }), 'category'); close(true); }}><i class="sw-dot" style={{ background: k.color }} />{k.name}</button>)}</div>
    </Modal>
  ));
}
