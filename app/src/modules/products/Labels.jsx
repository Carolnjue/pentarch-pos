// Barcode label printing: choose products & quantities, size preset, fields → preview → print.
import { useEffect, useState } from 'preact/hooks';
import { catalog } from '../../db/catalog.js';
import { PageHeader, Btn, Icon, Select, Check, Input, Empty } from '../../ui/kit.jsx';
import { toast } from '../../ui/overlay.jsx';
import { LABEL_PRESETS, labelsHtml } from '../../print/labels.js';
import { printHtml } from '../../print/print.js';
import { saveBusiness } from '../../auth/session.js';
import { levels } from '../../db/catalog.js';
import { audit } from '../../db/repo.js';
import { kes } from '../../lib/money.js';
import { on } from '../../lib/bus.js';
import { pickProduct } from './picker.jsx';
import * as S from '../../state.js';
import { t, tn } from '../../i18n/index.js';

export default function Labels({ query }) {
  // ?ids=a,b[&qty=5,3][&exp=2027-01-31,] — quantities/expiry per id (e.g. after receiving stock)
  const [items, setItems] = useState(() => { const qs = (query?.qty || '').split(','), ex = (query?.exp || '').split(','); return (query?.ids || '').split(',').map((id, i) => ({ id, qty: parseInt(qs[i] ?? (qs.length === 1 ? qs[0] : '')) || 1, expiry: ex[i] || '' })).filter((x) => x.id && catalog.value.byId.get(x.id)); });
  const [preset, setPreset] = useState(S.settings.value.label_preset || '38x25');
  const [fields, setFields] = useState(S.settings.value.label_fields || { name: true, price: true, barcode: true, sku: false, expiry: false, business: true });
  const [html, setHtml] = useState('');
  const [count, setCount] = useState(0);
  useEffect(() => on('scan', (code) => { const h = catalog.value.byCode.get(code); if (h) add(h.product); }), [items]);
  useEffect(() => {
    let live = true;
    const list = items.map((x) => ({ product: catalog.value.byId.get(x.id), qty: x.qty, expiry: x.expiry })).filter((x) => x.product && x.qty > 0);
    if (!list.length) { setHtml(''); setCount(0); return; }
    labelsHtml(list, preset, fields, { businessName: S.business.value?.name }).then((r) => { if (live) { setHtml(r.html); setCount(r.count); } });
    return () => { live = false; };
  }, [items, preset, fields]);
  const add = (p) => setItems((cur) => (cur.find((x) => x.id === p.id) ? cur.map((x) => (x.id === p.id ? { ...x, qty: x.qty + 1 } : x)) : [...cur, { id: p.id, qty: 1, expiry: '' }]));
  const P = LABEL_PRESETS[preset];
  const scale = P.sheet ? 0.62 : 1.9;
  const print = async () => {
    await saveBusiness({ settings: { label_preset: preset, label_fields: fields } });
    await printHtml(html);
    audit('labels.print', 'products', null, { count, preset });
  };
  return (
    <div class="page wide" style={{ maxWidth: '1400px' }}>
      <PageHeader back="#/products" title={t('Print barcode labels')} sub={t('Scan items or add them, set how many labels, then print.')}
        actions={<><Btn icon="plus" onClick={async () => { const p = await pickProduct(); if (p) add(p); }}>{t('Add product')}</Btn><Btn variant="primary" icon="print" disabled={!count} onClick={print}>{t('Print {n} labels', { n: count })}</Btn></>} />
      <div class="split-even">
        <div class="col gap-l">
          <div class="card pad">
            <div class="form-grid">
              <Select label={t('Label size')} value={preset} onValue={setPreset} options={Object.entries(LABEL_PRESETS).map(([k, v]) => ({ value: k, label: v.name }))} />
            </div>
            <div class="section-title">{t('Show on label')}</div>
            <div class="row wrap" style={{ gap: '4px 18px' }}>
              {[['business', 'Business name'], ['name', 'Product name'], ['price', 'Price'], ['barcode', 'Barcode'], ['sku', 'SKU'], ['expiry', 'Expiry date']].map(([k, l]) => <Check checked={fields[k]} label={t(l)} onChange={(v) => setFields({ ...fields, [k]: v })} />)}
            </div>
          </div>
          <div class="card">
            <div class="card-h"><h3>{t('Items')}</h3><span class="small mute">{tn(count, '{n} label', '{n} labels')}</span></div>
            {items.map((x, i) => {
              const p = catalog.value.byId.get(x.id);
              return (
                <div class="list-item">
                  <div class="grow"><b>{p.name}</b><div class="small mute mono">{p.barcode || p.sku || t('No barcode')} · {kes(p.price)}</div></div>
                  {fields.expiry && <input class="input" type="date" style={{ width: '150px' }} value={x.expiry} aria-label={t('Expiry date')} onInput={(e) => setItems(items.map((y, k) => (k === i ? { ...y, expiry: e.target.value } : y)))} />}
                  <div class="qty">
                    <button onClick={() => setItems(items.map((y, k) => (k === i ? { ...y, qty: Math.max(0, y.qty - 1) } : y)))} aria-label={t('Less')}><Icon name="minus" size={16} /></button>
                    <input value={x.qty} inputMode="numeric" aria-label={t('Number of labels')} onInput={(e) => setItems(items.map((y, k) => (k === i ? { ...y, qty: parseInt(e.target.value) || 0 } : y)))} />
                    <button onClick={() => setItems(items.map((y, k) => (k === i ? { ...y, qty: y.qty + 1 } : y)))} aria-label={t('More')}><Icon name="plus" size={16} /></button>
                  </div>
                  <Btn size="xs" title={t('One per item in stock')} onClick={() => setItems(items.map((y, k) => (k === i ? { ...y, qty: Math.max(1, Math.round(levels.value.get(y.id) || 0)) } : y)))}>{t('= stock')}</Btn>
                  <Btn size="sm" variant="ghost" icon="x" aria-label={t('Remove')} onClick={() => setItems(items.filter((_, k) => k !== i))} />
                </div>
              );
            })}
            {!items.length && <Empty icon="barcode" title={t('No items yet')} text={t('Scan a product barcode or use “Add product”.')} />}
          </div>
        </div>
        <div class="card pad">
          <div class="row mb"><h3 class="grow">{t('Preview')}</h3><span class="small mute">{P.name}</span></div>
          <div class="paper-strip" style={{ maxHeight: '70vh' }}>
            {html ? <div style={{ width: (P.sheet ? 210 : P.w) * 3.78 * scale + 'px', margin: '0 auto', background: '#fff', boxShadow: 'var(--sh-2)' }}>
              <iframe title={t('Label preview')} srcDoc={html} sandbox="allow-same-origin" style={{ width: (P.sheet ? 210 : P.w) * 3.78 + 'px', height: (P.sheet ? 297 : Math.min(count, 6) * P.h) * 3.78 + 'px', border: 0, transform: `scale(${scale})`, transformOrigin: '0 0', display: 'block', marginBottom: ((P.sheet ? 297 : Math.min(count, 6) * P.h) * 3.78 * (scale - 1)) + 'px' }} />
            </div> : <Empty icon="eye" title={t('Nothing to preview')} />}
          </div>
        </div>
      </div>
    </div>
  );
}
