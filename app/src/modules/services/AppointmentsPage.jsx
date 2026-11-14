// Appointments: book a client + service + staff + time; today's list; mark arrived → opens the sale.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { PageHeader, Btn, Icon, Badge, Empty, Avatar, Input, Textarea } from '../../ui/kit.jsx';
import { openModal, Modal, toast, confirm, Dropdown } from '../../ui/overlay.jsx';
import { db } from '../../db/index.js';
import { on } from '../../lib/bus.js';
import { navigate } from '../../router.js';
import { catalog } from '../../db/catalog.js';
import { kes } from '../../lib/money.js';
import { prettyPhone, normPhone, waLink, dayKey, DAY } from '../../lib/util.js';
import { norm } from '../../lib/search.js';
import { can } from '../../auth/permissions.js';
import * as S from '../../state.js';
import { t, tn } from '../../i18n/index.js';
import { appointmentsOn, saveAppointment, setStatus, startSale, clash, serviceStaff, dayStart, isService } from './logic.js';
import { pickStaff } from './bridge.jsx';
import './services.css';

const STATUS = { booked: ['Booked', 'navy'], arrived: ['In the chair', 'warn'], done: ['Done@@status', 'ok'], cancelled: ['Cancelled', ''], no_show: ['Did not come', 'bad'] };
const hm = (ms) => new Date(ms).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
const dayLabel = (ms) => {
  const d = dayStart(ms), today = dayStart(Date.now());
  if (d === today) return t('Today');
  if (d === today + DAY) return t('Tomorrow');
  if (d === today - DAY) return t('Yesterday');
  return new Date(ms).toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'short' });
};

export default function AppointmentsPage({ query }) {
  const [day, setDay] = useState(() => (query?.day ? new Date(query.day + 'T00:00').getTime() : dayStart(Date.now())));
  const [list, setList] = useState(null);
  const [staff, setStaff] = useState('');
  const load = () => appointmentsOn(day).then(setList);
  useEffect(() => { load(); return on('change', (e) => e === 'appointments' && load()); }, [day]);
  const people = serviceStaff();
  const shown = (list || []).filter((a) => !staff || a.staff_id === staff);
  const active = shown.filter((a) => !['cancelled', 'no_show'].includes(a.status));
  const arrive = async (a) => { await startSale(a); toast(t('{name} is in. The sale is ready — add anything extra and tap Pay.', { name: a.customer_name || t('Client') })); navigate('/sell'); };
  return (
    <div class="page wide">
      <PageHeader title={t('Appointments')} sub={dayLabel(day) + ' · ' + tn(active.length, '{n} booking', '{n} bookings')}
        actions={can('appointments.use') && <Btn variant="primary" icon="plus" onClick={() => book({ day })}>{t('Book appointment')}</Btn>} />
      <div class="row wrap mb" style={{ gap: '8px' }}>
        <div class="row gap-s">
          <Btn icon="chevron-left" aria-label={t('Previous day')} onClick={() => setDay(day - DAY)} />
          <Btn variant={dayStart(Date.now()) === day ? 'navy' : ''} onClick={() => setDay(dayStart(Date.now()))}>{t('Today')}</Btn>
          <Btn icon="chevron-left" class="flip" aria-label={t('Next day')} onClick={() => setDay(day + DAY)} />
          <input class="input" type="date" style={{ width: '160px' }} value={dayKey(day)} aria-label={t('Date')} onChange={(e) => e.target.value && setDay(new Date(e.target.value + 'T00:00').getTime())} />
        </div>
        <div class="cat-tabs" style={{ padding: 0, flex: 1 }}>
          <button class={'chip' + (!staff ? ' on' : '')} onClick={() => setStaff('')}>{t('Everyone')}</button>
          {people.filter((u) => (list || []).some((a) => a.staff_id === u.id) || u.commission_pct > 0).map((u) => <button class={'chip' + (staff === u.id ? ' on' : '')} onClick={() => setStaff(u.id)}>{u.name.split(' ')[0]}</button>)}
        </div>
      </div>
      {!list ? <div class="card" style={{ minHeight: '220px' }} /> : !shown.length ? (
        <div class="card"><Empty icon="calendar" title={t('No appointments for {day}', { day: dayLabel(day).toLowerCase() })} text={t('Tap Book appointment when a client calls or walks in to book.')}>
          {can('appointments.use') && <Btn variant="primary" icon="plus" onClick={() => book({ day })}>{t('Book appointment')}</Btn>}
        </Empty></div>
      ) : (
        <div class="card appt-list">
          {shown.map((a) => {
            const u = S.users.value.find((x) => x.id === a.staff_id);
            const [lab, tone] = STATUS[a.status] || STATUS.booked;
            const late = a.status === 'booked' && a.start + 15 * 60000 < Date.now();
            return (
              <div class={'appt s-' + a.status}>
                <div class="appt-t"><b class="mono">{hm(a.start)}</b><span class="small mute">{a.duration_min || 30} min</span></div>
                <div class="grow appt-m">
                  <b>{a.customer_name || t('Walk-in client')}</b>
                  <div class="small mute">{a.service_name}{a.phone ? ' · ' + prettyPhone(a.phone) : ''}</div>
                  {a.note && <div class="small">“{a.note}”</div>}
                </div>
                <div class="appt-s">{u ? <><Avatar name={u.name} size={28} /><span class="small">{u.name.split(' ')[0]}</span></> : <span class="small mute">{t('Any staff')}</span>}</div>
                <div class="appt-st"><Badge tone={late ? 'bad' : tone}>{late ? t('Late') : t(lab)}</Badge></div>
                <div class="appt-a">
                  {a.status === 'booked' && can('sell.use') && <Btn variant="ok" icon="check" onClick={() => arrive(a)}>{t('Arrived — start sale')}</Btn>}
                  {a.status === 'arrived' && <Btn icon="cart" onClick={() => navigate('/sell')}>{t('Go to sale')}</Btn>}
                  {a.status === 'done' && a.sale_id && <Btn size="sm" variant="ghost" icon="receipt" onClick={() => navigate('/sales/' + a.sale_id)}>{t('Receipt')}</Btn>}
                  {can('appointments.use') && ['booked', 'arrived'].includes(a.status) && (
                    <Dropdown width="230px" trigger={({ toggle }) => <Btn icon="more" onClick={toggle} aria-label={t('More')} />}>
                      <button onClick={() => book({ rec: a })}><Icon name="edit" size={18} />{t('Change booking')}</button>
                      {a.phone && <a href={waLink(a.phone, t('Hello {name}, this is a reminder of your {service} appointment at {biz} on {when}.', { name: (a.customer_name || '').split(' ')[0], service: a.service_name, biz: S.business.value?.name, when: dayLabel(a.start).toLowerCase() + ' ' + hm(a.start) }))} target="_blank" rel="noopener"><Icon name="whatsapp" size={18} />{t('WhatsApp reminder')}</a>}
                      {a.phone && <a href={'tel:+' + a.phone}><Icon name="phone" size={18} />{t('Call')}</a>}
                      <hr />
                      <button onClick={() => setStatus(a, 'no_show')}><Icon name="ban" size={18} />{t('Did not come')}</button>
                      <button onClick={async () => { if (await confirm({ title: t('Cancel this booking?'), danger: true, ok: t('Cancel booking'), cancel: t('Keep') })) setStatus(a, 'cancelled'); }}><Icon name="x" size={18} />{t('Cancel booking')}</button>
                    </Dropdown>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- booking dialog ---------- */
export const book = (opts) => openModal((close) => <Book {...opts} close={close} />);
const SLOTS = Array.from({ length: 26 }, (_, i) => 7 * 60 + 30 + i * 30); // 07:30 … 20:00
function Book({ rec, day, close }) {
  const services = useMemo(() => catalog.value.products.filter((p) => isService(p) && p.active !== false && !p.deleted).sort((a, b) => a.name.localeCompare(b.name)), []);
  const [f, setF] = useState(() => rec ? { ...rec, date: dayKey(rec.start), time: new Date(rec.start).getHours() * 60 + new Date(rec.start).getMinutes(), phone: prettyPhone(rec.phone) }
    : { customer_id: null, customer_name: '', phone: '', product_id: '', service_name: '', duration_min: 30, staff_id: '', date: dayKey(day || Date.now()), time: null, note: '' });
  const [q, setQ] = useState('');
  const [custs, setCusts] = useState([]);
  const [busy, setBusy] = useState([]);
  const set = (p) => setF({ ...f, ...p });
  useEffect(() => { db().customers.toArray().then((c) => setCusts(c.filter((x) => !x.deleted))); }, []);
  useEffect(() => { appointmentsOn(new Date(f.date + 'T00:00').getTime()).then((l) => setBusy(l.filter((x) => x.id !== rec?.id && !['cancelled', 'no_show'].includes(x.status)))); }, [f.date]);
  const matches = useMemo(() => {
    const n = norm(f.customer_name), d = f.phone.replace(/\D/g, '').replace(/^0/, '');
    if (f.customer_id || (n.length < 2 && d.length < 3)) return [];
    return custs.filter((c) => (n.length >= 2 && norm(c.name).includes(n)) || (d.length >= 3 && (c.phone || '').includes(d))).slice(0, 4);
  }, [f.customer_name, f.phone, f.customer_id, custs]);
  const shownSvc = services.filter((p) => !q || norm(p.name).includes(norm(q)));
  const taken = (m) => f.staff_id && busy.some((x) => x.staff_id === f.staff_id && (() => { const s = new Date(x.start); const sm = s.getHours() * 60 + s.getMinutes(); return m < sm + (x.duration_min || 30) && sm < m + (f.duration_min || 30); })());
  const staffU = S.users.value.find((u) => u.id === f.staff_id);
  const ok = async () => {
    if (!f.customer_name.trim()) return toast.error(t('Enter the client name'));
    if (f.phone && !normPhone(f.phone)) return toast.error(t('Enter a valid Kenyan phone number'));
    if (!f.product_id) return toast.error(t('Choose a service'));
    if (f.time == null) return toast.error(t('Choose a time'));
    const start = new Date(f.date + 'T00:00').getTime() + f.time * 60000;
    const out = { ...(rec || {}), customer_id: f.customer_id || null, customer_name: f.customer_name.trim(), phone: normPhone(f.phone) || '', product_id: f.product_id, service_name: f.service_name, duration_min: f.duration_min || 30, staff_id: f.staff_id || null, start, note: (f.note || '').trim() };
    const c = await clash(out);
    if (c && !(await confirm({ title: t('{name} is already booked', { name: staffU?.name.split(' ')[0] || '' }), message: t('{client} has {service} at {time}. Book anyway?', { client: c.customer_name, service: c.service_name, time: hm(c.start) }), ok: t('Book anyway') }))) return;
    delete out.date; delete out.time;
    await saveAppointment(out);
    toast(rec ? t('Booking changed') : t('Booked {name} for {time}', { name: out.customer_name, time: hm(start) }));
    close(true);
  };
  return (
    <Modal title={rec ? t('Change booking') : t('Book appointment')} icon="calendar" size="lg" onClose={() => close(null)}
      footer={<><Btn onClick={() => close(null)}>{t('Cancel')}</Btn><Btn variant="primary" icon="check" onClick={ok}>{rec ? t('Save') : t('Book')}</Btn></>}>
      <div class="book-grid">
        <div class="col">
          <div class="section-title" style={{ marginTop: 0 }}>1 · {t('Client')}</div>
          <div class="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
            <Input label={t('Name')} value={f.customer_name} onValue={(v) => set({ customer_name: v, customer_id: null })} data-autofocus />
            <Input label={t('Phone')} type="tel" value={f.phone} onValue={(v) => set({ phone: v, customer_id: f.customer_id && v === f.phone ? f.customer_id : null })} placeholder="07xx xxx xxx" />
          </div>
          {matches.length > 0 && <div class="row wrap gap-s">{matches.map((c) => <button class="chip" onClick={() => set({ customer_id: c.id, customer_name: c.name, phone: prettyPhone(c.phone) })}><Icon name="user" size={14} />{c.name} · {prettyPhone(c.phone)}</button>)}</div>}
          {f.customer_id && <div class="small up"><Icon name="check" size={14} /> {t('Existing customer')}</div>}
          <div class="section-title">2 · {t('Service')}</div>
          {services.length > 8 && <div class="input-wrap"><Icon name="search" size={18} /><input class="input" value={q} onInput={(e) => setQ(e.target.value)} placeholder={t('Search services')} aria-label={t('Search services')} /></div>}
          <div class="svc-grid">
            {shownSvc.map((p) => <button class={'svc' + (f.product_id === p.id ? ' on' : '')} onClick={() => set({ product_id: p.id, service_name: p.name, duration_min: p.service_duration_min || 30 })}><b>{p.name}</b><span class="small">{kes(p.price)}{p.service_duration_min ? ' · ' + p.service_duration_min + ' min' : ''}</span></button>)}
            {!services.length && <div class="mute small">{t('No services yet. Add products of type “Service” first.')}</div>}
          </div>
        </div>
        <div class="col">
          <div class="section-title" style={{ marginTop: 0 }}>3 · {t('Who')}</div>
          <button class="btn block" style={{ justifyContent: 'flex-start', minHeight: '52px' }} onClick={async () => { const id = await pickStaff(t('Who will do it?'), f.staff_id); if (id !== null) set({ staff_id: id }); }}>
            {staffU ? <><Avatar name={staffU.name} size={30} />{staffU.name}</> : <><Icon name="users" />{t('Any staff — tap to choose')}</>}
          </button>
          <div class="section-title">4 · {t('When')}</div>
          <input class="input" type="date" value={f.date} onChange={(e) => e.target.value && set({ date: e.target.value })} aria-label={t('Date')} />
          <div class="slot-grid" role="listbox" aria-label={t('Time')}>
            {SLOTS.map((m) => { const tk = taken(m); return <button role="option" aria-selected={f.time === m} class={'slot' + (f.time === m ? ' on' : '') + (tk ? ' taken' : '')} title={tk ? t('Already booked') : ''} onClick={() => set({ time: m })}>{String(Math.floor(m / 60)).padStart(2, '0')}:{String(m % 60).padStart(2, '0')}</button>; })}
          </div>
          <Textarea label={t('Note (optional)')} value={f.note} onValue={(v) => set({ note: v })} rows={2} placeholder={t('e.g. bring own hair, colour 1B')} />
        </div>
      </div>
    </Modal>
  );
}
