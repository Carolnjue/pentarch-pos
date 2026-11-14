// Return / refund: choose lines & quantities, restock or damaged, refund method, print slip.
import { useEffect, useState } from 'preact/hooks';
import { openModal, Modal, toast } from '../../ui/overlay.jsx';
import { Btn, Icon, Switch, Select, Input } from '../../ui/kit.jsx';
import { money, kes } from '../../lib/money.js';
import { processReturn, returnedQty } from '../../core/sales.js';
import { requirePerm } from '../../auth/override.jsx';
import { returnSlipHtml, methodLabel } from '../../print/templates.js';
import { previewPrint } from '../../ui/printpreview.jsx';
import { receiptCtx } from './receipt.js';
import * as S from '../../state.js';
import { t } from '../../i18n/index.js';

export async function openReturn(sale) {
  const by = await requirePerm('sell.return', t('Return items from {no}', { no: sale.no }));
  if (!by) return;
  const prev = await returnedQty(sale.id);
  const ret = await openModal((close) => <ReturnDialog sale={sale} prev={prev} by={by} close={close} />);
  if (ret) {
    toast(t('Refund of {a} recorded', { a: money(ret.total) }));
    const ctx = await receiptCtx(sale);
    previewPrint(await returnSlipHtml(ret, sale, ctx), { title: t('Return slip'), paper: S.settings.value.receipt_width || 80 });
  }
}

function ReturnDialog({ sale, prev, by, close }) {
  const [items, setItems] = useState(sale.lines.map((l, i) => ({ line_index: i, qty: 0, max: Math.max(0, l.qty - (prev[i] || 0)), restock: true })));
  const [reason, setReason] = useState('');
  const paidMethods = [...new Set(sale.payments.map((p) => p.method))];
  const [method, setMethod] = useState(paidMethods.includes('credit') ? 'credit' : paidMethods[0] === 'mpesa' ? 'mpesa' : 'cash');
  const [busy, setBusy] = useState(false);
  const total = items.reduce((s, it) => s + Math.round((sale.lines[it.line_index].total / sale.lines[it.line_index].qty) * it.qty), 0);
  const set = (i, patch) => setItems(items.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const submit = async () => {
    if (!total) return toast.error(t('Choose what is being returned'));
    if (!reason.trim()) return toast.error(t('Enter a reason'));
    setBusy(true);
    try {
      const ret = await processReturn(sale, items.filter((x) => x.qty > 0), [{ method, amount: total }], reason.trim(), by);
      close(ret);
    } catch (e) { toast.error(e.message); setBusy(false); }
  };
  const methods = ['cash', 'mpesa', 'card', 'bank', ...(sale.customer_id ? ['credit'] : [])];
  return (
    <Modal title={t('Return items — {no}', { no: sale.no })} icon="undo" size="lg" onClose={() => close(null)}
      footer={<><span class="grow">{t('Refund')}: <b class="mono" style={{ fontSize: '20px' }}>{money(total)}</b></span><Btn onClick={() => close(null)}>{t('Cancel')}</Btn><Btn variant="primary" icon="undo" disabled={busy || !total} onClick={submit}>{t('Confirm return')}</Btn></>}>
      <div class="card mb">
        {sale.lines.map((l, i) => {
          const it = items[i];
          return (
            <div class="list-item" style={{ opacity: it.max ? 1 : 0.5 }}>
              <div class="grow"><b>{l.name}</b><div class="small mute">{t('Sold')} {l.qty} × {kes(l.total / l.qty)}{prev[i] ? ' · ' + t('{n} already returned', { n: prev[i] }) : ''}</div></div>
              {it.max > 0 ? <>
                <div class="qty">
                  <button onClick={() => set(i, { qty: Math.max(0, it.qty - 1) })} aria-label={t('Less')}><Icon name="minus" size={16} /></button>
                  <input value={it.qty} inputMode="decimal" aria-label={t('Quantity to return')} onChange={(e) => set(i, { qty: Math.min(it.max, Math.max(0, parseFloat(e.target.value) || 0)) })} />
                  <button onClick={() => set(i, { qty: Math.min(it.max, it.qty + 1) })} aria-label={t('More')}><Icon name="plus" size={16} /></button>
                </div>
                <Switch checked={it.restock} onChange={(v) => set(i, { restock: v })} label={it.restock ? t('Back to stock') : t('Damaged')} />
              </> : <span class="badge">{t('Returned')}</span>}
            </div>
          );
        })}
      </div>
      <div class="row wrap gap-s mb"><Btn size="sm" onClick={() => setItems(items.map((x) => ({ ...x, qty: x.max })))}>{t('Return everything')}</Btn></div>
      <div class="form-grid">
        <Input label={t('Reason')} value={reason} onValue={setReason} placeholder={t('e.g. wrong size')} />
        <Select label={t('Refund by')} value={method} onValue={setMethod} options={methods.map((m) => ({ value: m, label: m === 'credit' ? t('Reduce customer balance') : methodLabel(m) }))} />
      </div>
      <div class="row wrap gap-s" style={{ marginTop: '8px' }}>{[t('Wrong size'), t('Faulty / damaged'), t('Expired'), t('Customer changed mind')].map((r) => <button class="chip" onClick={() => setReason(r)}>{r}</button>)}</div>
    </Modal>
  );
}
