// The Sell screen — fastest path to a sale. Scan anywhere, search, quick keys, cart, pay.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { cart, selKey, totals, initCart, addProduct, setQty, removeLine as rawRemove, clearCart, setCustomer, setWholesale, setNote, updateLine, restoreCart } from './cart.js';

/** Remove a line with an Undo toast. */
function removeLine(key) {
  const snap = cart.value;
  const l = snap.lines.find((x) => x.key === key);
  if (rawRemove(key) === false) return; // a module guard took over (e.g. item already sent to the kitchen)
  if (l) toast(t('{name} removed', { name: l.name }), { icon: 'trash', action: { label: t('Undo'), fn: () => restoreCart(snap) } });
}
import { catalog, levels, searchProducts, popularity, stockOf } from '../../db/catalog.js';
import { parseScaleBarcode, parseReceiptQr } from '../../lib/barcode.js';
import { money, kes } from '../../lib/money.js';
import { on } from '../../lib/bus.js';
import { beep } from '../../lib/sound.js';
import { cls, prettyPhone } from '../../lib/util.js';
import { Icon, Btn, Kbd, Badge, Avatar } from '../../ui/kit.jsx';
import { toast, confirm, hasModal, Dropdown, promptText } from '../../ui/overlay.jsx';
import { navigate } from '../../router.js';
import { can } from '../../auth/permissions.js';
import { requirePerm } from '../../auth/override.jsx';
import { licenceState } from '../../auth/session.js';
import { holdCart, openDrawer } from '../../core/sales.js';
import { db } from '../../db/index.js';
import { audit } from '../../db/repo.js';
import * as S from '../../state.js';
import { t, tn } from '../../i18n/index.js';
import { pickCustomer, editLine, editCartDiscount, recallHeld, pickVariant, askQty, pickModifiers, pickSerial, askHoldName } from './dialogs.jsx';
import { openTender } from './Tender.jsx';
import { StartCatalog } from '../products/StartCatalog.jsx';
import { openShiftDialog } from '../shifts/dialogs.jsx';
import { startTour, SELL_TOUR } from '../../ui/tour.jsx';
import { sellExtensions } from '../index.js';

const GRID_LIMIT = 240;

export default function SellPage() {
  initCart();
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const [tab, setTab] = useState(null);
  const [flash, setFlash] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [heldN, setHeldN] = useState(0);
  const searchRef = useRef();
  const cat = catalog.value;
  const st = S.settings.value;
  const c = cart.value;
  const calc = totals.value;

  // default tab: favourites if any
  const favs = useMemo(() => cat.products.filter((p) => p.favourite && p.active !== false && !p.parent_id), [cat.version]);
  const curTab = tab ?? (favs.length >= 12 ? 'fav' : 'all');
  // only show category tabs that have something to sell
  const catCount = useMemo(() => { const m = new Map(); for (const p of cat.products) if (!p.parent_id && p.active !== false) m.set(p.category_id, (m.get(p.category_id) || 0) + 1); return m; }, [cat.version]);
  const qtyPrefix = /^(\d+(?:\.\d+)?)\s*[*x×]\s*(.*)$/i.exec(q);
  const query = qtyPrefix ? qtyPrefix[2] : q;
  const results = useMemo(() => (query.trim() ? searchProducts(query, 40) : []), [query, cat.version]);
  useEffect(() => setHi(0), [q]);
  const refreshHeld = () => db().orders.where('status').equals('open').filter((o) => o.kind === 'held' && !o.deleted).count().then(setHeldN);
  useEffect(() => { refreshHeld(); return on('change', (e) => e === 'orders' && refreshHeld()); }, []);

  const grid = useMemo(() => {
    let list;
    if (curTab === 'fav') list = favs;
    else if (curTab === 'top') list = cat.products.filter((p) => !p.parent_id && p.active !== false).sort((a, b) => popularity(b.id) - popularity(a.id)).slice(0, 40);
    else list = cat.products.filter((p) => !p.parent_id && p.active !== false && (curTab === 'all' || p.category_id === curTab));
    if (curTab !== 'top') list = list.slice().sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name));
    return list;
  }, [curTab, cat.version, favs]);

  /* ---------- adding ---------- */
  async function addFlow(p, opts = {}) {
    if (!p) return;
    if (p.active === false) return toast.error(t('{name} is inactive', { name: p.name }));
    if (p.has_variants) { const v = await pickVariant(p); if (!v) return; p = v; }
    let qty = opts.qty ?? (qtyPrefix ? parseFloat(qtyPrefix[1]) : 1);
    const weighed = p.type === 'weight' || ['kg', 'g', 'l', 'ml', 'm'].includes(p.unit);
    if (weighed && opts.qty == null && !qtyPrefix && !opts.uom) { const w = await askQty(p); if (!w) return; qty = w; }
    let price = opts.price;
    if (price == null && p.allow_price_edit && !p.price) { const pr = await askQty(p, { title: t('Price for {name}', { name: p.name }), price: true }); if (!pr) return; price = pr; }
    let modifiers = [], note = '';
    if (p.modifiers_group_ids?.length) {
      const groups = (await db().modifier_groups.bulkGet(p.modifiers_group_ids)).filter(Boolean);
      if (groups.length) { const r = await pickModifiers(p, groups); if (!r) return; modifiers = r.modifiers; note = r.note; }
    }
    let serial = opts.serial || '';
    if (p.track_serials && !serial && S.modulesOn.value.serials !== false) { serial = await pickSerial(p); if (!serial) return; qty = 1; }
    if (p.track_stock && !st.allow_negative_stock) {
      const inCart = cart.value.lines.filter((l) => l.product_id === p.id).reduce((s, l) => s + l.qty * (l.factor || 1), 0);
      const need = inCart + qty * (opts.uom?.factor || 1);
      if (need > stockOf(p.id) + 1e-9) {
        const ok = await requirePerm('sell.negative_stock', t('Sell {name} with only {n} in stock', { name: p.name, n: stockOf(p.id) }));
        if (!ok) return;
      }
    }
    const key = addProduct(p, { qty, uom: opts.uom, price, modifiers, note, serial, priceOverride: false });
    for (const x of sellExtensions()) x.afterAdd?.(key, p);
    if (st.sound_on_scan) beep('scan');
    setFlash(p.id + ':' + Date.now());
    setQ('');
  }
  async function handleCode(raw) {
    const code = String(raw).trim();
    if (!code) return;
    const rq = parseReceiptQr(code);
    if (rq) { const s = await db().sales.where('no').equals(rq).first(); if (s) return navigate('/sales/' + s.id); }
    const hit = catalog.value.byCode.get(code) || catalog.value.byCode.get(code.toUpperCase());
    if (hit) return addFlow(hit.product, { uom: hit.uom || null, qty: hit.uom ? 1 : undefined });
    const sc = parseScaleBarcode(code, st);
    if (sc) {
      const p = catalog.value.byPlu.get(sc.plu);
      if (p) return sc.kind === 'weight' ? addFlow(p, { qty: sc.qty }) : addFlow(p, { qty: Math.round((sc.price / (p.price || 1)) * 1000) / 1000 });
    }
    if (st.sound_on_scan) beep('error');
    toast.error(t('Barcode {code} not found', { code }), can('products.edit') ? { action: { label: t('Add product'), fn: () => navigate('/products/new?barcode=' + encodeURIComponent(code)) } } : {});
  }
  const addRef = useRef({ handleCode, addFlow });
  addRef.current = { handleCode, addFlow };

  /* ---------- actions ---------- */
  async function pay(method) {
    if (!cart.value.lines.length) return toast.warn(t('Add items first'));
    const lic = licenceState();
    if (!lic.canSell) { toast.error(t('Selling is paused until the subscription is renewed.')); return navigate('/settings/licence'); }
    if (st.require_shift && !S.shift.value) { const sh = await openShiftDialog(); if (!sh) return; }
    if (!can('sell.use')) return toast.error(t('Your role cannot sell'));
    for (const x of sellExtensions()) if (x.beforePay && !(await x.beforePay())) return;
    const done = await openTender({ method });
    if (done) { setCartOpen(false); setTimeout(() => searchRef.current?.focus(), 50); }
  }
  async function hold() {
    if (!cart.value.lines.length) return recallHeld();
    for (const x of sellExtensions()) if (x.onHold && (await x.onHold())) return;
    const name = await askHoldName(cart.value.customer?.name || cart.value.heldName);
    if (!name) return;
    await holdCart({ name, lines: cart.value.lines, customer: cart.value.customer, cartDiscount: calc.cart_discount, note: cart.value.note, wholesale: cart.value.wholesale });
    clearCart();
    toast(t('Sale held as “{name}”. Recall it with F7.', { name }), { icon: 'pause' });
  }
  async function chooseCustomer() {
    const cst = await pickCustomer();
    if (cst !== undefined) setCustomer(cst);
  }
  async function clear() {
    if (!cart.value.lines.length) return;
    if (cart.value.lines.some((l) => l.sent_qty > 0)) return toast.warn(t('Some items were already sent to the kitchen. Remove them one by one or cancel the order.'));
    if (await confirm({ title: t('Clear the cart?'), message: t('All {n} items will be removed.', { n: cart.value.lines.length }), danger: true, ok: t('Clear cart') })) {
      const snap = cart.value;
      if (cart.value.lines.length > 2 || calc.total > 500000) await audit('cart.clear', 'sales', null, { lines: cart.value.lines.length, total: calc.total });
      clearCart();
      toast(t('Cart cleared'), { icon: 'trash', action: { label: t('Undo'), fn: () => restoreCart(snap) } });
    }
  }
  async function drawer() {
    const by = await requirePerm('sell.drawer', t('Open cash drawer'));
    if (!by) return;
    const reason = await promptText({ title: t('Open drawer'), label: t('Reason'), options: [t('Give change'), t('Check float'), t('Cash drop')], value: t('Give change'), ok: t('Open drawer') });
    if (reason == null) return;
    await openDrawer(reason);
    toast(t('Drawer opened — logged'), { icon: 'drawer' });
  }

  /* ---------- keyboard & scanner ---------- */
  useEffect(() => {
    const offScan = on('scan', (code, meta) => {
      if (hasModal()) return;
      const box = searchRef.current;
      if (box && meta?.target === box) {
        // the scan landed in the search box: use the whole field (robust if the device was busy and the burst got split)
        const v = box.value.trim();
        if (v.length > code.length && v.endsWith(code)) {
          const known = (x) => catalog.value.byCode.has(x) || catalog.value.byCode.has(x.toUpperCase());
          code = [v, v.slice(-13), v.slice(-12), v.slice(-8)].find(known) || code;
        }
        box.value = ''; setQ('');
      }
      addRef.current.handleCode(code);
    });
    const offAdd = on('sell:add', (id) => addRef.current.addFlow(catalog.value.byId.get(id)));
    const h = (e) => {
      if (hasModal() || S.phase.value !== 'app') return;
      const inField = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && e.target !== searchRef.current;
      const k = e.key;
      const sel = selKey.value;
      if (k === 'F2') { e.preventDefault(); searchRef.current?.focus(); searchRef.current?.select(); }
      else if (k === 'F4') { e.preventDefault(); pay(); }
      else if (k === 'F6') { e.preventDefault(); cart.value.lines.length && editCartDiscount(); }
      else if (k === 'F7') { e.preventDefault(); recallHeld(); }
      else if (k === 'F8') { e.preventDefault(); hold(); }
      else if (k === 'F9') { e.preventDefault(); chooseCustomer(); }
      else if (k === 'F10') { e.preventDefault(); drawer(); }
      else if (k === '*' && sel && !(e.target === searchRef.current && searchRef.current.value)) { e.preventDefault(); editLine(sel); }
      else if (inField) return;
      else if (k === 'Delete' && (e.ctrlKey || e.shiftKey)) { e.preventDefault(); clear(); }
      else if (k === 'Delete' && sel) { e.preventDefault(); removeLine(sel); }
      else if ((k === '+' || k === '=') && sel && !searchRef.current?.value) { e.preventDefault(); const l = cart.value.lines.find((x) => x.key === sel); l && setQty(sel, l.qty + 1); }
      else if (k === '-' && sel && !searchRef.current?.value) { e.preventDefault(); const l = cart.value.lines.find((x) => x.key === sel); l && setQty(sel, l.qty - 1); }
      else if ((k === 'ArrowUp' || k === 'ArrowDown') && !searchRef.current?.value) {
        const ls = cart.value.lines; if (!ls.length) return;
        e.preventDefault();
        const i = ls.findIndex((x) => x.key === sel);
        selKey.value = ls[Math.max(0, Math.min(ls.length - 1, (i < 0 ? ls.length : i) + (k === 'ArrowUp' ? -1 : 1)))].key;
      }
      else if (k === 'Enter' && e.target === searchRef.current && !searchRef.current.value && cart.value.lines.length) { e.preventDefault(); pay(); }

    };
    window.addEventListener('keydown', h);
    setTimeout(() => { if (window.innerWidth > 720) searchRef.current?.focus(); }, 60);
    const tourT = setTimeout(() => startTour('sell', SELL_TOUR), 700);
    return () => { clearTimeout(tourT); offScan(); offAdd(); window.removeEventListener('keydown', h); };
  }, []);

  const onSearchKey = (e) => {
    if (e.key === 'ArrowDown' && results.length) { e.preventDefault(); setHi((v) => Math.min(results.length - 1, v + 1)); }
    else if (e.key === 'ArrowUp' && results.length) { e.preventDefault(); setHi((v) => Math.max(0, v - 1)); }
    else if (e.key === 'Escape') { if (q) { e.preventDefault(); e.stopPropagation(); setQ(''); } }
    else if (e.key === 'Enter' && e._ppScan) { e.preventDefault(); }
    else if (e.key === 'Enter' && q.trim()) {
      e.preventDefault();
      const exact = catalog.value.byCode.get(query.trim()) || catalog.value.byCode.get(query.trim().toUpperCase());
      if (exact || /^\d{8,14}$/.test(query.trim())) { setQ(''); return handleCode(query.trim()); }
      if (results[hi]) addFlow(results[hi]);
    }
  };

  const lv = levels.value;
  const custBtn = (
    <button class={'cust-btn' + (c.customer ? ' has' : '')} onClick={chooseCustomer} aria-label={t('Customer')}>
      <Icon name={c.customer ? 'user' : 'user-plus'} size={20} />
      <span class="grow ellipsis">{c.customer ? c.customer.name : t('Add customer')}<small>{c.customer ? prettyPhone(c.customer.phone) + (c.customer.loyalty_points ? ' · ★ ' + c.customer.loyalty_points : '') : t('Walk-in customer')}</small></span>
      {c.customer ? <span role="button" tabIndex={0} class="btn ghost icon xs" aria-label={t('Remove customer')} onClick={(e) => { e.stopPropagation(); setCustomer(null); }}><Icon name="x" size={14} /></span> : <Kbd>F9</Kbd>}
    </button>
  );
  return (
    <div class={cls('sell', cartOpen && 'cart-open')}>
      <section class="left" aria-label={t('Products')}>
        <div class="search">
          <Icon name="search" size={22} />
          <input ref={searchRef} class="input" type="search" value={q} onInput={(e) => setQ(e.target.value)} onKeyDown={onSearchKey} autocomplete="off" spellcheck={false}
            placeholder={t('Scan a barcode or type a product name…')} aria-label={t('Search products')} aria-autocomplete="list" />
          <div class="suf">{q && <button class="btn ghost icon xs" onClick={() => setQ('')} aria-label={t('Clear search')}><Icon name="x" size={16} /></button>}<span class="desk-only row gap-s"><Icon name="scan" size={18} style={{ color: 'var(--mute)' }} /><Kbd>F2</Kbd></span></div>
          {q.trim() && (
            <div class="results-pop" role="listbox">
              {qtyPrefix && <div class="small mute" style={{ padding: '6px 12px' }}>{t('Quantity')}: <b class="mono">{qtyPrefix[1]}</b></div>}
              {results.map((p, i) => {
                const stq = lv.get(p.id) || 0;
                return (
                  <div class={'res' + (i === hi ? ' on' : '')} role="option" aria-selected={i === hi} onMouseEnter={() => setHi(i)} onMouseDown={(e) => { e.preventDefault(); addFlow(p); }}>
                    <div class="ellipsis"><div class="nm ellipsis">{p.name}</div><div class="sub">{[p.sku, p.barcode, cat.catById.get(p.category_id)?.name].filter(Boolean).join(' · ')}</div></div>
                    {p.track_stock ? <Badge tone={stq <= (p.reorder_level || 0) ? 'bad' : ''}>{t('{n} left', { n: Math.round(stq * 100) / 100 })}</Badge> : <span />}
                    <span class="pr">{kes(p.price)}</span>
                  </div>
                );
              })}
              {!results.length && <div class="empty" style={{ padding: '20px' }}><b>{t('No product matches “{q}”', { q: query })}</b>{can('products.edit') && <Btn size="sm" icon="plus" onClick={() => navigate('/products/new?name=' + encodeURIComponent(query))}>{t('Add new product')}</Btn>}</div>}
            </div>
          )}
        </div>
        <div class="cat-tabs" role="tablist" aria-label={t('Categories')}>
          {favs.length > 0 && <button class={'chip' + (curTab === 'fav' ? ' on' : '')} onClick={() => setTab('fav')}><Icon name="star" size={15} />{t('Favourites')}</button>}
          <button class={'chip' + (curTab === 'top' ? ' on' : '')} onClick={() => setTab('top')}><Icon name="zap" size={15} />{t('Top sellers')}</button>
          <button class={'chip' + (curTab === 'all' ? ' on' : '')} onClick={() => setTab('all')}>{t('All')}</button>
          {cat.categories.filter((k) => catCount.get(k.id)).map((k) => <button class={'chip' + (curTab === k.id ? ' on' : '')} onClick={() => setTab(k.id)}><span class="sw" style={{ background: k.color }} />{k.name}</button>)}
        </div>
        <div class="tiles" role="list">
          {grid.slice(0, GRID_LIMIT).map((p) => {
            const k = cat.catById.get(p.category_id);
            const stq = lv.get(p.id) || 0;
            const fl = flash?.startsWith(p.id + ':') || (p.has_variants && flash && cat.byId.get(flash.split(':')[0])?.parent_id === p.id);
            return (
              <button class={cls('tile', fl && 'flash', p.image && 'has-im')} key={p.id + (fl ? flash : '')} style={{ '--c': k?.color || 'var(--navy)' }} onClick={() => addFlow(p)} role="listitem">
                {p.image ? <img class="im" src={p.image} alt="" /> : <span class="ci" style={{ color: k?.color }}><Icon name={p.has_variants ? 'layers' : k?.icon || 'box'} size={18} /></span>}
                <span class="nm">{p.name}</span>
                {p.has_variants && <span class="tag">{t('Sizes / colours')}</span>}
                {p.type === 'service' && <span class="tag">{p.service_duration_min ? p.service_duration_min + ' min' : t('Service')}</span>}
                <span class="pr">{kes(p.price)}{p.unit !== 'pc' && p.unit ? <span class="mute" style={{ fontSize: '12px' }}>/{p.unit}</span> : ''}</span>
                {p.track_stock && !p.has_variants && <span class={'st' + (stq <= (p.reorder_level || 0) ? ' low' : '')}>{t('{n} left', { n: Math.round(stq * 100) / 100 })}</span>}
              </button>
            );
          })}
          {grid.length > GRID_LIMIT && <div class="empty" style={{ gridColumn: '1/-1' }}>{t('Showing {a} of {b}. Search to find the rest.', { a: GRID_LIMIT, b: grid.length })}</div>}
          {!grid.length && (cat.products.length
            ? <div class="empty" style={{ gridColumn: '1/-1' }}><Icon name="box" size={32} /><b>{t('No products here yet')}</b>{can('products.edit') && <a class="btn sm" href="#/products/new">{t('Add product')}</a>}</div>
            : <div style={{ gridColumn: '1/-1' }}><StartCatalog /></div>)}
        </div>
      </section>

      <aside class="cart" aria-label={t('Cart')}>
        <div class="cart-top">
          <button class="btn ghost icon mobile-only" onClick={() => setCartOpen(false)} aria-label={t('Back to products')}><Icon name="arrow-left" /></button>
          {custBtn}
          <Dropdown trigger={({ toggle }) => <button class="btn" style={{ padding: '0 12px' }} onClick={toggle} aria-label={t('More actions')}><Icon name="more" /><span class="desk-only">{t('More')}</span></button>} width="270px">
            <a href="#/sales"><Icon name="undo" size={18} />{t('Return items / find a receipt')}</a>
            {S.modulesOn.value.wholesale && <button onClick={() => setWholesale(!c.wholesale)}><Icon name="truck" size={18} />{c.wholesale ? t('Switch to retail prices') : t('Use wholesale prices')}</button>}
            <button onClick={async () => { const n = await promptText({ title: t('Receipt note'), label: t('Shown on the receipt'), value: c.note, multiline: true }); if (n != null) setNote(n); }}><Icon name="note" size={18} />{c.note ? t('Edit receipt note') : t('Add receipt note')}</button>
            {can('sell.drawer') && <button onClick={drawer}><Icon name="drawer" size={18} />{t('Open cash drawer')}<span class="spacer" /><Kbd>F10</Kbd></button>}
            <hr />
            <button onClick={clear} disabled={!c.lines.length}><Icon name="trash" size={18} />{t('Clear cart')}<span class="spacer" /><Kbd>Ctrl Del</Kbd></button>
          </Dropdown>
        </div>
        {sellExtensions().map((x) => x.CartBar && <x.CartBar />)}
        {(c.wholesale || c.heldName || c.note) && (
          <div class="row wrap gap-s" style={{ padding: '8px 14px 0' }}>
            {c.wholesale && <Badge tone="navy"><Icon name="truck" size={12} />{t('Wholesale prices')}</Badge>}
            {c.heldName && <Badge tone="warn"><Icon name="pause" size={12} />{c.heldName}</Badge>}
            {c.note && <Badge><Icon name="note" size={12} />{t('Note')}</Badge>}
          </div>
        )}
        <div class="lines" role="list">
          {!c.lines.length ? (
            <div class="cart-empty">
              <div class="scanart"><Icon name="barcode" size={44} /></div>
              <h3 style={{ color: 'var(--text)' }}>{t('Ready to sell')}</h3>
              <p style={{ margin: 0 }}>{t('Scan a barcode, search, or tap a product.')}</p>
              <div class="col gap-s" style={{ marginTop: '10px', width: '100%', maxWidth: '260px' }}>
                {heldN > 0 && <Btn icon="play" onClick={recallHeld}>{t('{n} held sales', { n: heldN })}</Btn>}
                <a class="btn" href="#/sales"><Icon name="undo" />{t('Return items / find a receipt')}</a>
              </div>
            </div>
          ) : calc.lines.map((l) => <CartLine l={l} sel={selKey.value === l.key} />)}
        </div>
        <div class="totals">
          {(calc.discount > 0 || calc.tax_total > 0 || calc.rounding !== 0 || calc.service_charge > 0) && (
            <>
              <div class="tr"><span>{t('Subtotal')}</span><span class="mono">{kes(calc.subtotal)}</span></div>
              {calc.discount > 0 && <div class="tr"><button class="btn ghost xs" style={{ padding: 0, minHeight: 0, color: 'var(--coral-d)' }} onClick={editCartDiscount}>{t('Discount')}</button><span class="mono down">-{kes(calc.discount)}</span></div>}
              {calc.service_charge > 0 && <div class="tr"><span>{t('Service charge')}</span><span class="mono">{kes(calc.service_charge)}</span></div>}
              {calc.tax_total > 0 && <div class="tr"><span>{t('VAT included')}</span><span class="mono">{kes(calc.tax_total)}</span></div>}
              {calc.rounding !== 0 && <div class="tr"><span>{t('Rounding')}</span><span class="mono">{kes(calc.rounding)}</span></div>}
            </>
          )}
          <div class="grand"><span class="l">{t('Total')} <span class="mute small" style={{ fontFamily: 'var(--f-body)', fontWeight: 500 }}>· {tn(Math.round(calc.items * 100) / 100, '{n} item', '{n} items')}</span></span><span class="v" key={calc.total}>{money(calc.total)}</span></div>
        </div>
        <div class="cart-actions">
          <Btn onClick={hold} title="F8"><Icon name="pause" /><span class="lab">{t('Hold sale')}</span></Btn>
          <Btn onClick={recallHeld} title="F7" style={{ position: 'relative' }}><Icon name="play" /><span class="lab">{t('Held sales')}</span>{heldN > 0 && <span class="badge warn" style={{ position: 'absolute', top: '4px', right: '4px', height: '18px', padding: '0 6px' }}>{heldN}</span>}</Btn>
          <Btn onClick={() => c.lines.length && editCartDiscount()} title="F6" disabled={!c.lines.length}><Icon name="percent" /><span class="lab">{t('Discount')}</span></Btn>
          <Btn onClick={() => selKey.value && editLine(selKey.value)} title="*" disabled={!selKey.value}><Icon name="edit" /><span class="lab">{t('Change item')}</span></Btn>
        </div>
        <div class="pay-row">
          <Btn variant="primary" class="pay-btn" onClick={() => pay()} disabled={!c.lines.length}>
            <span class="row gap-s"><Icon name="wallet" size={22} />{t('Pay')}<Kbd>F4</Kbd></span><span class="amt">{money(calc.total)}</span>
          </Btn>
        </div>
      </aside>
      <div class="mini-cart-bar">
        <Btn variant="primary" onClick={() => setCartOpen(true)} aria-label={t('Open cart')}>
          <span class="row gap-s"><Icon name="cart" />{t('Cart')} · {c.lines.length}</span><span class="mono" style={{ fontWeight: 800 }}>{money(calc.total)}</span>
        </Btn>
      </div>
    </div>
  );
}

function CartLine({ l, sel }) {
  const p = catalog.value.byId.get(l.product_id);
  const weighed = ['kg', 'g', 'l', 'ml', 'm'].includes(l.unit);
  const staff = l.staff_id && S.users.value.find((u) => u.id === l.staff_id);
  return (
    <div class={'line' + (sel ? ' sel' : '')} role="listitem" onClick={() => (selKey.value = l.key)} onDblClick={() => editLine(l.key)}>
      <span class="nm">{l.name}</span>
      <span class="amt">{kes(l.total)}</span>
      <div class="meta">
        <span class="mono">{weighed ? l.qty.toFixed(3).replace(/0+$/, '').replace(/\.$/, '') : l.qty} {l.unit !== 'pc' ? l.unit : ''} × {kes(l.price)}</span>
        {l.promo_id && <span class="badge ok">{t('Promo')}</span>}
        {l.price_override && <span class="badge warn">{t('Price changed')}</span>}
        {l.discount_total > 0 && <span class="disc">-{kes(l.discount_total)}</span>}
        {l.serial && <span class="mono">SN {l.serial}</span>}
        {staff && !S.modulesOn.value.services && <span>· {staff.name.split(' ')[0]}</span>}
        {l.modifiers?.length > 0 && <span>+ {l.modifiers.map((m) => m.name).join(', ')}</span>}
        {l.note && <span>“{l.note}”</span>}
        {sellExtensions().map((x) => x.LineExtra && <x.LineExtra l={l} />)}
      </div>
      {sel && (
        <div class="ops" onClick={(e) => e.stopPropagation()}>
          <div class="qty">
            <button onClick={() => setQty(l.key, l.qty - (weighed ? 0.25 : 1))} aria-label={t('Less')}><Icon name="minus" size={16} /></button>
            <input value={l.qty} inputMode="decimal" aria-label={t('Quantity')} onFocus={(e) => e.target.select()} disabled={!!l.serial}
              onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setQty(l.key, v); }} onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }} />
            <button onClick={() => setQty(l.key, l.qty + (weighed ? 0.25 : 1))} aria-label={t('More')} disabled={!!l.serial}><Icon name="plus" size={16} /></button>
          </div>
          {p?.units_of_measure?.length > 0 && (
            <select class="input" style={{ width: 'auto', minHeight: '36px', height: '36px' }} value={l.uom || ''} aria-label={t('Unit')}
              onChange={(e) => { const u = p.units_of_measure.find((x) => x.name === e.target.value); updateLine(l.key, u ? { uom: u.name, unit: u.name, factor: u.factor, price: u.price, orig_price: u.price } : { uom: null, unit: p.unit, factor: 1, price: p.price, orig_price: p.price }); }}>
              <option value="">{p.unit || 'pc'}</option>{p.units_of_measure.map((u) => <option value={u.name}>{u.name}</option>)}
            </select>
          )}
          <span class="spacer" />
          <Btn size="sm" icon="edit" onClick={() => editLine(l.key)}>{t('Edit')}</Btn>
          <Btn size="sm" icon="trash" variant="danger" aria-label={t('Remove')} onClick={() => removeLine(l.key)} />
        </div>
      )}
    </div>
  );
}
