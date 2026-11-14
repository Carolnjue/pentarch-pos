// Command palette (Ctrl+K): jump to pages, run commands, find products, customers and receipts.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { openModal, useEscape } from '../ui/overlay.jsx';
import { Icon, Kbd } from '../ui/kit.jsx';
import { navItems, commands } from '../modules/index.js';
import { navigate } from '../router.js';
import { searchProducts } from '../db/catalog.js';
import { db } from '../db/index.js';
import { money } from '../lib/money.js';
import { norm } from '../lib/search.js';
import { emit } from '../lib/bus.js';
import { route } from '../state.js';
import { t } from '../i18n/index.js';
import { parseReceiptQr } from '../lib/barcode.js';

export const openPalette = () => openModal((close) => <Palette close={close} />);

function Palette({ close }) {
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const [custs, setCusts] = useState([]);
  const [sales, setSales] = useState([]);
  const inp = useRef();
  useEscape(() => close());
  useEffect(() => { inp.current?.focus(); db().customers.toArray().then((c) => setCusts(c.filter((x) => !x.deleted))); }, []);
  useEffect(() => {
    const s = (parseReceiptQr(q.trim()) || q.trim()).toUpperCase();
    if (s.length >= 3 && /\d/.test(s)) db().sales.where('no').startsWith(s).limit(5).toArray().then(setSales).catch(() => setSales([]));
    else if (/^\d{3,}$/.test(s)) db().sales.filter((x) => x.no.endsWith(s)).limit(5).toArray().then(setSales);
    else setSales([]);
  }, [q]);
  const items = useMemo(() => {
    const n = norm(q);
    const out = [];
    const nav = navItems().map((x) => ({ grp: t('Go to'), icon: x.icon, label: t(x.label), run: () => navigate(x.path), kw: norm(t(x.label) + ' ' + x.label) }));
    const cmds = commands().map((c) => ({ grp: t('Actions'), icon: c.icon || 'zap', label: t(c.label), run: c.run, kw: norm(t(c.label) + ' ' + c.label + ' ' + (c.keywords || '')), kbd: c.kbd }));
    for (const x of [...cmds, ...nav]) if (!n || x.kw.includes(n)) out.push(x);
    if (n) {
      for (const p of searchProducts(q, 6)) out.push({ grp: t('Products'), icon: 'box', label: p.name, sub: money(p.price), run: () => (route.value.path === '/sell' ? emit('sell:add', p.id) : navigate('/products/' + p.id)) });
      for (const c of custs.filter((c) => norm(c.name + ' ' + c.phone).includes(n)).slice(0, 5)) out.push({ grp: t('Customers'), icon: 'user', label: c.name, sub: c.phone, run: () => navigate('/customers/' + c.id) });
      for (const s of sales) out.push({ grp: t('Receipts'), icon: 'receipt', label: s.no, sub: money(s.total), run: () => navigate('/sales/' + s.id) });
    }
    return out.slice(0, 40);
  }, [q, custs, sales]);
  useEffect(() => setI(0), [q]);
  const run = (x) => { close(); setTimeout(() => x.run(), 10); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setI((v) => Math.min(items.length - 1, v + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setI((v) => Math.max(0, v - 1)); }
    else if (e.key === 'Enter' && items[i]) { e.preventDefault(); run(items[i]); }
  };
  let lastGrp = '';
  return (
    <div class="overlay" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div class="cmdk" role="dialog" aria-label={t('Command palette')}>
        <div class="q"><Icon name="search" /><input ref={inp} value={q} onInput={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder={t('Search pages, products, customers, receipts…')} aria-label={t('Search')} /><Kbd>Esc</Kbd></div>
        <div class="list" role="listbox">
          {!items.length && <div class="empty" style={{ padding: '24px' }}>{t('Nothing found')}</div>}
          {items.map((x, k) => {
            const head = x.grp !== lastGrp ? <div class="grp">{x.grp}</div> : null;
            lastGrp = x.grp;
            return <>{head}<div class={'it' + (k === i ? ' on' : '')} role="option" aria-selected={k === i} onMouseEnter={() => setI(k)} onClick={() => run(x)}>
              <span class="ii"><Icon name={x.icon} size={16} /></span><span class="grow ellipsis">{x.label}</span>{x.sub && <span class="mono small mute">{x.sub}</span>}{x.kbd && <Kbd>{x.kbd}</Kbd>}
            </div></>;
          })}
        </div>
      </div>
    </div>
  );
}
