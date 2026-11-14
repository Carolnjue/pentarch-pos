// CSV import: template download → upload/paste → map columns → preview with dry-run errors → import (create or update by barcode/SKU).
import { useMemo, useState } from 'preact/hooks';
import { catalog } from '../../db/catalog.js';
import { saveMany, audit } from '../../db/repo.js';
import { addMoves } from '../../db/stock.js';
import { PageHeader, Btn, Icon, Badge, Empty, Switch, Textarea } from '../../ui/kit.jsx';
import { Table } from '../../ui/table.jsx';
import { toast } from '../../ui/overlay.jsx';
import { parseCsv, toCsv, download } from '../../lib/util.js';
import { parseMoney, money } from '../../lib/money.js';
import { isValidEan13, generateInternalEan } from '../../lib/barcode.js';
import { ulid } from '../../lib/ulid.js';
import { CATEGORY_COLORS } from '../../presets/types.js';
import { navigate } from '../../router.js';
import * as S from '../../state.js';
import { t } from '../../i18n/index.js';

const FIELDS = [
  { key: 'name', label: 'Name', req: true, alias: ['name', 'product', 'item', 'description', 'product name', 'jina'] },
  { key: 'price', label: 'Selling price', req: true, alias: ['price', 'selling price', 'sp', 'retail', 'bei', 'unit price'] },
  { key: 'cost', label: 'Cost price', alias: ['cost', 'buying price', 'bp', 'cost price', 'purchase price'] },
  { key: 'category', label: 'Category', alias: ['category', 'group', 'department', 'aina'] },
  { key: 'barcode', label: 'Barcode', alias: ['barcode', 'ean', 'upc', 'code'] },
  { key: 'sku', label: 'SKU', alias: ['sku', 'item code', 'product code', 'ref'] },
  { key: 'unit', label: 'Unit', alias: ['unit', 'uom'] },
  { key: 'tax', label: 'Tax code (A–E)', alias: ['tax', 'vat', 'tax code'] },
  { key: 'stock', label: 'Opening stock', alias: ['stock', 'qty', 'quantity', 'on hand', 'opening stock'] },
  { key: 'reorder_level', label: 'Reorder level', alias: ['reorder', 'reorder level', 'min', 'minimum'] },
  { key: 'wholesale_price', label: 'Wholesale price', alias: ['wholesale', 'wholesale price'] },
  { key: 'wholesale_min_qty', label: 'Wholesale min qty', alias: ['wholesale min', 'wholesale qty', 'wholesale_min_qty'] },
  { key: 'type', label: 'Type (stock/service/weight)', alias: ['type'] }
];
const TEMPLATE = [
  { name: 'Brookside Milk 500ml', price: 65, cost: 55, category: 'Dairy', barcode: '', sku: 'MLK-500', unit: 'pc', tax: 'A', stock: 24, reorder_level: 6, wholesale_price: '', wholesale_min_qty: '', type: 'stock' },
  { name: 'Kabras Sugar 1kg', price: 185, cost: 160, category: 'Flour & sugar', barcode: '', sku: 'SUG-1KG', unit: 'pc', tax: 'B', stock: 40, reorder_level: 10, wholesale_price: 172, wholesale_min_qty: 20, type: 'stock' },
  { name: 'Delivery within town', price: 200, cost: '', category: 'Services', barcode: '', sku: '', unit: 'pc', tax: 'B', stock: '', reorder_level: '', wholesale_price: '', wholesale_min_qty: '', type: 'service' }
];

export default function Import() {
  const [rows, setRows] = useState(null); // raw rows incl header
  const [map, setMap] = useState({});
  const [step, setStep] = useState(1);
  const [genBarcodes, setGen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [paste, setPaste] = useState('');
  const load = (text) => {
    const r = parseCsv(text);
    if (r.length < 2) return toast.error(t('The file needs a header row and at least one product'));
    const head = r[0].map((h) => h.trim().toLowerCase());
    const m = {};
    for (const f of FIELDS) { const i = head.findIndex((h) => f.alias.includes(h) || h === f.key); if (i >= 0) m[f.key] = i; }
    setRows(r); setMap(m); setStep(2);
  };
  const onFile = async (file) => {
    if (!file) return;
    if (/\.xlsx?$/i.test(file.name)) return toast.error(t('Save the Excel sheet as CSV (File → Save as → CSV) and upload that.'));
    load(await file.text());
  };
  const parsed = useMemo(() => {
    if (!rows) return [];
    const cats = new Map(catalog.value.categories.map((c) => [c.name.toLowerCase(), c]));
    const seenCodes = new Set();
    return rows.slice(1).map((r, i) => {
      const g = (k) => (map[k] != null ? String(r[map[k]] ?? '').trim() : '');
      const errs = [];
      const name = g('name');
      const price = parseMoney(g('price'));
      const cost = g('cost') ? parseMoney(g('cost')) : 0;
      if (!name) errs.push(t('Name missing'));
      if (isNaN(price) || g('price') === '') errs.push(t('Price missing or not a number'));
      if (isNaN(cost)) errs.push(t('Cost is not a number'));
      const barcode = g('barcode').replace(/\s/g, '');
      if (barcode && /^\d{13}$/.test(barcode) && !isValidEan13(barcode)) errs.push(t('Barcode check digit wrong'));
      if (barcode && seenCodes.has(barcode)) errs.push(t('Barcode repeated in file'));
      if (barcode) seenCodes.add(barcode);
      const tax = (g('tax') || S.settings.value.default_tax || 'B').toUpperCase().slice(0, 1);
      if (!'ABCDE'.includes(tax)) errs.push(t('Tax code must be A–E'));
      const existing = (barcode && catalog.value.byCode.get(barcode)?.product) || (g('sku') && catalog.value.products.find((p) => p.sku && p.sku.toUpperCase() === g('sku').toUpperCase()));
      const stock = g('stock') ? parseFloat(g('stock')) : 0;
      const type = ['service', 'weight', 'non_stock', 'stock'].includes(g('type').toLowerCase()) ? g('type').toLowerCase() : 'stock';
      return { line: i + 2, name, price, cost, barcode, sku: g('sku').toUpperCase(), unit: g('unit') || (type === 'weight' ? 'kg' : 'pc'), tax, stock: isNaN(stock) ? 0 : stock, reorder_level: parseFloat(g('reorder_level')) || 0,
        wholesale_price: g('wholesale_price') ? parseMoney(g('wholesale_price')) || 0 : 0, wholesale_min_qty: parseFloat(g('wholesale_min_qty')) || 0, category: g('category'), catExists: !g('category') || cats.has(g('category').toLowerCase()), type, existing, errs };
    });
  }, [rows, map]);
  const ok = parsed.filter((r) => !r.errs.length);
  const run = async () => {
    setBusy(true);
    try {
      const cats = new Map(catalog.value.categories.map((c) => [c.name.toLowerCase(), c]));
      const newCats = [];
      for (const r of ok) if (r.category && !cats.has(r.category.toLowerCase())) { const c = { id: ulid(), name: r.category, color: CATEGORY_COLORS[(cats.size + newCats.length) % CATEGORY_COLORS.length], icon: 'box', sort: cats.size + newCats.length, parent_id: null }; cats.set(r.category.toLowerCase(), c); newCats.push(c); }
      if (newCats.length) await saveMany('categories', newCats);
      const taken = (c) => !!catalog.value.byCode.get(c);
      const recs = [], moves = [];
      for (const r of ok) {
        const base = r.existing || { id: ulid(), barcodes: [], has_variants: false, parent_id: null, units_of_measure: [], track_batches: false, track_serials: false, allow_price_edit: false, image: '', favourite: false, sort: 0, branch_prices: {}, recipe: [], modifiers_group_ids: [], active: true, notes: '', reorder_qty: 0 };
        const rec = { ...base, name: r.name, price: r.price, cost: r.cost || base.cost || 0, tax: r.tax, unit: r.unit, type: r.type, sku: r.sku || base.sku || '', category_id: r.category ? cats.get(r.category.toLowerCase()).id : base.category_id || null,
          barcode: r.barcode || base.barcode || (genBarcodes && r.type !== 'service' ? generateInternalEan(taken) : ''), reorder_level: r.reorder_level || base.reorder_level || 0,
          wholesale_price: r.wholesale_price || base.wholesale_price || 0, wholesale_min_qty: r.wholesale_min_qty || base.wholesale_min_qty || 0, track_stock: ['stock', 'weight'].includes(r.type) };
        recs.push(rec);
        if (!r.existing && rec.track_stock && r.stock > 0) moves.push({ product_id: rec.id, qty: r.stock, type: 'opening', ref_type: 'import', cost: rec.cost, reason: 'CSV import' });
      }
      for (let i = 0; i < recs.length; i += 500) await saveMany('products', recs.slice(i, i + 500));
      if (moves.length) await addMoves(moves);
      await audit('product.import', 'products', null, { created: ok.filter((r) => !r.existing).length, updated: ok.filter((r) => r.existing).length, skipped: parsed.length - ok.length });
      setResult({ created: ok.filter((r) => !r.existing).length, updated: ok.filter((r) => r.existing).length, skipped: parsed.length - ok.length, cats: newCats.length });
      setStep(4);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const tmpl = () => download('pentarch-pos-products-template.csv', '﻿' + toCsv(TEMPLATE, FIELDS.map((f) => ({ key: f.key, label: f.key }))), 'text/csv');
  return (
    <div class="page" style={{ maxWidth: '1100px' }}>
      <PageHeader back="#/products" title={t('Import products')} sub={t('From Excel (saved as CSV), another POS, or a supplier price list.')} actions={<Btn icon="download" onClick={tmpl}>{t('Download template')}</Btn>} />
      <div class="steps-h">{[t('1. Upload'), t('2. Match columns'), t('3. Check'), t('4. Done')].map((s, i) => <span class={step === i + 1 ? 'on' : step > i + 1 ? 'done' : ''}>{s}</span>)}</div>
      {step === 1 && (
        <div class="grid2" style={{ alignItems: 'start' }}>
          <label class="dropzone" onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('over'); }} onDragLeave={(e) => e.currentTarget.classList.remove('over')}
            onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('over'); onFile(e.dataTransfer.files[0]); }}>
            <Icon name="upload" size={36} style={{ margin: '0 auto 10px', color: 'var(--navy)' }} />
            <b>{t('Drop a CSV file here or tap to choose')}</b>
            <p class="mute small" style={{ margin: '6px 0 0' }}>{t('In Excel: File → Save as → CSV UTF-8')}</p>
            <input type="file" accept=".csv,text/csv,.txt" class="sr" onChange={(e) => onFile(e.target.files[0])} />
          </label>
          <div class="card pad col">
            <Textarea label={t('…or paste rows from a spreadsheet')} value={paste} onValue={setPaste} rows={6} placeholder={'name,price,cost,category,barcode\nBrookside Milk 500ml,65,55,Dairy,'} />
            <Btn variant="navy" disabled={!paste.trim()} onClick={() => load(paste.includes('\t') ? paste.replace(/\t/g, ',') : paste)}>{t('Use pasted rows')}</Btn>
          </div>
        </div>
      )}
      {step === 2 && rows && (
        <div class="card">
          <div class="card-h"><h3>{t('Match your columns')}</h3><span class="small mute">{t('{n} rows found', { n: rows.length - 1 })}</span></div>
          <div class="card-b form-grid">
            {FIELDS.map((f) => (
              <div class="field"><label>{t(f.label)}{f.req && ' *'}</label>
                <select class="input" value={map[f.key] ?? ''} aria-label={t(f.label)} onChange={(e) => setMap({ ...map, [f.key]: e.target.value === '' ? undefined : +e.target.value })}>
                  <option value="">{t('— skip —')}</option>{rows[0].map((h, i) => <option value={i}>{h || t('Column {n}', { n: i + 1 })} {rows[1]?.[i] ? `(${String(rows[1][i]).slice(0, 18)})` : ''}</option>)}
                </select></div>
            ))}
          </div>
          <div class="modal-f"><Btn onClick={() => setStep(1)}>{t('Back')}</Btn><Btn variant="primary" disabled={map.name == null || map.price == null} onClick={() => setStep(3)}>{t('Check rows')}</Btn></div>
        </div>
      )}
      {step === 3 && (
        <div class="col gap-l">
          <div class="grid3">
            <div class="card stat"><div class="k">{t('New products')}</div><div class="v up">{ok.filter((r) => !r.existing).length}</div></div>
            <div class="card stat"><div class="k">{t('Will update')}</div><div class="v">{ok.filter((r) => r.existing).length}</div></div>
            <div class="card stat"><div class="k">{t('Rows with errors (skipped)')}</div><div class={'v ' + (parsed.length - ok.length ? 'down' : '')}>{parsed.length - ok.length}</div></div>
          </div>
          <div class="card" style={{ maxHeight: '50vh', overflow: 'auto' }}>
            <Table dense rows={parsed.slice(0, 500)} columns={[
              { key: 'line', label: t('Row'), render: (r) => <span class="mono mute">{r.line}</span> },
              { key: 'name', label: t('Name'), render: (r) => <b>{r.name}</b> },
              { key: 'category', label: t('Category'), render: (r) => <span>{r.category}{r.category && !r.catExists && <Badge tone="navy">{t('new')}</Badge>}</span> },
              { key: 'price', label: t('Price'), num: true, render: (r) => (isNaN(r.price) ? '—' : money(r.price)) },
              { key: 'stock', label: t('Stock'), num: true, render: (r) => r.stock || '' },
              { key: 'st', label: t('Status'), render: (r) => (r.errs.length ? <span class="down small bold">{r.errs.join('; ')}</span> : r.existing ? <Badge tone="warn">{t('Update')}</Badge> : <Badge tone="ok">{t('New')}</Badge>) }
            ]} />
          </div>
          <Switch checked={genBarcodes} onChange={setGen} label={t('Create barcodes for items without one')} sub={t('Internal EAN-13 codes you can print on labels')} />
          <div class="row"><Btn onClick={() => setStep(2)}>{t('Back')}</Btn><span class="spacer" /><Btn variant="primary" icon="upload" disabled={!ok.length || busy} onClick={run}>{busy ? t('Importing…') : t('Import {n} products', { n: ok.length })}</Btn></div>
        </div>
      )}
      {step === 4 && result && (
        <div class="card"><Empty icon="check-circle" title={t('Import finished')} text={t('{a} added, {b} updated, {c} skipped, {d} new categories.', { a: result.created, b: result.updated, c: result.skipped, d: result.cats })}>
          <div class="row gap-s"><Btn variant="primary" onClick={() => navigate('/products')}>{t('See products')}</Btn><Btn icon="barcode" onClick={() => navigate('/products/labels')}>{t('Print labels')}</Btn></div>
        </Empty></div>
      )}
    </div>
  );
}
