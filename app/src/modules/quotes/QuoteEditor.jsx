// Quote editor: customer, lines (search to add, qty, price, discount), validity, notes → print A4 / WhatsApp,
// convert to invoice (credit sale) or to a sale (loads the Sell cart), delivery note.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { PageHeader, Btn, Icon, Badge, Empty, Avatar, Textarea, Input } from '../../ui/kit.jsx';
import { toast, confirm, Dropdown, promptText } from '../../ui/overlay.jsx';
import { previewPrint } from '../../ui/printpreview.jsx';
import { db } from '../../db/index.js';
import { remove } from '../../db/repo.js';
import { catalog, searchProducts } from '../../db/catalog.js';
import { navigate } from '../../router.js';
import { money, kes, parseMoney } from '../../lib/money.js';
import { prettyPhone, waLink, normPhone } from '../../lib/util.js';
import { can } from '../../auth/permissions.js';
import { requirePerm } from '../../auth/override.jsx';
import { licenceState } from '../../auth/session.js';
import { pickCustomer } from '../sell/dialogs.jsx';
import * as S from '../../state.js';
import { t, tn } from '../../i18n/index.js';
import { STATUS, quoteStatus, quoteCalc, lineFor, reprice, saveQuote, setQuoteStatus, addDays, createInvoice, creditCheck, quoteToCart } from './logic.js';
import { quoteHtml, deliveryNoteHtml, quoteText, invoiceA4 } from './print.js';
import './quotes.css';

const d8 = (s) => (s ? new Date(s + 'T00:00').toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
export default function QuoteEditor({ params, query }) {
  const isNew = params.id === 'new';
  const invoiceMode = query?.invoice === '1';
  const [q, setQ] = useState(null);
  const [cust, setCust] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    (async () => {
      if (isNew) {
        const st = S.settings.value;
        const src = copyFrom; copyFrom = null;
        const cid = src?.customer_id || query?.customer;
        const c = cid ? await db().customers.get(cid) : null;
        setCust(c || null);
        setQ({ lines: (src?.lines || []).map((l) => reprice({ ...l, key: l.key + 'c' }, c)), status: 'draft', customer_id: c?.id || null, customer_name: c?.name || '', valid_until: addDays(Number(st.quote_valid_days) || 14), notes: src?.notes || '', lpo_no: '' });
        setDirty(!!src);
      } else {
        const r = await db().quotes.get(params.id);
        if (!r || r.deleted) return setQ(false);
        setQ(r); setCust(r.customer_id ? await db().customers.get(r.customer_id) : null);
      }
    })();
  }, [params.id]);
  if (q === false) return <div class="page"><Empty icon="file" title={t('Quote not found')}><a class="btn" href="#/quotes">{t('Back to quotes')}</a></Empty></div>;
  if (!q) return <div class="page" />;
  const locked = ['invoiced', 'sold'].includes(q.status);
  const status = quoteStatus(q);
  const calc = quoteCalc(q.lines);
  const upd = (p) => { setQ({ ...q, ...p }); setDirty(true); };
  const setLines = (lines) => upd({ lines });
  const persist = async () => {
    if (!q.lines.length) { toast.error(t('Add at least one item')); return null; }
    const r = await saveQuote(q);
    setQ(r); setDirty(false);
    if (isNew) navigate('/quotes/' + r.id + (invoiceMode ? '?invoice=1' : ''), { replace: true });
    return r;
  };
  const chooseCustomer = async () => {
    const c = await pickCustomer();
    if (c === undefined) return;
    setCust(c);
    upd({ customer_id: c?.id || null, customer_name: c?.name || '', lines: q.lines.map((l) => reprice(l, c)) });
  };
  const print = async () => { const r = dirty || isNew ? await persist() : q; if (!r) return; previewPrint(quoteHtml(r, cust), { title: t('Quote {no}', { no: r.no }), paper: 'a4', actions: () => <Btn icon="whatsapp" onClick={() => whatsapp(r)}>{t('Send on WhatsApp')}</Btn> }); };
  const whatsapp = async (r0) => {
    const r = r0 || (dirty || isNew ? await persist() : q); if (!r) return;
    let phone = cust?.phone;
    if (!phone) { phone = await promptText({ title: t('Send on WhatsApp'), label: t('Customer phone number'), type: 'tel', placeholder: '07xx xxx xxx', ok: t('Open WhatsApp') }); if (phone == null) return; }
    if (!normPhone(phone)) return toast.error(t('Enter a valid Kenyan phone number'));
    window.open(waLink(phone, quoteText(r)), '_blank', 'noopener');
    if (r.status === 'draft') { const n = await setQuoteStatus(r, 'sent'); setQ(n); }
  };
  const toInvoice = async () => {
    if (!licenceState().canSell) return toast.error(t('Selling is paused until the subscription is renewed.'));
    if (!can('invoices.create')) return toast.error(t('Your role cannot create invoices'));
    if (!q.customer_id) { toast.warn(t('Choose the customer first — an invoice needs a customer account.')); return chooseCustomer(); }
    const r = dirty || isNew ? await persist() : q; if (!r) return;
    if (status === 'expired' && !(await confirm({ title: t('This quote has expired'), message: t('It was valid until {d}. Prices may have changed. Invoice it anyway?', { d: d8(r.valid_until) }), ok: t('Invoice anyway') }))) return;
    const cc = await creditCheck(r.customer_id, calc.total);
    if (cc.over && !(await requirePerm('sell.credit_over_limit', t('Credit above limit for {name}: owes {b}, limit {l}', { name: r.customer_name, b: money(cc.balance), l: money(cc.limit) })))) return;
    if (!(await confirm({ title: t('Create invoice for {a}?', { a: money(calc.total) }), message: t('{name} will owe this amount. Stock is taken out now. Payments are received from the customer’s account.', { name: r.customer_name }), ok: t('Create invoice') }))) return;
    setBusy(true);
    try {
      const sale = await createInvoice(r);
      toast(t('Invoice {no} created', { no: sale.no }));
      setQ({ ...r, status: 'invoiced', invoice_sale_id: sale.id, invoice_no: sale.no });
      previewPrint(invoiceA4({ ...sale, due: sale.balance, paid_amount: 0 }, cust), { title: t('Invoice {no}', { no: sale.no }), paper: 'a4' });
    } catch (e) { console.error(e); toast.error(t('Could not create the invoice: {e}', { e: e.message })); }
    finally { setBusy(false); }
  };
  const toSale = async () => {
    const r = dirty || isNew ? await persist() : q; if (!r) return;
    if (status === 'expired' && !(await confirm({ title: t('This quote has expired'), message: t('It was valid until {d}. Prices may have changed. Sell anyway?', { d: d8(r.valid_until) }), ok: t('Sell anyway') }))) return;
    await quoteToCart(r);
    if (r.status !== 'accepted') await setQuoteStatus(r, 'accepted');
    toast(t('Quote {no} is in the cart. Take payment to finish.', { no: r.no }));
    navigate('/sell');
  };
  const del = async () => {
    if (!(await confirm({ title: t('Delete quote {no}?', { no: q.no }), danger: true, ok: t('Delete') }))) return;
    await remove('quotes', q.id, { audit: { action: 'quote.delete', details: { no: q.no } } });
    navigate('/quotes');
  };
  const titleTxt = isNew ? (invoiceMode ? t('New invoice') : t('New quote')) : (invoiceMode && !locked ? t('Invoice from {no}', { no: q.no }) : t('Quote {no}', { no: q.no }));
  const [sl, stone] = STATUS[status] || STATUS.draft;
  return (
    <div class="page wide">
      <PageHeader back="#/quotes" title={<span class="row gap-s">{titleTxt}{!isNew && <Badge tone={stone}>{t(sl)}</Badge>}</span>}
        sub={!isNew && q.created_at ? t('Created {d}', { d: new Date(q.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) }) + (q.invoice_no ? ' · ' + t('Invoice {no}', { no: q.invoice_no }) : '') : invoiceMode ? t('Add the items, choose the customer, then tap Create invoice.') : t('Add the items, choose the customer, then print or send it.')}
        actions={<>
          {!isNew && <Btn icon="print" onClick={print}>{t('Print')}</Btn>}
          {!isNew && <Btn icon="whatsapp" onClick={() => whatsapp()}>{t('WhatsApp')}</Btn>}
          {!isNew && <Dropdown width="250px" trigger={({ toggle }) => <Btn icon="more" onClick={toggle} aria-label={t('More')} />}>
            <button onClick={() => previewPrint(deliveryNoteHtml(q, cust), { title: t('Delivery note'), paper: 'a4' })}><Icon name="truck" size={18} />{t('Delivery note')}</button>
            {q.invoice_sale_id && <button onClick={() => navigate('/quotes?tab=invoices')}><Icon name="receipt" size={18} />{t('Go to invoices')}</button>}
            {!locked && q.status !== 'sent' && <button onClick={async () => setQ(await setQuoteStatus(q, 'sent'))}><Icon name="check" size={18} />{t('Mark as sent')}</button>}
            {!locked && q.status !== 'accepted' && <button onClick={async () => setQ(await setQuoteStatus(q, 'accepted'))}><Icon name="check-circle" size={18} />{t('Customer accepted')}</button>}
            {!locked && <button onClick={async () => setQ(await setQuoteStatus(q, 'declined'))}><Icon name="x" size={18} />{t('Customer declined')}</button>}
            <button onClick={() => { copyFrom = q; navigate('/quotes/new'); }}><Icon name="copy" size={18} />{t('Copy to a new quote')}</button>
            {!locked && <><hr /><button onClick={del}><Icon name="trash" size={18} />{t('Delete quote')}</button></>}
          </Dropdown>}
        </>} />
      {locked && <div class="callout ok mb"><Icon name="check-circle" size={18} /><span class="grow">{q.status === 'invoiced' ? t('This quote was turned into invoice {no}.', { no: q.invoice_no || '' }) : t('This quote was sold.')}</span>{q.invoice_sale_id && <Btn size="sm" onClick={() => navigate('/sales/' + q.invoice_sale_id)}>{t('Open')}</Btn>}</div>}
      <div class="split-360 qe">
        <div class="col">
          <div class="card">
            <div class="card-h"><h3>{t('Items')}</h3><span class="small mute">{tn(q.lines.length, '{n} item', '{n} items')}</span></div>
            {!locked && <AddItem onAdd={(p) => { const ex = q.lines.find((l) => l.product_id === p.id); setLines(ex ? q.lines.map((l) => (l === ex ? reprice({ ...l, qty: l.qty + 1 }, cust) : l)) : [...q.lines, lineFor(p, 1, cust)]); }} />}
            {!q.lines.length ? <Empty icon="search" title={t('No items yet')} text={t('Search above and tap a product to add it.')} /> : (
              <div class="ql-list">
                <div class="ql ql-h"><span>{t('Item')}</span><span class="num">{t('Qty')}</span><span class="num">{t('Unit price')}</span><span class="num">{t('Discount')}</span><span class="num">{t('Amount')}</span><span /></div>
                {calc.lines.map((l, i) => (
                  <div class="ql">
                    <span class="ql-n"><b>{l.name}</b>{l.price !== l.list_price && <span class="tiny mute"> · {t('list {p}', { p: kes(l.list_price) })}</span>}</span>
                    <span class="num" data-l={t('Qty')}><input class="input mono num" inputMode="decimal" value={l.qty} disabled={locked} aria-label={t('Quantity of {name}', { name: l.name })}
                      onChange={(e) => { const v = parseFloat(e.target.value); if (v > 0) setLines(q.lines.map((x, k) => (k === i ? reprice({ ...x, qty: v }, cust) : x))); }} /></span>
                    <span class="num" data-l={t('Unit price')}><input class="input mono num" inputMode="decimal" value={l.price / 100} disabled={locked} aria-label={t('Unit price of {name}', { name: l.name })}
                      onChange={(e) => { const v = parseMoney(e.target.value); if (!isNaN(v) && v >= 0) setLines(q.lines.map((x, k) => (k === i ? { ...x, price: v, price_edited: v !== x.list_price } : x))); }} /></span>
                    <span class="num" data-l={t('Discount')}><input class="input mono num" inputMode="decimal" value={l.discount ? l.discount / 100 : ''} placeholder="0" disabled={locked} aria-label={t('Discount on {name}', { name: l.name })}
                      onChange={(e) => { const v = parseMoney(e.target.value || '0'); if (!isNaN(v) && v >= 0) setLines(q.lines.map((x, k) => (k === i ? { ...x, discount: Math.min(v, Math.round(x.price * x.qty)) } : x))); }} /></span>
                    <span class="num mono bold">{kes(l.total)}</span>
                    <span>{!locked && <Btn size="sm" variant="ghost" icon="trash" aria-label={t('Remove {name}', { name: l.name })} onClick={() => setLines(q.lines.filter((_, k) => k !== i))} />}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div class="card pad">
            <Textarea label={t('Notes for the customer')} value={q.notes} onValue={(v) => upd({ notes: v })} rows={3} disabled={locked} placeholder={t('e.g. Delivery within Nairobi included. Prices include VAT.')} />
          </div>
        </div>
        <div class="col">
          <div class="card pad">
            <div class="section-title" style={{ marginTop: 0 }}>{t('Customer')}</div>
            {cust ? (
              <div class="row"><Avatar name={cust.name} /><div class="grow"><b>{cust.name}</b><div class="small mute">{prettyPhone(cust.phone)}{cust.group === 'wholesale' ? ' · ' + t('Wholesale') : ''}</div></div>{!locked && <Btn size="sm" onClick={chooseCustomer}>{t('Change')}</Btn>}</div>
            ) : <Btn class="block" icon="user-plus" variant={invoiceMode ? 'navy' : ''} onClick={chooseCustomer} disabled={locked}>{t('Choose customer')}</Btn>}
            <div class="section-title">{t('Valid until')}</div>
            <div class="row wrap gap-s">
              {[7, 14, 30].map((d) => <button class={'chip' + (q.valid_until === addDays(d, q.created_at || Date.now()) ? ' on' : '')} disabled={locked} onClick={() => upd({ valid_until: addDays(d, q.created_at || Date.now()) })}>{t('{n} days', { n: d })}</button>)}
              <input class="input" type="date" style={{ width: '160px' }} value={q.valid_until || ''} disabled={locked} aria-label={t('Valid until')} onChange={(e) => upd({ valid_until: e.target.value })} />
            </div>
            <Input class="mt" label={t('Customer reference / LPO (optional)')} value={q.lpo_no || ''} onValue={(v) => upd({ lpo_no: v })} disabled={locked} />
          </div>
          <div class="card pad qe-tot">
            <div class="row"><span class="grow mute">{t('Subtotal')}</span><span class="mono">{kes(calc.subtotal)}</span></div>
            {calc.discount > 0 && <div class="row"><span class="grow mute">{t('Discount')}</span><span class="mono down">-{kes(calc.discount)}</span></div>}
            {calc.tax_total > 0 && <div class="row"><span class="grow mute">{t('VAT included')}</span><span class="mono">{kes(calc.tax_total)}</span></div>}
            <div class="row qe-grand"><span class="grow">{t('Total')}</span><b class="mono">{money(calc.total)}</b></div>
            {!locked && <div class="col gap-s" style={{ marginTop: '12px' }}>
              {(dirty || isNew) && <Btn variant={invoiceMode ? '' : 'primary'} size="lg" icon="check" onClick={async () => { const r = await persist(); if (r) toast(t('Quote {no} saved', { no: r.no })); }}>{t('Save quote')}</Btn>}
              {can('invoices.create') && <Btn variant={invoiceMode ? 'primary' : 'navy'} size="lg" icon="file" disabled={busy || !q.lines.length} onClick={toInvoice}>{invoiceMode ? t('Create invoice') : t('Convert to invoice')}</Btn>}
              {can('sell.use') && <Btn icon="cart" disabled={!q.lines.length} onClick={toSale}>{t('Convert to sale (paid now)')}</Btn>}
            </div>}
          </div>
        </div>
      </div>
    </div>
  );
}

let copyFrom = null; // "Copy to a new quote"

function AddItem({ onAdd }) {
  const [s, setS] = useState('');
  const [hi, setHi] = useState(0);
  const ref = useRef();
  const res = useMemo(() => (s.trim() ? searchProducts(s, 12).filter((p) => !p.has_variants) : []), [s]);
  const add = (p) => { onAdd(p); setS(''); setHi(0); ref.current?.focus(); };
  return (
    <div class="qe-add">
      <div class="input-wrap"><Icon name="search" size={18} />
        <input ref={ref} class="input" value={s} placeholder={t('Type a product name, SKU or scan a barcode to add…')} aria-label={t('Add item')} data-scan="keep"
          onInput={(e) => { setS(e.target.value); setHi(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHi(Math.min(res.length - 1, hi + 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(Math.max(0, hi - 1)); }
            else if (e.key === 'Enter') { e.preventDefault(); const code = catalog.value.byCode.get(s.trim()); if (code) add(code.product); else if (res[hi]) add(res[hi]); }
          }} /></div>
      {res.length > 0 && <div class="qe-res" role="listbox">{res.map((p, i) => <div role="option" aria-selected={i === hi} class={'res' + (i === hi ? ' on' : '')} onMouseDown={(e) => { e.preventDefault(); add(p); }} onMouseEnter={() => setHi(i)}><div class="ellipsis"><div class="nm ellipsis">{p.name}</div><div class="sub">{[p.sku, p.barcode].filter(Boolean).join(' · ')}</div></div><span /><span class="pr">{kes(p.price)}</span></div>)}</div>}
      {s.trim() && !res.length && <div class="small mute" style={{ padding: '8px 2px' }}>{t('No product matches “{q}”', { q: s })}</div>}
    </div>
  );
}
