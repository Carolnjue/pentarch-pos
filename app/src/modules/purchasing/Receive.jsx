// Receive stock (goods received note): with or without a purchase order. Scan items, check quantities and costs,
// batches/expiry, serials, optional extra costs and new selling prices, pay now or later → labels.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { catalog } from '../../db/catalog.js';
import { db } from '../../db/index.js';
import { PageHeader, Btn, Icon, Empty, Input, Select, MoneyInput, Seg, Switch, Badge } from '../../ui/kit.jsx';
import { confirm, toast } from '../../ui/overlay.jsx';
import { previewPrint } from '../../ui/printpreview.jsx';
import { money, kes } from '../../lib/money.js';
import { navigate } from '../../router.js';
import { can } from '../../auth/permissions.js';
import { licenceState } from '../../auth/session.js';
import { receiveGoods, suppliersList, poReceived } from '../../core/purchasing.js';
import { poOutstanding } from '../../core/stockmath.js';
import { r3 } from '../../core/inventory.js';
import { grnHtml } from '../../print/stockdocs.js';
import { ProductAdder, QtyIn, useScan, resolveCode, fq, unitOf, ctxPrint, Done, userName } from '../inventory/common.jsx';
import { editSupplier } from './supplierDialog.jsx';
import * as S from '../../state.js';
import { t, tn } from '../../i18n/index.js';

let lk = 0;
const newLine = (p, pack = null, qty = 1, cost) => ({ key: ++lk, product_id: p.id, p, qty, pack, cost: cost ?? Math.round((p.cost || 0) * (pack?.factor || 1)), batch_no: '', expiry: '', serials: '', price: 0 });
const baseQty = (l) => r3(l.qty * (l.pack?.factor || 1));
const serialList = (l) => l.serials.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);

// Fresh form for every different link (e.g. ?po=… then plain “Receive stock”).
export default function ReceiveRoute(props) { return <Receive key={JSON.stringify(props.query || {})} {...props} />; }

function Receive({ query }) {
  const [sups, setSups] = useState([]);
  const [sid, setSid] = useState(query?.supplier || '');
  const [pos, setPos] = useState([]);
  const [poId, setPoId] = useState(query?.po || '');
  const [inv, setInv] = useState('');
  const [lines, setLines] = useState([]);
  const [more, setMore] = useState(false);
  const [prices, setPrices] = useState(false);
  const [extras, setExtras] = useState([{ label: '', amount: 0 }]);
  const [paidIn, setPaidIn] = useState(null); // null = automatic (full on delivery terms / cash purchase, else 0)
  const [method, setMethod] = useState('cash');
  const [ref, setRef] = useState('');
  const [drawer, setDrawer] = useState(true);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [flash, setFlash] = useState(null);
  const adderRef = useRef();
  const lic = licenceState();
  const loadSups = () => suppliersList().then(setSups);
  useEffect(() => { loadSups(); }, []);
  useEffect(() => {
    if (!sid) { setPos([]); return; }
    db().purchase_orders.where('supplier_id').equals(sid).toArray().then((l) => setPos(l.filter((p) => !p.deleted && ['sent', 'partial', 'draft'].includes(p.status)).sort((a, b) => b.created_at - a.created_at)));
  }, [sid]);
  useEffect(() => {
    if (!poId) return;
    (async () => {
      const po = await db().purchase_orders.get(poId);
      if (!po) return;
      if (po.supplier_id !== sid) setSid(po.supplier_id);
      const rec = await poReceived(po.id);
      const out = poOutstanding(po, rec).filter((l) => l.left > 0).map((l) => { const p = catalog.value.byId.get(l.product_id); return p ? newLine(p, null, l.left, l.cost) : null; }).filter(Boolean);
      setLines(out);
      if (out.length) toast(tn(out.length, '{n} item loaded from the order', '{n} items loaded from the order'));
    })();
  }, [poId]);
  const sup = sups.find((s) => s.id === sid);
  const supId = sid === 'none' ? '' : sid;
  const add = (p, r) => {
    if (p.has_variants) return toast.warn(t('Choose the size or colour of {name}', { name: p.name }));
    const pack = r?.uom ? { name: r.uom.name, factor: r.uom.factor } : null;
    setLines((cur) => {
      const i = cur.findIndex((l) => l.product_id === p.id && (l.pack?.name || '') === (pack?.name || ''));
      if (i >= 0) return cur.map((l, k) => (k === i ? { ...l, qty: r3(l.qty + 1) } : l));
      return [...cur, newLine(p, pack)];
    });
    setFlash(p.id); setTimeout(() => setFlash(null), 700);
  };
  useScan((code) => { const r = resolveCode(code); if (r) add(r.product, r); else toast.error(t('Barcode {c} not found — add the product first', { c: code })); }, [lines]);
  const upd = (i, ch) => setLines(lines.map((l, k) => (k === i ? { ...l, ...ch } : l)));
  const goods = lines.reduce((s, l) => s + Math.round(l.qty * l.cost), 0);
  const extraTotal = more ? extras.reduce((s, x) => s + (x.amount || 0), 0) : 0;
  const total = goods + extraTotal;
  const paid = paidIn ?? (sid === 'none' || (sup && !sup.terms_days) ? total : 0);
  const problems = useMemo(() => {
    const out = [];
    if (!sid) out.push(t('Choose the supplier (or “No supplier”)'));
    for (const l of lines) {
      if (l.qty <= 0) out.push(t('{name}: quantity is zero', { name: l.p.name }));
      if (l.p.track_serials && serialList(l).length !== Math.round(baseQty(l))) out.push(t('{name}: scan {n} serial / IMEI numbers', { name: l.p.name, n: Math.round(baseQty(l)) }));
      if (l.p.track_batches && !l.expiry) out.push(t('{name}: enter the expiry date', { name: l.p.name }));
    }
    return out;
  }, [lines, sid]);
  const save = async () => {
    if (problems.length) return toast.warn(problems[0]);
    const ok = await confirm({ title: t('Receive this delivery?'), message: t('{n} items worth {v} will be added to stock{s}.', { n: lines.length, v: money(total), s: sup ? ' ' + t('from {name}', { name: sup.name }) : '' }) + (supId && total - paid > 0 ? ' ' + t('{v} will be added to what you owe {name}.', { v: money(total - paid), name: sup.name }) : ''), ok: t('Yes, receive') });
    if (!ok) return;
    setBusy(true);
    try {
      const grn = await receiveGoods({
        supplier_id: supId, po_id: poId || null, supplier_invoice_no: inv.trim(), note,
        lines: lines.map((l) => {
          const f = l.pack?.factor || 1;
          const batch = l.p.track_batches ? (l.batch_no.trim() || 'EXP-' + l.expiry) : '';
          return { product_id: l.product_id, qty: baseQty(l), cost: Math.round(l.cost / f), batch_no: batch, expiry: l.p.track_batches ? l.expiry : '', serials: l.p.track_serials ? serialList(l) : [], pack: l.pack ? { name: l.pack.name, factor: f, qty: l.qty, cost: l.cost } : null, price: prices && l.price ? l.price : 0 };
        }),
        extra_costs: more ? extras.filter((x) => x.amount > 0) : [], paid: Math.min(paid, total), pay_method: method, pay_ref: ref.trim(), from_drawer: drawer && method === 'cash' && !!S.shift.value
      });
      setDone(grn);
      toast(t('Stock received — {no}', { no: grn.no }));
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };
  if (done) {
    const labelsHref = '/products/labels?ids=' + done.lines.map((l) => l.product_id).join(',') + '&qty=' + done.lines.map((l) => Math.max(1, Math.ceil(l.qty))).join(',') + '&exp=' + done.lines.map((l) => l.expiry || '').join(',');
    return (
      <div class="page" style={{ maxWidth: '820px' }}>
        <Done title={t('Stock received')} text={t('{no} · {n} items · {v}', { no: done.no, n: done.lines.length, v: money(done.total) })}>
          {can('labels.print') && S.settings.value.inv_labels_after_receive !== false && <Btn variant="primary" icon="barcode" onClick={() => navigate(labelsHref)}>{t('Print price labels')}</Btn>}
          <Btn icon="print" onClick={() => previewPrint(grnHtml(done, sup, ctxPrint(), userName(done.user_id)), { title: done.no, paper: 'a4' })}>{t('Print delivery note')}</Btn>
          <Btn icon="eye" onClick={() => navigate('/purchasing/grn/' + done.id)}>{t('View delivery')}</Btn>
          <Btn icon="plus" onClick={() => { setDone(null); setLines([]); setInv(''); setPoId(''); setNote(''); setPaidIn(null); setExtras([{ label: '', amount: 0 }]); }}>{t('Receive another delivery')}</Btn>
        </Done>
      </div>
    );
  }
  return (
    <div class="page wide" style={{ maxWidth: '1400px' }}>
      <PageHeader back="#/purchasing" title={t('Receive stock')} sub={t('Scan or add what arrived. Stock and cost prices update automatically.')} />
      {!lic.canPurchase && <div class="callout bad mb"><Icon name="alert" size={18} />{t('Your licence has expired. Receiving stock is paused until it is renewed — viewing and reports still work.')}</div>}
      <div class="split-360">
        <div class="col gap-l" style={{ minWidth: 0 }}>
          <div class="card pad">
            <div class="form-grid">
              <div class="field"><label>{t('Supplier')}</label>
                <div class="row gap-s">
                  <select class="input" value={sid} onChange={(e) => { setSid(e.target.value); setPoId(''); setPaidIn(null); }} aria-label={t('Supplier')}>
                    <option value="" disabled>{t('— choose the supplier —')}</option>{sups.map((s) => <option value={s.id}>{s.name}</option>)}<option value="none">{t('No supplier (bought for cash)')}</option>
                  </select>
                  {can('suppliers.edit') && <Btn icon="plus" aria-label={t('Add supplier')} title={t('Add supplier')} onClick={async () => { const s = await editSupplier(); if (s) { await loadSups(); setSid(s.id); } }} />}
                </div>
              </div>
              <Input label={t('Supplier invoice / delivery note no.')} value={inv} onValue={setInv} placeholder={t('e.g. INV-20431')} />
              {pos.length > 0 && <Select label={t('Purchase order')} value={poId} onValue={setPoId} options={[{ value: '', label: t('No order — receive anything') }, ...pos.map((p) => ({ value: p.id, label: `${p.no} · ${new Date(p.created_at).toLocaleDateString('en-KE')} · ${money(p.total || 0)}` }))]} hint={poId ? t('Items still outstanding on the order are filled in. Change the quantities to what actually arrived.') : ''} />}
            </div>
          </div>
          <div class="card">
            <div class="card-h"><h3 class="grow">{t('Items received')}</h3><span class="scan-hint"><Icon name="barcode" size={16} />{t('Scan each item — every scan adds one')}</span></div>
            <div class="card-b"><ProductAdder inputRef={adderRef} autoFocus onPick={(p, r) => add(p, r)} filter={(p) => p.type !== 'service' && p.type !== 'composite'} /></div>
            <div class="le">
              {lines.length > 0 && <div class="le-row head"><span>{t('Item')}</span><span>{t('Quantity')}</span><span>{t('Cost each')}</span><span class="right">{t('Amount')}</span><span /></div>}
              {lines.map((l, i) => (
                <div class={'le-row' + (flash === l.product_id ? ' flash' : '')} key={l.key}>
                  <div class="nm"><b>{l.p.name}</b><small class="mono" style={{ display: 'block' }}>{l.pack ? t('{n} per {u}', { n: l.pack.factor, u: l.pack.name }) : (l.p.barcode || l.p.sku || '')}</small>{can('products.cost_view') && l.p.cost > 0 && <small style={{ display: 'block' }}>{t('last cost')} {kes(Math.round(l.p.cost * (l.pack?.factor || 1)))}</small>}</div>
                  <div class="col c-qty" style={{ gap: '4px' }}>
                    <QtyIn value={l.qty} onValue={(v) => upd(i, { qty: v })} label={t('Quantity of {name}', { name: l.p.name })} step={l.p.unit === 'kg' && !l.pack ? 0.5 : 1} />
                    {l.p.units_of_measure?.length > 0 && <select class="input" style={{ height: '34px', minHeight: 0, fontSize: '13px', padding: '0 8px', maxWidth: '150px' }} aria-label={t('Pack')} value={l.pack?.name || ''}
                      onChange={(e) => { const u = l.p.units_of_measure.find((x) => x.name === e.target.value); upd(i, { pack: u ? { name: u.name, factor: u.factor } : null, cost: Math.round((l.p.cost || 0) * (u?.factor || 1)) }); }}>
                      <option value="">{l.p.unit === 'pc' ? t('Pieces') : l.p.unit}</option>{l.p.units_of_measure.map((u) => <option value={u.name}>{u.name}</option>)}
                    </select>}
                  </div>
                  <div class="c-cost"><MoneyInput value={l.cost} onValue={(v) => upd(i, { cost: v })} aria-label={t('Cost of {name}', { name: l.p.name })} /></div>
                  <div class="tot c-tot">{kes(Math.round(l.qty * l.cost))}</div>
                  <Btn class="rm" variant="ghost" icon="x" size="sm" aria-label={t('Remove')} onClick={() => setLines(lines.filter((_, k) => k !== i))} />
                  {(l.p.track_batches || l.p.track_serials || prices) && (
                    <div class="extra">
                      {l.p.track_batches && <><Input label={t('Expiry date')} type="date" value={l.expiry} onValue={(v) => upd(i, { expiry: v })} error={!l.expiry ? ' ' : ''} /><Input label={t('Batch / lot no.')} value={l.batch_no} onValue={(v) => upd(i, { batch_no: v })} placeholder={t('optional')} /></>}
                      {l.p.track_serials && <div class="field" style={{ maxWidth: 'none', flex: 2 }}><label>{t('Serial / IMEI numbers — scan each one ({a} of {b})', { a: serialList(l).length, b: Math.round(baseQty(l)) })}</label>
                        <textarea class="input mono" rows={2} value={l.serials} data-scan="own" aria-label={t('Serial / IMEI numbers')} onInput={(e) => upd(i, { serials: e.target.value })} placeholder={t('One per line')} /></div>}
                      {prices && can('products.price') && <MoneyInput label={t('New selling price')} value={l.price || l.p.price} onValue={(v) => upd(i, { price: v })} hint={l.p.cost ? t('now {p}', { p: kes(l.p.price) }) : ''} />}
                    </div>
                  )}
                </div>
              ))}
              {!lines.length && <Empty icon="truck" title={t('Scan the first item')} text={poId ? t('This order has nothing left to receive.') : t('Pick up each item and scan it, or type the name above. Cartons with their own barcode are added as cartons.')} />}
            </div>
          </div>
          {!more ? <button type="button" class="more-toggle" onClick={() => setMore(true)}><Icon name="sliders" size={18} />{t('More options')}<span class="small mute" style={{ fontWeight: 500 }}>— {t('transport & other costs, new selling prices, notes')}</span><span class="spacer" /><Icon name="chevron-down" /></button> : (
            <div class="card pad col">
              <div class="section-title" style={{ marginTop: 0 }}>{t('Extra costs (shared over the items by value)')}</div>
              {extras.map((x, i) => (
                <div class="row wrap gap-s">
                  <input class="input" style={{ flex: 2, minWidth: '160px' }} value={x.label} placeholder={t('e.g. Transport, loading')} aria-label={t('Extra cost name')} onInput={(e) => setExtras(extras.map((y, k) => (k === i ? { ...y, label: e.target.value } : y)))} />
                  <div style={{ flex: 1, minWidth: '140px' }}><MoneyInput value={x.amount} onValue={(v) => setExtras(extras.map((y, k) => (k === i ? { ...y, amount: v } : y)))} aria-label={t('Extra cost amount')} /></div>
                  {extras.length > 1 && <Btn variant="ghost" icon="x" aria-label={t('Remove')} onClick={() => setExtras(extras.filter((_, k) => k !== i))} />}
                </div>
              ))}
              <Btn size="sm" icon="plus" style={{ alignSelf: 'flex-start' }} onClick={() => setExtras([...extras, { label: '', amount: 0 }])}>{t('Add another cost')}</Btn>
              {can('products.price') && <Switch checked={prices} onChange={setPrices} label={t('Update selling prices')} sub={t('Set new prices for these items while you receive them')} />}
              <Input label={t('Note (optional)')} value={note} onValue={setNote} />
            </div>
          )}
        </div>
        <div class="card pad sum-card sticky-side col">
          <h3>{t('Summary')}</h3>
          <div>
            <div class="kv"><span>{t('Supplier')}</span><span class="bold ellipsis" style={{ maxWidth: '190px' }}>{sup?.name || t('None')}</span></div>
            <div class="kv"><span>{t('Items')}</span><b>{lines.length}</b></div>
            <div class="kv"><span>{t('Goods')}</span><b>{kes(goods)}</b></div>
            {extraTotal > 0 && <div class="kv"><span>{t('Extra costs')}</span><b>{kes(extraTotal)}</b></div>}
            <div class="grand"><span class="bold">{t('Total')}</span><b>{money(total)}</b></div>
          </div>
          <MoneyInput label={t('Paid now')} value={paid} onValue={(v) => setPaidIn(v)} hint={supId ? (total - paid > 0 ? t('{v} goes on the supplier’s account', { v: money(total - paid) }) : t('Fully paid')) : t('No supplier: treated as paid')} />
          {paid > 0 && <Seg value={method} onValue={setMethod} options={[{ value: 'cash', label: t('Cash') }, { value: 'mpesa', label: 'M-Pesa' }, { value: 'bank', label: t('Bank') }]} />}
          {paid > 0 && method !== 'cash' && <Input label={method === 'mpesa' ? t('M-Pesa code') : t('Reference')} value={ref} onValue={(v) => setRef(v.toUpperCase())} />}
          {paid > 0 && method === 'cash' && S.shift.value && <Switch checked={drawer} onChange={setDrawer} label={t('Paid from the cash drawer')} sub={t('Recorded as a pay-out in this shift')} />}
          {problems.length > 0 && lines.length > 0 && <div class="callout warn"><Icon name="alert" size={18} /><span>{problems[0]}{problems.length > 1 ? ' ' + t('(+{n} more)', { n: problems.length - 1 }) : ''}</span></div>}
          <Btn variant="primary" size="lg" icon="check" disabled={!lines.length || busy || !lic.canPurchase} onClick={save}>{t('Receive stock')}</Btn>
          {sup && sup.terms_days > 0 && <p class="small mute" style={{ margin: 0 }}>{t('{name} gives you {n} days to pay.', { name: sup.name, n: sup.terms_days })}</p>}
        </div>
      </div>
    </div>
  );
}
