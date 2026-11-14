import { useState } from 'preact/hooks';
import { Btn, Input, Select, Switch, MoneyInput, Icon, Badge, Textarea, Seg } from '../../../ui/kit.jsx';
import { toast, confirm } from '../../../ui/overlay.jsx';
import { saveBusiness } from '../../../auth/session.js';
import { can } from '../../../auth/permissions.js';
import { compressImage, normPhone, prettyPhone } from '../../../lib/util.js';
import { TAX_CODES } from '../../../lib/tax.js';
import { printHtml } from '../../../print/print.js';
import { testPageHtml } from '../../../print/templates.js';
import { BUSINESS_TYPES, MODULE_INFO, ALL_MODULES, typeById } from '../../../presets/types.js';
import { LABEL_PRESETS } from '../../../print/labels.js';
import { setLang, LANGS } from '../../../i18n/index.js';
import * as S from '../../../state.js';
import { t } from '../../../i18n/index.js';

const COUNTIES = ['Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu', 'Garissa', 'Homa Bay', 'Isiolo', 'Kajiado', 'Kakamega', 'Kericho', 'Kiambu', 'Kilifi', 'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui', 'Kwale', 'Laikipia', 'Lamu', 'Machakos', 'Makueni', 'Mandera', 'Marsabit', 'Meru', 'Migori', 'Mombasa', "Murang'a", 'Nairobi', 'Nakuru', 'Nandi', 'Narok', 'Nyamira', 'Nyandarua', 'Nyeri', 'Samburu', 'Siaya', 'Taita-Taveta', 'Tana River', 'Tharaka-Nithi', 'Trans Nzoia', 'Turkana', 'Uasin Gishu', 'Vihiga', 'Wajir', 'West Pokot'];
export { COUNTIES };

export function Panel({ title, sub, children, onSave, dirty = true, extra }) {
  const edit = can('settings.edit');
  return (
    <div class="card">
      <div class="card-h"><div class="grow"><h3>{title}</h3>{sub && <div class="small mute" style={{ marginTop: '2px' }}>{sub}</div>}</div>{extra}{onSave && edit && <Btn variant="primary" icon="check" onClick={onSave} disabled={!dirty}>{t('Save')}</Btn>}</div>
      <fieldset disabled={!edit} style={{ border: 0, margin: 0, padding: 0 }}><div class="card-b">{children}</div></fieldset>
    </div>
  );
}
export const Row = ({ title, sub, children }) => <div class="set-row"><div class="d"><b>{title}</b>{sub && <small>{sub}</small>}</div>{children}</div>;
function useSettings(keys) {
  const st = S.settings.value;
  const [f, setF] = useState(Object.fromEntries(keys.map((k) => [k, st[k]])));
  const save = async (extra = {}) => { await saveBusiness({ settings: { ...f, ...extra } }); toast(t('Saved')); };
  return [f, (p) => setF({ ...f, ...p }), save];
}

export function BusinessPanel() {
  const b = S.business.value;
  const [f, setF] = useState({ name: b.name, phone: prettyPhone(b.phone), email: b.email || '', address: b.address || '', town: b.town || '', county: b.county || '', logo: b.logo || '' });
  const set = (p) => setF({ ...f, ...p });
  const go = async () => {
    if (!f.name.trim()) return toast.error(t('Enter the business name'));
    if (f.phone && !normPhone(f.phone)) return toast.error(t('Enter a valid Kenyan phone number'));
    await saveBusiness({ ...f, name: f.name.trim(), phone: normPhone(f.phone) }, 'business.update');
    toast(t('Saved'));
  };
  return (
    <Panel title={t('Business profile')} sub={t('Shown on receipts, invoices and statements.')} onSave={go}>
      <div class="row start gap-l" style={{ flexWrap: 'wrap' }}>
        <label class="img-drop" style={{ width: '150px', flex: 'none' }} title={t('Logo')}>
          {f.logo ? <img src={f.logo} alt="" style={{ objectFit: 'contain', background: '#fff' }} /> : <span class="center small"><Icon name="image" size={28} style={{ margin: '0 auto 6px' }} />{t('Add logo')}</span>}
          <input type="file" accept="image/*" class="sr" onChange={async (e) => { const fl = e.target.files?.[0]; if (fl) set({ logo: await compressImage(fl, { max: 360, maxBytes: 60000 }) }); }} />
        </label>
        <div class="form-grid grow">
          <Input class="span2" label={t('Business name')} value={f.name} onValue={(v) => set({ name: v })} />
          <Input label={t('Phone')} type="tel" value={f.phone} onValue={(v) => set({ phone: v })} />
          <Input label={t('Email')} type="email" value={f.email} onValue={(v) => set({ email: v })} />
          <Input class="span2" label={t('Street / building')} value={f.address} onValue={(v) => set({ address: v })} />
          <Input label={t('Town')} value={f.town} onValue={(v) => set({ town: v })} />
          <Select label={t('County')} value={f.county} onValue={(v) => set({ county: v })} options={[{ value: '', label: '—' }, ...COUNTIES]} />
        </div>
      </div>
      {f.logo && <Btn size="sm" variant="ghost" icon="trash" onClick={() => set({ logo: '' })}>{t('Remove logo')}</Btn>}
    </Panel>
  );
}

export function TaxPanel() {
  const b = S.business.value;
  const [f, setF] = useState({ kra_pin: b.kra_pin || '', vat_registered: !!b.vat_registered, vat_inclusive: S.settings.value.vat_inclusive !== false, default_tax: S.settings.value.default_tax || 'B', etims_enabled: !!S.settings.value.etims_enabled });
  const set = (p) => setF({ ...f, ...p });
  const pinOk = !f.kra_pin || /^[AP]\d{9}[A-Z]$/i.test(f.kra_pin);
  const go = async () => {
    if (!pinOk) return toast.error(t('KRA PIN looks wrong — e.g. P051234567K'));
    await saveBusiness({ kra_pin: f.kra_pin.toUpperCase(), vat_registered: f.vat_registered, settings: { vat_inclusive: f.vat_inclusive, default_tax: f.default_tax, etims_enabled: f.etims_enabled, tax_reviewed: true } }, 'settings.tax');
    toast(t('Saved'));
  };
  return (
    <Panel title={t('Tax & KRA')} sub={t('VAT is worked out per item using the KRA eTIMS tax codes.')} onSave={go}>
      <div class="form-grid mb">
        <Input label={t('KRA PIN')} value={f.kra_pin} onValue={(v) => set({ kra_pin: v.toUpperCase() })} inputClass="mono" placeholder="P051234567K" error={!pinOk ? t('Format: letter, 9 digits, letter') : ''} />
        <Select label={t('Default tax code for new products')} value={f.default_tax} onValue={(v) => set({ default_tax: v })} options={Object.values(TAX_CODES).map((x) => ({ value: x.code, label: `${x.code} — ${t(x.label)}` }))} />
      </div>
      <Row title={t('VAT registered')} sub={t('Show VAT on receipts and calculate VAT per tax code')}><Switch checked={f.vat_registered} onChange={(v) => set({ vat_registered: v })} /></Row>
      <Row title={t('Prices include VAT')} sub={t('Recommended for shops. Turn off to add VAT on top of prices.')}><Switch checked={f.vat_inclusive} onChange={(v) => set({ vat_inclusive: v })} /></Row>
      <Row title={t('KRA eTIMS block on receipts')} sub={t('Shows the eTIMS invoice number once your eTIMS integration signs the sale')}><Switch checked={f.etims_enabled} onChange={(v) => set({ etims_enabled: v })} /></Row>
      <div class="card mt" style={{ background: 'var(--paper)', border: 0 }}>
        <table class="table" style={{ background: 'transparent' }}><thead><tr><th>{t('Code')}</th><th>{t('Meaning')}</th><th class="num">{t('Rate')}</th><th>{t('Typical items')}</th></tr></thead>
          <tbody>{[['A', 'Unprocessed food, medicines, maize flour, milk'], ['B', 'Most goods and services'], ['C', 'Exports and zero-rated supplies'], ['D', 'Airtime, deposits, non-VAT items'], ['E', 'Petroleum products']].map(([c, ex]) => <tr><td class="mono bold">{c}</td><td>{t(TAX_CODES[c].label)}</td><td class="num mono">{TAX_CODES[c].rate}%</td><td class="small mute">{t(ex)}</td></tr>)}</tbody></table>
      </div>
    </Panel>
  );
}

export function PrintingPanel() {
  const [f, set, save] = useSettings(['receipt_width', 'auto_print', 'print_copies', 'label_preset', 'kitchen_stations']);
  const test = async (paper) => {
    await printHtml(await testPageHtml({ business: S.business.value, branch: S.branch.value, settings: S.settings.value }, paper));
    await saveBusiness({ settings: { printer_tested: true } });
  };
  return (
    <Panel title={t('Printing')} sub={t('Works with any receipt printer installed on this computer or phone (USB, Bluetooth or network).')} onSave={() => save({ print_copies: +f.print_copies || 1 })}>
      <Row title={t('Receipt paper width')}><Seg value={+f.receipt_width} onValue={(v) => set({ receipt_width: v })} options={[{ value: 58, label: '58 mm' }, { value: 80, label: '80 mm' }]} /></Row>
      <Row title={t('Print receipt automatically')} sub={t('After every sale')}><Switch checked={f.auto_print} onChange={(v) => set({ auto_print: v })} /></Row>
      <Row title={t('Copies per receipt')}><input class="input mono num" style={{ width: '80px' }} type="number" min="1" max="3" value={f.print_copies} aria-label={t('Copies')} onInput={(e) => set({ print_copies: e.target.value })} /></Row>
      <Row title={t('Default label size')}><select class="input" style={{ width: 'auto' }} value={f.label_preset} aria-label={t('Label size')} onChange={(e) => set({ label_preset: e.target.value })}>{Object.entries(LABEL_PRESETS).map(([k, v]) => <option value={k}>{v.name}</option>)}</select></Row>
      <Row title={t('Kitchen / bar stations')} sub={t('Comma separated, used for kitchen tickets')}><input class="input" style={{ maxWidth: '260px' }} value={(f.kitchen_stations || []).join(', ')} aria-label={t('Stations')} onInput={(e) => set({ kitchen_stations: e.target.value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) })} /></Row>
      <div class="callout mt"><Icon name="info" size={18} /><div>
        <b>{t('Silent printing')}</b>
        <div class="small">{t('For one-tap printing without the print dialog, set the receipt printer as the default printer and start Chrome with --kiosk-printing (Pentarch installs this for you).')}</div>
      </div></div>
      <div class="row wrap gap-s mt"><Btn icon="print" variant="navy" onClick={() => test(58)}>{t('Print test page (58 mm)')}</Btn><Btn icon="print" variant="navy" onClick={() => test(80)}>{t('Print test page (80 mm)')}</Btn><Btn icon="print" onClick={() => test('a4')}>{t('Test A4 printer')}</Btn></div>
    </Panel>
  );
}

export function PaymentsPanel() {
  const [f, set, save] = useSettings(['pay_cash', 'pay_mpesa', 'pay_card', 'pay_bank', 'pay_credit', 'pay_points', 'mpesa_type', 'mpesa_till', 'mpesa_paybill', 'mpesa_account', 'mpesa_stk', 'quick_cash']);
  const go = () => {
    if (f.pay_mpesa && f.mpesa_type === 'till' && f.mpesa_till && !/^\d{5,7}$/.test(f.mpesa_till)) return toast.error(t('Till numbers have 5–7 digits'));
    if (f.pay_mpesa && f.mpesa_type === 'paybill' && f.mpesa_paybill && !/^\d{5,7}$/.test(f.mpesa_paybill)) return toast.error(t('Paybill numbers have 5–7 digits'));
    save({ pay_cash: true });
  };
  return (
    <Panel title={t('Payments & M-Pesa')} sub={t('Choose how customers can pay. Your M-Pesa number prints on every receipt.')} onSave={go}>
      {[['pay_cash', 'Cash', 'cash'], ['pay_mpesa', 'M-Pesa', 'phone'], ['pay_card', 'Card (PDQ)', 'card'], ['pay_bank', 'Bank transfer', 'bank'], ['pay_credit', 'Credit (on account)', 'credit'], ['pay_points', 'Loyalty points', 'star']].map(([k, l, i]) => (
        <Row title={<span class="row gap-s"><Icon name={i} size={18} />{t(l)}</span>}><Switch checked={k === 'pay_cash' ? true : f[k]} disabled={k === 'pay_cash'} onChange={(v) => set({ [k]: v })} /></Row>
      ))}
      {f.pay_mpesa && (
        <div class="card pad mt" style={{ background: 'var(--teal-50)', borderColor: '#bfe6e4' }}>
          <div class="row mb"><h4 class="grow">M-Pesa</h4><Seg value={f.mpesa_type} onValue={(v) => set({ mpesa_type: v })} options={[{ value: 'till', label: t('Buy Goods (Till)') }, { value: 'paybill', label: t('Paybill') }]} /></div>
          <div class="form-grid">
            {f.mpesa_type === 'till' ? <Input label={t('Till number')} value={f.mpesa_till} onValue={(v) => set({ mpesa_till: v.replace(/\D/g, '') })} inputClass="mono" />
              : <><Input label={t('Paybill number')} value={f.mpesa_paybill} onValue={(v) => set({ mpesa_paybill: v.replace(/\D/g, '') })} inputClass="mono" /><Input label={t('Account number to use')} value={f.mpesa_account} onValue={(v) => set({ mpesa_account: v })} hint={t('e.g. your shop name or “receipt number”')} /></>}
          </div>
          <div class="set-row"><div class="d"><b>{t('Send STK push to the customer’s phone')}</b><small>{t('Needs internet and Daraja keys set up by Pentarch on your cloud account. Without it, cashiers type the M-Pesa code.')}</small></div><Switch checked={f.mpesa_stk} onChange={(v) => set({ mpesa_stk: v })} /></div>
        </div>
      )}
      <div class="field mt"><label>{t('Quick cash buttons (KES)')}</label><input class="input mono" value={(f.quick_cash || []).join(', ')} aria-label={t('Quick cash buttons')} onInput={(e) => set({ quick_cash: e.target.value.split(',').map((x) => parseInt(x)).filter((x) => x > 0) })} /></div>
    </Panel>
  );
}

export function SellingPanel() {
  const [f, set, save] = useSettings(['allow_below_cost', 'allow_negative_stock', 'require_shift', 'rounding', 'wholesale_auto_qty', 'sound_on_scan', 'tips_enabled', 'service_charge_pct', 'auto_lock_min', 'weight_prefix', 'price_prefix']);
  return (
    <Panel title={t('Selling options')} onSave={() => save({ service_charge_pct: +f.service_charge_pct || 0, auto_lock_min: +f.auto_lock_min || 0 })}>
      <Row title={t('Require an open shift to sell')} sub={t('Cashiers must count the float first')}><Switch checked={f.require_shift} onChange={(v) => set({ require_shift: v })} /></Row>
      <Row title={t('Allow selling when stock is zero')} sub={t('Off = manager approval needed')}><Switch checked={f.allow_negative_stock} onChange={(v) => set({ allow_negative_stock: v })} /></Row>
      <Row title={t('Allow selling below cost')} sub={t('Off = owner approval needed')}><Switch checked={f.allow_below_cost} onChange={(v) => set({ allow_below_cost: v })} /></Row>
      <Row title={t('Round totals to the nearest shilling')}><Switch checked={f.rounding} onChange={(v) => set({ rounding: v })} /></Row>
      {S.modulesOn.value.wholesale && <Row title={t('Wholesale price from quantity automatically')} sub={t('Uses each product’s “wholesale from quantity”')}><Switch checked={f.wholesale_auto_qty} onChange={(v) => set({ wholesale_auto_qty: v })} /></Row>}
      <Row title={t('Beep when scanning')}><Switch checked={f.sound_on_scan} onChange={(v) => set({ sound_on_scan: v })} /></Row>
      <Row title={t('Service charge %')} sub={t('Added to every sale (restaurants, hotels). 0 = off')}><input class="input mono num" style={{ width: '90px' }} value={f.service_charge_pct} aria-label={t('Service charge %')} onInput={(e) => set({ service_charge_pct: e.target.value })} /></Row>
      <Row title={t('Lock the till after minutes idle')} sub={t('0 = never')}><input class="input mono num" style={{ width: '90px' }} value={f.auto_lock_min} aria-label={t('Minutes')} onInput={(e) => set({ auto_lock_min: e.target.value })} /></Row>
      {S.modulesOn.value.weights && <Row title={t('Scale barcode prefixes')} sub={t('Weight-embedded / price-embedded EAN-13 (2 digits each)')}><div class="row gap-s"><input class="input mono" style={{ width: '70px' }} value={f.weight_prefix} aria-label={t('Weight prefix')} onInput={(e) => set({ weight_prefix: e.target.value.slice(0, 2) })} /><input class="input mono" style={{ width: '70px' }} value={f.price_prefix} aria-label={t('Price prefix')} onInput={(e) => set({ price_prefix: e.target.value.slice(0, 2) })} /></div></Row>}
    </Panel>
  );
}

export function ModulesPanel() {
  const [mods, setMods] = useState({ ...S.modulesOn.value });
  const [type, setType] = useState(S.business.value.type);
  const go = async () => { await saveBusiness({ type, modules: mods }, 'settings.modules'); toast(t('Saved — the menu has been updated')); };
  const applyType = async (id) => {
    setType(id);
    if (await confirm({ title: t('Use the recommended modules for {type}?', { type: t(typeById(id).label) }), message: t('You can still switch individual modules on or off.'), ok: t('Use recommended') })) {
      setMods(Object.fromEntries(ALL_MODULES.map((k) => [k, !!typeById(id).modules[k]])));
    }
  };
  return (
    <Panel title={t('Modules & business type')} sub={t('Switch on only what you need — the menus stay simple.')} onSave={go}>
      <Select label={t('Business type')} value={type} onValue={applyType} options={BUSINESS_TYPES.map((b) => ({ value: b.id, label: t(b.label) }))} />
      <div class="mt">{ALL_MODULES.map((k) => <Row title={<span class="row gap-s"><Icon name={MODULE_INFO[k].icon} size={18} />{t(MODULE_INFO[k].label)}</span>} sub={t(MODULE_INFO[k].desc)}><Switch checked={!!mods[k]} onChange={(v) => setMods({ ...mods, [k]: v })} /></Row>)}</div>
    </Panel>
  );
}

export function LanguagePanel() {
  const [f, set, save] = useSettings(['notify_low_stock', 'notify_expiry_days', 'notify_backup_days']);
  return (
    <div class="col gap-l">
      <Panel title={t('Language')} sub={t('Each person can switch language from the top bar at any time.')}>
        <div class="row gap-s">{LANGS.map((l) => <button class={'chip' + (S.lang.value === l.code ? ' on' : '')} style={{ height: '44px' }} onClick={() => setLang(l.code)}>{l.label}</button>)}</div>
      </Panel>
      <Panel title={t('Notifications')} onSave={() => save({ notify_expiry_days: +f.notify_expiry_days || 30, notify_backup_days: +f.notify_backup_days || 7 })}>
        <Row title={t('Low stock alerts')}><Switch checked={f.notify_low_stock} onChange={(v) => set({ notify_low_stock: v })} /></Row>
        <Row title={t('Warn about batches expiring within (days)')}><input class="input mono num" style={{ width: '90px' }} value={f.notify_expiry_days} aria-label={t('Days')} onInput={(e) => set({ notify_expiry_days: e.target.value })} /></Row>
        <Row title={t('Remind me to download a backup every (days)')}><input class="input mono num" style={{ width: '90px' }} value={f.notify_backup_days} aria-label={t('Days')} onInput={(e) => set({ notify_backup_days: e.target.value })} /></Row>
      </Panel>
    </div>
  );
}
