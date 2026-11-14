import { useEffect, useState } from 'preact/hooks';
import { db } from '../../db/index.js';
import { account, agingBuckets, receivePayment } from '../../core/customers.js';
import { remove } from '../../db/repo.js';
import { PageHeader, Btn, Icon, Badge, Empty, Avatar, Tabs, MoneyInput, Input, Seg, Stat } from '../../ui/kit.jsx';
import { Table } from '../../ui/table.jsx';
import { openModal, Modal, toast, confirm } from '../../ui/overlay.jsx';
import { money, kes } from '../../lib/money.js';
import { prettyPhone, waLink, isMpesaCode, DAY } from '../../lib/util.js';
import { on } from '../../lib/bus.js';
import { navigate } from '../../router.js';
import { can } from '../../auth/permissions.js';
import { requirePerm } from '../../auth/override.jsx';
import { statementHtml, methodLabel, dt } from '../../print/templates.js';
import { previewPrint } from '../../ui/printpreview.jsx';
import { StatusBadge } from '../sell/SalesPage.jsx';
import { editCustomer } from './edit.jsx';
import { setCustomer, clearCart, cart } from '../sell/cart.js';
import * as S from '../../state.js';
import { t, tn } from '../../i18n/index.js';

const ctx = () => ({ business: S.business.value, branch: S.branch.value, settings: S.settings.value });
export default function CustomerProfile({ params }) {
  const [c, setC] = useState(null);
  const [acc, setAcc] = useState(null);
  const [tab, setTab] = useState('sales');
  const load = async () => {
    const cust = await db().customers.get(params.id);
    if (!cust || cust.deleted) return setC(false);
    setC(cust); setAcc(await account(cust.id));
  };
  useEffect(() => { load(); return on('change', (e) => ['customers', 'customer_payments', 'sales', 'returns'].includes(e) && load()); }, [params.id]);
  if (c === false) return <div class="page"><Empty icon="user" title={t('Customer not found')} /></div>;
  if (!c || !acc) return <div class="page" />;
  const aging = agingBuckets(acc.open);
  const statement = async () => previewPrint(statementHtml(c, acc, ctx()), { title: t('Statement — {name}', { name: c.name }), paper: 'a4', actions: () => <Btn icon="whatsapp" onClick={remind}>{t('Send on WhatsApp')}</Btn> });
  const remind = () => {
    const st = S.settings.value;
    const how = st.mpesa_type === 'paybill' && st.mpesa_paybill ? `${t('Paybill')} ${st.mpesa_paybill}${st.mpesa_account ? ', ' + t('Account') + ' ' + st.mpesa_account : ''}` : st.mpesa_till ? `${t('Till')} ${st.mpesa_till}` : '';
    const lines = acc.open.slice(0, 8).map((i) => `• ${i.sale.no} (${new Date(i.sale.created_at).toLocaleDateString('en-KE')}): ${kes(i.due)}`).join('\n');
    const text = t('Hello {name}, this is {biz}. Your balance with us is {bal}.', { name: c.name.split(' ')[0], biz: S.business.value.name, bal: money(acc.balance) }) + '\n' + lines + (how ? '\n\n' + t('Pay via M-Pesa {how}. Thank you!', { how }) : '\n\n' + t('Thank you!'));
    window.open(waLink(c.phone, text), '_blank', 'noopener');
  };
  const sell = () => { if (!cart.value.lines.length) clearCart(); setCustomer(c); navigate('/sell'); };
  return (
    <div class="page">
      <PageHeader back="#/customers" title={<span class="row" style={{ gap: '12px' }}><Avatar name={c.name} size={44} />{c.name}</span>}
        sub={<span class="row wrap gap-s">{prettyPhone(c.phone)}{c.email && ' · ' + c.email}{c.kra_pin && <span class="mono">· PIN {c.kra_pin}</span>}{c.group === 'wholesale' && <Badge tone="navy">{t('Wholesale')}</Badge>}</span>}
        actions={<>
          {can('sell.use') && <Btn icon="cart" onClick={sell}>{t('Sell to {name}', { name: c.name.split(' ')[0] })}</Btn>}
          {c.phone && <a class="btn" href={'tel:+' + c.phone}><Icon name="phone" />{t('Call')}</a>}
          {can('customers.edit') && <Btn icon="edit" onClick={async () => { const r = await editCustomer(c); if (r) load(); }}>{t('Edit')}</Btn>}
          {acc.balance > 0 && can('customers.payments') && <Btn variant="primary" icon="wallet" onClick={async () => { const r = await payDialog(c, acc); if (r) load(); }}>{t('Receive payment')}</Btn>}
        </>} />
      <div class="grid3 mb" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <Stat label={t('Balance owed')} value={<span class={acc.balance > 0 ? 'down' : ''}>{money(Math.max(0, acc.balance))}</span>} icon="credit">{c.credit_limit > 0 && <div class="small mute" style={{ marginTop: '4px' }}>{t('Limit {l}', { l: money(c.credit_limit) })}</div>}</Stat>
        <Stat label={t('Total spent')} value={money(acc.spent)} icon="receipt"><div class="small mute" style={{ marginTop: '4px' }}>{t('{n} visits', { n: acc.sales.length })}</div></Stat>
        {S.settings.value.loyalty_enabled && <Stat label={t('Loyalty points')} value={c.loyalty_points || 0} icon="star"><div class="small mute" style={{ marginTop: '4px' }}>{t('Worth {v}', { v: money((c.loyalty_points || 0) * (S.settings.value.loyalty_point_value || 100)) })}</div></Stat>}
        <Stat label={t('Last visit')} value={acc.lastVisit ? new Date(acc.lastVisit).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' }) : '—'} icon="calendar" />
      </div>
      {acc.balance > 0 && (
        <div class="card pad mb">
          <div class="row wrap" style={{ gap: '18px' }}>
            <h3 class="grow">{t('Debt aging')}</h3>
            <Btn size="sm" icon="file" onClick={statement}>{t('Statement')}</Btn>
            <Btn size="sm" icon="whatsapp" onClick={remind} disabled={!c.phone}>{t('WhatsApp reminder')}</Btn>
            <a class={'btn sm' + (c.phone ? '' : ' disabled')} href={`sms:+${c.phone}?body=${encodeURIComponent(t('Hello {name}, your balance at {biz} is {bal}. Thank you.', { name: c.name.split(' ')[0], biz: S.business.value.name, bal: money(acc.balance) }))}`}><Icon name="mail" size={17} />{t('SMS')}</a>
          </div>
          <div class="grid3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', marginTop: '12px' }}>
            {Object.entries(aging).map(([k, v]) => <div class="card pad" style={{ background: v && k !== '0-30' ? 'var(--coral-50)' : 'var(--paper)', border: 0 }}><div class="small mute bold">{k} {t('days')}</div><div class="mono bold" style={{ fontSize: '18px' }}>{kes(v)}</div></div>)}
          </div>
        </div>
      )}
      <Tabs value={tab} onValue={setTab} tabs={[{ value: 'sales', label: t('Purchases'), count: acc.sales.length }, { value: 'open', label: t('Unpaid invoices'), count: acc.open.length }, { value: 'payments', label: t('Payments'), count: acc.payments.length }]} />
      <div class="card">
        {tab === 'sales' && <Table rows={acc.sales.slice().reverse()} onRowClick={(s) => navigate('/sales/' + s.id)} empty={<Empty icon="receipt" title={t('No purchases yet')} />} columns={[
          { key: 'no', label: t('Receipt'), render: (s) => <b class="mono">{s.no}</b> }, { key: 'created_at', label: t('Date'), render: (s) => dt(s.created_at) },
          { key: 'items', label: t('Items'), hideMobile: true, render: (s) => <span class="small">{s.lines.slice(0, 3).map((l) => l.name).join(', ')}{s.lines.length > 3 ? '…' : ''}</span> },
          { key: 'pay', label: t('Paid by'), hideMobile: true, render: (s) => s.payments.map((p) => methodLabel(p.method)).join(' + ') }, { key: 'status', label: t('Status'), render: (s) => <StatusBadge s={s.status} /> },
          { key: 'total', label: t('Total'), num: true, render: (s) => kes(s.total) }]} />}
        {tab === 'open' && <Table rows={acc.open} onRowClick={(i) => navigate('/sales/' + i.sale.id)} empty={<Empty icon="smile" title={t('Nothing owed')} />} columns={[
          { key: 'no', label: t('Invoice'), render: (i) => <b class="mono">{i.sale.no}</b> }, { key: 'date', label: t('Date'), render: (i) => dt(i.sale.created_at) },
          { key: 'age', label: t('Age'), render: (i) => { const d = Math.floor((Date.now() - i.sale.created_at) / DAY); return <Badge tone={d > 60 ? 'bad' : d > 30 ? 'warn' : ''}>{tn(d, '{n} day', '{n} days')}</Badge>; } },
          { key: 'amt', label: t('Amount'), num: true, render: (i) => kes(i.sale.balance) }, { key: 'paid', label: t('Paid'), num: true, hideMobile: true, render: (i) => kes(i.sale.balance - i.due) }, { key: 'due', label: t('Due'), num: true, render: (i) => <b class="down">{kes(i.due)}</b> }]} />}
        {tab === 'payments' && <Table rows={acc.payments} empty={<Empty icon="wallet" title={t('No payments yet')} />} columns={[
          { key: 'created_at', label: t('Date'), render: (p) => dt(p.created_at) }, { key: 'method', label: t('Method'), render: (p) => methodLabel(p.method) }, { key: 'ref', label: t('Reference'), render: (p) => <span class="mono">{p.ref}</span> },
          { key: 'alloc', label: t('Applied to'), hideMobile: true, render: (p) => <span class="small mono">{(p.allocations || []).map((a) => a.no || '').filter(Boolean).join(', ')}</span> }, { key: 'amount', label: t('Amount'), num: true, render: (p) => <b class="up">{kes(p.amount)}</b> }]} />}
      </div>
      {can('customers.delete') && <div class="mt-l"><Btn variant="danger" size="sm" icon="trash" onClick={async () => {
        if (acc.balance > 0) return toast.error(t('This customer still owes money.'));
        if (await confirm({ title: t('Delete {name}?', { name: c.name }), message: t('Their sales history is kept.'), danger: true, ok: t('Delete') })) { await remove('customers', c.id, { audit: { action: 'customer.delete', details: { name: c.name } } }); navigate('/customers'); }
      }}>{t('Delete customer')}</Btn></div>}
    </div>
  );
}

export const payDialog = (c, acc) => openModal((close) => <Pay c={c} acc={acc} close={close} />);
function Pay({ c, acc, close }) {
  const [amt, setAmt] = useState(acc.balance);
  const [method, setMethod] = useState('mpesa');
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  let left = amt;
  const alloc = acc.open.map((i) => { const a = Math.max(0, Math.min(left, i.due)); left -= a; return { ...i, a }; });
  const go = async () => {
    if (!(amt > 0)) return toast.error(t('Enter an amount'));
    if (method === 'mpesa' && !isMpesaCode(ref.trim().toUpperCase())) return toast.error(t('M-Pesa code must be 10 letters/numbers, e.g. TK7AB3CD9E'));
    if (method === 'cash' && S.settings.value.require_shift && !S.shift.value) return toast.error(t('Open a shift first'));
    setBusy(true);
    const r = await receivePayment(c, amt, method, ref.trim().toUpperCase());
    toast(t('Payment of {a} recorded', { a: money(amt) }) + (r.overpaid ? ' · ' + t('{a} extra kept as credit', { a: money(r.overpaid) }) : ''));
    close(r);
  };
  return (
    <Modal title={t('Receive payment — {name}', { name: c.name })} icon="wallet" size="lg" onClose={() => close(null)}
      footer={<><Btn onClick={() => close(null)}>{t('Cancel')}</Btn><Btn variant="primary" icon="check" disabled={busy} onClick={go}>{t('Record {a}', { a: money(amt) })}</Btn></>}>
      <div class="grid2" style={{ alignItems: 'start' }}>
        <div class="col">
          <MoneyInput label={t('Amount received')} value={amt} onValue={setAmt} big hint={t('Owes {b}', { b: money(acc.balance) })} />
          <div class="field"><label>{t('Method')}</label><Seg value={method} onValue={setMethod} options={[{ value: 'mpesa', label: 'M-Pesa' }, { value: 'cash', label: t('Cash') }, { value: 'bank', label: t('Bank') }, { value: 'card', label: t('Card') }]} /></div>
          <Input label={method === 'mpesa' ? t('M-Pesa code') : t('Reference')} value={ref} onValue={(v) => setRef(method === 'mpesa' ? v.toUpperCase() : v)} inputClass="mono" />
        </div>
        <div class="card">
          <div class="card-h"><h4 class="grow">{t('Applied oldest first')}</h4></div>
          {alloc.map((i) => <div class="list-item small"><span class="mono grow">{i.sale.no}</span><span class="mute">{kes(i.due)}</span><b class={'mono ' + (i.a ? 'up' : 'mute')}>{i.a ? '−' + kes(i.a) : '—'}</b></div>)}
        </div>
      </div>
    </Modal>
  );
}
