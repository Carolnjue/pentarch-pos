// Create / view a purchase order: supplier, items (scan or search), expected date → print A4 or send on WhatsApp → receive.
import { useEffect, useState } from 'preact/hooks';
import { catalog, levels } from '../../db/catalog.js';
import { db } from '../../db/index.js';
import { PageHeader, Btn, Icon, Empty, Input, MoneyInput, Textarea } from '../../ui/kit.jsx';
import { Table } from '../../ui/table.jsx';
import { confirm, toast } from '../../ui/overlay.jsx';
import { previewPrint } from '../../ui/printpreview.jsx';
import { money, kes } from '../../lib/money.js';
import { waLink } from '../../lib/util.js';
import { navigate } from '../../router.js';
import { can } from '../../auth/permissions.js';
import { licenceState } from '../../auth/session.js';
import { savePO, setPOStatus, suppliersList, poReceived } from '../../core/purchasing.js';
import { poOutstanding } from '../../core/stockmath.js';
import { r3 } from '../../core/inventory.js';
import { poHtml, poText } from '../../print/stockdocs.js';
import { BuyTabs, ProductAdder, QtyIn, StatusPill, useScan, resolveCode, fq, unitOf, ctxPrint, d8, userName } from '../inventory/common.jsx';
import { editSupplier } from './supplierDialog.jsx';
import * as S from '../../state.js';
import { t } from '../../i18n/index.js';

export default function OrderEdit({ params, query }) {
  const isNew = !params.id;
  const [po, setPo] = useState(isNew ? { supplier_id: query?.supplier || '', lines: [], expected_date: '', notes: '', status: 'draft', branch_id: S.branch.value?.id } : null);
  const [sups, setSups] = useState([]);
  const [rec, setRec] = useState({});
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const loadSups = () => suppliersList().then(setSups);
  useEffect(() => { loadSups(); }, []);
  useEffect(() => {
    if (isNew) return;
    (async () => { const p = await db().purchase_orders.get(params.id); if (!p || p.deleted) return setPo(false); setPo(p); setRec(await poReceived(p.id)); setDirty(false); })();
  }, [params.id]);
  const editable = po && can('purchasing.orders') && (po.status === 'draft' || po.status === 'sent');
  const set = (ch) => { setPo({ ...po, ...ch }); setDirty(true); };
  const add = (p, r) => {
    if (!editable || p.has_variants) return;
    const f = r?.uom?.factor || 1;
    const i = po.lines.findIndex((l) => l.product_id === p.id);
    if (i >= 0) set({ lines: po.lines.map((l, k) => (k === i ? { ...l, qty: r3(l.qty + f) } : l)) });
    else set({ lines: [...po.lines, { product_id: p.id, name: p.name, qty: Math.max(f, p.reorder_qty || 1), cost: p.cost || 0 }] });
  };
  useScan((code) => { const r = resolveCode(code); if (r) add(r.product, r); }, [po]);
  if (po === false) return <div class="page"><Empty icon="file" title={t('Order not found')} /></div>;
  if (!po) return <div class="page" />;
  const sup = sups.find((s) => s.id === po.supplier_id);
  const total = po.lines.reduce((s, l) => s + Math.round(l.qty * l.cost), 0);
  const persist = async (extra = {}) => {
    if (!po.supplier_id) { toast.warn(t('Choose a supplier')); return null; }
    if (!po.lines.length) { toast.warn(t('Add at least one item')); return null; }
    const saved = await savePO({ ...po, ...extra });
    setPo(saved); setDirty(false);
    if (isNew) navigate('/purchasing/orders/' + saved.id, { replace: true });
    return saved;
  };
  const saveDraft = async () => { setBusy(true); const s = await persist(); setBusy(false); if (s) toast(t('Order {no} saved', { no: s.no })); };
  const print = async () => { const s = dirty || isNew ? await persist() : po; if (s) previewPrint(poHtml(s, sup, ctxPrint()), { title: s.no, paper: 'a4', actions: () => sup?.phone && <Btn icon="whatsapp" onClick={() => whatsapp(s)}>{t('Send on WhatsApp')}</Btn> }); };
  const whatsapp = async (cur) => {
    const s = cur || (dirty || isNew ? await persist() : po);
    if (!s) return;
    if (!sup?.phone) { toast.warn(t('Add the supplier’s phone number first')); return; }
    window.open(waLink(sup.phone, poText(s, sup, ctxPrint())), '_blank', 'noopener');
    if (s.status === 'draft') { const n = await setPOStatus(s, 'sent'); setPo(n); }
    toast(t('Order opened in WhatsApp — press Send there'));
  };
  const markSent = async () => { const s = dirty || isNew ? await persist() : po; if (s) { setPo(await setPOStatus(s, 'sent')); toast(t('Marked as sent')); } };
  const cancel = async () => {
    if (!(await confirm({ title: t('Cancel this order?'), message: t('The supplier should not deliver it any more. Deliveries already received stay in stock.'), danger: true, ok: t('Yes, cancel order') }))) return;
    setPo(await setPOStatus(po, 'cancelled')); toast(t('Order cancelled'));
  };
  const out = poOutstanding(po, rec);
  const canBuy = licenceState().canPurchase;
  return (
    <div class="page wide" style={{ maxWidth: '1300px' }}>
      <PageHeader back="#/purchasing/orders" title={isNew ? t('New purchase order') : <span class="row wrap gap-s">{t('Order')} <span class="mono">{po.no}</span><StatusPill s={po.status} /></span>}
        sub={!isNew && [sup?.name, d8(po.created_at), userName(po.created_by)].filter(Boolean).join(' · ')}
        actions={<>
          {!isNew && ['sent', 'partial', 'draft'].includes(po.status) && can('purchasing.receive') && canBuy && <Btn variant="ok" icon="truck" onClick={() => navigate('/purchasing/receive?po=' + po.id)}>{t('Receive goods')}</Btn>}
          {!isNew && ['draft', 'sent'].includes(po.status) && can('purchasing.orders') && <Btn variant="ghost" icon="x" onClick={cancel}>{t('Cancel order')}</Btn>}
        </>} />
      <BuyTabs active="/purchasing/orders" />
      <div class="split-360">
        <div class="card" style={{ minWidth: 0 }}>
          <div class="card-h"><h3 class="grow">{t('Items to order')}</h3>{editable && <span class="scan-hint"><Icon name="barcode" size={16} />{t('Scan items or search')}</span>}</div>
          {editable && <div class="card-b"><ProductAdder onPick={add} filter={(p) => p.type !== 'service' && p.type !== 'composite'} /></div>}
          {editable ? (
            <div class="le">
              {po.lines.length > 0 && <div class="le-row head"><span>{t('Item')}</span><span>{t('Quantity')}</span><span>{t('Cost each')}</span><span class="right">{t('Amount')}</span><span /></div>}
              {po.lines.map((l, i) => { const p = catalog.value.byId.get(l.product_id); return (
                <div class="le-row" key={l.product_id}>
                  <div class="nm"><b>{l.name}</b><small>{t('In stock')}: {fq(levels.value.get(l.product_id) || 0)}{unitOf(p)}{p?.reorder_level ? ' · ' + t('reorder at {n}', { n: p.reorder_level }) : ''}</small></div>
                  <div class="c-qty"><QtyIn value={l.qty} onValue={(v) => set({ lines: po.lines.map((x, k) => (k === i ? { ...x, qty: v } : x)) })} label={t('Quantity of {name}', { name: l.name })} /></div>
                  <div class="c-cost"><MoneyInput value={l.cost} onValue={(v) => set({ lines: po.lines.map((x, k) => (k === i ? { ...x, cost: v } : x)) })} aria-label={t('Cost of {name}', { name: l.name })} /></div>
                  <div class="tot c-tot">{kes(Math.round(l.qty * l.cost))}</div>
                  <Btn class="rm" variant="ghost" icon="x" size="sm" aria-label={t('Remove')} onClick={() => set({ lines: po.lines.filter((_, k) => k !== i) })} />
                </div>); })}
              {!po.lines.length && <Empty icon="file" title={t('No items yet')} text={t('Scan or search the items you want to order. Tip: Stock → Reorder fills in everything that is running low.')} />}
            </div>
          ) : (
            <Table rows={out} columns={[
              { key: 'name', label: t('Item'), render: (l) => <b>{l.name}</b> },
              { key: 'qty', label: t('Ordered'), num: true, render: (l) => fq(l.qty) },
              { key: 'received', label: t('Received'), num: true, render: (l) => <span class={l.received >= l.qty ? 'up' : ''}>{fq(l.received)}</span> },
              { key: 'left', label: t('Still to come'), num: true, render: (l) => (l.left > 0 && po.status !== 'cancelled' ? <b>{fq(l.left)}</b> : <span class="mute">—</span>) },
              { key: 'cost', label: t('Cost each'), num: true, hideMobile: true, render: (l) => kes(l.cost) },
              { key: 'amt', label: t('Amount'), num: true, render: (l) => kes(Math.round(l.qty * l.cost)) }
            ]} />
          )}
        </div>
        <div class="card pad sum-card sticky-side col">
          <div class="field"><label>{t('Supplier')}</label>
            {editable ? <div class="row gap-s">
              <select class="input" value={po.supplier_id} onChange={(e) => set({ supplier_id: e.target.value })} aria-label={t('Supplier')}>
                <option value="">{t('— choose —')}</option>{sups.map((s) => <option value={s.id}>{s.name}</option>)}
              </select>
              {can('suppliers.edit') && <Btn icon="plus" aria-label={t('Add supplier')} onClick={async () => { const s = await editSupplier(); if (s) { await loadSups(); set({ supplier_id: s.id }); } }} />}
            </div> : <a href={'#/purchasing/suppliers/' + po.supplier_id} class="bold">{sup?.name || '—'}</a>}
          </div>
          {editable ? <Input label={t('Expected delivery date')} type="date" value={po.expected_date} onValue={(v) => set({ expected_date: v })} /> : po.expected_date && <div class="kv"><span>{t('Expected by')}</span><b>{po.expected_date}</b></div>}
          {editable ? <Textarea label={t('Note to supplier (optional)')} value={po.notes} onValue={(v) => set({ notes: v })} rows={2} /> : po.notes && <p class="small">{po.notes}</p>}
          <div class="grand"><span class="bold">{t('Total')}</span><b>{money(total)}</b></div>
          {editable && <Btn variant="primary" size="lg" icon="whatsapp" disabled={busy || !po.lines.length || !po.supplier_id} onClick={() => whatsapp()}>{t('Send on WhatsApp')}</Btn>}
          <div class="row wrap gap-s">
            <Btn icon="print" class="grow" disabled={!po.lines.length || !po.supplier_id} onClick={print}>{t('Print / PDF')}</Btn>
            {editable && <Btn icon="check" class="grow" disabled={busy || (!dirty && !isNew)} onClick={saveDraft}>{t('Save')}</Btn>}
          </div>
          {editable && po.status === 'draft' && !isNew && <Btn size="sm" variant="ghost" icon="check-circle" onClick={markSent}>{t('Mark as sent (sent another way)')}</Btn>}
          {!sup?.phone && po.supplier_id && editable && <p class="small mute" style={{ margin: 0 }}>{t('This supplier has no phone number — add one to send on WhatsApp.')}</p>}
        </div>
      </div>
    </div>
  );
}
