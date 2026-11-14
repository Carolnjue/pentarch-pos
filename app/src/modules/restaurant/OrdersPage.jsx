// Takeaway & delivery queue: customer, phone, address, rider, status steps, kitchen state, payment.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { PageHeader, Btn, Icon, Badge, Empty, Tabs } from '../../ui/kit.jsx';
import { toast, confirm, promptText } from '../../ui/overlay.jsx';
import { save } from '../../db/repo.js';
import { db } from '../../db/index.js';
import { on } from '../../lib/bus.js';
import { navigate } from '../../router.js';
import { money } from '../../lib/money.js';
import { prettyPhone, waLink, DAY } from '../../lib/util.js';
import { cart } from '../sell/cart.js';
import { holdCart } from '../../core/sales.js';
import * as S from '../../state.js';
import { t, tn } from '../../i18n/index.js';
import { STEPS, STEP_LABEL, orderCalc, ticketsFor, kitchenState, createOrder, loadOrder, leaveOrder, here } from './logic.js';
import { askOrderInfo } from './dialogs.jsx';
import { elapsed } from './FloorPage.jsx';
import './restaurant.css';

const DONE = new Set(['collected', 'delivered']);
export default function OrdersPage() {
  const [list, setList] = useState(null);
  const [tks, setTks] = useState([]);
  const [tab, setTab] = useState('open');
  const [, tick] = useState(0);
  const load = async () => {
    const since = Date.now() - DAY;
    const rows = (await db().orders.where('updated_at').above(since - 2 * DAY).toArray()).filter((o) => here(o) && (o.kind === 'takeaway' || o.kind === 'delivery') && o.status !== 'cancelled');
    setList(rows.sort((a, b) => (a.opened_at || a.created_at) - (b.opened_at || b.created_at)));
    setTks(await ticketsFor(rows.map((o) => o.id)));
  };
  useEffect(() => {
    load();
    const off = on('change', (e) => ['orders', 'kitchen_tickets', 'sales'].includes(e) && load());
    const iv = setInterval(() => tick((x) => x + 1), 30000);
    return () => { off(); clearInterval(iv); };
  }, []);
  const groups = useMemo(() => {
    const L = list || [];
    const active = L.filter((o) => !(o.status === 'paid' && DONE.has(o.delivery_status)));
    return {
      open: active,
      takeaway: active.filter((o) => o.kind === 'takeaway'),
      delivery: active.filter((o) => o.kind === 'delivery'),
      done: L.filter((o) => o.status === 'paid' && DONE.has(o.delivery_status) && (o.updated_at > Date.now() - DAY)).reverse()
    };
  }, [list]);
  const start = async (kind) => {
    const info = await askOrderInfo(kind, { name: '', phone: '' });
    if (!info) return;
    const c = cart.value;
    if (c.meta?.order_id) await leaveOrder();
    else if (c.lines.length) await holdCart({ name: t('Counter sale'), lines: c.lines, customer: c.customer, cartDiscount: 0, note: c.note, wholesale: c.wholesale });
    const o = await createOrder({ kind, info });
    loadOrder(o);
    navigate('/sell');
  };
  const open = async (o) => {
    const c = cart.value;
    if (c.meta?.order_id && c.meta.order_id !== o.id) await leaveOrder();
    else if (!c.meta?.order_id && c.lines.length) {
      if (!(await confirm({ title: t('Hold the current sale?'), message: t('The Sell screen has items that are not on this order. They will be held so you can recall them later.'), ok: t('Hold and open order') }))) return;
      await holdCart({ name: t('Counter sale'), lines: c.lines, customer: c.customer, cartDiscount: 0, note: c.note, wholesale: c.wholesale });
    }
    if (o.status === 'paid') return navigate(o.sale_id ? '/sales/' + o.sale_id : '/sales');
    loadOrder(o);
    navigate('/sell');
  };
  const step = async (o, to) => {
    await save('orders', { ...o, delivery_status: to, [to + '_at']: Date.now() }, { audit: { action: 'order.status', details: { no: o.no, status: to } } });
    if (to === 'ready' && o.phone) toast(t('Order #{no} is ready', { no: o.no }), { action: { label: t('Tell customer'), fn: () => window.open(waLink(o.phone, t('Hello {name}, your order #{no} from {biz} is ready.', { name: (o.customer_name || '').split(' ')[0], no: o.no, biz: S.business.value?.name })), '_blank', 'noopener') } });
  };
  const rider = async (o) => {
    const r = await promptText({ title: t('Rider for #{no}', { no: o.no }), label: t('Rider name'), value: o.rider || '', options: S.users.value.filter((u) => u.active !== false).slice(0, 6).map((u) => u.name), ok: t('Save') });
    if (r != null) await save('orders', { ...o, rider: r.trim() });
  };
  if (!list) return <div class="page" />;
  const shown = groups[tab];
  return (
    <div class="page wide">
      <PageHeader title={t('Takeaway & delivery')} sub={tn(groups.open.length, '{n} order in the queue', '{n} orders in the queue')}
        actions={<>
          <Btn icon="utensils" onClick={() => navigate('/tables')}>{t('Tables')}</Btn>
          <Btn icon="bag" variant="navy" onClick={() => start('takeaway')}>{t('New takeaway')}</Btn>
          <Btn icon="truck" variant="primary" onClick={() => start('delivery')}>{t('New delivery')}</Btn>
        </>} />
      <Tabs value={tab} onValue={setTab} tabs={[
        { value: 'open', label: t('All open'), count: groups.open.length }, { value: 'takeaway', label: t('Takeaway'), count: groups.takeaway.length },
        { value: 'delivery', label: t('Delivery'), count: groups.delivery.length }, { value: 'done', label: t('Done today'), count: groups.done.length }]} />
      {!shown.length ? (
        <div class="card mt"><Empty icon={tab === 'delivery' ? 'truck' : 'bag'} title={tab === 'done' ? t('Nothing finished yet today') : t('No orders waiting')} text={tab === 'done' ? '' : t('Tap New takeaway or New delivery when a customer orders by phone or at the counter.')} /></div>
      ) : (
        <div class="q-grid mt">
          {shown.map((o) => {
            const steps = STEPS[o.kind];
            const i = Math.max(0, steps.indexOf(o.delivery_status || 'new'));
            const next = steps[i + 1];
            const kst = kitchenState(tks.filter((x) => x.order_id === o.id));
            const total = orderCalc(o).total;
            const paid = o.status === 'paid';
            return (
              <div class={'card q-card k-' + o.kind}>
                <div class="q-h">
                  <span class="q-ico"><Icon name={o.kind === 'delivery' ? 'truck' : 'bag'} size={18} /></span>
                  <div class="grow ellipsis"><b>#{o.no} · {o.customer_name || t('Walk-in customer')}</b><div class="small mute">{elapsed(o.opened_at || o.created_at)} · {tn((o.lines || []).length, '{n} item', '{n} items')}</div></div>
                  <b class="mono">{money(paid ? o.paid_total || total : total)}</b>
                </div>
                <div class="q-steps" aria-label={t('Status')}>
                  {steps.map((s, k) => <span class={'q-step' + (k < i ? ' past' : k === i ? ' on' : '')}>{t(STEP_LABEL[s])}</span>)}
                </div>
                <div class="q-b">
                  {o.phone && <div class="row small"><Icon name="phone" size={15} /><a href={'tel:+' + o.phone}>{prettyPhone(o.phone)}</a></div>}
                  {o.address && <div class="row small start"><Icon name="pin" size={15} /><span>{o.address}</span></div>}
                  {o.kind === 'delivery' && <div class="row small"><Icon name="truck" size={15} /><span class="grow">{o.rider ? t('Rider: {name}', { name: o.rider }) : <span class="mute">{t('No rider yet')}</span>}</span><button class="btn ghost xs" onClick={() => rider(o)}>{o.rider ? t('Change') : t('Assign rider')}</button></div>}
                  <div class="row wrap gap-s">
                    {paid ? <Badge tone="ok"><Icon name="check" size={12} />{t('Paid')}</Badge> : <Badge tone="bad">{t('Not paid')}</Badge>}
                    {kst === 'cooking' && <Badge tone="warn">{t('In the kitchen')}</Badge>}
                    {kst === 'ready' && <Badge tone="ok">{t('Kitchen done')}</Badge>}
                    {kst === 'none' && !paid && (o.lines || []).length > 0 && <Badge>{t('Not sent to kitchen')}</Badge>}
                  </div>
                </div>
                <div class="q-f">
                  <Btn size="sm" icon={paid ? 'receipt' : 'cart'} onClick={() => open(o)}>{paid ? t('Receipt') : t('Open order')}</Btn>
                  {o.phone && <a class="btn sm ghost" href={waLink(o.phone, t('Hello {name}, this is {biz} about your order #{no}.', { name: (o.customer_name || '').split(' ')[0], biz: S.business.value?.name, no: o.no }))} target="_blank" rel="noopener" aria-label="WhatsApp"><Icon name="whatsapp" size={17} /></a>}
                  <span class="spacer" />
                  {next && <Btn size="sm" variant={next === 'ready' || DONE.has(next) ? 'ok' : 'navy'} onClick={() => step(o, next)}>{t(next === 'preparing' ? 'Start preparing' : next === 'ready' ? 'Mark ready' : next === 'on_the_way' ? 'Out for delivery' : next === 'delivered' ? 'Mark delivered' : 'Mark collected')}</Btn>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
