// Return goods to a supplier: choose supplier (and optionally the delivery), scan items, reason → stock out + credit.
import { useEffect, useState } from 'preact/hooks';
import { catalog, levels } from '../../db/catalog.js';
import { db } from '../../db/index.js';
import { batchBalances } from '../../db/stock.js';
import { PageHeader, Btn, Icon, Empty, Input, Select, MoneyInput, Seg, Switch } from '../../ui/kit.jsx';
import { confirm, toast } from '../../ui/overlay.jsx';
import { previewPrint } from '../../ui/printpreview.jsx';
import { money, kes } from '../../lib/money.js';
import { navigate } from '../../router.js';
import { licenceState } from '../../auth/session.js';
import { returnToSupplier, suppliersList, allDocs } from '../../core/purchasing.js';
import { lastSuppliers, r3 } from '../../core/inventory.js';
import { grnHtml } from '../../print/stockdocs.js';
import { ProductAdder, QtyIn, useScan, resolveCode, fq, unitOf, ctxPrint, Done, userName, d8 } from '../inventory/common.jsx';
import * as S from '../../state.js';
import { t } from '../../i18n/index.js';

const REASONS = ['Damaged', 'Expired', 'Wrong item', 'Too many delivered', 'Poor quality', 'Other'];

export default function ReturnRoute(props) { return <ReturnNew key={JSON.stringify(props.query || {})} {...props} />; }

function ReturnNew({ query }) {
  const [sups, setSups] = useState([]);
  const [sid, setSid] = useState(query?.supplier || '');
  const [grns, setGrns] = useState([]);
  const [grnId, setGrnId] = useState(query?.grn || '');
  const [lines, setLines] = useState([]);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [refund, setRefund] = useState(false);
  const [refundAmt, setRefundAmt] = useState(0);
  const [refundMethod, setRefundMethod] = useState('cash');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [lastCost, setLastCost] = useState(new Map());
  useEffect(() => { suppliersList().then(setSups); lastSuppliers().then(setLastCost); }, []);
  useEffect(() => { if (!sid) return setGrns([]); allDocs('receipt').then((d) => setGrns(d.filter((g) => g.supplier_id === sid).slice(0, 40))); }, [sid]);
  useEffect(() => {
    if (!grnId) return;
    db().goods_received.get(grnId).then((g) => { if (g) { setSid(g.supplier_id); } });
  }, [grnId]);
  const grn = grns.find((g) => g.id === grnId);
  const costFor = (p) => grn?.lines.find((l) => l.product_id === p.id)?.cost ?? lastCost.get(p.id)?.cost ?? p.cost ?? 0;
  const add = async (p, factor = 1) => {
    if (!p.track_stock) return;
    const ex = lines.findIndex((l) => l.product_id === p.id);
    if (ex >= 0) return setLines(lines.map((l, k) => (k === ex ? { ...l, qty: r3(l.qty + factor) } : l)));
    const batches = p.track_batches ? await batchBalances(p.id, S.branch.value?.id) : [];
    const serials = p.track_serials ? (await db().serials.where('product_id').equals(p.id).toArray()).filter((s) => !s.deleted && s.status === 'in_stock' && (!s.branch_id || s.branch_id === S.branch.value?.id)) : [];
    setLines((cur) => [...cur, { product_id: p.id, p, qty: p.track_serials ? 0 : factor, cost: costFor(p), batch_no: '', batches, serialsAvail: serials, serials: [] }]);
  };
  useScan((code) => {
    const hitSerial = lines.find((l) => l.serialsAvail?.some((s) => s.serial === code));
    if (hitSerial) return toggleSerial(lines.indexOf(hitSerial), code);
    const r = resolveCode(code); if (r) add(r.product, r.factor); else toast.error(t('Barcode {c} not found', { c: code }));
  }, [lines, grn]);
  const upd = (i, ch) => setLines(lines.map((l, k) => (k === i ? { ...l, ...ch } : l)));
  const toggleSerial = (i, s) => { const l = lines[i]; const sel = l.serials.includes(s) ? l.serials.filter((x) => x !== s) : [...l.serials, s]; upd(i, { serials: sel, qty: sel.length }); };
  const total = lines.reduce((s, l) => s + Math.round(l.qty * l.cost), 0);
  const sup = sups.find((s) => s.id === sid);
  const go = async () => {
    if (!sid) return toast.warn(t('Choose a supplier'));
    if (!reason) return toast.warn(t('Choose a reason'));
    const ok = await confirm({ title: t('Return to {name}?', { name: sup.name }), message: t('{n} items worth {v} leave your stock. {name} owes you this as a credit.', { n: lines.length, v: money(total), name: sup.name }), ok: t('Yes, return') });
    if (!ok) return;
    setBusy(true);
    try {
      const doc = await returnToSupplier({ supplier_id: sid, grn_id: grnId || null, reason: t(reason), note, refund: refund ? refundAmt || total : 0, refund_method: refundMethod,
        lines: lines.map((l) => ({ product_id: l.product_id, qty: l.qty, cost: l.cost, batch_no: l.batch_no, expiry: l.batches.find((b) => b.batch_no === l.batch_no)?.expiry || '', serials: l.serials })) });
      setDone(doc); toast(t('Return {no} recorded', { no: doc.no }));
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };
  if (done) return (
    <div class="page" style={{ maxWidth: '760px' }}>
      <Done title={t('Goods returned')} text={t('{no} · credit {v} from {name}', { no: done.no, v: money(-done.total), name: sup?.name || '' })}>
        <Btn icon="print" onClick={() => previewPrint(grnHtml(done, sup, ctxPrint(), userName(done.user_id)), { title: done.no, paper: 'a4' })}>{t('Print return note')}</Btn>
        <Btn icon="store" onClick={() => navigate('/purchasing/suppliers/' + sid)}>{t('Open supplier')}</Btn>
        <Btn variant="primary" icon="plus" onClick={() => { setDone(null); setLines([]); setReason(''); setNote(''); }}>{t('Return more')}</Btn>
      </Done>
    </div>
  );
  return (
    <div class="page wide" style={{ maxWidth: '1300px' }}>
      <PageHeader back="#/purchasing/returns" title={t('Return goods to supplier')} sub={t('Stock goes down and the supplier owes you a credit (or refunds you).')} />
      <div class="split-360">
        <div class="col gap-l" style={{ minWidth: 0 }}>
          <div class="card pad form-grid">
            <Select label={t('Supplier')} value={sid} onValue={(v) => { setSid(v); setGrnId(''); }} options={[{ value: '', label: t('— choose —') }, ...sups.map((s) => ({ value: s.id, label: s.name }))]} />
            {grns.length > 0 && <Select label={t('From delivery (optional)')} value={grnId} onValue={setGrnId} options={[{ value: '', label: t('Any delivery') }, ...grns.map((g) => ({ value: g.id, label: `${g.no} · ${d8(g.created_at)}${g.supplier_invoice_no ? ' · ' + g.supplier_invoice_no : ''}` }))]} />}
          </div>
          {grn && <div class="card pad"><div class="lbl" style={{ marginBottom: '8px' }}>{t('Items in {no} — tap to return', { no: grn.no })}</div><div class="row wrap gap-s">{grn.lines.map((l) => { const p = catalog.value.byId.get(l.product_id); return p ? <button type="button" class="chip" onClick={() => add(p)}><Icon name="plus" size={14} />{l.name} <span class="mute">×{fq(l.qty)}</span></button> : null; })}</div></div>}
          <div class="card">
            <div class="card-h"><h3 class="grow">{t('Items to return')}</h3><span class="scan-hint"><Icon name="barcode" size={16} />{t('Scan items or search')}</span></div>
            <div class="card-b"><ProductAdder onPick={(p, r) => add(p, r?.factor || 1)} /></div>
            <div class="le">
              {lines.length > 0 && <div class="le-row head"><span>{t('Item')}</span><span>{t('Quantity')}</span><span>{t('Cost each')}</span><span class="right">{t('Amount')}</span><span /></div>}
              {lines.map((l, i) => (
                <div class="le-row" key={l.product_id}>
                  <div class="nm"><b>{l.p.name}</b><small>{t('In stock')}: {fq(levels.value.get(l.product_id) || 0)}{unitOf(l.p)}</small></div>
                  <div class="c-qty">{l.p.track_serials ? <b class="mono center">{l.qty}</b> : <QtyIn value={l.qty} onValue={(v) => upd(i, { qty: v })} label={t('Quantity of {name}', { name: l.p.name })} />}</div>
                  <div class="c-cost"><MoneyInput value={l.cost} onValue={(v) => upd(i, { cost: v })} aria-label={t('Cost of {name}', { name: l.p.name })} /></div>
                  <div class="tot c-tot">{kes(Math.round(l.qty * l.cost))}</div>
                  <Btn class="rm" variant="ghost" icon="x" size="sm" aria-label={t('Remove')} onClick={() => setLines(lines.filter((_, k) => k !== i))} />
                  {(l.batches.length > 0 || l.serialsAvail.length > 0) && <div class="extra">
                    {l.batches.length > 0 && <Select label={t('Batch')} value={l.batch_no} onValue={(v) => upd(i, { batch_no: v })} options={[{ value: '', label: t('Oldest expiry first (automatic)') }, ...l.batches.map((b) => ({ value: b.batch_no, label: `${b.batch_no} · ${t('exp')} ${b.expiry || '—'} · ${fq(b.qty)}` }))]} />}
                    {l.serialsAvail.length > 0 && <div class="field" style={{ maxWidth: 'none', flex: 3 }}><label>{t('Tap or scan the serial / IMEI numbers you are returning')}</label>
                      <div class="row wrap gap-s">{l.serialsAvail.map((s) => <button type="button" class={'chip mono' + (l.serials.includes(s.serial) ? ' on' : '')} onClick={() => toggleSerial(i, s.serial)}>{s.serial}</button>)}</div></div>}
                  </div>}
                </div>
              ))}
              {!lines.length && <Empty icon="undo" title={t('No items yet')} text={t('Scan the items you are sending back, or pick them from the delivery above.')} />}
            </div>
          </div>
        </div>
        <div class="card pad sum-card sticky-side col">
          <div class="field"><label>{t('Why are you returning them?')}</label><div class="row wrap gap-s">{REASONS.map((r) => <button type="button" class={'chip' + (reason === r ? ' on' : '')} onClick={() => setReason(r)}>{t(r)}</button>)}</div></div>
          <Input label={t('Note (optional)')} value={note} onValue={setNote} placeholder={t('e.g. credit note number')} />
          <div class="grand"><span class="bold">{t('Credit (return)')}</span><b>{money(total)}</b></div>
          <Switch checked={refund} onChange={(v) => { setRefund(v); setRefundAmt(total); }} label={t('Supplier refunded money now')} sub={t('Otherwise it is deducted from what you owe them')} />
          {refund && <><MoneyInput label={t('Refund received')} value={refundAmt || total} onValue={setRefundAmt} /><Seg value={refundMethod} onValue={setRefundMethod} options={[{ value: 'cash', label: t('Cash') }, { value: 'mpesa', label: 'M-Pesa' }, { value: 'bank', label: t('Bank') }]} /></>}
          <Btn variant="primary" size="lg" icon="undo" disabled={!lines.length || !sid || busy || lines.some((l) => l.qty <= 0) || !licenceState().canPurchase} onClick={go}>{t('Return goods')}</Btn>
        </div>
      </div>
    </div>
  );
}
