import { useState } from 'preact/hooks';
import { PageHeader, Icon, Btn, Kbd } from '../../ui/kit.jsx';
import { openShortcuts } from '../../shell/Shortcuts.jsx';
import { startTour, SELL_TOUR } from '../../ui/tour.jsx';
import { navigate } from '../../router.js';
import { waLink } from '../../lib/util.js';
import * as S from '../../state.js';
import { t } from '../../i18n/index.js';

const GUIDE = [
  { id: 'sell', icon: 'cart', title: 'Selling', steps: [
    'Scan the barcode — no need to click anywhere first. Or type part of the name and press Enter.',
    'Tap a line to change quantity, unit (carton/piece), discount or price. Press * to edit the selected line.',
    'Type 3* before a search to add three at once. Weighed items ask for the kg (or read the scale barcode).',
    'Press F4 (or Enter on an empty search) to pay. Pick Cash, M-Pesa, Card, Credit or split across several.',
    'For cash, tap the note the customer gave — the change shows in big numbers.']},
  { id: 'mpesa', icon: 'phone', title: 'M-Pesa', steps: [
    'Your till or paybill shows on the payment screen and on every receipt.',
    'Type the 10-character code from the customer’s SMS (e.g. TK7AB3CD9E). The app checks the format and warns if the code was already used.',
    'If STK push is set up, enter the phone number and tap “Send STK request” — the sale completes when the customer enters their PIN.']},
  { id: 'hold', icon: 'pause', title: 'Hold & recall', steps: ['Press F8 to park a sale while you serve someone else. Give it a name.', 'Press F7 to bring it back. Held sales survive a power cut or reload.']},
  { id: 'returns', icon: 'undo', title: 'Returns, voids & reprints', steps: [
    'Open Sales & receipts, or scan the QR code on the customer’s receipt.',
    'Return items: choose quantities, whether they go back to stock, and how you refund. A return slip prints.',
    'Void cancels the whole sale and returns stock. It needs a manager and a reason — everything is logged.']},
  { id: 'shift', icon: 'clock', title: 'Cash & shifts', steps: [
    'Open a shift with the float in the drawer. Record pay-outs (transport, cleaning) and cash drops to the safe.',
    'Print an X report any time. At the end, count notes and coins — the app shows any shortage and prints the Z report.']},
  { id: 'products', icon: 'box', title: 'Products & labels', steps: [
    'Add products one by one, import a CSV/Excel list, or load the template catalogue for your business type.',
    'No barcode? Tap “Generate EAN-13” and print labels (38×25, 40×30, 50×25 mm or A4 sheets).',
    'Sell by carton and piece with units of measure; sizes and colours with variants; IMEI with serials; expiry with batches.']},
  { id: 'customers', icon: 'users', title: 'Customers & credit', steps: [
    'Attach a customer with F9 — search by phone. New customers take ten seconds to add.',
    'Credit sales go on the customer’s account. Receive payments from their profile — oldest invoices are paid first.',
    'Send a statement or a polite WhatsApp reminder with your M-Pesa details.']},
  { id: 'offline', icon: 'wifi-off', title: 'Offline & sync', steps: [
    'Pentarch POS works with no internet. Sales, stock and customers are saved on this device first.',
    'When the internet returns, everything syncs to Pentarch Cloud automatically. The pill at the top shows what is waiting.',
    'Download a backup now and then from Settings → Backup. Your data is always yours.']},
  { id: 'staff', icon: 'shield', title: 'Staff, PINs & security', steps: [
    'Each person has their own PIN. Lock the till with Ctrl+L or the Lock button when you step away.',
    'Discounts above a cashier’s limit, voids, price changes and opening the drawer need a manager PIN.',
    'The owner decides what each role can do in Settings → Staff & roles.']}
];
export default function HelpPage() {
  const [open, setOpen] = useState('sell');
  return (
    <div class="page" style={{ maxWidth: '1000px' }}>
      <PageHeader title={t('Help & quick guide')} sub={t('Short answers for every screen. Need a person? We are on WhatsApp.')}
        actions={<><Btn variant="navy" icon="play" onClick={() => { navigate('/sell'); setTimeout(() => startTour('sell', SELL_TOUR, { force: true }), 500); }}>{t('Replay the Sell tour')}</Btn><Btn icon="keyboard" onClick={openShortcuts}>{t('Keyboard shortcuts')}<Kbd>F1</Kbd></Btn><a class="btn ok" href={waLink('254729455912', t('Hello Pentarch, I need help with Pentarch POS ({b}).', { b: S.business.value?.name }))} target="_blank" rel="noopener"><Icon name="whatsapp" />{t('WhatsApp support')}</a></>} />
      <div class="col gap-s">
        {GUIDE.map((g) => (
          <div class="card">
            <button class="card-h" style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', borderBottom: open === g.id ? '1px solid var(--line)' : 0 }} aria-expanded={open === g.id} onClick={() => setOpen(open === g.id ? null : g.id)}>
              <span class="ico-bub" style={{ background: 'var(--navy-50)', color: 'var(--navy)' }}><Icon name={g.icon} size={18} /></span><h3>{t(g.title)}</h3><Icon name={open === g.id ? 'chevron-up' : 'chevron-down'} />
            </button>
            {open === g.id && <ol class="card-b" style={{ margin: 0, paddingLeft: '40px', lineHeight: 1.7 }}>{g.steps.map((s) => <li style={{ marginBottom: '6px' }}>{t(s)}</li>)}</ol>}
          </div>
        ))}
      </div>
      <div class="card pad mt-l row wrap" style={{ background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)' }}>
        <div class="grow"><h3 style={{ color: '#fff' }}>{t('Pentarch support')}</h3><p style={{ color: '#aab5cf', margin: '4px 0 0' }}>+254 729 455 912 · info@pentarchcommunications.com · {t('Mon–Sat, 8am–6pm')}</p></div>
        <a class="btn sun" href="tel:+254729455912"><Icon name="phone" />{t('Call us')}</a>
      </div>
    </div>
  );
}
