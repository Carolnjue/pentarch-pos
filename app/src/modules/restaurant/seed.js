// Demo data for restaurant / bar: open table orders (some sent, one bill printed), kitchen tickets, takeaway & delivery queue.
import { db } from '../../db/index.js';
import { ulid } from '../../lib/ulid.js';

const MIN = 60000;
export async function demoSeed({ business, branch, users, products, now, stamp }) {
  if (!business.modules?.restaurant) return;
  const d = db();
  const tables = (await d.table('tables').toArray()).filter((x) => !x.deleted);
  // give the demo room some breathing space (160 px grid, long tables need the width)
  const byArea = {};
  for (const tb of tables) (byArea[tb.area] ||= []).push(tb);
  for (const list of Object.values(byArea)) list.forEach((tb, i) => { tb.x = (i % 4) * 165 + 30; tb.y = Math.floor(i / 4) * 150 + 30; });
  await d.table('tables').bulkPut(tables);
  const food = products.filter((p) => p.kitchen_station && !p.has_variants && p.price > 0);
  if (!tables.length || !food.length) return;
  const waiters = users.filter((u) => u.role === 'waiter');
  const W = (i) => waiters[i % Math.max(1, waiters.length)] || users[0];
  const kitchen = food.filter((p) => p.kitchen_station === 'kitchen');
  const bar = food.filter((p) => p.kitchen_station === 'bar');
  const pickFrom = (arr, i) => arr[(i * 7 + 3) % arr.length];
  const line = (p, qty, sent, mods = [], note = '') => ({
    key: ulid(), product_id: p.id, name: p.name, qty, unit: p.unit || 'pc', factor: 1, uom: null, price: p.price, orig_price: p.price, promo_id: null,
    cost: p.cost || 0, discount: 0, tax: p.tax || 'B', modifiers: mods, note, staff_id: null, serial: '', price_override: false, added_at: now, sent_qty: sent, station: p.kitchen_station
  });
  // [table index, guests, minutes ago, status, waiter, lines spec [listName, i, qty, sent]]
  const plan = [
    [0, 3, 42, 'open', 0, [['k', 0, 2, 2], ['k', 1, 1, 1], ['b', 0, 3, 3]], 'done'],
    [2, 6, 18, 'open', 1, [['k', 2, 3, 3], ['k', 3, 2, 2], ['b', 1, 4, 4], ['b', 2, 2, 0]], 'new'],
    [4, 2, 65, 'billed', 0, [['k', 4, 2, 2], ['b', 3, 2, 2]], 'done'],
    [6, 4, 7, 'open', 1, [['k', 5, 1, 1], ['k', 6, 2, 2], ['b', 4, 2, 2]], 'new'],
    [9, 2, 3, 'open', 0, [['b', 5, 2, 0]], null]
  ];
  const orders = [], tickets = [];
  let seq = 0;
  const sides = [{ group: 'Side', name: 'Chips', price: 5000 }];
  for (const [ti, guests, ago, status, wi, spec, tstate] of plan) {
    const tb = tables[ti % tables.length];
    const at = now - ago * MIN;
    const w = W(wi);
    const lines = spec.map(([lst, i, q, s], k) => {
      const arr = lst === 'k' ? (kitchen.length ? kitchen : food) : (bar.length ? bar : food);
      const p = pickFrom(arr, i + ti);
      return line(p, q, s, k === 0 && lst === 'k' && p.modifiers_group_ids?.includes('mg-sides') ? sides : [], k === 1 && lst === 'k' ? 'No onions' : '');
    });
    const id = ulid(at);
    const no = '1-' + String(++seq).padStart(3, '0');
    orders.push(stamp({ id, kind: 'table', no, table_id: tb.id, table_name: tb.name, area: tb.area, guests, waiter_id: w.id, waiter_name: w.name, lines, status, note: '', round: 1, opened_at: at, sent_at: at + 2 * MIN, bill_printed_at: status === 'billed' ? now - 4 * MIN : null, delivery_status: null, branch_id: branch.id, created_at: at }, now - MIN));
    if (tstate) {
      const byStation = {};
      for (const l of lines) if (l.sent_qty > 0) (byStation[l.station] ||= []).push({ name: l.name, qty: l.sent_qty, modifiers: l.modifiers.map((m) => m.name), note: l.note });
      for (const [station, ls] of Object.entries(byStation)) {
        const st = station === 'bar' && tstate === 'new' && ago > 10 ? 'done' : tstate;
        tickets.push(stamp({ id: ulid(at + 2 * MIN), order_id: id, order_no: no, table_id: tb.id, table_name: tb.name, order_type: 'dine_in', customer_name: '', kind: 'order', station, round: 1, lines: ls, status: st, waiter_id: w.id, waiter_name: w.name, guests, sent_at: at + 2 * MIN, bumped_at: st === 'done' ? at + 14 * MIN : null, branch_id: branch.id, created_at: at + 2 * MIN }, st === 'done' ? at + 14 * MIN : at + 2 * MIN));
      }
    }
  }
  // takeaway & delivery queue
  const q = [
    ['takeaway', 'Wanjiku', '254722314562', '', '', 'preparing', 12, 'open'],
    ['delivery', 'Otieno', '254711908245', 'Kilimani, Argwings Kodhek Rd, Hse 14', 'Brian Kiptoo', 'on_the_way', 31, 'open'],
    ['delivery', 'Achieng', '254798662017', 'Yaya Centre, Block B apt 3', '', 'new', 4, 'open']
  ];
  for (const [kind, name, phone, address, rider, ds, ago, status] of q) {
    const at = now - ago * MIN;
    const ls = [line(pickFrom(kitchen.length ? kitchen : food, ago), 2, ds === 'new' ? 0 : 2), line(pickFrom(bar.length ? bar : food, ago + 1), 1, ds === 'new' ? 0 : 1)];
    const id = ulid(at);
    const no = '1-' + String(++seq).padStart(3, '0');
    orders.push(stamp({ id, kind, no, table_id: null, table_name: '', guests: 0, waiter_id: W(0).id, waiter_name: W(0).name, lines: ls, status, note: '', round: ds === 'new' ? 0 : 1, opened_at: at, customer_id: null, customer_name: name, phone, address, rider, delivery_status: ds, branch_id: branch.id, created_at: at }, now - MIN));
    if (ds !== 'new') tickets.push(stamp({ id: ulid(at + MIN), order_id: id, order_no: no, table_id: null, table_name: '', order_type: kind, customer_name: name, kind: 'order', station: 'kitchen', round: 1, lines: ls.filter((l) => l.station === 'kitchen').map((l) => ({ name: l.name, qty: l.qty, modifiers: [], note: '' })), status: ds === 'preparing' ? 'new' : 'done', waiter_id: W(0).id, waiter_name: W(0).name, guests: 0, sent_at: at + MIN, bumped_at: ds === 'preparing' ? null : at + 15 * MIN, branch_id: branch.id, created_at: at + MIN }, at + MIN));
  }
  await d.orders.bulkPut(orders);
  await d.kitchen_tickets.bulkPut(tickets.filter((x) => x.lines.length));
  await d.meta.put({ key: 'order_seq', value: seq });
}
