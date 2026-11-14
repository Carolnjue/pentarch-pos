// Floor view: tables by area with status colours and elapsed time; tap a table to open its order.
// Edit layout: drag tables, add / rename / reshape / delete, add areas.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { PageHeader, Btn, Icon, Empty, Input, Seg } from '../../ui/kit.jsx';
import { openModal, Modal, toast, confirm, promptText } from '../../ui/overlay.jsx';
import { save, saveMany, remove } from '../../db/repo.js';
import { db } from '../../db/index.js';
import { on } from '../../lib/bus.js';
import { navigate } from '../../router.js';
import { money } from '../../lib/money.js';
import { can } from '../../auth/permissions.js';
import { holdCart } from '../../core/sales.js';
import { cart } from '../sell/cart.js';
import * as S from '../../state.js';
import { t, tn } from '../../i18n/index.js';
import { loadTables, openOrders, ticketsFor, kitchenState, orderCalc, createOrder, loadOrder, leaveOrder, firstName, natural, typicalLayout } from './logic.js';
import { askGuests } from './dialogs.jsx';
import './restaurant.css';

const LS = 'ppos.floor.area';
const SIZE = (tb) => {
  const s = tb.seats || 4;
  if (tb.shape === 'rect') return { w: s > 6 ? 170 : 130, h: 96 };
  if (tb.shape === 'square') return { w: 100, h: 100 };
  const d = s <= 2 ? 90 : s <= 4 ? 104 : 118;
  return { w: d, h: d };
};
const mins = (ms) => Math.max(0, Math.floor((Date.now() - ms) / 60000));
export const elapsed = (ms) => { const m = mins(ms); return m < 60 ? m + ' min' : Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0'); };

export default function FloorPage({ query }) {
  const [tables, setTables] = useState(null);
  const [orders, setOrders] = useState([]);
  const [tks, setTks] = useState([]);
  const [area, setArea] = useState(() => { try { return localStorage.getItem(LS) || ''; } catch { return ''; } });
  const [edit, setEdit] = useState(false);
  const [, tick] = useState(0);
  const attach = query?.attach === '1' && cart.value.lines.length > 0 && !cart.value.meta?.order_id;
  const load = async () => {
    const [tb, os] = await Promise.all([loadTables(), openOrders()]);
    setTables(tb); setOrders(os);
    setTks(await ticketsFor(os.map((o) => o.id)));
  };
  useEffect(() => {
    load();
    const off = on('change', (e) => ['tables', 'orders', 'kitchen_tickets'].includes(e) && load());
    const iv = setInterval(() => tick((x) => x + 1), 30000);
    return () => { off(); clearInterval(iv); };
  }, [S.branch.value?.id]);
  // areas in the order they were created; the biggest room first when created together
  const areas = useMemo(() => {
    const m = new Map();
    for (const x of tables || []) { const a = x.area || t('Main hall'); const g = m.get(a) || { a, at: Infinity, n: 0 }; g.at = Math.min(g.at, x.created_at || 0); g.n++; m.set(a, g); }
    return [...m.values()].sort((x, y) => Math.round(x.at / 60000) - Math.round(y.at / 60000) || y.n - x.n).map((g) => g.a);
  }, [tables]);
  const cur = areas.includes(area) ? area : areas[0] || '';
  const busy = useMemo(() => new Map(orders.filter((o) => o.kind === 'table' && o.table_id).map((o) => [o.table_id, o])), [orders]);
  const queue = orders.filter((o) => o.kind !== 'table').length;
  const pick = (a) => { setArea(a); try { localStorage.setItem(LS, a); } catch {} };

  async function switchTo(order) {
    const c = cart.value;
    if (c.meta?.order_id && c.meta.order_id !== order.id) await leaveOrder();
    else if (!c.meta?.order_id && c.lines.length && !attach) {
      if (!(await confirm({ title: t('Hold the current sale?'), message: t('The Sell screen has items that are not on a table. They will be held so you can recall them later.'), ok: t('Hold and open table') }))) return;
      await holdCart({ name: t('Counter sale'), lines: c.lines, customer: c.customer, cartDiscount: 0, note: c.note, wholesale: c.wholesale });
    }
    loadOrder(order);
    navigate('/sell');
  }
  async function tap(tb) {
    const o = busy.get(tb.id);
    if (attach) {
      const c = cart.value;
      if (o) {
        if (!(await confirm({ title: t('Add to {name}?', { name: tb.name }), message: tn(c.lines.length, 'Add {n} item to the open bill on {name}.', 'Add {n} items to the open bill on {name}.', { name: tb.name }), ok: t('Add to table') }))) return;
        const upd = await save('orders', { ...o, lines: [...(o.lines || []), ...c.lines.map((l) => ({ ...l }))], status: 'open' });
        loadOrder(upd);
      } else {
        const g = S.settings.value.ask_guests === false ? 0 : await askGuests(tb);
        if (g === null || g === undefined) return;
        const ord = await createOrder({ kind: 'table', table: tb, guests: g, lines: c.lines.map((l) => ({ ...l })), customer: c.customer });
        loadOrder({ ...ord, customer: c.customer || null });
      }
      return navigate('/sell');
    }
    if (o) return switchTo(o);
    const g = S.settings.value.ask_guests === false ? 0 : await askGuests(tb);
    if (g === null || g === undefined) return;
    const ord = await createOrder({ kind: 'table', table: tb, guests: g });
    switchTo(ord);
  }

  if (!tables) return <div class="page" />;
  const shown = tables.filter((x) => (x.area || t('Main hall')) === cur);
  const free = tables.filter((x) => !busy.has(x.id)).length;
  const canEdit = can('tables.layout');
  const addTypical = async () => { await saveMany('tables', typicalLayout().map((x) => ({ ...x, branch_id: S.branch.value?.id || null }))); toast(t('12 tables added. Drag them to match your room.')); };
  return (
    <div class="page wide floor-page">
      <PageHeader title={t('Tables')} sub={tables.length ? t('{a} occupied · {b} free', { a: tables.length - free, b: free }) : t('Open a bill per table and send orders to the kitchen.')}
        actions={<>
          {can('tables.use') && <Btn icon="bag" onClick={() => navigate('/orders')}>{t('Takeaway & delivery')}{queue > 0 && <span class="badge warn">{queue}</span>}</Btn>}
          {canEdit && tables.length > 0 && <Btn icon={edit ? 'check' : 'edit'} variant={edit ? 'ok' : ''} onClick={() => setEdit(!edit)}>{edit ? t('Done editing') : t('Edit layout')}</Btn>}
        </>} />
      {attach && <div class="callout warn mb"><Icon name="utensils" size={18} /><span class="grow">{tn(cart.value.lines.length, 'Choose a table for the {n} item in the cart.', 'Choose a table for the {n} items in the cart.')}</span><Btn size="sm" onClick={() => navigate('/sell')}>{t('Cancel')}</Btn></div>}
      {!tables.length ? (
        <div class="card"><Empty icon="utensils" title={t('No tables yet')} text={t('Add your tables so waiters can open a bill per table. You can drag them to match your room.')}>
          {canEdit ? <div class="row wrap gap-s" style={{ justifyContent: 'center' }}>
            <Btn variant="primary" icon="grid" onClick={addTypical}>{t('Add a typical layout (12 tables)')}</Btn>
            <Btn icon="plus" onClick={() => editTable(null, { area: t('Main hall'), tables })}>{t('Add a table')}</Btn>
          </div> : <p>{t('Ask the owner or a manager to add tables.')}</p>}
        </Empty></div>
      ) : (
        <>
          <div class="row wrap mb" style={{ gap: '8px' }}>
            <div class="cat-tabs" style={{ padding: 0, flex: 1 }} role="tablist" aria-label={t('Areas')}>
              {areas.map((a) => {
                const ts = tables.filter((x) => (x.area || t('Main hall')) === a);
                const n = ts.filter((x) => busy.has(x.id)).length;
                return <button role="tab" aria-selected={a === cur} class={'chip' + (a === cur ? ' on' : '')} onClick={() => pick(a)}>{a}<span class="mono small" style={{ opacity: 0.75 }}>{n}/{ts.length}</span></button>;
              })}
            </div>
            {edit && <>
              <Btn size="sm" icon="plus" variant="navy" onClick={() => editTable(null, { area: cur, tables })}>{t('Add table')}</Btn>
              <Btn size="sm" icon="plus" onClick={async () => { const a = await promptText({ title: t('New area'), label: t('Area name'), placeholder: t('e.g. Garden, VIP, Upstairs'), ok: t('Add area'), required: true }); if (a?.trim()) { await save('tables', { name: nextName(tables), area: a.trim(), seats: 4, shape: 'round', x: 30, y: 30, branch_id: S.branch.value?.id || null }); pick(a.trim()); } }}>{t('Add area')}</Btn>
              <Btn size="sm" icon="edit" onClick={async () => { const a = await promptText({ title: t('Rename area'), label: t('Area name'), value: cur, required: true }); if (a?.trim() && a.trim() !== cur) { await saveMany('tables', shown.map((x) => ({ ...x, area: a.trim() }))); pick(a.trim()); } }}>{t('Rename area')}</Btn>
            </>}
          </div>
          {edit && <div class="callout mb"><Icon name="info" size={18} /><span>{t('Drag tables to move them. Tap a table to rename it, change seats or shape.')}</span></div>}
          <Floor tables={shown} busy={busy} tks={tks} edit={edit} onTap={edit ? (tb) => editTable(tb, { tables }) : tap} />
          <div class="legend floor-legend">
            <span><i class="flg free" />{t('Free')}</span><span><i class="flg busy" />{t('Occupied')}</span><span><i class="flg bill" />{t('Bill printed')}</span><span><i class="flg ready" />{t('Food ready')}</span>
          </div>
        </>
      )}
    </div>
  );
}

function Floor({ tables, busy, tks, edit, onTap }) {
  const box = useRef();
  const [w, setW] = useState(900);
  const [drag, setDrag] = useState(null); // {id, x, y}
  useLayoutEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el); setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const grid = w < 560;
  const pos = (tb) => (drag?.id === tb.id ? { x: drag.x, y: drag.y } : { x: tb.x || 0, y: tb.y || 0 });
  const maxX = Math.max(640, ...tables.map((tb) => pos(tb).x + SIZE(tb).w + 30));
  const maxY = Math.max(260, ...tables.map((tb) => pos(tb).y + SIZE(tb).h + 30));
  const scale = Math.min(1.25, w / maxX);
  const start = (e, tb) => {
    if (!edit || grid) return;
    e.preventDefault();
    const el = e.currentTarget; el.setPointerCapture?.(e.pointerId);
    const sx = e.clientX, sy = e.clientY, ox = tb.x || 0, oy = tb.y || 0;
    let moved = false;
    const mv = (ev) => {
      const dx = (ev.clientX - sx) / scale, dy = (ev.clientY - sy) / scale;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      if (moved) setDrag({ id: tb.id, x: Math.max(0, Math.round((ox + dx) / 10) * 10), y: Math.max(0, Math.round((oy + dy) / 10) * 10) });
    };
    const up = async (ev) => {
      el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
      if (!moved) { setDrag(null); return onTap(tb); }
      const dx = (ev.clientX - sx) / scale, dy = (ev.clientY - sy) / scale;
      const x = Math.max(0, Math.round((ox + dx) / 10) * 10), y = Math.max(0, Math.round((oy + dy) / 10) * 10);
      await save('tables', { ...tb, x, y });
      setDrag(null);
    };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  };
  return (
    <div ref={box} class={'floor' + (edit ? ' editing' : '') + (grid ? ' as-grid' : '')} style={grid ? {} : { height: Math.max(280, maxY * scale) + 'px' }}>
      {tables.slice().sort((a, b) => natural(a.name, b.name)).map((tb) => {
        const o = busy.get(tb.id);
        const st = !o ? 'free' : o.status === 'billed' ? 'bill' : 'busy';
        const ready = o && kitchenState(tks.filter((x) => x.order_id === o.id)) === 'ready';
        const sz = SIZE(tb), p = pos(tb);
        const style = grid ? {} : { left: p.x * scale + 'px', top: p.y * scale + 'px', width: sz.w * scale + 'px', height: sz.h * scale + 'px', fontSize: Math.max(11, 14 * Math.min(1, scale)) + 'px' };
        return (
          <button class={`ftable s-${st} sh-${tb.shape || 'round'}${ready ? ' ready' : ''}${drag?.id === tb.id ? ' dragging' : ''}`} style={style}
            onPointerDown={(e) => start(e, tb)} onClick={() => (!edit || grid) && onTap(tb)}
            aria-label={`${tb.name} — ${st === 'free' ? t('Free') : st === 'bill' ? t('Bill printed') : t('Occupied')}`}>
            <b class="fn">{tb.name}</b>
            {o ? <>
              <span class="fm mono">{money(orderCalc(o).total)}</span>
              <span class="fs">{o.guests ? <><Icon name="users" size={12} />{o.guests} · </> : ''}{elapsed(o.opened_at || o.created_at)}</span>
              {o.waiter_name && !grid && scale > 0.7 && <span class="fw">{firstName(o.waiter_name)}</span>}
            </> : <span class="fs">{edit ? tn(tb.seats || 0, '{n} seat', '{n} seats') : t('Free')}</span>}
            {ready && <span class="fready"><Icon name="check" size={11} />{t('Ready')}</span>}
          </button>
        );
      })}
    </div>
  );
}

const nextName = (tables) => 'T' + (Math.max(0, ...tables.map((x) => parseInt(String(x.name).replace(/\D/g, ''), 10) || 0)) + 1);
function freeSpot(tables, area) {
  const ts = tables.filter((x) => (x.area || '') === area);
  for (let y = 30; y < 2000; y += 150) for (let x = 30; x < 760; x += 150) if (!ts.some((tb) => Math.abs((tb.x || 0) - x) < 120 && Math.abs((tb.y || 0) - y) < 120)) return { x, y };
  return { x: 30, y: 30 };
}

const editTable = (tb, ctx) => openModal((close) => <TableEdit tb={tb} ctx={ctx} close={close} />);
function TableEdit({ tb, ctx, close }) {
  const areas = [...new Set(ctx.tables.map((x) => x.area).filter(Boolean))];
  const [f, setF] = useState(tb ? { name: tb.name, area: tb.area || '', seats: String(tb.seats || 4), shape: tb.shape || 'round' } : { name: nextName(ctx.tables), area: ctx.area || areas[0] || t('Main hall'), seats: '4', shape: 'round' });
  const set = (p) => setF({ ...f, ...p });
  const ok = async () => {
    if (!f.name.trim()) return toast.error(t('Enter a table name'));
    if (ctx.tables.some((x) => x.id !== tb?.id && x.name.toLowerCase() === f.name.trim().toLowerCase() && (x.area || '') === f.area)) return toast.error(t('Another table already has this name'));
    const rec = { ...(tb || { ...freeSpot(ctx.tables, f.area), branch_id: S.branch.value?.id || null }), name: f.name.trim(), area: f.area.trim() || t('Main hall'), seats: Math.max(1, parseInt(f.seats, 10) || 1), shape: f.shape };
    await save('tables', rec, { audit: { action: tb ? 'table.edit' : 'table.create', details: { name: rec.name } } });
    close(true);
  };
  const del = async () => {
    const open = (await openOrders()).some((o) => o.table_id === tb.id);
    if (open) return toast.error(t('This table has an open bill. Pay or move it first.'));
    if (!(await confirm({ title: t('Delete {name}?', { name: tb.name }), danger: true, ok: t('Delete') }))) return;
    await remove('tables', tb.id, { audit: { action: 'table.delete', details: { name: tb.name } } });
    close(true);
  };
  return (
    <Modal title={tb ? t('Edit {name}', { name: tb.name }) : t('Add table')} icon="utensils" size="sm" center onClose={() => close(null)}
      footer={<>{tb && <Btn variant="danger" icon="trash" onClick={del}>{t('Delete')}</Btn>}<span class="spacer" /><Btn onClick={() => close(null)}>{t('Cancel')}</Btn><Btn variant="primary" icon="check" onClick={ok}>{t('Save')}</Btn></>}>
      <div class="col">
        <Input label={t('Table name or number')} value={f.name} onValue={(v) => set({ name: v })} data-autofocus />
        <div class="field"><label>{t('Area')}</label>
          <input class="input" list="pp-areas" value={f.area} onInput={(e) => set({ area: e.target.value })} aria-label={t('Area')} />
          <datalist id="pp-areas">{areas.map((a) => <option value={a} />)}</datalist>
        </div>
        <div class="field"><label>{t('Seats')}</label>
          <div class="row wrap gap-s">{[1, 2, 4, 6, 8, 10].map((n) => <button class={'chip' + (+f.seats === n ? ' on' : '')} style={{ height: '44px', minWidth: '52px', justifyContent: 'center' }} onClick={() => set({ seats: String(n) })}>{n}</button>)}
            <input class="input mono num" style={{ width: '80px' }} inputMode="numeric" value={f.seats} onInput={(e) => set({ seats: e.target.value.replace(/\D/g, '') })} aria-label={t('Seats')} /></div>
        </div>
        <div class="field"><label>{t('Shape')}</label>
          <Seg value={f.shape} onValue={(v) => set({ shape: v })} options={[{ value: 'round', label: t('Round') }, { value: 'square', label: t('Square') }, { value: 'rect', label: t('Long') }]} />
        </div>
      </div>
    </Modal>
  );
}
