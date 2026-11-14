// Tender (payment) dialog: cash with quick notes, M-Pesa (STK via cloud or code), card, bank, credit, points, split; then receipt.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { openModal, useEscape, toast, confirm } from '../../ui/overlay.jsx';
import { Btn, Icon, Kbd, Input, NumPad, Badge } from '../../ui/kit.jsx';
import { money, kes, parseMoney } from '../../lib/money.js';
import { isMpesaCode, normPhone, prettyPhone, waLink, sleep } from '../../lib/util.js';
import { completeSale } from '../../core/sales.js';
import { account } from '../../core/customers.js';
import { requirePerm } from '../../auth/override.jsx';
import { can } from '../../auth/permissions.js';
import { Cloud } from '../../sync/api.js';
import { getMeta, db } from '../../db/index.js';
import { beep } from '../../lib/sound.js';
import * as S from '../../state.js';
import { t, tn } from '../../i18n/index.js';
import { cart, totals, clearCart } from './cart.js';
import { printReceipt, previewReceipt, whatsappReceipt, previewInvoice } from './receipt.js';
import { pickCustomer } from './dialogs.jsx';
import { setCustomer } from './cart.js';

export const METHODS = [
  { id: 'cash', label: 'Cash', icon: 'cash', color: '#0A7F7B' },
  { id: 'mpesa', label: 'M-Pesa', icon: 'phone', color: '#2f8f2f' },
  { id: 'card', label: 'Card', icon: 'card', color: '#1F3C7A' },
  { id: 'bank', label: 'Bank transfer', icon: 'bank', color: '#182A55' },
  { id: 'credit', label: 'Credit', long: 'Credit (on account)', icon: 'credit', color: '#B97A00' },
  { id: 'points', label: 'Points', long: 'Loyalty points', icon: 'star', color: '#5b3a8c' }
];
export const enabledMethods = () => {
  const st = S.settings.value;
  return METHODS.filter((m) => m.id === 'cash' || st['pay_' + m.id])
    .filter((m) => m.id !== 'credit' || (S.modulesOn.value.credit !== false && can('sell.credit')))
    .filter((m) => m.id !== 'points' || st.loyalty_enabled);
};

// Set when the cloud answered 501 (no Daraja keys for this business): stop offering STK until the app restarts.
let stkUnavailable = false;
export const openTender = (opts = {}) => openModal((close) => <Tender close={close} {...opts} />);

function Tender({ close, method: initial, shares = 0 }) {
  const calc = totals.value;
  const total = calc.total;
  const methods = enabledMethods();
  const [method, setMethod] = useState(initial && methods.find((m) => m.id === initial) ? initial : methods[0]?.id || 'cash');
  const [pays, setPays] = useState([]);
  const [amt, setAmt] = useState('');
  const [ref, setRef] = useState('');
  const [phone, setPhone] = useState(cart.value.customer?.phone ? prettyPhone(cart.value.customer.phone) : '');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [stk, setStk] = useState(null); // {state:'sending'|'waiting'|'failed', id}
  const [acc, setAcc] = useState(null);
  const amtRef = useRef();
  const paid = pays.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, total - paid);
  const cust = cart.value.customer;
  const st = S.settings.value;
  useEscape(() => (done ? finish() : close(false)));
  const codeRef = useRef();
  // switch method: reset the entry fields synchronously (an effect would race with fast typing / autofill)
  const pick = (id) => { if (id === method) return; setMethod(id); setAmt(''); setRef(''); setStk(null); };
  useEffect(() => { const el = method === 'mpesa' ? document.getElementById('tender-code') : amtRef.current; setTimeout(() => el?.focus(), 30); }, [method]);
  useEffect(() => { if (cust && (method === 'credit' || method === 'points')) account(cust.id).then(setAcc); }, [method, cust?.id]);
  // split equally: each person pays one share (the last share takes any rounding remainder)
  const share = shares > 1 ? Math.ceil(total / shares / 100) * 100 : 0; // whole shillings
  const entered = amt === '' ? (share ? Math.min(share, remaining) : remaining) : parseMoney(amt);

  const finish = () => { close(true); };
  async function complete(allPays) {
    setBusy(true);
    try {
      const cash = allPays.filter((p) => p.method === 'cash');
      const change = cash.reduce((s, p) => s + (p.tendered || p.amount) - p.amount, 0);
      const c = cart.value;
      const sale = await completeSale({ calc, payments: allPays, change, customer: c.customer, note: c.note, order_type: c.orderType || 'retail', held_id: c.heldId, table_id: c.tableId || null, extra: c.meta || null });
      if (st.sound_on_scan) beep('done');
      clearCart();
      setDone(sale);
      if (st.auto_print) printReceipt(sale).catch(() => {});
    } catch (e) {
      console.error(e);
      toast.error(t('Could not save the sale: {e}', { e: e.message }));
    } finally { setBusy(false); }
  }
  async function add(p) {
    const next = [...pays, p];
    const covered = next.reduce((s, x) => s + x.amount, 0) >= total;
    setPays(next);
    setAmt(''); setRef('');
    if (covered) await complete(next);
    else { beep('scan'); amtRef.current?.focus(); }
  }
  async function charge(value = entered) {
    if (busy || done) return;
    if (!(value > 0) && remaining > 0) return toast.error(t('Enter an amount'));
    if (isNaN(value)) return toast.error(t('Enter a valid amount'));
    if (method === 'cash') {
      const applied = Math.min(value, remaining);
      return add({ method: 'cash', amount: applied, tendered: value });
    }
    if (value > remaining) return toast.error(t('Amount is more than the balance due ({a})', { a: money(remaining) }));
    if (method === 'mpesa') {
      const code = ref.trim().toUpperCase();
      if (!isMpesaCode(code)) return toast.error(t('M-Pesa code must be 10 letters/numbers, e.g. TK7AB3CD9E'));
      const dup = await db().sales.where('created_at').above(Date.now() - 90 * 86400000).filter((s) => s.payments?.some((p) => p.method === 'mpesa' && p.ref === code)).first();
      if (dup && !(await requirePerm('sell.mpesa_reuse', t('Use M-Pesa code {c} again (already on {no})', { c: code, no: dup.no })))) return;
      return add({ method: 'mpesa', amount: value, ref: code, phone: normPhone(phone) });
    }
    if (method === 'card' || method === 'bank') return add({ method, amount: value, ref: ref.trim() });
    if (method === 'credit') {
      if (!cust) return toast.error(t('Attach a customer first'));
      const limit = (await db().customers.get(cust.id))?.credit_limit || 0;
      const bal = acc?.balance || 0;
      if (limit > 0 && bal + value > limit) {
        const by = await requirePerm('sell.credit_over_limit', t('Credit above limit for {name}: owes {b}, limit {l}', { name: cust.name, b: money(bal), l: money(limit) }));
        if (!by) return;
      }
      return add({ method: 'credit', amount: value, ref: '' });
    }
    if (method === 'points') {
      if (!cust) return toast.error(t('Attach a customer first'));
      const pts = (await db().customers.get(cust.id))?.loyalty_points || 0;
      const max = pts * (Number(st.loyalty_point_value) || 100);
      if (value > max) return toast.error(t('Customer has {p} points worth {v}', { p: pts, v: money(max) }));
      return add({ method: 'points', amount: value, ref: Math.ceil(value / (Number(st.loyalty_point_value) || 100)) + ' pts' });
    }
  }
  async function sendStk() {
    const ph = normPhone(phone);
    if (!ph) return toast.error(t('Enter the customer M-Pesa number'));
    const value = entered;
    setStk({ state: 'sending' });
    try {
      const r = await Cloud.stk({ phone: ph, amount: Math.ceil(value / 100), ref: (S.branch.value?.code || 'POS') + '-' + Date.now().toString(36).toUpperCase() });
      setStk({ state: 'waiting', id: r.checkout_request_id });
      for (let i = 0; i < 64; i++) { // the cloud marks a request failed after 3 minutes
        await sleep(3000);
        const s = await Cloud.stkStatus(r.checkout_request_id).catch(() => ({ status: 'pending' }));
        if (s.status === 'paid') { setStk(null); return add({ method: 'mpesa', amount: value, ref: s.mpesa_receipt || '', phone: ph, stk: true }); }
        if (s.status === 'failed') { setStk({ state: 'failed' }); return; }
      }
      setStk({ state: 'failed' });
    } catch (e) {
      if (e.status === 501) stkUnavailable = true;
      setStk({ state: 'failed', msg: e.status === 501 ? t('STK push is not set up on the cloud. Ask the customer to pay to the till and enter the code.') : t('Could not reach the cloud. Enter the M-Pesa code instead.') });
    }
  }
  const quick = useMemo(() => {
    const notes = (st.quick_cash || [50, 100, 200, 500, 1000]).map((k) => k * 100);
    const up = [...new Set([...notes.filter((n) => n >= remaining), Math.ceil(remaining / 5000) * 5000, Math.ceil(remaining / 10000) * 10000, Math.ceil(remaining / 100000) * 100000])].filter((n) => n > remaining).sort((a, b) => a - b).slice(0, 4);
    return [...new Set([...notes, ...up])].sort((a, b) => a - b).slice(0, 8);
  }, [remaining]);
  const keyRef = useRef(null);
  keyRef.current = (e) => {
    if (done) { if (e.key === 'Enter') { e.preventDefault(); finish(); } else if (e.key.toLowerCase() === 'p' && !e.ctrlKey) { e.preventDefault(); printReceipt(done); } return; }
    if (e.altKey && /^Digit[1-6]$/.test(e.code)) { const m = methods[+e.code.slice(5) - 1]; if (m) { e.preventDefault(); pick(m.id); } }
  };
  useLayoutEffect(() => {
    const h = (e) => keyRef.current(e);
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, []);


  if (done) return <Done sale={done} onNew={finish} />;
  const M = METHODS.find((m) => m.id === method);
  const mpesaInfo = st.mpesa_type === 'paybill' ? (st.mpesa_paybill ? `${t('Paybill')} ${st.mpesa_paybill}${st.mpesa_account ? ' · ' + t('Account') + ' ' + st.mpesa_account : ''}` : '') : st.mpesa_till ? `${t('Buy Goods Till')} ${st.mpesa_till}` : '';
  const stkOk = st.mpesa_stk && S.online.value && !S.isDemo.value && !stkUnavailable;
  return (
    <div class="overlay" onMouseDown={(e) => e.target === e.currentTarget && close(false)}>
      <div class="modal xl" role="dialog" aria-modal="true" aria-label={t('Payment')}>
        <div class="tender">
          <div class="methods" role="tablist" aria-label={t('Payment method')}>
            <div class="section-title" style={{ margin: '4px 4px 4px' }}>{t('Pay with')}</div>
            {methods.map((m, i) => (
              <button class={'m' + (method === m.id ? ' on' : '')} role="tab" aria-selected={method === m.id} onClick={() => pick(m.id)}>
                <span class="mi" style={{ background: m.color }}><Icon name={m.icon} size={18} /></span>{t(m.label)}<Kbd>Alt {i + 1}</Kbd>
              </button>
            ))}
            <div class="spacer" />
            {pays.length > 0 && (
              <div class="paylist desk-only">
                <div class="section-title" style={{ margin: '8px 4px 2px' }}>{t('Paid so far')}</div>
                {pays.map((p, i) => (
                  <div class="payrow" style={{ background: '#fff' }}><span class="grow small">{t(METHODS.find((m) => m.id === p.method)?.label)}{p.ref ? <span class="mute"> · {p.ref}</span> : ''}</span><b class="mono small">{kes(p.amount)}</b>
                    <button class="btn ghost icon xs" aria-label={t('Remove payment')} onClick={() => setPays(pays.filter((_, k) => k !== i))}><Icon name="x" size={14} /></button></div>
                ))}
              </div>
            )}
          </div>
          <div class="pane">
            <div class="row">
              <h2 class="grow">{t(M.long || M.label)}</h2>
              <button class="btn ghost icon sm" onClick={() => close(false)} aria-label={t('Close')}><Icon name="x" /></button>
            </div>
            <div class="due-box">
              <div><div class="k">{pays.length ? t('Balance due') : t('Total due')}</div><div class="v">{money(remaining)}</div></div>
              <div class="right"><div class="k">{tn(Math.round(calc.items * 100) / 100, '{n} item', '{n} items')}</div>{pays.length > 0 && <div class="mono" style={{ color: '#aab5cf' }}>{t('of')} {money(total)}</div>}{calc.discount > 0 && <div class="mono small" style={{ color: 'var(--sun)' }}>-{money(calc.discount)} {t('discount')}</div>}</div>
            </div>
            {share > 0 && <div class="callout"><Icon name="users" /><span class="grow">{t('Split {n} ways · each pays {a}', { n: shares, a: money(share) })}</span><Badge tone="navy">{t('{k} of {n} paid', { k: Math.min(shares, Math.round(paid / share)), n: shares })}</Badge></div>}
            {method === 'mpesa' && mpesaInfo && <div class="callout ok" style={{ fontSize: '16px' }}><Icon name="phone" /><div><b>{mpesaInfo}</b><div class="small">{S.business.value?.name}</div></div></div>}
            {method === 'mpesa' && !mpesaInfo && <div class="callout warn"><Icon name="info" size={18} /><span>{t('Add your M-Pesa till or paybill in Settings → Payments so it shows here and on receipts.')}</span></div>}
            {(method === 'credit' || method === 'points') && (
              cust ? <div class="callout"><Icon name="user" /><div class="grow"><b>{cust.name}</b><div class="small">{method === 'credit' ? t('Owes {b}', { b: money(acc?.balance || 0) }) + (cust.credit_limit ? ' · ' + t('Limit {l}', { l: money(cust.credit_limit) }) : '') : t('{p} points (worth {v})', { p: cust.loyalty_points || 0, v: money((cust.loyalty_points || 0) * (Number(st.loyalty_point_value) || 100)) })}</div></div>
                <Btn size="sm" onClick={async () => { const c = await pickCustomer({ requireCredit: true }); if (c) setCustomer(c); }}>{t('Change')}</Btn></div>
                : <div class="callout warn"><Icon name="user" /><span class="grow">{t('Credit sales need a customer account.')}</span><Btn size="sm" variant="navy" onClick={async () => { const c = await pickCustomer({ requireCredit: true }); if (c) setCustomer(c); }}>{t('Choose customer')}</Btn></div>
            )}
            <div class="grid2" style={{ alignItems: 'start' }}>
              <div class="col">
                <label class="lbl" for="tender-amt">{method === 'cash' ? t('Cash received') : t('Amount')}</label>
                <div class="input-wrap"><span class="pre">KES</span>
                  <input id="tender-amt" ref={amtRef} class="input amount-in mono" inputMode="decimal" value={amt} placeholder={kes(remaining)} onInput={(e) => setAmt(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); charge(); } }} autocomplete="off" /></div>
                {method === 'cash' && entered > remaining && <div class="change-big"><div class="small bold">{t('Change')}</div><div class="v">{money(entered - remaining)}</div></div>}
                {method === 'mpesa' && (
                  <>
                    <Input id="tender-code" label={t('M-Pesa code')} value={ref} onValue={(v) => setRef(v.toUpperCase().replace(/\s/g, ''))} placeholder="TK7AB3CD9E" inputClass="mono" maxLength={10}
                      error={ref.length === 10 && !isMpesaCode(ref) ? t('Check the code — 10 letters/numbers') : ''} hint={t('From the customer’s M-Pesa SMS')} onKeyDown={(e) => e.key === 'Enter' && charge()} data-scan="keep" />
                    <Input label={t('Customer phone (optional)')} type="tel" value={phone} onValue={setPhone} placeholder="07xx xxx xxx" />
                    {stkOk && <Btn variant="ok" icon="phone" disabled={stk?.state === 'sending' || stk?.state === 'waiting'} onClick={sendStk}>{stk?.state === 'waiting' ? t('Waiting for customer PIN…') : stk?.state === 'sending' ? t('Sending…') : t('Send STK request to phone')}</Btn>}
                    {stk?.state === 'failed' && <div class="callout bad small"><Icon name="alert" size={16} />{stk.msg || t('No confirmation yet. Ask for the M-Pesa code and enter it above.')}</div>}
                  </>
                )}
                {(method === 'card' || method === 'bank') && <Input label={method === 'card' ? t('Card approval code / last 4 digits') : t('Bank reference')} value={ref} onValue={setRef} onKeyDown={(e) => e.key === 'Enter' && charge()} />}
                {method === 'cash' && <div class="quick-notes">
                  <Btn variant="sun" onClick={() => charge(share ? Math.min(share, remaining) : remaining)}>{t('Exact')}</Btn>
                  {quick.map((n) => <Btn onClick={() => charge(n)}>{kes(n)}</Btn>)}
                </div>}
              </div>
              <div class="col desk-only">
                <NumPad onKey={(k) => (k === 'back' ? setAmt(amt.slice(0, -1)) : k === 'ok' ? charge() : setAmt(amt + k))} />
              </div>
            </div>
            <div class="spacer" />
            {pays.length > 0 && <div class="paylist mobile-only">{pays.map((p) => <div class="payrow"><span class="grow">{t(METHODS.find((m) => m.id === p.method)?.label)}</span><b class="mono">{kes(p.amount)}</b></div>)}</div>}
            <Btn variant="ok" size="xl" class="block" disabled={busy || (method === 'credit' && !cust) || (method === 'points' && !cust)} onClick={() => charge()}>
              <Icon name="check" size={24} />
              {entered >= remaining ? t('Complete sale') : t('Add {m} payment', { m: t(M.label) })} · <span class="mono">{money(method === 'cash' ? Math.min(entered, remaining) || remaining : entered)}</span><Kbd>Enter</Kbd>
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

function Done({ sale, onNew }) {
  const [ms] = useState(sale._ms);
  return (
    <div class="overlay">
      <div class="modal" role="dialog" aria-modal="true" aria-label={t('Sale complete')}>
        <div class="modal-b" style={{ paddingTop: '22px' }}>
          <div class="done-hero">
            <div class="tick"><Icon name="check" size={40} stroke={3} /></div>
            <h2>{t('Sale complete')}</h2>
            <div class="mute small" style={{ marginTop: '4px' }}>{t('Receipt')} <b class="mono" style={{ color: 'var(--text)' }}>{sale.no}</b> · {money(sale.total)} · {ms} ms</div>
          </div>
          {sale.change > 0 && <div class="change-big" style={{ margin: '16px 0 4px' }}><div class="bold">{t('Give change')}</div><div class="v">{money(sale.change)}</div></div>}
          {sale.balance > 0 && <div class="callout warn" style={{ marginTop: '12px' }}><Icon name="credit" /><span>{t('{a} added to {name}’s account', { a: money(sale.balance), name: sale.customer_name })}</span></div>}
          {sale.points_earned > 0 && <div class="callout" style={{ marginTop: '12px' }}><Icon name="star" /><span>{t('{n} loyalty points earned', { n: sale.points_earned })}</span></div>}
          <div class="grid2" style={{ marginTop: '16px', gap: '8px' }}>
            <Btn icon="print" kbd="P" onClick={() => printReceipt(sale)}>{t('Print receipt')}</Btn>
            <Btn icon="whatsapp" onClick={() => whatsappReceipt(sale)}>{t('WhatsApp receipt')}</Btn>
            <Btn icon="eye" onClick={() => previewReceipt(sale)}>{t('View receipt')}</Btn>
            <Btn icon="file" onClick={() => previewInvoice(sale)}>{t('A4 invoice')}</Btn>
          </div>
        </div>
        <div class="modal-f"><Btn variant="primary" size="lg" class="block" icon="plus" onClick={onNew} data-autofocus>{t('New sale')}<Kbd>Enter</Kbd></Btn></div>
      </div>
    </div>
  );
}
