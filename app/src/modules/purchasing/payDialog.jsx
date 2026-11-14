// "Pay a supplier" dialog: choose supplier, see unpaid deliveries (oldest first), amount, method, reference.
import { useEffect, useState } from 'preact/hooks';
import { openModal, Modal, toast } from '../../ui/overlay.jsx';
import { Btn, MoneyInput, Input, Seg, Switch, Check, Icon, Select } from '../../ui/kit.jsx';
import { money, kes } from '../../lib/money.js';
import { paySupplier, supplierAcc, suppliersList } from '../../core/purchasing.js';
import { licenceState } from '../../auth/session.js';
import { d8 } from '../inventory/common.jsx';
import * as S from '../../state.js';
import { t } from '../../i18n/index.js';

export const payDialog = (supplierId = '', grnId = '') => openModal((close) => <PayBody close={close} sid0={supplierId} grnId={grnId} />);

function PayBody({ close, sid0, grnId }) {
  const [sups, setSups] = useState([]);
  const [sid, setSid] = useState(sid0);
  const [acc, setAcc] = useState(null);
  const [pick, setPick] = useState(new Set());
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState('mpesa');
  const [ref, setRef] = useState('');
  const [note, setNote] = useState('');
  const [drawer, setDrawer] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => { suppliersList().then(setSups); }, []);
  useEffect(() => {
    if (!sid) { setAcc(null); return; }
    supplierAcc(sid).then((a) => {
      setAcc(a);
      const sel = new Set(a.open.filter((o) => !grnId || o.grn.id === grnId).map((o) => o.grn.id));
      setPick(sel);
      setAmount(a.open.filter((o) => sel.has(o.grn.id)).reduce((s, o) => s + o.due, 0));
    });
  }, [sid]);
  const toggle = (id) => { const n = new Set(pick); n.has(id) ? n.delete(id) : n.add(id); setPick(n); setAmount(acc.open.filter((o) => n.has(o.grn.id)).reduce((s, o) => s + o.due, 0)); };
  const sup = sups.find((s) => s.id === sid);
  const go = async () => {
    if (!sid || amount <= 0 || busy) return;
    setBusy(true);
    const ids = pick.size && pick.size < (acc?.open.length || 0) ? [...pick] : null;
    const p = await paySupplier({ supplier_id: sid, amount, method, ref: ref.trim(), note, grn_ids: ids, from_drawer: drawer && method === 'cash' && !!S.shift.value });
    toast(t('{v} paid to {name}', { v: money(amount), name: sup?.name || '' }));
    close(p);
  };
  return (
    <Modal title={t('Pay a supplier')} icon="wallet" onClose={() => close(null)}
      footer={<><Btn onClick={() => close(null)}>{t('Cancel')}</Btn><Btn variant="primary" icon="check" disabled={!sid || amount <= 0 || busy || !licenceState().canPurchase} onClick={go}>{t('Pay {v}', { v: money(amount) })}</Btn></>}>
      <div class="col gap-l">
        {!sid0 && <Select label={t('Supplier')} value={sid} onValue={setSid} options={[{ value: '', label: t('— choose —') }, ...sups.map((s) => ({ value: s.id, label: s.name }))]} />}
        {acc && <div class="card pad row" style={{ background: 'var(--paper)', border: 0 }}>
          <div class="grow"><b>{sup?.name}</b><div class="small mute">{t('We owe them')}</div></div><b class="mono" style={{ fontSize: '22px' }}>{money(Math.max(0, acc.balance))}</b></div>}
        {acc && acc.open.length > 0 && <div>
          <div class="lbl" style={{ marginBottom: '6px' }}>{t('Unpaid deliveries (oldest first)')}</div>
          <div class="card" style={{ maxHeight: '200px', overflow: 'auto' }}>
            {acc.open.map((o) => <label class="list-item click" style={{ padding: '8px 12px' }}><input type="checkbox" checked={pick.has(o.grn.id)} onChange={() => toggle(o.grn.id)} /><span class="grow"><b class="mono">{o.grn.no}</b><span class="small mute"> · {d8(o.grn.created_at)}{o.grn.supplier_invoice_no ? ' · ' + o.grn.supplier_invoice_no : ''}</span></span><b class="mono">{kes(o.due)}</b></label>)}
          </div>
        </div>}
        {acc && !acc.open.length && <div class="callout ok"><Icon name="check-circle" size={18} />{t('Nothing is owed to this supplier. A payment now is kept as credit (advance).')}</div>}
        {sid && acc && <>
          <MoneyInput label={t('Amount')} value={amount} onValue={setAmount} big />
          <Seg value={method} onValue={setMethod} options={[{ value: 'mpesa', label: 'M-Pesa' }, { value: 'cash', label: t('Cash') }, { value: 'bank', label: t('Bank') }, { value: 'cheque', label: t('Cheque') }]} />
          {method !== 'cash' && <Input label={method === 'mpesa' ? t('M-Pesa code') : method === 'cheque' ? t('Cheque number') : t('Reference')} value={ref} onValue={(v) => setRef(v.toUpperCase())} />}
          {method === 'cash' && S.shift.value && <Switch checked={drawer} onChange={setDrawer} label={t('Paid from the cash drawer')} sub={t('Recorded as a pay-out in this shift')} />}
          <Input label={t('Note (optional)')} value={note} onValue={setNote} />
        </>}
      </div>
    </Modal>
  );
}
