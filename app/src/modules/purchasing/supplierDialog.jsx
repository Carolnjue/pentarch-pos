// Add / edit supplier dialog (name and phone first; terms as simple choices).
import { useState } from 'preact/hooks';
import { openModal, Modal, toast } from '../../ui/overlay.jsx';
import { Btn, Input, Textarea, Seg } from '../../ui/kit.jsx';
import { db } from '../../db/index.js';
import { saveSupplier } from '../../core/purchasing.js';
import { normPhone, prettyPhone } from '../../lib/util.js';
import { t } from '../../i18n/index.js';

export const editSupplier = (s = null) => openModal((close) => <SupplierForm s={s} close={close} />);

function SupplierForm({ s, close }) {
  const [f, setF] = useState({ name: s?.name || '', phone: s?.phone ? prettyPhone(s.phone) : '', contact: s?.contact || '', email: s?.email || '', kra_pin: s?.kra_pin || '', terms_days: s?.terms_days ?? 0, address: s?.address || '', notes: s?.notes || '' });
  const [err, setErr] = useState({});
  const [more, setMore] = useState(!!(s?.email || s?.kra_pin || s?.address || s?.notes));
  const set = (p) => setF({ ...f, ...p });
  const terms = [0, 7, 14, 30].includes(Number(f.terms_days)) ? String(f.terms_days) : 'x';
  const go = async () => {
    const e = {};
    if (!f.name.trim()) e.name = t('Enter the supplier’s name');
    const ph = f.phone.trim() ? normPhone(f.phone) : '';
    if (f.phone.trim() && !ph) e.phone = t('Enter a valid Kenyan phone number, e.g. 0722 123 456');
    if (!e.name) {
      const dup = (await db().suppliers.toArray()).find((x) => !x.deleted && x.id !== s?.id && (x.name.trim().toLowerCase() === f.name.trim().toLowerCase() || (ph && x.phone === ph)));
      if (dup) e.name = t('{name} is already in your suppliers', { name: dup.name });
    }
    setErr(e);
    if (Object.keys(e).length) return;
    const rec = await saveSupplier({ ...(s || {}), ...f, name: f.name.trim(), phone: ph, terms_days: Math.max(0, parseInt(f.terms_days) || 0) });
    toast(s ? t('Supplier saved') : t('Supplier {name} added', { name: rec.name }));
    close(rec);
  };
  return (
    <Modal title={s ? t('Edit supplier') : t('Add supplier')} icon="store" onClose={() => close(null)}
      footer={<><Btn onClick={() => close(null)}>{t('Cancel')}</Btn><Btn variant="primary" icon="check" onClick={go}>{t('Save supplier')}</Btn></>}>
      <form class="form-grid" onSubmit={(e) => { e.preventDefault(); go(); }}>
        <Input class="full" label={t('Supplier name')} value={f.name} onValue={(v) => set({ name: v })} error={err.name} placeholder={t('e.g. Bidco Africa')} />
        <Input label={t('Phone (WhatsApp)')} value={f.phone} onValue={(v) => set({ phone: v })} error={err.phone} inputMode="tel" placeholder="0722 123 456" />
        <Input label={t('Contact person')} value={f.contact} onValue={(v) => set({ contact: v })} placeholder={t('e.g. sales rep name')} />
        <div class="field full"><label>{t('When do you pay them?')}</label>
          <Seg value={terms} onValue={(v) => set({ terms_days: v === 'x' ? 45 : Number(v) })} options={[{ value: '0', label: t('On delivery') }, { value: '7', label: t('7 days') }, { value: '14', label: t('14 days') }, { value: '30', label: t('30 days') }, { value: 'x', label: t('Other') }]} />
          {terms === 'x' && <Input class="mt" label={t('Days to pay')} type="number" value={f.terms_days} onValue={(v) => set({ terms_days: v })} />}
        </div>
        {!more && <button type="button" class="more-toggle full" onClick={() => setMore(true)}>{t('More options')}<span class="small mute" style={{ fontWeight: 500 }}>— {t('email, KRA PIN, address, notes')}</span></button>}
        {more && <>
          <Input label={t('Email')} type="email" value={f.email} onValue={(v) => set({ email: v })} />
          <Input label={t('KRA PIN')} value={f.kra_pin} onValue={(v) => set({ kra_pin: v.toUpperCase() })} placeholder="P051234567X" />
          <Input class="full" label={t('Address')} value={f.address} onValue={(v) => set({ address: v })} />
          <Textarea class="full" label={t('Notes')} value={f.notes} onValue={(v) => set({ notes: v })} rows={2} />
        </>}
        <button type="submit" class="sr" tabIndex={-1}>{t('Save')}</button>
      </form>
    </Modal>
  );
}
