// "Adjust stock" dialog: choose what happened (damaged, expired, theft, own use, found, correction), how many, done.
// Large changes (value at cost above the limit in Settings → Stock & purchasing) need a manager PIN.
import { useEffect, useState } from 'preact/hooks';
import { openModal, Modal, toast } from '../../ui/overlay.jsx';
import { Btn, Icon, Input, Select, Badge } from '../../ui/kit.jsx';
import { catalog } from '../../db/catalog.js';
import { db } from '../../db/index.js';
import { batchBalances } from '../../db/stock.js';
import { ADJUST_REASONS, adjustStock, approvalLimit, levelAt, r3 } from '../../core/inventory.js';
import { requirePerm } from '../../auth/override.jsx';
import { can } from '../../auth/permissions.js';
import { money } from '../../lib/money.js';
import { ProductAdder, QtyIn, fq, unitOf, useScan, resolveCode } from './common.jsx';
import * as S from '../../state.js';
import { t } from '../../i18n/index.js';

/** Open the dialog. Resolves with the saved moves or null. */
export const adjustDialog = (product = null, opts = {}) => openModal((close) => <AdjustBody close={close} initial={product} {...opts} />);

function AdjustBody({ close, initial, reason: r0 }) {
  const [p, setP] = useState(initial);
  const [reason, setReason] = useState(r0 || '');
  const [mode, setMode] = useState('remove'); // correction: remove | add | set
  const [qty, setQty] = useState(1);
  const [now, setNow] = useState(0);
  const [batches, setBatches] = useState([]);
  const [batch, setBatch] = useState('');
  const [newBatch, setNewBatch] = useState({ batch_no: '', expiry: '' });
  const [serials, setSerials] = useState([]);
  const [serial, setSerial] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const bid = S.branch.value?.id;
  useScan((code) => { const r = resolveCode(code); if (r?.product?.track_stock) { setP(r.product); } else if (p?.track_serials) setSerial(code); }, [p], { dialog: true });
  useEffect(() => {
    if (!p) return;
    levelAt(p.id, bid).then(setNow);
    if (p.track_batches) batchBalances(p.id, bid).then(setBatches);
    if (p.track_serials) db().serials.where('product_id').equals(p.id).toArray().then((l) => setSerials(l.filter((s) => !s.deleted && s.status === 'in_stock' && (!s.branch_id || s.branch_id === bid))));
    setBatch(''); setSerial('');
  }, [p?.id]);
  const def = ADJUST_REASONS.find((x) => x.value === reason);
  const dir = def ? (def.dir || (mode === 'add' ? 1 : mode === 'remove' ? -1 : 0)) : -1;
  const delta = !def ? 0 : def.dir === 0 && mode === 'set' ? r3(qty - now) : r3(dir * (p?.track_serials ? 1 : qty));
  const after = r3(now + delta);
  const value = Math.abs(Math.round(delta * (p?.cost || 0)));
  const limit = approvalLimit();
  const needsOk = value > limit && !can('inventory.approve');
  const costs = can('products.cost_view');
  const save = async () => {
    if (!p || !delta || busy) return;
    if (p.track_serials && !serial) return toast.warn(t('Choose the serial / IMEI number'));
    let approver = null;
    if (needsOk) { approver = await requirePerm('inventory.approve', t('Stock change of {v}', { v: money(value) })); if (!approver) return; }
    setBusy(true);
    try {
      const moves = await adjustStock({ product_id: p.id, qty: delta, reason, note, batch_no: delta < 0 ? batch : newBatch.batch_no.trim(), expiry: delta < 0 ? (batches.find((b) => b.batch_no === batch)?.expiry || '') : newBatch.expiry, serial, approver });
      toast(delta < 0 ? t('{n} removed from stock', { n: fq(-delta) + unitOf(p) }) : t('{n} added to stock', { n: fq(delta) + unitOf(p) }));
      close(moves);
    } catch (e) { toast.error(e.message); setBusy(false); }
  };
  const label = !delta ? t('Save') : delta < 0 ? t('Remove {n} from stock', { n: fq(-delta) }) : t('Add {n} to stock', { n: fq(delta) });
  return (
    <Modal title={t('Adjust stock')} icon="sliders" size="lg" onClose={() => close(null)}
      footer={<><Btn onClick={() => close(null)}>{t('Cancel')}</Btn><Btn variant="primary" icon={needsOk ? 'shield' : 'check'} disabled={!p || !reason || !delta || busy} onClick={save}>{label}</Btn></>}>
      {!p ? (
        <div class="col">
          <p class="mute" style={{ margin: 0 }}>{t('Which item? Scan its barcode or type the name.')}</p>
          <ProductAdder autoFocus onPick={(x) => setP(x)} />
        </div>
      ) : (
        <div class="col gap-l">
          <div class="card pad row" style={{ background: 'var(--paper)', border: 0 }}>
            <div class="grow"><b style={{ fontSize: '17px' }}>{p.name}</b><div class="small mute mono">{[p.sku, p.barcode].filter(Boolean).join(' · ')}</div></div>
            <div class="right"><div class="small mute">{t('In stock now')}</div><b class="mono" style={{ fontSize: '20px' }}>{fq(now)}{unitOf(p)}</b></div>
            {!initial && <Btn size="sm" variant="ghost" onClick={() => setP(null)}>{t('Change')}</Btn>}
          </div>
          <div>
            <div class="lbl" style={{ marginBottom: '8px' }}>{t('What happened?')}</div>
            <div class="reason-grid" role="radiogroup">
              {ADJUST_REASONS.map((r) => <button type="button" role="radio" aria-checked={reason === r.value} class={reason === r.value ? 'on' : ''} onClick={() => { setReason(r.value); if (r.dir === 0) setMode('set'); setQty(r.dir === 0 ? Math.max(0, now) : 1); }}><Icon name={r.icon} size={20} />{t(r.label)}</button>)}
            </div>
          </div>
          {def && (
            <div class="form-grid">
              {def.dir === 0 && <div class="full"><div class="lbl" style={{ marginBottom: '6px' }}>{t('What do you want to do?')}</div>
                <div class="seg" role="radiogroup">{[['set', t('Set the count to')], ['remove', t('Remove')], ['add', t('Add')]].map(([v, l]) => <button type="button" role="radio" aria-checked={mode === v} class={mode === v ? 'on' : ''} onClick={() => { setMode(v); setQty(v === 'set' ? Math.max(0, now) : 1); }}>{l}</button>)}</div></div>}
              {!p.track_serials && <div class="field"><label>{def.dir === 0 && mode === 'set' ? t('Correct quantity on the shelf') : dir < 0 ? t('How many to remove?') : t('How many to add?')}</label><QtyIn value={qty} onValue={setQty} step={p.unit === 'kg' || p.unit === 'l' ? 0.5 : 1} label={t('Quantity')} /></div>}
              {p.track_batches && delta < 0 && <Select label={t('Batch')} value={batch} onValue={setBatch} options={[{ value: '', label: t('Oldest expiry first (automatic)') }, ...batches.map((b) => ({ value: b.batch_no, label: `${b.batch_no} · ${t('exp')} ${b.expiry || '—'} · ${fq(b.qty)}` }))]} />}
              {p.track_batches && delta > 0 && <><Input label={t('Batch number (optional)')} value={newBatch.batch_no} onValue={(v) => setNewBatch({ ...newBatch, batch_no: v })} /><Input label={t('Expiry date')} type="date" value={newBatch.expiry} onValue={(v) => setNewBatch({ ...newBatch, expiry: v })} /></>}
              {p.track_serials && delta < 0 && <Select label={t('Serial / IMEI number')} value={serial} onValue={setSerial} options={[{ value: '', label: t('— choose —') }, ...serials.map((s) => ({ value: s.serial, label: s.serial }))]} />}
              {p.track_serials && delta > 0 && <Input label={t('Serial / IMEI number')} value={serial} onValue={setSerial} data-scan="keep" />}
              <Input class={p.track_serials ? '' : 'full'} label={t('Note (optional)')} value={note} onValue={setNote} placeholder={t('e.g. dropped while offloading')} />
            </div>
          )}
          {def && delta !== 0 && (
            <div class={'callout ' + (delta < 0 ? 'warn' : 'ok')}>
              <Icon name={delta < 0 ? 'minus' : 'plus'} size={18} />
              <div class="grow">{t('Stock will change from {a} to {b}', { a: fq(now), b: fq(after) })}{costs && value > 0 && <> · {t('value {v}', { v: money(value) })}</>}
                {needsOk && <div class="bold" style={{ marginTop: '4px' }}>{t('This is a big change — a manager will be asked to approve it.')}</div>}</div>
              {after < 0 && <Badge tone="bad">{t('Below zero')}</Badge>}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
