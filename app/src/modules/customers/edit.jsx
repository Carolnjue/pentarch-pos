import { useState } from 'preact/hooks';
import { openModal, Modal, toast } from '../../ui/overlay.jsx';
import { Btn, Input, Select, MoneyInput, Textarea } from '../../ui/kit.jsx';
import { save } from '../../db/repo.js';
import { db } from '../../db/index.js';
import { normPhone, prettyPhone } from '../../lib/util.js';
import { can } from '../../auth/permissions.js';
import * as S from '../../state.js';
import { t } from '../../i18n/index.js';

export const editCustomer = (c) => openModal((close) => <Edit c={c} close={close} />);
function Edit({ c, close }) {
  const [f, setF] = useState(c ? { ...c, phone: prettyPhone(c.phone) } : { name: '', phone: '', email: '', kra_pin: '', group: 'retail', credit_limit: 0, loyalty_points: 0, notes: '', birthday: '' });
  const set = (p) => setF({ ...f, ...p });
  const go = async () => {
    if (!f.name.trim()) return toast.error(t('Enter the customer name'));
    const phone = f.phone ? normPhone(f.phone) : '';
    if (f.phone && !phone) return toast.error(t('Enter a valid Kenyan phone number'));
    if (phone) { const dup = (await db().customers.where('phone').equals(phone).toArray()).find((x) => x.id !== f.id && !x.deleted); if (dup) return toast.error(t('{name} already uses this phone', { name: dup.name })); }
    const r = await save('customers', { ...f, name: f.name.trim(), phone, kra_pin: (f.kra_pin || '').toUpperCase() }, { audit: { action: c ? 'customer.update' : 'customer.create', details: { name: f.name, credit_limit: f.credit_limit } } });
    toast(c ? t('Saved') : t('{name} added', { name: r.name }));
    close(r);
  };
  return (
    <Modal title={c ? t('Edit customer') : t('New customer')} icon="user" size="lg" onClose={() => close(null)} footer={<><Btn onClick={() => close(null)}>{t('Cancel')}</Btn><Btn variant="primary" onClick={go}>{t('Save')}</Btn></>}>
      <div class="form-grid">
        <Input label={t('Full name')} value={f.name} onValue={(v) => set({ name: v })} autoFocus />
        <Input label={t('Phone (M-Pesa)')} type="tel" value={f.phone} onValue={(v) => set({ phone: v })} placeholder="07xx xxx xxx" />
        <Input label={t('Email')} type="email" value={f.email} onValue={(v) => set({ email: v })} />
        <Input label={t('KRA PIN')} value={f.kra_pin} onValue={(v) => set({ kra_pin: v })} inputClass="mono" placeholder="A000000000X" hint={t('Needed on invoices for business customers')} />
        {S.modulesOn.value.wholesale && <Select label={t('Group')} value={f.group} onValue={(v) => set({ group: v })} options={[{ value: 'retail', label: t('Retail') }, { value: 'wholesale', label: t('Wholesale (gets wholesale prices)') }]} />}
        {S.modulesOn.value.credit !== false && <MoneyInput label={t('Credit limit')} value={f.credit_limit} onValue={(v) => set({ credit_limit: v })} disabled={!can('customers.credit_limit')} hint={t('0 = no limit set')} />}
        <Input label={t('Birthday')} type="date" value={f.birthday} onValue={(v) => set({ birthday: v })} />
        <Textarea class="full" label={t('Notes')} value={f.notes} onValue={(v) => set({ notes: v })} rows={2} />
      </div>
    </Modal>
  );
}
