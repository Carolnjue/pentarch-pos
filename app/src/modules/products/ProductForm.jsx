// Product form: all product fields (SPEC §3) — variants matrix, units, wholesale tier, batches/serials, recipe, modifiers, branch prices, image, barcodes.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { db } from '../../db/index.js';
import { save, saveMany, remove, audit } from '../../db/repo.js';
import { addMoves } from '../../db/stock.js';
import { catalog, levels, variantsOf } from '../../db/catalog.js';
import { PageHeader, Btn, Icon, Input, Select, MoneyInput, Switch, Textarea, Badge, Empty, Check } from '../../ui/kit.jsx';
import { Table } from '../../ui/table.jsx';
import { openModal, Modal, toast, confirm, promptText } from '../../ui/overlay.jsx';
import { generateInternalEan, isValidEan13, makeEan13 } from '../../lib/barcode.js';
import { money, kes, parseMoney } from '../../lib/money.js';
import { TAX_CODES } from '../../lib/tax.js';
import { compressImage } from '../../lib/util.js';
import { on } from '../../lib/bus.js';
import { navigate } from '../../router.js';
import { can } from '../../auth/permissions.js';
import { requirePerm } from '../../auth/override.jsx';
import { barcodeSvg } from '../../print/print.js';
import { pickProduct } from './picker.jsx';
import { quickCategory } from './Categories.jsx';
import * as S from '../../state.js';
import { t } from '../../i18n/index.js';

const UNITS = ['pc', 'kg', 'g', 'l', 'ml', 'm', 'box', 'pack', 'pair', 'dozen', 'bag', 'roll', 'ft', 'tin', 'bottle', 'plate', 'hour'];
const TYPES = [['stock', 'Stock item'], ['weight', 'Sold by weight'], ['service', 'Service'], ['composite', 'Recipe / composite'], ['non_stock', 'Non-stock item']];
const blank = (q = {}) => ({
  name: q.name || '', sku: '', barcode: q.barcode || '', barcodes: [], category_id: '', type: 'stock', unit: 'pc', price: 0, cost: 0, wholesale_price: 0, wholesale_min_qty: 0,
  tax: S.settings.value.default_tax || 'B', track_stock: true, reorder_level: 0, reorder_qty: 0, has_variants: false, parent_id: null, variant_attrs: null,
  units_of_measure: [], track_batches: false, track_serials: false, allow_price_edit: false, image: '', favourite: false, sort: 0, branch_prices: {}, recipe: [],
  service_duration_min: 0, kitchen_station: null, modifiers_group_ids: [], active: true, notes: '', plu: ''
});
const codeTaken = (code, selfIds) => { const h = catalog.value.byCode.get(code); return h && !selfIds.includes(h.product.id) ? h.product : null; };

export default function ProductForm({ params, query }) {
  const isNew = !params.id;
  const [f, setF] = useState(null);
  const [orig, setOrig] = useState(null);
  const [variants, setVariants] = useState([]);
  const [opening, setOpening] = useState({ qty: '', batch_no: '', expiry: '', serials: '' });
  const [moves, setMoves] = useState([]);
  const [groups, setGroups] = useState([]);
  const [bcSvg, setBcSvg] = useState('');
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);
  const mods = S.modulesOn.value;
  const editable = can('products.edit');
  useEffect(() => {
    (async () => {
      setGroups((await db().modifier_groups.toArray()).filter((g) => !g.deleted));
      if (isNew) { const b = blank(query); b.category_id = catalog.value.categories[0]?.id || ''; setF(b); setOrig(null); setVariants([]); return; }
      const p = await db().products.get(params.id);
      if (!p) return setF(false);
      setF({ ...blank(), ...p }); setOrig(p);
      setMore(!!(p.sku || p.notes || p.units_of_measure?.length || p.wholesale_price || p.barcodes?.length || p.modifiers_group_ids?.length || Object.keys(p.branch_prices || {}).length || p.tax !== (S.settings.value.default_tax || 'B')));
      setVariants(p.has_variants ? (await db().products.where('parent_id').equals(p.id).toArray()).filter((v) => !v.deleted) : []);
      setMoves((await db().stock_moves.where('product_id').equals(p.id).reverse().sortBy('created_at')).slice(0, 12));
    })();
  }, [params.id]);
  useEffect(() => { if (f?.barcode) barcodeSvg(f.barcode, { height: 46 }).then(setBcSvg).catch(() => setBcSvg('')); else setBcSvg(''); }, [f?.barcode]);
  useEffect(() => on('scan', (code) => { if (document.activeElement?.dataset?.barcodeField) return; setF((x) => (x && !x.barcode ? { ...x, barcode: code } : x)); }), []);
  if (f === false) return <div class="page"><Empty icon="box" title={t('Product not found')} /></div>;
  if (!f) return <div class="page" />;
  const set = (patch) => setF({ ...f, ...patch });
  const selfIds = [f.id, ...variants.map((v) => v.id)].filter(Boolean);
  const margin = f.price ? ((f.price - f.cost) / f.price) * 100 : 0;
  const stockNow = f.id ? (f.has_variants ? variants.reduce((s, v) => s + (levels.value.get(v.id) || 0), 0) : levels.value.get(f.id) || 0) : 0;
  const genBarcode = () => set({ barcode: generateInternalEan((c) => !!catalog.value.byCode.get(c)) });
  const genCode128 = () => { const sku = f.sku || ('P' + Date.now().toString(36)).toUpperCase(); set({ sku, barcode: sku }); };

  async function onSave(addAnother) {
    if (!f.name.trim()) return toast.error(t('Enter the product name'));
    if (f.barcode && codeTaken(f.barcode, selfIds)) return toast.error(t('Barcode already used by {name}', { name: codeTaken(f.barcode, selfIds).name }));
    if (f.barcode && /^\d{13}$/.test(f.barcode) && !isValidEan13(f.barcode) && !(await confirm({ title: t('Barcode check digit is wrong'), message: t('{code} is not a valid EAN-13. Keep it anyway?', { code: f.barcode }), ok: t('Keep it') }))) return;
    for (const u of f.units_of_measure) if (u.barcode && codeTaken(u.barcode, selfIds)) return toast.error(t('Barcode already used by {name}', { name: codeTaken(u.barcode, selfIds).name }));
    if (f.sku) { const other = catalog.value.products.find((p) => p.sku && p.sku.toUpperCase() === f.sku.toUpperCase() && !selfIds.includes(p.id)); if (other) return toast.error(t('SKU already used by {name}', { name: other.name })); }
    if (orig && (orig.price !== f.price || orig.cost !== f.cost || orig.wholesale_price !== f.wholesale_price) && !can('products.price')) { const by = await requirePerm('products.price', t('Change price of {name}', { name: f.name })); if (!by) return; }
    if (f.has_variants && !variants.length) return toast.error(t('Generate at least one variant'));
    setBusy(true);
    try {
      const rec = { ...f, name: f.name.trim(), sku: f.sku.trim(), barcodes: f.barcodes.filter(Boolean), track_stock: f.has_variants ? false : ['stock', 'weight'].includes(f.type) && f.track_stock !== false };
      if (rec.type === 'service' || rec.type === 'non_stock' || rec.type === 'composite') rec.track_stock = false;
      if (rec.type === 'weight' && !rec.plu) rec.plu = String(Math.floor(Math.random() * 90000) + 10000);
      const saved = await save('products', rec, { audit: { action: isNew ? 'product.create' : 'product.update', details: { name: rec.name } } });
      if (orig && orig.price !== rec.price) await audit('price.change', 'products', saved.id, { name: rec.name, from: orig.price, to: rec.price });
      const newMoves = [];
      if (f.has_variants) {
        const vs = await saveMany('products', variants.map((v) => ({
          ...blank(), ...v, category_id: rec.category_id, tax: rec.tax, cost: v.cost ?? rec.cost, unit: rec.unit, type: 'stock', track_stock: true, parent_id: saved.id,
          reorder_level: rec.reorder_level, track_serials: rec.track_serials, track_batches: rec.track_batches, wholesale_price: rec.wholesale_price, wholesale_min_qty: rec.wholesale_min_qty
        })));
        vs.forEach((v, i) => { const q = parseFloat(variants[i]._opening) || 0; if (q > 0) newMoves.push({ product_id: v.id, qty: q, type: 'opening', ref_type: 'opening', cost: v.cost, reason: 'Opening stock' }); });
      } else if ((isNew || !moves.length) && saved.track_stock) {
        let q = parseFloat(opening.qty) || 0;
        const serials = f.track_serials ? opening.serials.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean) : [];
        if (serials.length) {
          q = serials.length;
          await saveMany('serials', serials.map((s) => ({ product_id: saved.id, serial: s, status: 'in_stock', sale_id: null })));
          for (const s of serials) newMoves.push({ product_id: saved.id, qty: 1, type: 'opening', ref_type: 'opening', cost: saved.cost, serial: s });
        } else if (q > 0) {
          const mv = { product_id: saved.id, qty: q, type: 'opening', ref_type: 'opening', cost: saved.cost, reason: 'Opening stock' };
          if (f.track_batches && opening.batch_no) { mv.batch_no = opening.batch_no.trim(); mv.expiry = opening.expiry; await save('batches', { product_id: saved.id, batch_no: mv.batch_no, expiry: opening.expiry, qty_received: q }); }
          newMoves.push(mv);
        }
      }
      if (newMoves.length) { await addMoves(newMoves); await audit('stock.opening', 'products', saved.id, { qty: newMoves.reduce((s, m) => s + m.qty, 0) }); }
      toast(isNew ? t('{name} added', { name: rec.name }) : t('Saved'));
      if (addAnother) { setF({ ...blank(), category_id: rec.category_id, tax: rec.tax, unit: rec.unit, type: rec.type }); setVariants([]); setOpening({ qty: '', batch_no: '', expiry: '', serials: '' }); setOrig(null); navigate('/products/new', { replace: true }); }
      else navigate('/products/' + saved.id, { replace: true });
    } catch (e) { console.error(e); toast.error(e.message); } finally { setBusy(false); }
  }
  async function onDelete() {
    const by = await requirePerm('products.delete', t('Delete {name}', { name: f.name }));
    if (!by) return;
    if (!(await confirm({ title: t('Delete {name}?', { name: f.name }), message: t('It disappears from selling and lists. Sales history and stock records are kept.'), danger: true, ok: t('Delete') }))) return;
    await remove('products', f.id, { audit: { action: 'product.delete', details: { name: f.name, approved_by: by.name } } });
    for (const v of variants) await remove('products', v.id);
    toast(t('Deleted'));
    navigate('/products');
  }
  const bp = S.branches.value.length > 1 && mods.multi_branch;
  return (
    <div class="page">
      <PageHeader back="#/products" title={isNew ? t('New product') : f.name} sub={!isNew && <span class="row gap-s">{f.sku && <span class="mono">{f.sku}</span>}{f.active === false && <Badge>{t('Inactive')}</Badge>}{f.has_variants && <Badge tone="navy">{t('{n} variants', { n: variants.length })}</Badge>}</span>}
        actions={editable && <>
          {!isNew && can('products.delete') && <Btn variant="danger" icon="trash" onClick={onDelete}>{t('Delete')}</Btn>}
          {!isNew && can('labels.print') && <Btn icon="barcode" onClick={() => navigate('/products/labels?ids=' + (f.has_variants ? variants.map((v) => v.id).join(',') : f.id))}>{t('Labels')}</Btn>}
          {isNew && <Btn icon="plus" disabled={busy} onClick={() => onSave(true)}>{t('Save & add another')}</Btn>}
          <Btn variant="primary" icon="check" disabled={busy} onClick={() => onSave(false)}>{t('Save product')}</Btn>
        </>} />
      <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0 }}>
      <div class="pf-grid">
        <div class="col gap-l">
          <div class="card">
            <div class="card-h"><h3>{t('Basics')}</h3></div>
            <div class="card-b form-grid">
              <Input class="span2" label={t('Product name')} value={f.name} onValue={(v) => set({ name: v })} autoFocus={isNew && !f.name} placeholder={t('e.g. Brookside Milk 500ml')} hint={t('Write it the way customers ask for it, with the size.')} />
              <div class="field">
                <label>{t('Category')}</label>
                <div class="row gap-s">
                  <select class="input" value={f.category_id} onChange={(e) => set({ category_id: e.target.value })} aria-label={t('Category')}>
                    <option value="">{t('— none —')}</option>{catalog.value.categories.map((k) => <option value={k.id}>{k.name}</option>)}
                  </select>
                  <Btn icon="plus" aria-label={t('New category')} onClick={async () => { const k = await quickCategory(); if (k) set({ category_id: k.id }); }} />
                </div>
              </div>
              <Select label={t('Type')} value={f.type} onValue={(v) => set({ type: v, unit: v === 'weight' ? 'kg' : v === 'service' ? (f.unit === 'pc' ? 'pc' : f.unit) : f.unit, track_stock: ['stock', 'weight'].includes(v) })}
                options={TYPES.filter(([k]) => k !== 'composite' || mods.recipes || f.type === 'composite').map(([k, l]) => ({ value: k, label: t(l) }))} />
              <Select label={t('Unit')} value={f.unit} onValue={(v) => set({ unit: v })} options={UNITS.map((u) => ({ value: u, label: u }))} />
              {more && <Input label={t('SKU / code')} value={f.sku} onValue={(v) => set({ sku: v.toUpperCase() })} inputClass="mono" placeholder={t('optional')} />}
              {f.type === 'service' && <Input label={t('Duration (minutes)')} type="number" value={f.service_duration_min || ''} onValue={(v) => set({ service_duration_min: parseInt(v) || 0 })} />}
              {f.type === 'weight' && <Input label={t('Scale PLU (5 digits)')} value={f.plu || ''} onValue={(v) => set({ plu: v.replace(/\D/g, '').slice(0, 5) })} inputClass="mono" hint={t('Used in scale barcodes starting {p}', { p: S.settings.value.weight_prefix })} />}
              {more && <Textarea class="full" label={t('Notes (shown to staff, e.g. warranty)')} value={f.notes} onValue={(v) => set({ notes: v })} rows={2} />}
            </div>
          </div>

          <div class="card">
            <div class="card-h"><h3>{t('Price & tax')}</h3>{can('products.cost_view') && f.price > 0 && <Badge tone={margin < 5 ? 'bad' : margin < 15 ? 'warn' : 'ok'}>{t('Margin {m}%', { m: margin.toFixed(1) })}</Badge>}</div>
            <div class="card-b form-grid">
              <MoneyInput label={t('Selling price')} value={f.price} onValue={(v) => set({ price: v })} hint={S.settings.value.vat_inclusive !== false ? t('Including VAT') : t('Excluding VAT')} />
              {can('products.cost_view') && <MoneyInput label={t('Cost price')} value={f.cost} onValue={(v) => set({ cost: v })} hint={t('Updated automatically when you receive stock')} />}
              {more && <Select label={t('Tax (eTIMS code)')} value={f.tax} onValue={(v) => set({ tax: v })} options={Object.values(TAX_CODES).map((x) => ({ value: x.code, label: `${x.code} — ${t(x.label)}` }))} hint={t('Most items: B (VAT 16%)')} />}
              {more && mods.wholesale && <MoneyInput label={t('Wholesale price')} value={f.wholesale_price} onValue={(v) => set({ wholesale_price: v })} />}
              {more && mods.wholesale && <Input label={t('Wholesale from quantity')} type="number" value={f.wholesale_min_qty || ''} onValue={(v) => set({ wholesale_min_qty: parseFloat(v) || 0 })} hint={t('Wholesale customers always get it')} />}
              <div class="full row wrap" style={{ gap: '20px' }}>
                {more && <Switch checked={f.allow_price_edit} onChange={(v) => set({ allow_price_edit: v })} label={t('Ask for price when selling')} sub={t('For items with varying prices')} />}
                <Switch checked={f.favourite} onChange={(v) => set({ favourite: v })} label={t('Quick key (favourite)')} sub={t('Shows first on the Sell screen')} />
                <Switch checked={f.active !== false} onChange={(v) => set({ active: v })} label={t('Active')} sub={t('Inactive items cannot be sold')} />
              </div>
              {more && bp && (
                <div class="full">
                  <div class="section-title" style={{ marginTop: 0 }}>{t('Branch prices')}</div>
                  <div class="form-grid">{S.branches.value.map((b) => <MoneyInput label={b.name} value={f.branch_prices?.[b.id] ?? 0} hint={t('Leave 0 to use the normal price')} onValue={(v) => { const bpx = { ...(f.branch_prices || {}) }; if (v) bpx[b.id] = v; else delete bpx[b.id]; set({ branch_prices: bpx }); }} />)}</div>
                </div>
              )}
            </div>
          </div>

          {mods.variants && f.type === 'stock' && (isNew || f.has_variants) && <VariantsCard f={f} set={set} variants={variants} setVariants={setVariants} />}

          {!f.has_variants && ['stock', 'weight'].includes(f.type) && (
            <div class="card">
              <div class="card-h"><h3>{t('Stock')}</h3>{!isNew && <Badge tone={stockNow <= (f.reorder_level || 0) ? 'warn' : 'ok'}>{t('{n} in stock', { n: Math.round(stockNow * 1000) / 1000 })}</Badge>}</div>
              <div class="card-b form-grid">
                <div class="full row wrap" style={{ gap: '20px' }}>
                  <Switch checked={f.track_stock} onChange={(v) => set({ track_stock: v })} label={t('Track stock')} />
                  {mods.batches && <Switch checked={f.track_batches} onChange={(v) => set({ track_batches: v })} label={t('Batches & expiry')} sub={t('First-expiry-first-out')} />}
                  {mods.serials && <Switch checked={f.track_serials} onChange={(v) => set({ track_serials: v })} label={t('Serial / IMEI numbers')} />}
                </div>
                {f.track_stock && <>
                  <Input label={t('Reorder level (alert at)')} type="number" value={f.reorder_level || ''} onValue={(v) => set({ reorder_level: parseFloat(v) || 0 })} />
                  <Input label={t('Reorder quantity')} type="number" value={f.reorder_qty || ''} onValue={(v) => set({ reorder_qty: parseFloat(v) || 0 })} />
                  {(isNew || !moves.length) && !f.track_serials && <Input label={t('Opening stock')} type="number" inputMode="decimal" value={opening.qty} onValue={(v) => setOpening({ ...opening, qty: v })} hint={t('Quantity you have right now')} />}
                  {(isNew || !moves.length) && f.track_batches && <><Input label={t('Batch number')} value={opening.batch_no} onValue={(v) => setOpening({ ...opening, batch_no: v })} /><Input label={t('Expiry date')} type="date" value={opening.expiry} onValue={(v) => setOpening({ ...opening, expiry: v })} /></>}
                  {(isNew || !moves.length) && f.track_serials && <Textarea class="full" label={t('Serial / IMEI numbers in stock (one per line or scan)')} value={opening.serials} onValue={(v) => setOpening({ ...opening, serials: v })} rows={3} data-scan="keep" />}
                </>}
              </div>
              {moves.length > 0 && (
                <div style={{ borderTop: '1px solid var(--line)' }}>
                  <div class="card-h" style={{ borderBottom: 0, paddingBottom: 0 }}><h4 class="grow">{t('Recent stock movements')}</h4>{can('inventory.view') && <a class="small" href={'#/inventory/product/' + params.id}>{t('Full stock history')}</a>}</div>
                  <Table dense rows={moves} columns={[
                    { key: 'created_at', label: t('When'), render: (m) => new Date(m.created_at).toLocaleString('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) },
                    { key: 'type', label: t('Type'), render: (m) => <Badge tone={m.qty > 0 ? 'ok' : ''}>{t(m.type)}</Badge> },
                    { key: 'qty', label: t('Qty'), num: true, render: (m) => (m.qty > 0 ? '+' : '') + Math.round(m.qty * 1000) / 1000 },
                    { key: 'user_id', label: t('By'), render: (m) => S.users.value.find((u) => u.id === m.user_id)?.name?.split(' ')[0] || '' },
                    { key: 'batch_no', label: t('Batch / serial'), render: (m) => <span class="mono small">{m.batch_no || m.serial || ''}</span> }
                  ]} />
                </div>
              )}
            </div>
          )}

          {!more && <button type="button" class="more-toggle" onClick={() => setMore(true)}><Icon name="sliders" size={18} />{t('More options')}<span class="small mute" style={{ fontWeight: 500 }}>— {t('SKU, tax code, wholesale price, packs, extra barcodes, notes')}</span><span class="spacer" /><Icon name="chevron-down" /></button>}
          {more && mods.units && !f.has_variants && f.type !== 'service' && <UnitsCard f={f} set={set} selfIds={selfIds} />}
          {(mods.recipes || f.type === 'composite') && f.type === 'composite' && <RecipeCard f={f} set={set} />}
          {more && (mods.restaurant || f.modifiers_group_ids?.length > 0) && <ModifiersCard f={f} set={set} groups={groups} setGroups={setGroups} />}
        </div>

        <div class="pf-side">
          <div class="card pad">
            <div class="lbl" style={{ marginBottom: '8px' }}>{t('Barcode')}</div>
            <div class="input-wrap"><Icon name="barcode" size={18} /><input class="input mono" value={f.barcode} placeholder={t('Scan or type')} data-barcode-field="1" data-scan="keep" aria-label={t('Barcode')} onInput={(e) => set({ barcode: e.target.value.trim() })} /></div>
            <div class="row gap-s" style={{ marginTop: '8px' }}>
              <Btn size="sm" icon="sparkle" onClick={genBarcode}>{t('Generate EAN-13')}</Btn>
              <Btn size="sm" onClick={genCode128}>{t('Code 128 from SKU')}</Btn>
            </div>
            {bcSvg && <div style={{ marginTop: '12px', background: '#fff', padding: '8px', border: '1px solid var(--line)', borderRadius: '10px' }} dangerouslySetInnerHTML={{ __html: bcSvg }} />}
            {more && <div class="field" style={{ marginTop: '12px' }}>
              <label>{t('Extra barcodes')}</label>
              {f.barcodes.map((b, i) => <div class="row gap-s" style={{ marginBottom: '6px' }}><input class="input mono" value={b} aria-label={t('Extra barcode')} onInput={(e) => set({ barcodes: f.barcodes.map((x, k) => (k === i ? e.target.value.trim() : x)) })} /><Btn icon="x" variant="ghost" aria-label={t('Remove')} onClick={() => set({ barcodes: f.barcodes.filter((_, k) => k !== i) })} /></div>)}
              <Btn size="sm" icon="plus" onClick={() => set({ barcodes: [...f.barcodes, ''] })}>{t('Add barcode')}</Btn>
            </div>}
            {!f.barcode && <p class="small mute" style={{ margin: '10px 0 0' }}>{t('Scan the product’s barcode now, or tap “Generate” to make one you can print on a label.')}</p>}
          </div>
          <div class="card pad">
            <div class="lbl" style={{ marginBottom: '8px' }}>{t('Photo')}</div>
            <label class="img-drop">
              {f.image ? <img src={f.image} alt="" /> : <span class="col center" style={{ alignItems: 'center' }}><Icon name="image" size={30} />{t('Tap to add a photo')}</span>}
              <input type="file" accept="image/*" class="sr" onChange={async (e) => { const file = e.target.files?.[0]; if (file) { const img = await compressImage(file); set({ image: img }); toast(t('Photo compressed to {k} KB', { k: Math.round(img.length * 0.75 / 1024) })); } }} />
            </label>
            {f.image && <Btn size="sm" variant="ghost" icon="trash" onClick={() => set({ image: '' })} class="mt">{t('Remove photo')}</Btn>}
          </div>
        </div>
      </div>
      </fieldset>
    </div>
  );
}

function VariantsCard({ f, set, variants, setVariants }) {
  const [a1, setA1] = useState({ name: 'size', values: 'S, M, L, XL' });
  const [a2, setA2] = useState({ name: 'colour', values: '' });
  const gen = () => {
    const v1 = a1.values.split(',').map((s) => s.trim()).filter(Boolean);
    const v2 = a2.values.split(',').map((s) => s.trim()).filter(Boolean);
    if (!v1.length) return toast.error(t('Enter at least one value'));
    const out = [...variants];
    const taken = (c) => !!catalog.value.byCode.get(c) || out.some((x) => x.barcode === c);
    for (const x of v1) for (const y of v2.length ? v2 : ['']) {
      const attrs = { [a1.name]: x, ...(y ? { [a2.name]: y } : {}) };
      if (out.some((v) => JSON.stringify(v.variant_attrs) === JSON.stringify(attrs))) continue;
      out.push({ name: `${f.name || t('Product')} — ${[x, y].filter(Boolean).join(' / ')}`, variant_attrs: attrs, price: f.price, cost: f.cost, barcode: generateInternalEan(taken), sku: f.sku ? `${f.sku}-${x}${y ? '-' + y : ''}`.toUpperCase().replace(/\s+/g, '') : '', active: true, _opening: '' });
    }
    setVariants(out);
    set({ has_variants: true, track_stock: false });
  };
  const upd = (i, patch) => setVariants(variants.map((v, k) => (k === i ? { ...v, ...patch } : v)));
  return (
    <div class="card">
      <div class="card-h"><h3>{t('Variants (size × colour)')}</h3><Switch checked={f.has_variants} onChange={(v) => set({ has_variants: v })} label={t('Has variants')} /></div>
      {f.has_variants && (
        <div class="card-b">
          <div class="form-grid">
            <Input label={t('Option 1 name')} value={a1.name} onValue={(v) => setA1({ ...a1, name: v })} />
            <Input class="span2" label={t('Values (comma separated)')} value={a1.values} onValue={(v) => setA1({ ...a1, values: v })} placeholder="S, M, L, XL" />
            <Input label={t('Option 2 name')} value={a2.name} onValue={(v) => setA2({ ...a2, name: v })} />
            <Input class="span2" label={t('Values (comma separated)')} value={a2.values} onValue={(v) => setA2({ ...a2, values: v })} placeholder={t('Red, Blue, Black')} />
          </div>
          <Btn icon="layers" variant="navy" class="mt" onClick={gen}>{t('Generate variants')}</Btn>
          {variants.length > 0 && (
            <div style={{ overflowX: 'auto', marginTop: '14px' }}>
              <table class="table vm-table">
                <thead><tr><th>{t('Variant')}</th><th>{t('Price')}</th><th>{t('Barcode')}</th><th>{f.id ? t('In stock') : t('Opening stock')}</th><th /></tr></thead>
                <tbody>{variants.map((v, i) => (
                  <tr>
                    <td><b>{Object.values(v.variant_attrs || {}).join(' / ')}</b></td>
                    <td><input class="input mono num" style={{ width: '110px' }} value={v.price / 100} aria-label={t('Price')} onChange={(e) => upd(i, { price: parseMoney(e.target.value) || 0 })} /></td>
                    <td><input class="input mono" style={{ width: '160px' }} value={v.barcode} aria-label={t('Barcode')} onChange={(e) => upd(i, { barcode: e.target.value.trim() })} /></td>
                    <td>{v.id ? <Badge>{Math.round((levels.value.get(v.id) || 0) * 100) / 100}</Badge> : <input class="input mono num" style={{ width: '80px' }} value={v._opening} placeholder="0" aria-label={t('Opening stock')} onInput={(e) => upd(i, { _opening: e.target.value })} />}</td>
                    <td>{!v.id && <Btn size="xs" variant="ghost" icon="x" aria-label={t('Remove')} onClick={() => setVariants(variants.filter((_, k) => k !== i))} />}{v.id && <Switch checked={v.active !== false} onChange={(a) => upd(i, { active: a })} />}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UnitsCard({ f, set, selfIds }) {
  const u = f.units_of_measure || [];
  const upd = (i, patch) => set({ units_of_measure: u.map((x, k) => (k === i ? { ...x, ...patch } : x)) });
  return (
    <div class="card">
      <div class="card-h"><h3>{t('Units of measure (packs)')}</h3><Btn size="sm" icon="plus" onClick={() => set({ units_of_measure: [...u, { name: t('Carton'), factor: 12, price: f.price * 12, barcode: '' }] })}>{t('Add unit')}</Btn></div>
      <div class="card-b">
        {!u.length && <p class="mute" style={{ margin: 0 }}>{t('Sell this item by the carton, bale or dozen too. Each pack can have its own barcode and price; stock is counted in {u}.', { u: f.unit })}</p>}
        {u.map((x, i) => (
          <div class="form-grid uom-row">
            <Input label={t('Unit name')} value={x.name} onValue={(v) => upd(i, { name: v })} />
            <Input label={t('Contains ({u})', { u: f.unit })} type="number" value={x.factor} onValue={(v) => upd(i, { factor: parseFloat(v) || 1 })} />
            <MoneyInput label={t('Price')} value={x.price} onValue={(v) => upd(i, { price: v })} />
            <div class="field"><label>{t('Barcode')}</label><div class="row gap-s"><input class="input mono" value={x.barcode || ''} aria-label={t('Barcode')} onInput={(e) => upd(i, { barcode: e.target.value.trim() })} /><Btn icon="sparkle" aria-label={t('Generate')} onClick={() => upd(i, { barcode: generateInternalEan((c) => !!catalog.value.byCode.get(c)) })} /></div></div>
            <Btn icon="trash" variant="ghost" aria-label={t('Remove')} onClick={() => set({ units_of_measure: u.filter((_, k) => k !== i) })} />
          </div>
        ))}
      </div>
    </div>
  );
}

function RecipeCard({ f, set }) {
  const r = f.recipe || [];
  const cost = r.reduce((s, x) => s + Math.round((catalog.value.byId.get(x.product_id)?.cost || 0) * x.qty), 0);
  return (
    <div class="card">
      <div class="card-h"><h3>{t('Recipe / ingredients')}</h3><span class="small mute">{t('Cost {c}', { c: money(cost) })}</span>
        <Btn size="sm" icon="plus" onClick={async () => { const p = await pickProduct({ title: t('Add ingredient'), filter: (p) => p.id !== f.id && p.track_stock }); if (p) set({ recipe: [...r, { product_id: p.id, qty: 1 }] }); }}>{t('Add ingredient')}</Btn>
        <Btn size="sm" onClick={() => set({ cost })}>{t('Use as cost')}</Btn></div>
      <div class="card-b">
        {!r.length && <p class="mute" style={{ margin: 0 }}>{t('Selling one {name} will deduct these ingredients from stock.', { name: f.name || t('item') })}</p>}
        {r.map((x, i) => { const p = catalog.value.byId.get(x.product_id); return (
          <div class="row" style={{ marginBottom: '8px' }}>
            <span class="grow ellipsis"><b>{p?.name || '?'}</b> <span class="small mute">{kes(p?.cost || 0)}/{p?.unit}</span></span>
            <input class="input mono num" style={{ width: '100px' }} value={x.qty} aria-label={t('Quantity')} onInput={(e) => set({ recipe: r.map((y, k) => (k === i ? { ...y, qty: parseFloat(e.target.value) || 0 } : y)) })} /><span class="mute small" style={{ width: '30px' }}>{p?.unit}</span>
            <Btn icon="trash" variant="ghost" aria-label={t('Remove')} onClick={() => set({ recipe: r.filter((_, k) => k !== i) })} />
          </div>); })}
      </div>
    </div>
  );
}

function ModifiersCard({ f, set, groups, setGroups }) {
  const ids = f.modifiers_group_ids || [];
  const newGroup = async () => {
    const g = await openModal((close) => <GroupEditor close={close} />);
    if (g) { setGroups([...groups, g]); set({ modifiers_group_ids: [...ids, g.id] }); }
  };
  return (
    <div class="card">
      <div class="card-h"><h3>{t('Options & modifiers')}</h3><Btn size="sm" icon="plus" onClick={newGroup}>{t('New option group')}</Btn></div>
      <div class="card-b form-grid">
        <Select label={t('Prepared at')} value={f.kitchen_station || ''} onValue={(v) => set({ kitchen_station: v || null })} options={[{ value: '', label: t('— not prepared —') }, ...(S.settings.value.kitchen_stations || ['kitchen', 'bar']).map((s) => ({ value: s, label: t(s[0].toUpperCase() + s.slice(1)) }))]} />
        <div class="full row wrap gap-s">
          {groups.map((g) => <Check checked={ids.includes(g.id)} label={<span>{g.name} <span class="small mute">({g.options.map((o) => o.name).join(', ')})</span></span>} onChange={(v) => set({ modifiers_group_ids: v ? [...ids, g.id] : ids.filter((x) => x !== g.id) })} />)}
          {!groups.length && <span class="mute">{t('No option groups yet (e.g. “How cooked”, “Sides”, “Sugar”).')}</span>}
        </div>
      </div>
    </div>
  );
}
function GroupEditor({ close }) {
  const [name, setName] = useState('');
  const [min, setMin] = useState(0);
  const [max, setMax] = useState(1);
  const [opts, setOpts] = useState('');
  const go = async () => {
    const options = opts.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [n, p] = l.split(/[,;]/); return { name: n.trim(), price: parseMoney(p || '0') || 0 }; });
    if (!name.trim() || !options.length) return toast.error(t('Enter a name and at least one option'));
    close(await save('modifier_groups', { name: name.trim(), min: +min, max: +max, options }, { audit: { action: 'modifiers.create', details: { name } } }));
  };
  return (
    <Modal title={t('New option group')} icon="sliders" onClose={() => close(null)} footer={<Btn variant="primary" onClick={go}>{t('Save')}</Btn>}>
      <div class="form-grid">
        <Input class="full" label={t('Group name')} value={name} onValue={setName} placeholder={t('e.g. Sides')} autoFocus />
        <Input label={t('Minimum choices')} type="number" value={min} onValue={setMin} />
        <Input label={t('Maximum choices')} type="number" value={max} onValue={setMax} />
        <Textarea class="full" label={t('Options — one per line, optional extra price after a comma')} value={opts} onValue={setOpts} rows={5} placeholder={'Ugali\nRice\nChips, 50'} />
      </div>
    </Modal>
  );
}
