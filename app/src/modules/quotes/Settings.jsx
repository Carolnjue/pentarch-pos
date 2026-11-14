// Settings → Quotes & invoices: validity, payment terms, bank details, default terms, footer.
import { useState } from 'preact/hooks';
import { Textarea, Icon } from '../../ui/kit.jsx';
import { toast } from '../../ui/overlay.jsx';
import { saveBusiness } from '../../auth/session.js';
import { Panel, Row } from '../settings/panels/general.jsx';
import * as S from '../../state.js';
import { t } from '../../i18n/index.js';

export default function QuotesSettings() {
  const st = S.settings.value;
  const [f, setF] = useState({ quote_valid_days: st.quote_valid_days || 14, invoice_terms_days: st.invoice_terms_days ?? 30, bank_details: st.bank_details || '', quote_terms: st.quote_terms || '', invoice_footer: st.invoice_footer || '' });
  const set = (p) => setF({ ...f, ...p });
  const save = async () => { await saveBusiness({ settings: { ...f, quote_valid_days: Math.max(1, +f.quote_valid_days || 14), invoice_terms_days: Math.max(0, +f.invoice_terms_days || 0) } }); toast(t('Saved')); };
  const mp = st.mpesa_type === 'paybill' && st.mpesa_paybill ? `M-Pesa Paybill ${st.mpesa_paybill}` : st.mpesa_till ? `M-Pesa Till ${st.mpesa_till}` : '';
  return (
    <Panel title={t('Quotes & invoices')} sub={t('What prints on quotations, invoices and delivery notes')} onSave={save}>
      <Row title={t('Quotes are valid for (days)')}><input class="input mono num" style={{ width: '90px' }} inputMode="numeric" value={f.quote_valid_days} aria-label={t('Quotes are valid for (days)')} onInput={(e) => set({ quote_valid_days: e.target.value })} /></Row>
      <Row title={t('Invoice payment terms (days)')} sub={t('Due date = invoice date + these days. 0 = due on receipt')}><input class="input mono num" style={{ width: '90px' }} inputMode="numeric" value={f.invoice_terms_days} aria-label={t('Invoice payment terms (days)')} onInput={(e) => set({ invoice_terms_days: e.target.value })} /></Row>
      <div class="set-row"><div class="d"><b>{t('M-Pesa on invoices')}</b><small>{mp ? t('Invoices show {mp}. Change it in Payments & M-Pesa.', { mp }) : t('Add your till or paybill in Payments & M-Pesa so it shows on invoices.')}</small></div><a class="btn sm" href="#/settings/payments"><Icon name="wallet" size={16} />{t('Payments')}</a></div>
      <div class="col" style={{ paddingTop: '12px' }}>
        <Textarea label={t('Bank details for invoices')} value={f.bank_details} onValue={(v) => set({ bank_details: v })} rows={3} placeholder={t('e.g. Equity Bank, Thika branch · Acc 0123 4567 8901 · Name: Jenga Hardware Ltd')} />
        <Textarea label={t('Standard terms on quotes')} value={f.quote_terms} onValue={(v) => set({ quote_terms: v })} rows={2} placeholder={t('e.g. Prices include VAT. Delivery within 48 hours of payment.')} />
        <Textarea label={t('Footer on invoices')} value={f.invoice_footer} onValue={(v) => set({ invoice_footer: v })} rows={2} placeholder={t('e.g. Thank you for your business.')} />
      </div>
    </Panel>
  );
}
