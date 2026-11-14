// Setup wizard: business & logo → KRA/VAT → branch → receipt & M-Pesa → payment methods → staff → products → printer test → done.
import { useState, useEffect } from 'preact/hooks';
import * as S from '../state.js';
import { saveBusiness, finishSetup } from '../auth/session.js';
import { save } from '../db/repo.js';
import { Btn, Icon, Input, Select, Switch, Seg, Badge, Avatar, Textarea } from '../ui/kit.jsx';
import { toast } from '../ui/overlay.jsx';
import { compressImage, normPhone, prettyPhone } from '../lib/util.js';
import { printHtml } from '../print/print.js';
import { testPageHtml } from '../print/templates.js';
import { addTemplateCatalogue } from '../presets/seed.js';
import { typeById } from '../presets/types.js';
import { catalog } from '../db/catalog.js';
import { editUser } from '../modules/settings/panels/staff.jsx';
import { COUNTIES } from '../modules/settings/panels/general.jsx';
import { ROLE_LABELS } from '../auth/permissions.js';
import { t } from '../i18n/index.js';

const STEPS = ['Business', 'Tax & KRA', 'Branch', 'Receipt & M-Pesa', 'Payments', 'Staff', 'Products', 'Printer', 'Done'];

export default function Wizard() {
  const [i, setI] = useState(0);
  const b = S.business.value;
  const st = S.settings.value;
  const br = S.branch.value;
  const [f, setF] = useState({
    name: b.name, phone: prettyPhone(b.phone), email: b.email || '', address: b.address || '', town: b.town || '', county: b.county || 'Nairobi', logo: b.logo || '',
    kra_pin: b.kra_pin || '', vat_registered: !!b.vat_registered, vat_inclusive: st.vat_inclusive !== false,
    br_name: br?.name || '', br_code: br?.code || '', br_address: br?.address || '',
    receipt_width: st.receipt_width || 80, receipt_footer: st.receipt_footer, mpesa_type: st.mpesa_type || 'till', mpesa_till: st.mpesa_till || '', mpesa_paybill: st.mpesa_paybill || '', mpesa_account: st.mpesa_account || '',
    pay_mpesa: st.pay_mpesa, pay_card: st.pay_card, pay_bank: st.pay_bank, pay_credit: st.pay_credit, pay_points: st.pay_points
  });
  const [products, setProducts] = useState(catalog.value.products.length);
  const set = (p) => setF({ ...f, ...p });
  useEffect(() => setProducts(catalog.value.products.length), [catalog.value.version]);
  const next = async () => {
    try {
      if (i === 0) {
        if (!f.name.trim()) return toast.error(t('Enter the business name'));
        await saveBusiness({ name: f.name.trim(), phone: normPhone(f.phone), email: f.email, address: f.address, town: f.town, county: f.county, logo: f.logo }, 'setup.business');
      }
      if (i === 1) {
        if (f.kra_pin && !/^[AP]\d{9}[A-Z]$/i.test(f.kra_pin)) return toast.error(t('KRA PIN looks wrong — e.g. P051234567K'));
        await saveBusiness({ kra_pin: f.kra_pin.toUpperCase(), vat_registered: f.vat_registered, settings: { vat_inclusive: f.vat_inclusive, tax_reviewed: true } }, 'setup.tax');
      }
      if (i === 2) {
        const r = await save('branches', { ...br, name: f.br_name || 'Main branch', code: (f.br_code || 'MAI').toUpperCase().slice(0, 4), address: f.br_address });
        S.branch.value = r; S.branches.value = S.branches.value.map((x) => (x.id === r.id ? r : x));
      }
      if (i === 3) await saveBusiness({ settings: { receipt_width: f.receipt_width, receipt_footer: f.receipt_footer, mpesa_type: f.mpesa_type, mpesa_till: f.mpesa_till, mpesa_paybill: f.mpesa_paybill, mpesa_account: f.mpesa_account } }, 'setup.receipt');
      if (i === 4) await saveBusiness({ settings: { pay_mpesa: f.pay_mpesa, pay_card: f.pay_card, pay_bank: f.pay_bank, pay_credit: f.pay_credit, pay_points: f.pay_points } }, 'setup.payments');
      setI(Math.min(STEPS.length - 1, i + 1));
    } catch (e) { toast.error(e.message); }
  };
  const tp = typeById(b.type);
  return (
    <div class="wizard">
      <aside class="steps" aria-label={t('Setup steps')}>
        <div class="row" style={{ marginBottom: '18px' }}><img src="/pos/brand/pentarch-mark.svg" alt="" width="34" height="34" /><b class="desk-only" style={{ color: '#fff', font: '800 18px var(--f-head)' }}>{t('Set up')}</b></div>
        {STEPS.map((s, k) => <div class={'step' + (k === i ? ' on' : k < i ? ' done' : '')}><i>{k < i ? <Icon name="check" size={14} stroke={3} /> : k + 1}</i><span>{t(s)}</span></div>)}
        <div class="spacer" />
        <button class="btn ghost sm desk-only" style={{ color: '#aab5cf' }} onClick={finishSetup}>{t('Skip setup for now')}</button>
      </aside>
      <main class="body">
        <div class="inner">
          <div class="small mute bold" style={{ textTransform: 'uppercase', letterSpacing: '.08em' }}>{t('Step {a} of {b}', { a: i + 1, b: STEPS.length })}</div>
          {i === 0 && <>
            <h1 class="mb">{t('Your business')}</h1>
            <div class="row start gap-l" style={{ flexWrap: 'wrap' }}>
              <label class="img-drop" style={{ width: '140px', flex: 'none' }}>
                {f.logo ? <img src={f.logo} alt="" style={{ objectFit: 'contain' }} /> : <span class="center small"><Icon name="image" size={26} style={{ margin: '0 auto 6px' }} />{t('Add logo')}</span>}
                <input type="file" accept="image/*" class="sr" onChange={async (e) => { const fl = e.target.files?.[0]; if (fl) set({ logo: await compressImage(fl, { max: 360, maxBytes: 60000 }) }); }} />
              </label>
              <div class="form-grid grow">
                <Input class="span2" label={t('Business name')} value={f.name} onValue={(v) => set({ name: v })} />
                <Input label={t('Phone')} value={f.phone} onValue={(v) => set({ phone: v })} />
                <Input label={t('Email')} value={f.email} onValue={(v) => set({ email: v })} />
                <Input class="span2" label={t('Street / building')} value={f.address} onValue={(v) => set({ address: v })} />
                <Input label={t('Town')} value={f.town} onValue={(v) => set({ town: v })} />
                <Select label={t('County')} value={f.county} onValue={(v) => set({ county: v })} options={COUNTIES} />
              </div>
            </div>
          </>}
          {i === 1 && <>
            <h1 class="mb">{t('KRA PIN & VAT')}</h1>
            <div class="form-grid mb"><Input label={t('KRA PIN')} value={f.kra_pin} onValue={(v) => set({ kra_pin: v.toUpperCase() })} inputClass="mono" placeholder="P051234567K" hint={t('Printed on receipts and invoices')} /></div>
            <div class="card pad">
              <div class="set-row"><div class="d"><b>{t('VAT registered')}</b><small>{t('Most small shops are not. You can change this later.')}</small></div><Switch checked={f.vat_registered} onChange={(v) => set({ vat_registered: v })} /></div>
              {f.vat_registered && <div class="set-row"><div class="d"><b>{t('Prices include VAT')}</b></div><Switch checked={f.vat_inclusive} onChange={(v) => set({ vat_inclusive: v })} /></div>}
            </div>
          </>}
          {i === 2 && <>
            <h1 class="mb">{t('Your branch')}</h1>
            <p class="mute">{t('Receipt numbers start with the branch code, e.g. {c}1-000001.', { c: (f.br_code || 'MAI').toUpperCase() })}</p>
            <div class="form-grid"><Input label={t('Branch name')} value={f.br_name} onValue={(v) => set({ br_name: v })} /><Input label={t('Code (3 letters)')} value={f.br_code} onValue={(v) => set({ br_code: v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) })} inputClass="mono" /><Input class="span2" label={t('Address')} value={f.br_address} onValue={(v) => set({ br_address: v })} /></div>
          </>}
          {i === 3 && <>
            <h1 class="mb">{t('Receipt & M-Pesa')}</h1>
            <div class="card pad col">
              <div class="set-row"><div class="d"><b>{t('Receipt paper width')}</b></div><Seg value={+f.receipt_width} onValue={(v) => set({ receipt_width: v })} options={[{ value: 58, label: '58 mm' }, { value: 80, label: '80 mm' }]} /></div>
              <Textarea label={t('Footer message')} value={f.receipt_footer} onValue={(v) => set({ receipt_footer: v })} rows={2} />
              <div class="row"><b class="grow">M-Pesa</b><Seg value={f.mpesa_type} onValue={(v) => set({ mpesa_type: v })} options={[{ value: 'till', label: t('Buy Goods (Till)') }, { value: 'paybill', label: t('Paybill') }]} /></div>
              <div class="form-grid">{f.mpesa_type === 'till' ? <Input label={t('Till number')} value={f.mpesa_till} onValue={(v) => set({ mpesa_till: v.replace(/\D/g, '') })} inputClass="mono" /> : <><Input label={t('Paybill number')} value={f.mpesa_paybill} onValue={(v) => set({ mpesa_paybill: v.replace(/\D/g, '') })} inputClass="mono" /><Input label={t('Account number to use')} value={f.mpesa_account} onValue={(v) => set({ mpesa_account: v })} /></>}</div>
            </div>
          </>}
          {i === 4 && <>
            <h1 class="mb">{t('How customers pay')}</h1>
            <div class="card pad">
              <div class="set-row"><div class="d"><b>{t('Cash')}</b></div><Switch checked disabled /></div>
              {[['pay_mpesa', 'M-Pesa'], ['pay_card', 'Card (PDQ)'], ['pay_bank', 'Bank transfer'], ['pay_credit', 'Credit (on account)'], ['pay_points', 'Loyalty points']].map(([k, l]) => <div class="set-row"><div class="d"><b>{t(l)}</b></div><Switch checked={f[k]} onChange={(v) => set({ [k]: v })} /></div>)}
            </div>
          </>}
          {i === 5 && <>
            <h1 class="mb">{t('Staff & PINs')}</h1>
            <p class="mute">{t('Give each person their own PIN. Cashiers can sell; managers can approve discounts and voids.')}</p>
            <div class="card">{S.users.value.map((u) => <div class="list-item"><Avatar name={u.name} /><b class="grow">{u.name}</b><Badge>{t(ROLE_LABELS[u.role])}</Badge><Btn size="sm" icon="edit" onClick={() => editUser(u)}>{t('Edit')}</Btn></div>)}</div>
            <Btn icon="user-plus" class="mt" variant="navy" onClick={() => editUser()}>{t('Add staff')}</Btn>
          </>}
          {i === 6 && <>
            <h1 class="mb">{t('Your products')}</h1>
            <p class="mute">{t('{n} products so far. Choose how to start — you can mix all of them.', { n: products })}</p>
            <div class="grid2">
              <button class="type-tile" onClick={async () => { const n = await addTemplateCatalogue(b.type); toast(t('{n} products added', { n })); }}><span class="ti" style={{ background: tp.color }}><Icon name="layers" /></span><span><b>{t('Use the template catalogue')}</b><small>{t('Typical {type} products with prices — edit later', { type: t(tp.label).toLowerCase() })}</small></span></button>
              <a class="type-tile" href="#/products/import" onClick={() => finishSetup().then(() => (location.hash = '#/products/import'))} style={{ textDecoration: 'none' }}><span class="ti" style={{ background: 'var(--navy)' }}><Icon name="upload" /></span><span><b>{t('Import from Excel / CSV')}</b><small>{t('Bring your existing list')}</small></span></a>
              <button class="type-tile" onClick={() => finishSetup().then(() => (location.hash = '#/products/new'))}><span class="ti" style={{ background: 'var(--teal-d)' }}><Icon name="plus" /></span><span><b>{t('Add products one by one')}</b><small>{t('Scan the barcode to fill it in')}</small></span></button>
              <button class="type-tile" onClick={() => finishSetup().then(() => (location.hash = '#/sell'))}><span class="ti" style={{ background: 'var(--coral-d)' }}><Icon name="scan" /></span><span><b>{t('Scan to add while selling')}</b><small>{t('Unknown barcodes offer “Add product”')}</small></span></button>
            </div>
          </>}
          {i === 7 && <>
            <h1 class="mb">{t('Test your printer')}</h1>
            <p class="mute">{t('Connect the receipt printer and set it as the default printer. Then print a test page.')}</p>
            <div class="row wrap gap-s">
              <Btn variant="navy" icon="print" onClick={async () => { await printHtml(await testPageHtml({ business: S.business.value, branch: S.branch.value, settings: S.settings.value }, S.settings.value.receipt_width || 80)); await saveBusiness({ settings: { printer_tested: true } }); }}>{t('Print test page')}</Btn>
              <span class="mute small">{t('No printer yet? Skip — receipts can also go by WhatsApp.')}</span>
            </div>
          </>}
          {i === 8 && <div class="center" style={{ padding: '30px 0' }}>
            <div class="done-hero"><div class="tick"><Icon name="check" size={40} stroke={3} /></div></div>
            <h1>{t('You are ready to sell')}</h1>
            <p class="mute" style={{ maxWidth: '460px', margin: '10px auto 24px' }}>{t('Your checklist on the home screen shows what is left. Press F2 anywhere to start selling.')}</p>
            <Btn variant="primary" size="lg" icon="cart" onClick={finishSetup}>{t('Go to Pentarch POS')}</Btn>
          </div>}
          {i < STEPS.length - 1 && (
            <div class="row mt-l">
              {i > 0 && <Btn icon="arrow-left" onClick={() => setI(i - 1)}>{t('Back')}</Btn>}
              <span class="spacer" />
              <Btn variant="primary" size="lg" onClick={next}>{i === STEPS.length - 2 ? t('Finish') : t('Continue')}<Icon name="arrow-right" /></Btn>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
