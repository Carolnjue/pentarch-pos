// Services logic (no JSX): who can serve, commission rates, commission report rows, appointments.
import { db } from '../../db/index.js';
import { save } from '../../db/repo.js';
import { catalog } from '../../db/catalog.js';
import { cart, emptyCart, restoreCart, addProduct, setCustomer } from '../sell/cart.js';
import { holdCart } from '../../core/sales.js';
import * as S from '../../state.js';
import { t } from '../../i18n/index.js';

/** Staff who can be picked as "served by": active, not stock clerks / accountants. Commission earners first. */
export function serviceStaff() {
  return S.users.value.filter((u) => !u.deleted && u.active !== false && !['stock', 'accountant'].includes(u.role))
    .sort((a, b) => (b.commission_pct > 0) - (a.commission_pct > 0) || a.name.localeCompare(b.name));
}
export const isService = (p) => p?.type === 'service';

/**
 * Commission rate for a line: the service's own rate (product.commission_pct) wins, else the staff member's rate.
 * Products (not services) earn commission only when they have their own rate or settings.commission_on_products is on.
 */
export function rateFor(product, staff, st = S.settings.value) {
  if (product && product.commission_pct != null && product.commission_pct !== '') return Number(product.commission_pct) || 0;
  if (!staff) return 0;
  if (product && !isService(product) && !st.commission_on_products) return 0;
  return Number(staff.commission_pct) || 0;
}

/** Commission rows for sales between from..to (ms). Void sales excluded; returned quantities taken off. */
export async function commissionRows(from, to, staffId = '') {
  const [sales, rets, users] = await Promise.all([
    db().sales.where('created_at').between(from, to, true, true).toArray(),
    db().returns.where('created_at').between(from, to + 90 * 86400000, true, true).toArray(),
    db().users.toArray()
  ]);
  const uById = new Map(users.map((u) => [u.id, u]));
  const back = {};
  for (const r of rets) if (!r.deleted) for (const l of r.lines || []) back[r.sale_id + ':' + l.line_index] = (back[r.sale_id + ':' + l.line_index] || 0) + (l.amount || 0);
  const rows = [];
  for (const s of sales) {
    if (s.deleted || s.status === 'void' || (S.branch.value?.id && s.branch_id && s.branch_id !== S.branch.value.id)) continue;
    s.lines.forEach((l, i) => {
      if (!l.staff_id || (staffId && l.staff_id !== staffId)) return;
      const p = catalog.value.byId.get(l.product_id);
      const staff = uById.get(l.staff_id);
      const rate = rateFor(p || { type: l.type }, staff);
      const amount = Math.max(0, (l.total || 0) - (back[s.id + ':' + i] || 0));
      rows.push({ id: s.id + ':' + i, sale_id: s.id, no: s.no, at: s.created_at, staff_id: l.staff_id, staff: staff?.name || t('Unknown'), name: l.name, qty: l.qty, amount, rate, commission: Math.round((amount * rate) / 100), service: isService(p) });
    });
  }
  return rows.sort((a, b) => b.at - a.at);
}
export function byStaff(rows) {
  const m = new Map();
  for (const r of rows) {
    const g = m.get(r.staff_id) || { staff_id: r.staff_id, staff: r.staff, services: 0, items: 0, amount: 0, commission: 0 };
    if (r.service) g.services += r.qty; else g.items += r.qty;
    g.amount += r.amount; g.commission += r.commission;
    m.set(r.staff_id, g);
  }
  return [...m.values()].sort((a, b) => b.commission - a.commission);
}

/* ---------------- appointments ---------------- */
export const dayStart = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
export async function appointmentsOn(day) {
  const a = dayStart(day), b = a + 86400000 - 1;
  return (await db().appointments.where('start').between(a, b, true, true).toArray())
    .filter((x) => !x.deleted && (!x.branch_id || !S.branch.value?.id || x.branch_id === S.branch.value.id)).sort((x, y) => x.start - y.start);
}
/** Overlapping booking for the same staff member (ignores cancelled / no-show). */
export async function clash(rec) {
  if (!rec.staff_id) return null;
  const list = await appointmentsOn(rec.start);
  const end = rec.start + (rec.duration_min || 30) * 60000;
  return list.find((x) => x.id !== rec.id && x.staff_id === rec.staff_id && !['cancelled', 'no_show'].includes(x.status) && x.start < end && rec.start < x.start + (x.duration_min || 30) * 60000) || null;
}
export const saveAppointment = (rec) => save('appointments', { branch_id: S.branch.value?.id || null, status: 'booked', ...rec }, { audit: { action: rec.id ? 'appointment.edit' : 'appointment.book', details: { client: rec.customer_name, service: rec.service_name, at: rec.start } } });
export const setStatus = (a, status) => save('appointments', { ...a, status, [status + '_at']: Date.now() }, { audit: { action: 'appointment.' + status, details: { client: a.customer_name, service: a.service_name } } });

/** Client arrived: mark arrived and open the sale with the service, stylist and client already in the cart. */
export async function startSale(a) {
  const c = cart.value;
  if (c.lines.length) await holdCart({ name: c.customer?.name || t('Held sale'), lines: c.lines, customer: c.customer, cartDiscount: 0, note: c.note, wholesale: c.wholesale });
  restoreCart({ ...emptyCart(), meta: { appointment_id: a.id } });
  const p = catalog.value.byId.get(a.product_id);
  if (p) addProduct(p, { staff_id: a.staff_id || null });
  if (a.customer_id) { const cu = await db().customers.get(a.customer_id); if (cu) setCustomer(cu); }
  await setStatus(a, 'arrived');
}
