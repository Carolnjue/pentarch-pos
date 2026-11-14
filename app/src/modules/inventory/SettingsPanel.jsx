// Settings → Stock & purchasing: approval limit for stock changes, blind counts, purchase order footer.
import { useState } from 'preact/hooks';
import { Btn, Switch, MoneyInput, Textarea, Input } from '../../ui/kit.jsx';
import { toast } from '../../ui/overlay.jsx';
import { saveBusiness } from '../../auth/session.js';
import { can } from '../../auth/permissions.js';
import { approvalLimit } from '../../core/inventory.js';
import * as S from '../../state.js';
import { t } from '../../i18n/index.js';

export default function StockSettings() {
  const st = S.settings.value;
  const [f, setF] = useState({ inv_approve_over: approvalLimit(), inv_blind_default: !!st.inv_blind_default, inv_labels_after_receive: st.inv_labels_after_receive !== false, po_footer: st.po_footer || '', notify_expiry_days: st.notify_expiry_days || 30 });
  const set = (p) => setF({ ...f, ...p });
  const go = async () => { await saveBusiness({ settings: { ...f, notify_expiry_days: Math.max(1, parseInt(f.notify_expiry_days) || 30) } }); toast(t('Saved')); };
  const edit = can('settings.edit');
  return (
    <div class="card">
      <div class="card-h"><h3 class="grow">{t('Stock & purchasing')}</h3>{edit && <Btn variant="primary" icon="check" onClick={go}>{t('Save')}</Btn>}</div>
      <fieldset disabled={!edit} style={{ border: 0, margin: 0, padding: 0 }}><div class="card-b">
        <div class="set-row"><div class="d"><b>{t('Manager approval for big stock changes')}</b><small>{t('Adjustments and count differences worth more than this (at cost) need a manager PIN. 0 = always ask.')}</small></div>
          <div style={{ width: '200px' }}><MoneyInput value={f.inv_approve_over} onValue={(v) => set({ inv_approve_over: v })} aria-label={t('Approval limit')} /></div></div>
        <div class="set-row"><div class="d"><b>{t('Blind counts by default')}</b><small>{t('Staff do not see the system quantity while counting')}</small></div><Switch checked={f.inv_blind_default} onChange={(v) => set({ inv_blind_default: v })} /></div>
        <div class="set-row"><div class="d"><b>{t('Offer to print labels after receiving')}</b><small>{t('Price labels for the items that just arrived')}</small></div><Switch checked={f.inv_labels_after_receive} onChange={(v) => set({ inv_labels_after_receive: v })} /></div>
        <div class="set-row"><div class="d"><b>{t('Expiry warning')}</b><small>{t('Warn this many days before a batch expires')}</small></div><div style={{ width: '120px' }}><Input type="number" value={f.notify_expiry_days} onValue={(v) => set({ notify_expiry_days: v })} aria-label={t('Days')} /></div></div>
        <Textarea class="mt" label={t('Note printed on purchase orders')} value={f.po_footer} onValue={(v) => set({ po_footer: v })} rows={2} placeholder={t('e.g. Deliver between 8 am and 4 pm. Invoice must quote our order number.')} />
      </div></fieldset>
    </div>
  );
}
