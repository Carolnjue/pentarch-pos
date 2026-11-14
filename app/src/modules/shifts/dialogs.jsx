import { useEffect, useState } from 'preact/hooks';
import { openModal, Modal, toast } from '../../ui/overlay.jsx';
import { Btn, MoneyInput, Input, Icon, Textarea } from '../../ui/kit.jsx';
import { money, kes } from '../../lib/money.js';
import { openShift, cashMove, shiftSummary, closeShift, DENOMS } from '../../core/shifts.js';
import { shiftReportHtml } from '../../print/templates.js';
import { previewPrint } from '../../ui/printpreview.jsx';
import { requirePerm } from '../../auth/override.jsx';
import * as S from '../../state.js';
import { t } from '../../i18n/index.js';

export async function openShiftDialog() {
  if (S.shift.value) return S.shift.value;
  const by = await requirePerm('shift.open_close', t('Open a shift'));
  if (!by) return null;
  return openModal((close) => <OpenShift close={close} />);
}
function OpenShift({ close }) {
  const [float, setFloat] = useState(200000);
  const go = async () => { const s = await openShift(float); toast(t('Shift opened with float {f}', { f: money(float) })); close(s); };
  return (
    <Modal title={t('Open shift')} icon="clock" size="sm" center onClose={() => close(null)}
      footer={<><Btn onClick={() => close(null)}>{t('Cancel')}</Btn><Btn variant="ok" icon="check" onClick={go}>{t('Open shift')}</Btn></>}>
      <p class="mute" style={{ marginTop: 0 }}>{t('Count the cash in the drawer before you start.')}</p>
      <MoneyInput label={t('Opening float (cash in drawer)')} value={float} onValue={setFloat} big onKeyDown={(e) => e.key === 'Enter' && go()} />
      <div class="row wrap gap-s" style={{ marginTop: '10px' }}>{[0, 1000, 2000, 5000].map((k) => <button class="chip" onClick={() => setFloat(k * 100)}>{k ? 'KES ' + k.toLocaleString() : t('No float')}</button>)}</div>
    </Modal>
  );
}

export async function cashMoveDialog(type) {
  if (!S.shift.value) { toast.error(t('Open a shift first')); return; }
  const by = await requirePerm('shift.cash_moves', t('Cash in / out'));
  if (!by) return;
  return openModal((close) => <CashMove type={type} close={close} />);
}
const TITLES = { pay_in: 'Pay in (add cash)', pay_out: 'Pay out (take cash)', drop: 'Cash drop (to safe / bank)' };
function CashMove({ type, close }) {
  const [amt, setAmt] = useState(0);
  const [reason, setReason] = useState('');
  const go = async () => {
    if (!amt) return toast.error(t('Enter an amount'));
    if (!reason.trim()) return toast.error(t('Enter a reason'));
    await cashMove(type, amt, reason.trim());
    toast(t('{what}: {a} recorded', { what: t(TITLES[type]), a: money(amt) }));
    close(true);
  };
  const sugg = type === 'pay_in' ? [t('Change float top-up'), t('Owner added cash')] : type === 'pay_out' ? [t('Transport'), t('Cleaning'), t('Staff lunch'), t('Supplier payment')] : [t('To safe'), t('Bank deposit'), t('Owner collected')];
  return (
    <Modal title={t(TITLES[type])} icon={type === 'pay_in' ? 'download' : 'upload'} size="sm" center onClose={() => close(false)}
      footer={<><Btn onClick={() => close(false)}>{t('Cancel')}</Btn><Btn variant="primary" onClick={go}>{t('Save')}</Btn></>}>
      <div class="col">
        <MoneyInput label={t('Amount')} value={amt} onValue={setAmt} big />
        <Input label={t('Reason')} value={reason} onValue={setReason} onKeyDown={(e) => e.key === 'Enter' && go()} />
        <div class="row wrap gap-s">{sugg.map((s) => <button class="chip" onClick={() => setReason(s)}>{s}</button>)}</div>
      </div>
    </Modal>
  );
}

export async function xReport(shift = S.shift.value) {
  const sum = await shiftSummary(shift);
  const u = S.users.value.find((x) => x.id === shift.user_id);
  return previewPrint(shiftReportHtml(sum, ctx(), { kind: shift.status === 'closed' ? 'Z' : 'X', userName: u?.name, denominations: shift.denominations }), { title: shift.status === 'closed' ? t('Z report') : t('X report'), paper: S.settings.value.receipt_width || 80 });
}
const ctx = () => ({ business: S.business.value, branch: S.branch.value, settings: S.settings.value });

export async function closeShiftDialog() {
  const sh = S.shift.value;
  if (!sh) return;
  const by = await requirePerm('shift.open_close', t('Close shift'));
  if (!by) return;
  const res = await openModal((close) => <CloseShift shift={sh} close={close} />);
  if (res) {
    const u = S.users.value.find((x) => x.id === res.rec.user_id);
    previewPrint(shiftReportHtml(res.sum, ctx(), { kind: 'Z', userName: u?.name, denominations: res.rec.denominations }), { title: t('Z report'), paper: S.settings.value.receipt_width || 80 });
  }
}
function CloseShift({ shift, close }) {
  const [sum, setSum] = useState(null);
  const [counts, setCounts] = useState({});
  const [notes, setNotes] = useState('');
  const [blind, setBlind] = useState(!(S.user.value?.role === 'owner' || S.user.value?.role === 'manager'));
  useEffect(() => { shiftSummary(shift).then(setSum); }, []);
  const counted = DENOMS.reduce((s, d) => s + d * (parseInt(counts[d]) || 0), 0);
  const variance = sum ? counted - sum.expected : 0;
  const go = async () => { const r = await closeShift(shift, counted, Object.fromEntries(DENOMS.map((d) => [d, parseInt(counts[d]) || 0])), notes); toast(t('Shift closed')); close(r); };
  return (
    <Modal title={t('Close shift — count the cash')} icon="clock" size="lg" onClose={() => close(null)}
      footer={<><span class="grow">{t('Counted')}: <b class="mono" style={{ fontSize: '20px' }}>{money(counted)}</b></span><Btn onClick={() => close(null)}>{t('Cancel')}</Btn><Btn variant="primary" icon="check" onClick={go}>{t('Close shift & print Z')}</Btn></>}>
      <div class="grid2" style={{ alignItems: 'start' }}>
        <div>
          <div class="section-title" style={{ marginTop: 0 }}>{t('Notes & coins')}</div>
          <div class="col gap-s">
            {DENOMS.map((d) => (
              <div class="row">
                <span class="mono bold" style={{ width: '90px' }}>{kes(d)}</span><span class="mute">×</span>
                <input class="input mono num" style={{ width: '90px', minHeight: '40px' }} inputMode="numeric" value={counts[d] || ''} placeholder="0" aria-label={t('Count of {d}', { d: kes(d) })} onInput={(e) => setCounts({ ...counts, [d]: e.target.value.replace(/\D/g, '') })} />
                <span class="grow right mono">{counts[d] ? kes(d * counts[d]) : ''}</span>
              </div>
            ))}
          </div>
        </div>
        <div class="col">
          {sum && (blind ? (
            <div class="callout"><Icon name="eye-off" /><span>{t('Blind count: the expected amount is hidden until the shift is closed.')}</span></div>
          ) : (
            <div class="card pad col gap-s">
              <div class="row"><span class="grow mute">{t('Opening float')}</span><span class="mono">{kes(shift.opening_float)}</span></div>
              <div class="row"><span class="grow mute">{t('Cash sales')}</span><span class="mono">{kes(sum.byMethod.cash || 0)}</span></div>
              {sum.refunds.cash > 0 && <div class="row"><span class="grow mute">{t('Cash refunds')}</span><span class="mono">-{kes(sum.refunds.cash)}</span></div>}
              <div class="row"><span class="grow mute">{t('Pay in / out / drops')}</span><span class="mono">{kes((sum.cashMoves.pay_in || 0) - (sum.cashMoves.pay_out || 0) - (sum.cashMoves.drop || 0))}</span></div>
              {sum.debtPayments.cash > 0 && <div class="row"><span class="grow mute">{t('Debt payments (cash)')}</span><span class="mono">{kes(sum.debtPayments.cash)}</span></div>}
              <hr class="sep" style={{ margin: '6px 0' }} />
              <div class="row"><b class="grow">{t('Expected cash')}</b><b class="mono">{money(sum.expected)}</b></div>
              <div class="row"><b class="grow">{t('Variance')}</b><b class={'mono ' + (variance < 0 ? 'down' : variance > 0 ? 'up' : '')}>{variance > 0 ? '+' : ''}{money(variance)}</b></div>
            </div>
          ))}
          {sum && <div class="card pad"><div class="section-title" style={{ marginTop: 0 }}>{t('Other takings')}</div>{Object.entries(sum.byMethod).filter(([m]) => m !== 'cash').map(([m, v]) => <div class="row"><span class="grow">{t({ mpesa: 'M-Pesa', card: 'Card', bank: 'Bank transfer', credit: 'Credit (on account)', points: 'Loyalty points' }[m] || m)}</span><span class="mono">{kes(v)}</span></div>)}{Object.keys(sum.byMethod).filter((m) => m !== 'cash').length === 0 && <span class="mute">—</span>}</div>}
          <Textarea label={t('Notes')} value={notes} onValue={setNotes} placeholder={t('Explain any shortage or extra cash')} />
        </div>
      </div>
    </Modal>
  );
}
