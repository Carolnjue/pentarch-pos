// Sell-screen dialogs: customer picker, line editor, discounts, hold/recall, variants, weight, modifiers, serials.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { openModal, Modal, confirm, toast } from '../../ui/overlay.jsx';
import { Btn, Input, MoneyInput, NumPad, Icon, Avatar, Badge, Seg, Select, Empty, Textarea } from '../../ui/kit.jsx';
import { db } from '../../db/index.js';
import { save, remove, audit } from '../../db/repo.js';
import { allBalances } from '../../core/customers.js';
import { heldOrders } from '../../core/sales.js';
import { catalog, stockOf, variantsOf } from '../../db/catalog.js';
import { money, kes, parseMoney } from '../../lib/money.js';
import { normPhone, prettyPhone, relTime } from '../../lib/util.js';
import { norm } from '../../lib/search.js';
import { requirePerm } from '../../auth/override.jsx';
import { can } from '../../auth/permissions.js';
import * as S from '../../state.js';
import { t, tn } from '../../i18n/index.js';
import { cart, updateLine, setQty, removeLine, setCartDiscount, loadHeld, totals } from './cart.js';

/* ---------- customer picker ---------- */
export const pickCustomer = (opts = {}) => openModal((close) => <CustomerPicker close={close} {...opts} />);
function CustomerPicker({ close, requireCredit }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState([]);
  const [bal, setBal] = useState(new Map());
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', phone: '', group: 'retail' });
  useEffect(() => { db().customers.toArray().then((c) => setList(c.filter((x) => !x.deleted))); allBalances().then(setBal); }, []);
  const shown = useMemo(() => {
    const n = norm(q), digits = q.replace(/\D/g, '');
    return list.filter((c) => !n || norm(c.name).includes(n) || (digits.length >= 3 && (c.phone || '').includes(digits.replace(/^0/, '')))).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 80);
  }, [q, list]);
  const looksPhone = /^[0+]?\d{6,}$/.test(q.replace(/\s/g, ''));
  const startAdd = (qq = q) => { const lp = /^[0+]?\d{6,}$/.test(String(qq).replace(/\s/g, '')); setF({ name: lp ? '' : qq, phone: lp ? qq : '', group: 'retail' }); setAdding(true); };
  const create = async (e) => {
    e?.preventDefault();
    if (!f.name.trim()) return toast.error(t('Enter the customer name'));
    if (f.phone && !normPhone(f.phone)) return toast.error(t('Enter a valid Kenyan phone number'));
    if (f.phone && list.some((c) => c.phone === normPhone(f.phone))) return toast.error(t('A customer with this phone already exists'));
    const c = await save('customers', { name: f.name.trim(), phone: normPhone(f.phone), email: '', kra_pin: '', group: f.group, credit_limit: 0, loyalty_points: 0, notes: '', birthday: '' }, { audit: { action: 'customer.create', details: { name: f.name } } });
    close(c);
  };
  return (
    <Modal title={adding ? t('New customer') : t('Choose customer')} icon="user" size="lg" onClose={() => close(undefined)}
      footer={adding ? <><Btn onClick={() => setAdding(false)}>{t('Back')}</Btn><Btn variant="primary" icon="check" onClick={create}>{t('Save & attach')}</Btn></>
        : <><Btn icon="x" onClick={() => close(null)}>{t('Walk-in (no customer)')}</Btn><span class="spacer" /><Btn variant="navy" icon="user-plus" onClick={() => startAdd()}>{t('New customer')}</Btn></>}>
      {adding ? (
        <form class="form-grid" onSubmit={create}>
          <Input label={t('Phone (M-Pesa)')} type="tel" value={f.phone} onValue={(v) => setF({ ...f, phone: v })} placeholder="07xx xxx xxx" autoFocus={!f.phone} />
          <Input label={t('Full name')} value={f.name} onValue={(v) => setF({ ...f, name: v })} autoFocus={!!f.phone} />
          {S.modulesOn.value.wholesale && <Select label={t('Group')} value={f.group} onValue={(v) => setF({ ...f, group: v })} options={[{ value: 'retail', label: t('Retail') }, { value: 'wholesale', label: t('Wholesale') }]} />}
          <button type="submit" class="sr">{t('Save')}</button>
        </form>
      ) : (
        <>
          <div class="input-wrap mb"><Icon name="search" size={18} /><input class="input" autoFocus value={q} onInput={(e) => setQ(e.target.value)} placeholder={t('Phone number or name')} aria-label={t('Search customers')}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const qq = e.currentTarget.value; const n = norm(qq), d = qq.replace(/\D/g, '').replace(/^0/, ''); const hits = list.filter((c) => !n || norm(c.name).includes(n) || (d.length >= 3 && (c.phone || '').includes(d))); if (hits.length === 1) close(hits[0]); else if (!hits.length) { setQ(qq); startAdd(qq); } } }} /></div>
          {requireCredit && <div class="callout warn mb"><Icon name="info" size={18} />{t('Credit sales need a customer account.')}</div>}
          <div class="card" style={{ maxHeight: '46vh', overflow: 'auto' }}>
            {shown.map((c) => {
              const b = bal.get(c.id) || 0;
              return (
                <div class="list-item click" onClick={() => close(c)}>
                  <Avatar name={c.name} />
                  <div class="grow"><b>{c.name}</b><div class="small mute">{prettyPhone(c.phone)}{c.group === 'wholesale' ? ' · ' + t('Wholesale') : ''}</div></div>
                  {c.loyalty_points > 0 && <Badge tone="navy"><Icon name="star" size={12} />{c.loyalty_points}</Badge>}
                  {b > 0 && <Badge tone="bad">{t('Owes')} {money(b)}</Badge>}
                </div>
              );
            })}
            {!shown.length && <Empty icon="user" title={t('No customer found')} text={q ? t('Press Enter to add “{q}” as a new customer.', { q }) : ''} />}
          </div>
        </>
      )}
    </Modal>
  );
}

/* ---------- line editor ---------- */
export const editLine = (key) => openModal((close) => <LineEditor lineKey={key} close={close} />);
function LineEditor({ lineKey, close }) {
  const l = cart.value.lines.find((x) => x.key === lineKey);
  const p = catalog.value.byId.get(l?.product_id);
  const [qty, setQ] = useState(String(l?.qty ?? 1));
  const [price, setPrice] = useState(l?.price ?? 0);
  const [dType, setDType] = useState(l?.discount_pct ? 'pct' : 'amount');
  const [dVal, setDVal] = useState(l?.discount_pct ? String(l.discount_pct) : l?.discount ? String(l.discount / 100) : '');
  const [note, setNote] = useState(l?.note || '');
  const [staff, setStaff] = useState(l?.staff_id || '');
  const [uom, setUom] = useState(l?.uom || '');
  if (!l) { close(); return null; }
  const q = parseFloat(qty) || 0;
  const gross = Math.round(price * q);
  const disc = dType === 'pct' ? Math.round((gross * (parseFloat(dVal) || 0)) / 100) : parseMoney(dVal || '0') || 0;
  const pct = gross ? (disc / gross) * 100 : 0;
  const apply = async () => {
    const patch = { note: note.trim(), staff_id: staff || null };
    if (uom !== (l.uom || '')) {
      const u = (p?.units_of_measure || []).find((x) => x.name === uom);
      Object.assign(patch, u ? { uom: u.name, unit: u.name, factor: u.factor, price: u.price, orig_price: u.price } : { uom: null, unit: p.unit, factor: 1, price: p.price, orig_price: p.price });
    } else if (price !== l.price) {
      const by = await requirePerm('sell.price_override', t('Change price of {name}', { name: l.name }));
      if (!by) return;
      if (!S.settings.value.allow_below_cost && p?.cost && price < p.cost * (l.factor || 1)) {
        const ok = await requirePerm('sell.below_cost', t('Sell {name} below cost', { name: l.name }));
        if (!ok) return;
      }
      Object.assign(patch, { price, price_override: true, override_by: by.id });
    }
    if (disc !== (l.discount || 0)) {
      if (disc > gross) return toast.error(t('Discount cannot be more than the line amount'));
      if (disc > 0) {
        const by = await requirePerm('sell.discount', t('Discount {pct}% on {name}', { pct: pct.toFixed(0), name: l.name }), { test: (u) => u.role === 'owner' || (u.max_discount_pct ?? 0) >= pct - 0.01 });
        if (!by) return;
        patch.discount_by = by.id;
      }
      patch.discount = disc; patch.discount_pct = dType === 'pct' ? parseFloat(dVal) || 0 : 0;
    }
    updateLine(l.key, patch);
    if (q !== l.qty) setQty(l.key, q);
    close();
  };
  const stylists = S.users.value.filter((u) => u.active !== false);
  return (
    <Modal title={l.name} icon="edit" size="lg" onClose={() => close()}
      footer={<><Btn variant="danger" icon="trash" onClick={() => { removeLine(l.key); close(); }}>{t('Remove')}</Btn><span class="spacer" /><Btn onClick={() => close()}>{t('Cancel')}</Btn><Btn variant="primary" icon="check" onClick={apply}>{t('Apply')}</Btn></>}>
      <div class="grid2" style={{ alignItems: 'start' }}>
        <div class="col">
          <Input label={t('Quantity') + (l.unit && l.unit !== 'pc' ? ` (${l.unit})` : '')} inputClass="mono num amount-in" inputMode="decimal" value={qty} onValue={setQ} onFocus={(e) => e.target.select()} data-autofocus />
          {p?.units_of_measure?.length > 0 && (
            <div class="field"><label>{t('Unit')}</label><div class="row wrap gap-s">
              <button class={'chip' + (!uom ? ' on' : '')} onClick={() => setUom('')}>{p.unit || 'pc'} · {kes(p.price)}</button>
              {p.units_of_measure.map((u) => <button class={'chip' + (uom === u.name ? ' on' : '')} onClick={() => setUom(u.name)}>{u.name} · {kes(u.price)}</button>)}
            </div></div>
          )}
          <MoneyInput label={t('Unit price')} value={price} onValue={setPrice} hint={l.orig_price !== price ? t('List price {p}', { p: money(l.orig_price) }) : ''} />
          <div class="field">
            <label>{t('Line discount')}</label>
            <div class="row gap-s">
              <Seg value={dType} onValue={setDType} options={[{ value: 'pct', label: '%' }, { value: 'amount', label: 'KES' }]} />
              <input class="input mono num" inputMode="decimal" value={dVal} onInput={(e) => setDVal(e.target.value)} placeholder="0" aria-label={t('Discount')} />
            </div>
            <div class="row wrap gap-s" style={{ marginTop: '6px' }}>{[5, 10, 15, 20].map((v) => <button class="chip" onClick={() => { setDType('pct'); setDVal(String(v)); }}>{v}%</button>)}</div>
            <span class="hint">{t('Your limit: {n}%', { n: S.user.value?.role === 'owner' ? 100 : S.user.value?.max_discount_pct ?? 0 })}</span>
          </div>
        </div>
        <div class="col">
          <NumPad onKey={(k) => setQ((v) => (k === 'back' ? v.slice(0, -1) : k === 'clear' ? '' : (v === String(l.qty) ? '' : v) + k))} />
          {(p?.type === 'service' || S.modulesOn.value.services) && (
            <Select label={t('Served by')} value={staff} onValue={setStaff} options={[{ value: '', label: t('— none —') }, ...stylists.map((u) => ({ value: u.id, label: u.name + (u.commission_pct ? ` (${u.commission_pct}%)` : '') }))]} />
          )}
          <Input label={t('Note on this item')} value={note} onValue={setNote} placeholder={t('e.g. no onions, gift wrap')} />
          <div class="card pad" style={{ background: 'var(--paper)' }}>
            <div class="row"><span class="grow mute">{t('Line total')}</span><b class="mono" style={{ fontSize: '20px' }}>{money(Math.max(0, gross - disc))}</b></div>
            {disc > 0 && <div class="row small"><span class="grow mute">{t('Discount')}</span><span class="mono down">-{money(disc)} ({pct.toFixed(1)}%)</span></div>}
            {can('products.cost_view') && p?.cost ? <div class="row small"><span class="grow mute">{t('Margin')}</span><span class="mono">{gross ? (((gross - disc) - p.cost * q * (l.factor || 1)) / Math.max(1, gross - disc) * 100).toFixed(0) : 0}%</span></div> : null}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- cart discount ---------- */
export const editCartDiscount = () => openModal((close) => <CartDiscount close={close} />);
function CartDiscount({ close }) {
  const cur = cart.value.cartDiscount;
  const [type, setType] = useState(cur?.type || 'pct');
  const [val, setVal] = useState(cur ? (cur.type === 'pct' ? String(cur.value) : String(cur.value / 100)) : '');
  const base = totals.value.subtotal - totals.value.line_discount;
  const amount = type === 'pct' ? Math.round((base * (parseFloat(val) || 0)) / 100) : parseMoney(val || '0') || 0;
  const pct = base ? (amount / base) * 100 : 0;
  const apply = async () => {
    if (amount > base) return toast.error(t('Discount cannot be more than the sale'));
    if (amount > 0) {
      const by = await requirePerm('sell.discount', t('Discount {pct}% on whole sale', { pct: pct.toFixed(0) }), { test: (u) => u.role === 'owner' || (u.max_discount_pct ?? 0) >= pct - 0.01 });
      if (!by) return;
    }
    setCartDiscount(amount ? { type, value: type === 'pct' ? parseFloat(val) : amount } : null);
    close();
  };
  return (
    <Modal title={t('Discount on whole sale')} icon="percent" size="sm" center onClose={() => close()}
      footer={<>{cur && <Btn variant="danger" onClick={() => { setCartDiscount(null); close(); }}>{t('Remove')}</Btn>}<span class="spacer" /><Btn variant="primary" onClick={apply}>{t('Apply')}</Btn></>}>
      <div class="col">
        <Seg value={type} onValue={setType} options={[{ value: 'pct', label: t('Percent %') }, { value: 'amount', label: t('Amount KES') }]} />
        <input class="input amount-in" inputMode="decimal" value={val} onInput={(e) => setVal(e.target.value)} data-autofocus aria-label={t('Discount')} onKeyDown={(e) => e.key === 'Enter' && apply()} />
        <div class="row wrap gap-s">{(type === 'pct' ? [2, 5, 10, 15, 20] : [50, 100, 200, 500]).map((v) => <button class="chip" onClick={() => setVal(String(v))}>{type === 'pct' ? v + '%' : 'KES ' + v}</button>)}</div>
        <div class="row"><span class="grow mute">{t('Discount')}</span><b class="mono down">-{money(amount)}</b></div>
        <div class="row"><span class="grow mute">{t('New total')}</span><b class="mono" style={{ fontSize: '20px' }}>{money(Math.max(0, base - amount))}</b></div>
      </div>
    </Modal>
  );
}

/* ---------- recall held ---------- */
export const recallHeld = () => openModal((close) => <Recall close={close} />);
function Recall({ close }) {
  const [list, setList] = useState(null);
  const load = () => heldOrders().then(setList);
  useEffect(load, []);
  const pick = async (o) => {
    if (cart.value.lines.length && !(await confirm({ title: t('Replace current cart?'), message: t('The items in the current cart will be removed. Hold them first if you need them.'), ok: t('Replace') }))) return;
    loadHeld(o);
    await save('orders', { ...o, status: 'recalled' });
    close();
  };
  return (
    <Modal title={t('Held sales')} icon="play" size="lg" onClose={() => close()}>
      {!list ? null : !list.length ? <Empty icon="pause" title={t('No held sales')} text={t('Use Hold (F8) to park a sale while you serve someone else.')} /> : (
        <div class="card">
          {list.map((o) => {
            const tot = o.lines.reduce((s, l) => s + Math.round(l.price * l.qty) - (l.discount || 0), 0);
            return (
              <div class="list-item">
                <div class="ico-bub" style={{ background: 'var(--sun-50)', color: 'var(--sun-d)' }}><Icon name="pause" size={18} /></div>
                <div class="grow"><b>{o.name || t('Held sale')}</b><div class="small mute">{tn(o.lines.length, '{n} item', '{n} items')} · {relTime(o.updated_at, t)}{o.customer_name ? ' · ' + o.customer_name : ''}</div></div>
                <b class="mono">{money(tot)}</b>
                <Btn size="sm" icon="trash" variant="ghost" aria-label={t('Delete')} onClick={async () => { if (await confirm({ title: t('Delete held sale?'), danger: true, ok: t('Delete') })) { await remove('orders', o.id, { audit: { action: 'sale.hold_delete', details: { name: o.name } } }); load(); } }} />
                <Btn size="sm" variant="navy" icon="play" onClick={() => pick(o)}>{t('Recall')}</Btn>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

/* ---------- variants ---------- */
export const pickVariant = (parent) => openModal((close) => <VariantPicker parent={parent} close={close} />);
function VariantPicker({ parent, close }) {
  const vs = variantsOf(parent.id);
  const attrs = Object.keys(vs[0]?.variant_attrs || {}).filter((k) => vs.some((v) => v.variant_attrs?.[k]));
  const [a0, a1] = attrs;
  const rows = [...new Set(vs.map((v) => v.variant_attrs?.[a0] || ''))];
  const cols = a1 ? [...new Set(vs.map((v) => v.variant_attrs?.[a1] || ''))] : [''];
  return (
    <Modal title={parent.name} icon="layers" size="lg" onClose={() => close(null)}>
      <p class="mute" style={{ marginTop: 0 }}>{t('Choose size and colour')}</p>
      <div style={{ overflowX: 'auto' }}>
        <table class="table">
          <thead><tr><th>{t(a0 ? a0[0].toUpperCase() + a0.slice(1) : '')}</th>{cols.map((c) => <th>{c}</th>)}</tr></thead>
          <tbody>{rows.map((r) => <tr><td class="bold">{r}</td>{cols.map((c) => {
            const v = vs.find((x) => (x.variant_attrs?.[a0] || '') === r && (!a1 || (x.variant_attrs?.[a1] || '') === c));
            if (!v) return <td class="mute">—</td>;
            const st = stockOf(v.id);
            return <td><button class="btn sm block" style={{ flexDirection: 'column', gap: 0, minHeight: '52px' }} onClick={() => close(v)}><span class="mono">{kes(v.price)}</span><span class={'tiny ' + (st <= 0 ? 'down' : 'mute')}>{t('{n} in stock', { n: st })}</span></button></td>;
          })}</tr>)}</tbody>
        </table>
      </div>
    </Modal>
  );
}

/* ---------- weight / open price ---------- */
export const askQty = (p, { title, price } = {}) => openModal((close) => <QtyPad p={p} title={title} close={close} openPrice={price} />);
function QtyPad({ p, title, close, openPrice }) {
  const [v, setV] = useState('');
  const n = openPrice ? parseMoney(v) : parseFloat(v) || 0;
  const ok = () => { if (n > 0) close(n); };
  useEffect(() => {
    const h = (e) => { if (e.target.tagName === 'INPUT') return; if (/^[\d.]$/.test(e.key)) setV((x) => x + e.key); else if (e.key === 'Backspace') setV((x) => x.slice(0, -1)); else if (e.key === 'Enter') ok(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  });
  return (
    <Modal title={title || p.name} icon={openPrice ? 'tag' : 'scale'} size="sm" center onClose={() => close(null)}>
      <div class="col">
        <div class="card pad center" style={{ background: 'var(--paper)' }}>
          <div class="big-num">{v || '0'} <span class="mute" style={{ fontSize: '18px' }}>{openPrice ? 'KES' : p.unit}</span></div>
          {!openPrice && <div class="mono mute" style={{ marginTop: '6px' }}>× {kes(p.price)} = <b style={{ color: 'var(--text)' }}>{money(Math.round(p.price * n))}</b></div>}
        </div>
        {!openPrice && <div class="row wrap gap-s">{[0.25, 0.5, 1, 1.5, 2].map((x) => <button class="chip" onClick={() => setV(String(x))}>{x} {p.unit}</button>)}</div>}
        <NumPad onKey={(k) => (k === 'back' ? setV(v.slice(0, -1)) : k === 'ok' ? ok() : setV(v + k))} okLabel={t('Add to cart')} />
      </div>
    </Modal>
  );
}

/* ---------- modifiers ---------- */
export const pickModifiers = (p, groups) => openModal((close) => <Modifiers p={p} groups={groups} close={close} />);
function Modifiers({ p, groups, close }) {
  const [sel, setSel] = useState({});
  const [note, setNote] = useState('');
  const toggle = (g, o) => {
    const cur = sel[g.id] || [];
    const has = cur.find((x) => x.name === o.name);
    let next = has ? cur.filter((x) => x.name !== o.name) : g.max === 1 ? [o] : cur.length < g.max ? [...cur, o] : cur;
    setSel({ ...sel, [g.id]: next });
  };
  const missing = groups.filter((g) => (sel[g.id] || []).length < (g.min || 0));
  const extra = Object.values(sel).flat().reduce((s, o) => s + (o.price || 0), 0);
  return (
    <Modal title={p.name} icon="sliders" size="lg" onClose={() => close(null)}
      footer={<><span class="grow mono bold">{money(p.price + extra)}</span><Btn variant="primary" icon="plus" disabled={missing.length > 0} onClick={() => close({ modifiers: groups.flatMap((g) => (sel[g.id] || []).map((o) => ({ group: g.name, name: o.name, price: o.price || 0 }))), note })}>{t('Add to order')}</Btn></>}>
      {groups.map((g) => (
        <div class="mb">
          <div class="row"><h3 class="grow">{g.name}</h3><span class="small mute">{g.min ? t('Required') : t('Optional')}{g.max > 1 ? ' · ' + t('up to {n}', { n: g.max }) : ''}</span></div>
          <div class="row wrap gap-s" style={{ marginTop: '8px' }}>
            {g.options.map((o) => <button class={'chip' + ((sel[g.id] || []).find((x) => x.name === o.name) ? ' on' : '')} style={{ height: '44px' }} onClick={() => toggle(g, o)}>{o.name}{o.price ? ' +' + kes(o.price) : ''}</button>)}
          </div>
        </div>
      ))}
      <Input label={t('Note for the kitchen')} value={note} onValue={setNote} placeholder={t('e.g. no onions')} />
    </Modal>
  );
}

/* ---------- serial capture ---------- */
export const pickSerial = (p) => openModal((close) => <SerialPick p={p} close={close} />);
function SerialPick({ p, close }) {
  const [list, setList] = useState([]);
  const [v, setV] = useState('');
  useEffect(() => { db().serials.where('product_id').equals(p.id).toArray().then((r) => setList(r.filter((s) => s.status === 'in_stock' && !s.deleted && (!s.branch_id || s.branch_id === S.branch.value?.id)))); }, []);
  const taken = new Set(cart.value.lines.map((l) => l.serial).filter(Boolean));
  const ok = (s) => { s = String(s || v).trim(); if (!s) return; if (taken.has(s)) return toast.error(t('This serial is already in the cart')); close(s); };
  return (
    <Modal title={t('Serial / IMEI for {name}', { name: p.name })} icon="hash" size="lg" onClose={() => close(null)}
      footer={<Btn variant="primary" icon="check" disabled={!v.trim()} onClick={() => ok()}>{t('Use this serial')}</Btn>}>
      <Input label={t('Scan or type the serial / IMEI')} value={v} onValue={setV} autoFocus data-scan="keep" inputClass="mono" onKeyDown={(e) => e.key === 'Enter' && ok(e.currentTarget.value)} />
      <div class="section-title">{t('In stock ({n})', { n: list.length })}</div>
      <div class="row wrap gap-s">{list.filter((s) => !taken.has(s.serial)).slice(0, 60).map((s) => <button class="chip mono" onClick={() => ok(s.serial)}>{s.serial}</button>)}</div>
      {!list.length && <p class="mute">{t('No serials recorded for this product. Type the serial from the box.')}</p>}
    </Modal>
  );
}

/* ---------- hold name ---------- */
export const askHoldName = (suggest) => openModal((close) => <HoldName suggest={suggest} close={close} />);
function HoldName({ suggest, close }) {
  const [v, setV] = useState(suggest || '');
  return (
    <Modal title={t('Hold this sale')} icon="pause" size="sm" center onClose={() => close(null)}
      footer={<><Btn onClick={() => close(null)}>{t('Cancel')}</Btn><Btn variant="primary" icon="pause" onClick={() => close(v.trim() || t('Held sale'))}>{t('Hold')}</Btn></>}>
      <Input label={t('Name (customer, table or note)')} value={v} onValue={setV} autoFocus onKeyDown={(e) => e.key === 'Enter' && close(e.currentTarget.value.trim() || t('Held sale'))} />
      <div class="row wrap gap-s" style={{ marginTop: '10px' }}>{[t('Customer in queue'), t('Waiting for M-Pesa'), t('Will come back')].map((x) => <button class="chip" onClick={() => setV(x)}>{x}</button>)}</div>
    </Modal>
  );
}
