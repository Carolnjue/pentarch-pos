// Shared UI for the Inventory and Purchasing modules: sub-navigation, product adder (search + scan),
// quantity field, branch levels hook, formatting helpers.
import './stock.css';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Icon, Badge, Tabs } from '../../ui/kit.jsx';
import { hasModal, toast } from '../../ui/overlay.jsx';
import { catalog, searchProducts, levels } from '../../db/catalog.js';
import { db } from '../../db/index.js';
import { on } from '../../lib/bus.js';
import { kes } from '../../lib/money.js';
import { navigate } from '../../router.js';
import { can } from '../../auth/permissions.js';
import { MOVE_TYPES, REASON_LABELS } from '../../core/inventory.js';
import * as S from '../../state.js';
import { t } from '../../i18n/index.js';

export const fq = (n) => { const v = Math.round((Number(n) || 0) * 1000) / 1000; return v.toLocaleString('en-KE', { maximumFractionDigits: 3 }); };
export const unitOf = (p) => (p && p.unit && p.unit !== 'pc' ? ' ' + p.unit : '');
export const d8 = (ms) => new Date(ms).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
export const dtm = (ms) => new Date(ms).toLocaleString('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
export const userName = (id) => S.users.value.find((u) => u.id === id)?.name || '';
export const branchName = (id) => S.branches.value.find((b) => b.id === id)?.name || '—';
export const multiBranch = () => S.branches.value.length > 1;
export const moveLabel = (type) => t(MOVE_TYPES[type] || type);
export const reasonLabel = (r) => (r ? t(REASON_LABELS[r] || r) : '');
const PAY = { cash: 'Cash', mpesa: 'M-Pesa', bank: 'Bank', cheque: 'Cheque', card: 'Card' };
export const payLabel = (m) => t(PAY[m] || m);
export const ctxPrint = () => ({ business: S.business.value, branch: S.branch.value, settings: S.settings.value });

/** Sub-navigation of the Stock area. */
export function StockTabs({ active }) {
  const mods = S.modulesOn.value;
  const tabs = [
    { value: '/inventory', label: t('Stock on hand'), icon: 'layers' },
    can('inventory.count') && { value: '/inventory/counts', label: t('Count stock'), icon: 'list' },
    can('inventory.adjust') && { value: '/inventory/adjustments', label: t('Adjustments'), icon: 'sliders' },
    (multiBranch() || mods.multi_branch) && can('inventory.transfer') && { value: '/inventory/transfers', label: t('Move stock'), icon: 'truck' },
    { value: '/inventory/reorder', label: t('Reorder'), icon: 'refresh' },
    { value: '/inventory/expiry', label: t('Expiry'), icon: 'calendar' },
    { value: '/inventory/serials', label: t('Serial / IMEI'), icon: 'hash' }
  ].filter(Boolean);
  return <Tabs value={active} onValue={navigate} tabs={tabs} />;
}
/** Sub-navigation of the Purchases area. */
export function BuyTabs({ active }) {
  const tabs = [
    { value: '/purchasing', label: t('Deliveries'), icon: 'truck' },
    { value: '/purchasing/orders', label: t('Purchase orders'), icon: 'file' },
    { value: '/purchasing/suppliers', label: t('Suppliers'), icon: 'store' },
    can('purchasing.pay') && { value: '/purchasing/payments', label: t('Payments'), icon: 'wallet' },
    { value: '/purchasing/returns', label: t('Returns to supplier'), icon: 'undo' }
  ].filter(Boolean);
  return <Tabs value={active} onValue={navigate} tabs={tabs} />;
}

/** Resolve a scanned / typed code to {product, factor, uom}. */
export function resolveCode(code) {
  const c = String(code || '').trim();
  const hit = catalog.value.byCode.get(c) || catalog.value.byCode.get(c.toUpperCase());
  if (!hit) return null;
  return { product: hit.product, uom: hit.uom || null, factor: hit.uom?.factor || 1 };
}
/** Subscribe to scanner bursts while mounted. Page handlers ignore scans while a dialog is open; dialogs pass {dialog: true}. */
export function useScan(fn, deps = [], { dialog = false } = {}) {
  const ref = useRef(fn); ref.current = fn;
  useEffect(() => on('scan', (code) => { if (!dialog && hasModal()) return; ref.current(code); }), deps);
}
/** Live stock levels for a branch (the current branch uses the catalogue cache). */
export function useBranchLevels(branchId) {
  const cur = S.branch.value?.id;
  const [lv, setLv] = useState(null);
  useEffect(() => {
    if (!branchId || branchId === cur) { setLv(null); return; }
    let live = true;
    const load = () => db().stock_levels.where('branch_id').equals(branchId).toArray().then((rows) => live && setLv(new Map(rows.map((r) => [r.product_id, r.qty]))));
    load();
    const off = on('change', (e) => (e === 'stock_levels' || e === 'stock_moves') && load());
    return () => { live = false; off(); };
  }, [branchId, cur]);
  return !branchId || branchId === cur ? levels.value : lv || new Map();
}

/** Inline product search with keyboard navigation; Enter picks the exact code or the first result. */
export function ProductAdder({ onPick, filter = (p) => p.track_stock, placeholder, autoFocus, inputRef, showStock = true }) {
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const [open, setOpen] = useState(false);
  const own = useRef();
  const ref = inputRef || own;
  const list = useMemo(() => (q.trim() ? searchProducts(q, 40).filter(filter).slice(0, 12) : []), [q, catalog.value.version]);
  const pick = (p, extra) => { if (!p) return; onPick(p, extra); setQ(''); setOpen(false); setHi(0); };
  return (
    <div class="adder">
      <div class="input-wrap"><Icon name="search" size={18} />
        <input ref={ref} class="input" value={q} data-scan="own" placeholder={placeholder || t('Type a name or scan a barcode')} aria-label={placeholder || t('Find a product')} autoFocus={autoFocus}
          onInput={(e) => { setQ(e.target.value); setHi(0); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHi(Math.min(list.length - 1, hi + 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(Math.max(0, hi - 1)); }
            else if (e.key === 'Enter') {
              // the whole field value: a scanner burst typed here arrives as one code (data-scan="own")
              e.preventDefault(); const v = e.target.value.trim(); const r = resolveCode(v);
              if (r && filter(r.product)) pick(r.product, r);
              else if (r) { setQ(''); toast.warn(t('{name} cannot be used here', { name: r.product.name })); }
              else if (list[hi] && !/^\d{8,}$/.test(v)) pick(list[hi]);
              else if (v) { setQ(''); toast.error(t('Barcode {c} not found', { c: v })); }
            }
            else if (e.key === 'Escape' && q) { e.stopPropagation(); setQ(''); }
          }} />
      </div>
      {open && q.trim() && (
        <div class="pop" role="listbox">
          {list.map((p, i) => (
            <div class={'res' + (i === hi ? ' on' : '')} role="option" aria-selected={i === hi} onMouseDown={(e) => { e.preventDefault(); pick(p); }} onMouseEnter={() => setHi(i)}>
              <div class="grow"><b class="ellipsis" style={{ display: 'block' }}>{p.name}</b><span class="small mute mono">{[p.sku, p.barcode].filter(Boolean).join(' · ')}</span></div>
              {showStock && p.track_stock && <Badge>{fq(levels.value.get(p.id) || 0)}{unitOf(p)}</Badge>}
              <span class="mono small mute">{kes(p.price)}</span>
            </div>
          ))}
          {!list.length && <div class="res mute">{t('Nothing found. Check the spelling or scan the barcode.')}</div>}
        </div>
      )}
    </div>
  );
}

/** Quantity field with − / + (decimals allowed for kg/l). */
export function QtyIn({ value, onValue, step = 1, min = 0, label, id }) {
  const [txt, setTxt] = useState(value == null ? '' : String(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setTxt(value == null ? '' : String(value)); }, [value]);
  const set = (v) => { const n = Math.max(min, Math.round(v * 1000) / 1000); setTxt(String(n)); onValue(n); };
  return (
    <div class="qty-in">
      <button type="button" onClick={() => set((parseFloat(txt) || 0) - step)} aria-label={t('Less')} tabIndex={-1}><Icon name="minus" size={16} /></button>
      <input id={id} value={txt} inputMode="decimal" aria-label={label || t('Quantity')} onFocus={(e) => { focused.current = true; e.target.select(); }} onBlur={() => { focused.current = false; }}
        onInput={(e) => { setTxt(e.target.value); const n = parseFloat(e.target.value); onValue(isNaN(n) ? 0 : n); }} />
      <button type="button" onClick={() => set((parseFloat(txt) || 0) + step)} aria-label={t('More')} tabIndex={-1}><Icon name="plus" size={16} /></button>
    </div>
  );
}

/** Branch select shown only for multi-branch businesses. */
export function BranchSelect({ value, onValue, label }) {
  if (!multiBranch()) return null;
  return (
    <select class="input" style={{ width: 'auto', maxWidth: '240px' }} value={value} onChange={(e) => onValue(e.target.value)} aria-label={label || t('Branch')}>
      {S.branches.value.map((b) => <option value={b.id}>{b.name}</option>)}
    </select>
  );
}

export function ActTile({ icon, title, sub, onClick, href, tone = 'navy', main }) {
  const colors = { navy: ['var(--navy-50)', 'var(--navy)'], teal: ['var(--teal-50)', 'var(--teal-d)'], sun: ['var(--sun-50)', 'var(--sun-d)'], coral: ['var(--coral-50)', 'var(--coral-d)'] }[tone];
  const inner = <><span class="ib" style={main ? { background: 'var(--coral-d)', color: '#fff' } : { background: colors[0], color: colors[1] }}><Icon name={icon} size={20} /></span><span class="grow"><b>{title}</b>{sub && <small>{sub}</small>}</span></>;
  return href ? <a class={'inv-act' + (main ? ' hero' : '')} href={href}>{inner}</a> : <button type="button" class={'inv-act' + (main ? ' hero' : '')} onClick={onClick}>{inner}</button>;
}

export function StatusPill({ s }) {
  const map = { draft: ['', 'Draft'], sent: ['navy', 'Sent'], partial: ['warn', 'Part received'], received: ['ok', 'Received'], cancelled: ['bad', 'Cancelled'], open: ['warn', 'In progress'], applied: ['ok', 'Applied'], transit: ['warn', 'On the way'] };
  const [tone, label] = map[s] || ['', s];
  return <Badge tone={tone}>{t(label)}</Badge>;
}

export function Done({ title, text, children }) {
  return (
    <div class="card done-card">
      <div class="tick"><Icon name="check" size={38} stroke={3} /></div>
      <h2>{title}</h2>
      {text && <p class="mute" style={{ margin: 0 }}>{text}</p>}
      <div class="row wrap">{children}</div>
    </div>
  );
}
