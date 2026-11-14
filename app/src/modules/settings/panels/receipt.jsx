// Receipt designer with live preview (uses the real receipt template on a sample sale).
import { useEffect, useState } from 'preact/hooks';
import { Btn, Input, Switch, Seg, Textarea } from '../../../ui/kit.jsx';
import { toast } from '../../../ui/overlay.jsx';
import { saveBusiness } from '../../../auth/session.js';
import { receiptHtml } from '../../../print/templates.js';
import { printHtml } from '../../../print/print.js';
import { computeCart } from '../../../core/pricing.js';
import { Panel, Row } from './general.jsx';
import * as S from '../../../state.js';
import { t } from '../../../i18n/index.js';

const KEYS = ['receipt_width', 'receipt_header', 'receipt_footer', 'receipt_show_logo', 'receipt_show_qr', 'receipt_show_barcode', 'receipt_show_cashier', 'receipt_show_tax', 'receipt_font_size'];
function sample() {
  const lines = [
    { product_id: 'x1', name: t('Brookside Milk 500ml'), qty: 2, unit: 'pc', factor: 1, price: 6500, cost: 5500, discount: 0, tax: 'A' },
    { product_id: 'x2', name: t('Kabras Sugar 1kg'), qty: 1, unit: 'pc', factor: 1, price: 18500, cost: 16000, discount: 1000, tax: 'B' },
    { product_id: 'x3', name: t('Royco Mchuzi Mix 200g'), qty: 1, unit: 'pc', factor: 1, price: 11500, cost: 9800, discount: 0, tax: 'B' }
  ];
  const c = computeCart(lines, { vatRegistered: !!S.business.value.vat_registered, rounding: true });
  return { no: (S.branch.value?.code || 'POS') + '1-000123', created_at: Date.now(), user_id: S.user.value?.id, lines: c.lines.map((l) => ({ ...l, discount: l.discount_total, line_discount: l.discount })), subtotal: c.subtotal, discount: c.discount, tax_total: c.tax_total, total: c.total, rounding: c.rounding,
    payments: [{ method: 'cash', amount: c.total, tendered: 50000 }], paid: c.total, change: 50000 - c.total, balance: 0, status: 'completed', points_earned: 0 };
}
export default function ReceiptPanel() {
  const st = S.settings.value;
  const [f, setF] = useState(Object.fromEntries(KEYS.map((k) => [k, st[k]])));
  const [footer, setFooter] = useState(S.branch.value?.receipt_footer || '');
  const [html, setHtml] = useState('');
  const set = (p) => setF({ ...f, ...p });
  useEffect(() => {
    const ctx = { business: S.business.value, branch: { ...S.branch.value, receipt_footer: '' }, settings: { ...st, ...f }, cashier: S.user.value?.name, customer: null };
    receiptHtml(sample(), ctx).then(setHtml);
  }, [f]);
  return (
    <div class="split-360">
      <Panel title={t('Receipt designer')} sub={t('Changes show in the preview straight away.')} onSave={async () => { await saveBusiness({ settings: { ...f, receipt_font_size: +f.receipt_font_size || 12 } }); toast(t('Saved')); }}>
        <Row title={t('Paper width')}><Seg value={+f.receipt_width} onValue={(v) => set({ receipt_width: v })} options={[{ value: 58, label: '58 mm' }, { value: 80, label: '80 mm' }]} /></Row>
        <Textarea label={t('Header line (under the address)')} value={f.receipt_header} onValue={(v) => set({ receipt_header: v })} rows={2} placeholder={t('e.g. Open Mon–Sat 7am–9pm')} />
        <Textarea class="mt" label={t('Footer message')} value={f.receipt_footer} onValue={(v) => set({ receipt_footer: v })} rows={2} />
        <div class="mt">
          <Row title={t('Show logo')}><Switch checked={f.receipt_show_logo} onChange={(v) => set({ receipt_show_logo: v })} /></Row>
          <Row title={t('Show QR code')} sub={t('Scan it later to find the receipt for returns')}><Switch checked={f.receipt_show_qr} onChange={(v) => set({ receipt_show_qr: v })} /></Row>
          <Row title={t('Show receipt barcode')}><Switch checked={f.receipt_show_barcode} onChange={(v) => set({ receipt_show_barcode: v })} /></Row>
          <Row title={t('Show cashier name')}><Switch checked={f.receipt_show_cashier} onChange={(v) => set({ receipt_show_cashier: v })} /></Row>
          <Row title={t('Show VAT breakdown')} sub={t('Only when VAT registered')}><Switch checked={f.receipt_show_tax} onChange={(v) => set({ receipt_show_tax: v })} /></Row>
          <Row title={t('Text size (80 mm)')}><input class="input mono num" type="number" min="10" max="15" style={{ width: '80px' }} value={f.receipt_font_size} aria-label={t('Text size')} onInput={(e) => set({ receipt_font_size: e.target.value })} /></Row>
        </div>
      </Panel>
      <div class="paper-strip" style={{ maxHeight: 'none', position: 'sticky', top: 0 }}>
        <div style={{ width: (+f.receipt_width === 58 ? 230 : 310) + 'px', margin: '0 auto', background: '#fff', boxShadow: 'var(--sh-2)', borderRadius: '4px' }}>
          <iframe title={t('Receipt preview')} srcDoc={html} sandbox="allow-same-origin" style={{ width: '100%', height: '720px', border: 0, display: 'block' }} onLoad={(e) => { try { e.target.style.height = e.target.contentDocument.documentElement.scrollHeight + 10 + 'px'; } catch {} }} />
        </div>
        <Btn class="block mt" icon="print" onClick={() => printHtml(html)}>{t('Print this sample')}</Btn>
      </div>
    </div>
  );
}
