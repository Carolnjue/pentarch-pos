// Business builder (trial) and demo seeder (catalogue + 30 days of history). Writes directly with bulkPut for speed.
import { db, setMeta } from '../db/index.js';
import { save, saveMany, stamp } from '../db/repo.js';
import { rebuildLevels } from '../db/stock.js';
import { ulid } from '../lib/ulid.js';
import { makeEan13, makeScaleBarcode } from '../lib/barcode.js';
import { sha256 } from '../lib/sha256.js';
import { normPhone, DAY, startOfDay } from '../lib/util.js';
import { computeCart, pointsEarned } from '../core/pricing.js';
import { BUSINESS_TYPES, typeById, demoStaff, DEMO_CUSTOMERS, DEMO_SUPPLIERS, CATEGORY_COLORS, ALL_MODULES } from './types.js';
import { CATALOGUES, MODIFIER_GROUPS, TABLES } from './catalogues.js';
import { DEFAULT_SETTINGS } from '../state.js';
import { seedReportExtras } from './seed-reports.js';
import { seedStockDemo } from './seed-stock.js'; // Inventory & Purchasing demo data

const DEMO_NAMES = {
  duka: ['Mama Grace Duka', 'Kasarani, Nairobi', 'Nairobi'], minimart: ['Baraka Supermarket', 'Thika', 'Kiambu'], hardware: ['Jenga Hardware & Building Supplies', 'Nakuru', 'Nakuru'],
  agrovet: ['Shamba Bora Agrovet', 'Kerugoya', 'Kirinyaga'], pharmacy: ['Afya Plus Chemist', 'Kisumu', 'Kisumu'], boutique: ['Mitindo Boutique', 'Westlands, Nairobi', 'Nairobi'],
  electronics: ['Simu Tech Phones & Electronics', 'Eldoret', 'Uasin Gishu'], cosmetics: ['Urembo Beauty Shop', 'Machakos', 'Machakos'], butchery: ['Nyama Bora Butchery', 'Kitengela', 'Kajiado'],
  bakery: ['Tamu Tamu Bakery', 'Nyeri', 'Nyeri'], restaurant: ['Kula Kitchen Café', 'Kilimani, Nairobi', 'Nairobi'], bar: ['Tulia Bar & Grill', 'Rongai', 'Kajiado'],
  salon: ['Kinyozi & Glow Salon', 'Embu', 'Embu'], stationery: ['Elimu Stationers & Cyber', 'Meru', 'Meru'], wholesale: ['Faida Wholesalers', 'Ruiru', 'Kiambu'],
  autospares: ['Gari Spares Centre', 'Kirinyaga Road, Nairobi', 'Nairobi'], gas_water: ['Moto Gas & Maji Point', 'Juja', 'Kiambu'], other: ['Pentarch Demo Services', 'Nairobi', 'Nairobi']
};
const cents = (kes) => Math.round(kes * 100);
const branchCode = (name) => (name.replace(/[^A-Za-z ]/g, '').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').toUpperCase() + 'XXX').slice(0, 3);

function modulesFor(type) {
  const m = Object.fromEntries(ALL_MODULES.map((k) => [k, false]));
  return { ...m, ...typeById(type).modules };
}

/** Create business + main branch + owner + categories (no products). Used by trial registration. */
export async function buildBusiness({ tenantId, type, name, phone, email, town, county, ownerId, ownerName, ownerPinHash, existing = null, skipOwner = false }) {
  const tp = typeById(type);
  const now = Date.now();
  const ex = existing || {};
  const keep = (v, d) => (v !== undefined && v !== null && v !== '' ? v : d);
  await save('business', {
    ...ex, id: tenantId, name: keep(ex.name, name), type: tp.id, kra_pin: keep(ex.kra_pin, ''), vat_registered: !!ex.vat_registered, phone: keep(ex.phone, phone), email: keep(ex.email, email),
    address: keep(ex.address, ''), town: keep(ex.town, town), county: keep(ex.county, county), logo: keep(ex.logo, ''), currency: 'KES',
    modules: { ...modulesFor(tp.id), ...(ex.modules || {}) }, settings: { ...presetSettings(tp), ...(ex.settings || {}) }, created_at: ex.created_at || now
  });
  let branchId = null;
  const brs = existing ? (await db().branches.toArray()).filter((b) => !b.deleted) : [];
  if (!brs.length) { branchId = ulid(); await save('branches', { id: branchId, name: town ? town + ' branch' : 'Main branch', code: branchCode(name || 'Main'), address: town || '', phone, is_main: true, receipt_footer: '' }); }
  else branchId = (brs.find((b) => b.is_main) || brs[0]).id;
  if (!skipOwner) await save('users', { id: ownerId, name: ownerName, phone, role: 'owner', pin_hash: ownerPinHash, branch_ids: [], active: true, max_discount_pct: 100, commission_pct: 0 });
  if (existing && (await db().categories.count())) return { branchId };
  const cats = (CATALOGUES[tp.id] || []).map(([n, icon], i) => ({ id: ulid(), name: n, icon, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length], sort: i, parent_id: null }));
  await saveMany('categories', cats);
  return { branchId };
}
function presetSettings(tp) {
  return {
    loyalty_enabled: !!tp.modules.loyalty,
    pay_credit: !!tp.modules.credit,
    pay_points: !!tp.modules.loyalty,
    pay_bank: ['hardware', 'wholesale', 'autospares', 'electronics'].includes(tp.id),
    receipt_width: ['restaurant', 'bar'].includes(tp.id) ? 80 : 80
  };
}

/** Build product records from the catalogue for a type. Returns {categories, products, stockPlan, modifierGroups}. */
export function buildCatalogue(type, { withRecipes = true } = {}) {
  const tp = typeById(type);
  const tIdx = BUSINESS_TYPES.findIndex((x) => x.id === tp.id);
  const cats = [], products = [], stockPlan = new Map();
  const groups = MODIFIER_GROUPS.map((g) => ({ ...g }));
  const gid = Object.fromEntries(groups.map((g) => [g.key, g.id]));
  let n = 0, plu = 0;
  const byName = new Map();
  const mk = (cat, name, price, o, extra = {}) => {
    n++;
    const isService = !!o.s;
    const isWeight = !!o.w;
    const p = {
      id: ulid(), name, sku: (tp.id.slice(0, 3) + '-' + String(n).padStart(4, '0')).toUpperCase(),
      barcode: isService || o.ns ? '' : makeEan13('20', tIdx * 1e8 + n), barcodes: [], category_id: cat.id,
      type: isService ? 'service' : isWeight ? 'weight' : o.rec ? 'composite' : o.ns ? 'non_stock' : 'stock',
      unit: o.u || (isWeight ? 'kg' : 'pc'), price: cents(price), cost: cents(o.c ?? Math.round(price * cat.costRatio * 100) / 100),
      wholesale_price: o.ws ? cents(o.ws[0]) : 0, wholesale_min_qty: o.ws ? o.ws[1] : 0,
      tax: o.t || 'B', track_stock: !isService && !o.ns && !o.rec, reorder_level: 0, reorder_qty: 0,
      has_variants: false, parent_id: null, variant_attrs: null,
      units_of_measure: (o.uom || []).map(([nm, factor, pr], j) => ({ name: nm, factor, price: cents(pr), barcode: makeEan13('20', tIdx * 1e8 + 5e7 + n * 10 + j) })),
      track_batches: !!o.b, track_serials: !!o.sr, allow_price_edit: isService || !!o.ns || tp.id === 'other',
      image: '', favourite: !!o.f, sort: n, branch_prices: {}, recipe: [], service_duration_min: o.s || 0,
      kitchen_station: o.kit || null, modifiers_group_ids: (o.mods || []).map((k) => gid[k]).filter(Boolean), active: true, notes: o.n || '', ...extra
    };
    if (isWeight) { plu++; p.plu = String(tIdx * 1000 + plu).padStart(5, '0'); p.barcodes = [makeScaleBarcode('21', p.plu, 1000)]; }
    if (p.type === 'weight' || p.unit === 'kg') p.track_stock = true;
    products.push(p);
    byName.set(name, p);
    return p;
  };
  (CATALOGUES[tp.id] || []).forEach(([cname, icon, costRatio, items], ci) => {
    const cat = { id: ulid(), name: cname, icon, color: CATEGORY_COLORS[ci % CATEGORY_COLORS.length], sort: ci, parent_id: null, costRatio };
    cats.push(cat);
    for (const [name, price, o = {}] of items) {
      if (o.v) {
        const parent = mk(cat, name, price, o, { has_variants: true, track_stock: false, barcode: '' });
        const sizes = o.v.size || [''], colours = o.v.colour || [''];
        for (const sz of sizes) for (const col of colours) {
          const vName = name + ' — ' + [sz, col].filter(Boolean).join(' / ');
          const v = mk(cat, vName, price, { ...o, v: null, f: false }, { parent_id: parent.id, variant_attrs: { size: sz, colour: col } });
          stockPlan.set(v.id, { target: 2 + Math.floor(Math.random() * 7), low: Math.random() < 0.12 });
        }
        continue;
      }
      const p = mk(cat, name, price, o);
      if (p.track_stock) {
        const target = o.st ?? (price > 10000 ? 3 + Math.floor(Math.random() * 6) : price > 2000 ? 6 + Math.floor(Math.random() * 14) : 15 + Math.floor(Math.random() * 50));
        stockPlan.set(p.id, { target, low: !!o.lo || Math.random() < 0.06 });
        p.reorder_level = Math.max(2, Math.round(target * 0.25));
        p.reorder_qty = Math.max(6, Math.round(target * 0.8));
      }
    }
  });
  if (withRecipes) {
    for (const [cname, , , items] of CATALOGUES[tp.id] || []) for (const [name, , o = {}] of items) {
      if (!o.rec) continue;
      const p = byName.get(name);
      p.recipe = o.rec.map(([ing, qty]) => ({ product_id: byName.get(ing)?.id, qty })).filter((r) => r.product_id);
      p.cost = p.recipe.reduce((s, r) => s + Math.round((products.find((x) => x.id === r.product_id)?.cost || 0) * r.qty), 0);
    }
  }
  for (const c of cats) delete c.costRatio;
  const usedGroups = new Set(products.flatMap((p) => p.modifiers_group_ids));
  return { categories: cats, products, stockPlan, modifierGroups: groups.filter((g) => usedGroups.has(g.id)).map(({ key, ...g }) => g) };
}

/* ---------- random helpers (seeded for stable demos) ---------- */
let seed = 20261109;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const ALNUM = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
const mpesaCode = () => { let s = 'T'; for (let i = 0; i < 9; i++) s += ALNUM[Math.floor(rnd() * ALNUM.length)]; return /\d/.test(s) ? s : s.slice(0, 9) + '7'; };
function imei() {
  const d = [3, 5]; while (d.length < 14) d.push(Math.floor(rnd() * 10));
  let sum = 0; for (let i = 0; i < 14; i++) { let v = d[i]; if (i % 2 === 1) { v *= 2; if (v > 9) v -= 9; } sum += v; }
  return d.join('') + ((10 - (sum % 10)) % 10);
}
const HOURS = {
  retail: [0, 0, 0, 0, 0, 0, 1, 5, 7, 5, 4, 4, 6, 6, 4, 4, 5, 8, 9, 8, 5, 2, 0, 0],
  trade: [0, 0, 0, 0, 0, 0, 0, 4, 8, 9, 8, 7, 6, 5, 6, 7, 6, 4, 2, 0, 0, 0, 0, 0],
  fashion: [0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 5, 6, 7, 7, 6, 6, 7, 8, 6, 3, 1, 0, 0, 0],
  cafe: [0, 0, 0, 0, 0, 0, 6, 9, 8, 5, 4, 5, 6, 5, 4, 5, 6, 5, 3, 1, 0, 0, 0, 0],
  restaurant: [0, 0, 0, 0, 0, 0, 0, 3, 5, 3, 2, 4, 9, 10, 6, 2, 2, 3, 6, 9, 8, 4, 1, 0],
  bar: [2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 2, 2, 3, 5, 8, 10, 10, 9, 7, 4],
  salon: [0, 0, 0, 0, 0, 0, 0, 0, 2, 5, 6, 6, 5, 5, 6, 6, 6, 5, 3, 1, 0, 0, 0, 0]
};
const weightedIdx = (w) => { const s = w.reduce((a, b) => a + b, 0); let r = rnd() * s; for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; } return w.length - 1; };

/** Seed a full demo business of `type` into the (already open, empty) demo database. */
export async function seedDemo(type) {
  const t0 = performance.now();
  seed = 20261109 + type.length * 7919;
  const tp = typeById(type);
  const d = db();
  const now = Date.now();
  const tenantId = 'demo-' + tp.id;
  const [bizName, town, county] = DEMO_NAMES[tp.id] || DEMO_NAMES.other;
  const hash = (pin) => sha256(tenantId + pin);
  const S = (rec, at = now) => stamp('x', { ...rec, created_at: rec.created_at || at }, at);

  const modules = modulesFor(tp.id);
  const business = S({
    id: tenantId, name: bizName, type: tp.id, kra_pin: tp.vat ? 'P051' + String(Math.floor(rnd() * 1e6)).padStart(6, '0') + 'K' : '', vat_registered: tp.vat,
    phone: '254722418903', email: 'demo@example.co.ke', address: 'Shop 4, Main Street', town, county, logo: '', currency: 'KES', modules,
    settings: {
      ...presetSettings(tp), mpesa_type: 'till', mpesa_till: '5' + String(Math.floor(rnd() * 1e6)).padStart(6, '0'),
      receipt_footer: 'Asante kwa kununua! Goods once sold are not returnable without a receipt.', require_shift: false, auto_lock_min: 0
    }
  });
  const main = S({ id: ulid(), name: town.split(',')[0] + ' main', code: branchCode(bizName), address: business.address + ', ' + town, phone: business.phone, is_main: true, receipt_footer: '' });
  const branches = [main];
  if (modules.multi_branch) branches.push(S({ id: ulid(), name: 'Thika Road branch', code: 'TRD', address: 'Roysambu, Thika Road', phone: '254711205774', is_main: false, receipt_footer: '' }));
  const deviceId = ulid();
  const devices = [S({ id: deviceId, name: 'Front counter', branch_id: main.id, no: 1, last_seen: now })];
  if (branches[1]) devices.push(S({ id: ulid(), name: 'Branch till', branch_id: branches[1].id, no: 2, last_seen: now - 3600e3 }));

  const users = demoStaff(tp.id).map((s) => S({ id: ulid(), name: s.name, phone: normPhone(s.phone), role: s.role, pin_hash: hash(s.pin), demo_pin: s.pin, branch_ids: [], active: true, max_discount_pct: s.max_discount_pct ?? (s.role === 'owner' ? 100 : 10), commission_pct: s.commission_pct || 0 }));
  const owner = users[0], cashier = users.find((u) => u.role === 'cashier'), manager = users.find((u) => u.role === 'manager');
  const sellers = users.filter((u) => ['cashier', 'manager', 'waiter'].includes(u.role) || (tp.id === 'salon' && u.commission_pct));
  const stylists = users.filter((u) => u.commission_pct > 0);

  const { categories, products, stockPlan, modifierGroups } = buildCatalogue(tp.id);
  const cats = categories.map((c) => S(c));
  const prods = products.map((p) => S(p, now - 40 * DAY));
  const byId = new Map(prods.map((p) => [p.id, p]));
  const sellable = prods.filter((p) => !p.has_variants && !(p.unit !== 'pc' && /Ingredients/.test(cats.find((c) => c.id === p.category_id)?.name || '')) && !/deposit|Empty bottle/i.test(p.name));
  // popularity: favourites + zipf over shuffled order
  const order = sellable.slice().sort(() => rnd() - 0.5);
  const weights = order.map((p, i) => (p.favourite ? 6 : 1) * (1 / Math.pow(i + 1, 0.55)) * (p.price > 500000 ? 0.25 : 1));

  const customers = DEMO_CUSTOMERS.filter(([, , g]) => g === 'retail' || modules.wholesale || modules.credit || tp.id === 'restaurant').slice(0, 14)
    .map(([name, phone, group, lim], i) => S({ id: ulid(), name, phone: normPhone(phone), email: '', kra_pin: group === 'wholesale' ? 'P05' + (1000000 + i * 7) + 'Q' : '', group: modules.wholesale ? group : 'retail', credit_limit: cents(lim), loyalty_points: 0, notes: '', birthday: '' }, now - 60 * DAY));
  const suppliers = (DEMO_SUPPLIERS[tp.id] || DEMO_SUPPLIERS.other).map((name, i) => S({ id: ulid(), name, phone: normPhone('07' + (20 + i) + ' ' + (300000 + i * 4711)), email: '', kra_pin: 'P0' + (51000000 + i * 3) + 'A', contact: pick(['James Kariuki', 'Ann Mwende', 'Hassan Ali', 'Rose Wambui', 'David Kiprop']), terms_days: pick([0, 7, 14, 30]), notes: '' }, now - 60 * DAY));

  // ---------- sales history ----------
  const days = 30;
  const hours = HOURS[tp.pattern] || HOURS.retail;
  const sales = [], moves = [], shifts = [], payments = [], cashMoves = [], audits = [], returns = [], serials = [], batches = [];
  const sold = new Map(); // product_id|branch → qty out
  const serialPool = new Map();
  for (const p of prods) if (p.track_serials) {
    const list = [];
    const plan = stockPlan.get(p.id);
    const count = (plan?.target || 4) + 6;
    for (let i = 0; i < count; i++) { const s = S({ id: ulid(), product_id: p.id, branch_id: main.id, serial: imei(), status: 'in_stock', sale_id: null }, now - 35 * DAY); list.push(s); serials.push(s); }
    serialPool.set(p.id, list);
  }
  // batches plan: two batches per batch-tracked product
  const batchPlan = new Map();
  for (const p of prods) if (p.track_batches) {
    const soon = rnd() < 0.3;
    const e1 = new Date(now + (soon ? (rnd() < 0.3 ? -5 : 20 + rnd() * 50) : 120 + rnd() * 200) * DAY).toISOString().slice(0, 10);
    const e2 = new Date(now + (300 + rnd() * 400) * DAY).toISOString().slice(0, 10);
    const b1 = { batch_no: 'B' + String(Math.floor(rnd() * 90000) + 10000), expiry: e1 }, b2 = { batch_no: 'B' + String(Math.floor(rnd() * 90000) + 10000), expiry: e2 };
    batchPlan.set(p.id, [b1, b2]);
  }
  const vat = tp.vat;
  let seq = 0, seq2 = 0;
  const today0 = startOfDay(now);
  const custForCredit = customers.filter((c) => c.credit_limit > 0);
  for (let di = days - 1; di >= 0; di--) {
    const day0 = today0 - di * DAY;
    const dow = new Date(day0).getDay();
    const wk = tp.pattern === 'bar' || tp.pattern === 'restaurant' ? [0.9, 0.75, 0.8, 0.85, 1, 1.35, 1.4][dow] : tp.pattern === 'trade' ? [0.4, 1.05, 1.05, 1, 1, 1.1, 1.1][dow] : [0.8, 0.95, 0.95, 0.95, 1, 1.2, 1.3][dow];
    const n = Math.round(tp.salesPerDay * wk * (0.85 + rnd() * 0.3));
    for (const br of branches) {
      const isMain = br === main;
      const nb = isMain ? n : Math.round(n * 0.45);
      const dev = isMain ? devices[0] : devices[1];
      const openAt = day0 + 7 * 3600e3 - (tp.pattern === 'bar' ? -4 * 3600e3 : 0);
      const shiftUser = isMain ? (di % 3 === 0 ? manager : cashier) : manager;
      const shift = { id: ulid(), branch_id: br.id, device_id: dev.id, user_id: shiftUser.id, opened_at: openAt, opening_float: cents(2000), closed_at: null, counted_cash: 0, expected_cash: 0, variance: 0, totals_by_method: {}, notes: '', status: 'closed' };
      let cashIn = 0;
      const tbm = {};
      const times = [];
      for (let k = 0; k < nb; k++) {
        const h = weightedIdx(hours);
        const tms = day0 + h * 3600e3 + Math.floor(rnd() * 3600e3);
        if (tms > now - 60e3) continue;
        times.push(tms);
      }
      times.sort((a, b) => a - b);
      for (const at of times) {
        const nLines = Math.max(1, Math.min(8, Math.round(-Math.log(1 - rnd()) * (tp.pattern === 'restaurant' || tp.pattern === 'bar' ? 2.6 : tp.pattern === 'trade' ? 1.7 : 2.2))));
        const lines = [];
        const user = pick(sellers.length ? sellers : [cashier]);
        for (let li = 0; li < nLines; li++) {
          const p = order[weightedIdx(weights)];
          if (lines.find((l) => l.product_id === p.id)) continue;
          let qty = 1, unit = p.unit, factor = 1, price = p.price, uomName = null;
          if (p.type === 'weight' || p.unit === 'kg' || p.unit === 'l') qty = Math.round((0.25 + rnd() * 1.75) * 20) / 20;
          else if (tp.pattern === 'trade') qty = p.price < 50000 ? 1 + Math.floor(rnd() * 12) : 1 + Math.floor(rnd() * 3);
          else if (p.price < 3000) qty = 1 + Math.floor(rnd() * 4);
          else if (rnd() < 0.2) qty = 2;
          if (p.units_of_measure?.length && rnd() < (tp.id === 'wholesale' ? 0.45 : 0.08)) { const u = p.units_of_measure[0]; unit = u.name; factor = u.factor; price = u.price; uomName = u.name; qty = 1 + Math.floor(rnd() * (tp.id === 'wholesale' ? 4 : 1)); }
          else if (p.wholesale_price && qty >= p.wholesale_min_qty) price = p.wholesale_price;
          const line = { product_id: p.id, name: p.name, qty, unit, factor, price, cost: p.cost, discount: 0, tax: p.tax, modifiers: [], note: '', staff_id: p.type === 'service' && stylists.length ? pick(stylists).id : null, uom: uomName };
          if (p.modifiers_group_ids?.length && rnd() < 0.5) {
            const g = modifierGroups.find((x) => x.id === p.modifiers_group_ids[0]);
            if (g) { const o = pick(g.options); line.modifiers = [{ group: g.name, name: o.name, price: o.price }]; }
          }
          if (p.track_serials) {
            const pool = serialPool.get(p.id).filter((s) => s.status === 'in_stock');
            if (!pool.length) continue;
            const s = pool[0]; line.serial = s.serial; line.qty = 1; s.status = 'sold';
            line._serialRec = s;
          }
          lines.push(line);
        }
        if (!lines.length) continue;
        let r = rnd();
        let customer = rnd() < 0.22 ? pick(customers) : null;
        let method = r < 0.55 ? 'mpesa' : r < 0.9 ? 'cash' : r < 0.95 ? 'card' : 'credit';
        if (method === 'credit' && (!modules.credit || !custForCredit.length)) method = 'mpesa';
        if (method === 'card' && tp.id === 'duka') method = 'cash';
        if (method === 'credit') customer = pick(custForCredit);
        let cartDiscount = 0;
        if (rnd() < 0.05) { lines[0].discount = Math.round(lines[0].price * lines[0].qty * 0.05); }
        const calc = computeCart(lines, { vatRegistered: vat, inclusive: true, rounding: true, cartDiscount });
        if (!calc.total) continue;
        const total = calc.total;
        const pay = { method, amount: total, ref: '', phone: '' };
        let change = 0;
        if (method === 'mpesa') { pay.ref = mpesaCode(); pay.phone = customer?.phone || '2547' + String(Math.floor(rnd() * 1e8)).padStart(8, '0'); }
        if (method === 'card') pay.ref = String(Math.floor(rnd() * 900000) + 100000);
        if (method === 'cash') { const tendered = [5000, 10000, 20000, 50000, 100000, 200000, 500000].find((x) => x >= total && rnd() < 0.7) || Math.ceil(total / 10000) * 10000; change = tendered - total; pay.tendered = tendered; }
        let no;
        if (isMain) no = br.code + '1-' + String(++seq).padStart(6, '0'); else no = br.code + '2-' + String(++seq2).padStart(6, '0');
        const sale = {
          id: ulid(at), no, branch_id: br.id, device_id: dev.id, shift_id: shift.id, user_id: user.id, customer_id: customer?.id || null, table_id: null,
          order_type: tp.pattern === 'restaurant' ? pick(['dine_in', 'dine_in', 'dine_in', 'takeaway']) : 'retail',
          lines: calc.lines.map(({ _serialRec, gross, cart_discount, discount_total, ...l }) => ({ ...l, discount: discount_total, line_discount: l.discount })),
          subtotal: calc.subtotal, discount: calc.discount, cart_discount: calc.cart_discount, tax_total: calc.tax_total, total, rounding: calc.rounding,
          payments: [pay], paid: method === 'credit' ? 0 : total, change, balance: method === 'credit' ? total : 0, status: 'completed', receipt_note: '',
          etims: null, void_reason: '', void_by: null, points_earned: 0, points_redeemed: 0, created_at: at, updated_at: at, deleted: 0
        };
        if (customer && business.settings.loyalty_enabled) { sale.points_earned = pointsEarned(total, 100); customer.loyalty_points += sale.points_earned; }
        for (const l of lines) if (l._serialRec) { l._serialRec.sale_id = sale.id; l._serialRec.updated_at = at; }
        // stock moves
        for (const l of sale.lines) {
          const p = byId.get(l.product_id);
          if (p.type === 'composite') {
            for (const rc of p.recipe) moves.push({ id: ulid(at), product_id: rc.product_id, branch_id: br.id, qty: -(rc.qty * l.qty), type: 'recipe', ref_type: 'sale', ref_id: sale.id, cost: byId.get(rc.product_id)?.cost || 0, user_id: user.id, created_at: at, updated_at: at, deleted: 0 });
            continue;
          }
          if (!p.track_stock) continue;
          const q = l.qty * (l.factor || 1);
          const k = p.id + '|' + br.id;
          sold.set(k, (sold.get(k) || 0) + q);
          const mv = { id: ulid(at), product_id: p.id, branch_id: br.id, qty: -q, type: 'sale', ref_type: 'sale', ref_id: sale.id, cost: p.cost, user_id: user.id, created_at: at, updated_at: at, deleted: 0 };
          if (l.serial) mv.serial = l.serial;
          if (p.track_batches) { const bp = batchPlan.get(p.id); const b = (sold.get(k) > (stockPlan.get(p.id)?.target || 10) * 0.6 ? bp[1] : bp[0]); mv.batch_no = b.batch_no; mv.expiry = b.expiry; l.batch_no = b.batch_no; }
          moves.push(mv);
        }
        // occasional void
        if (rnd() < 0.012 && di > 0) {
          sale.status = 'void'; sale.void_reason = pick(['Customer changed mind', 'Wrong item scanned', 'Duplicate sale', 'Payment failed']); sale.void_by = manager.id; sale.updated_at = at + 120e3;
          for (const mv of moves.filter((m) => m.ref_id === sale.id)) moves.push({ ...mv, id: ulid(at + 120e3), qty: -mv.qty, type: 'void', created_at: at + 120e3, updated_at: at + 120e3 });
          audits.push({ id: ulid(at + 120e3), action: 'sale.void', entity: 'sales', entity_id: sale.id, details: { no, reason: sale.void_reason, total }, user_id: manager.id, device_id: dev.id, at: at + 120e3, created_at: at + 120e3, updated_at: at + 120e3, deleted: 0 });
        } else {
          tbm[method] = (tbm[method] || 0) + total;
          if (method === 'cash') cashIn += total;
          if (sale.discount) audits.push({ id: ulid(at), action: 'discount.apply', entity: 'sales', entity_id: sale.id, details: { no, amount: sale.discount }, user_id: user.id, device_id: dev.id, at, created_at: at, updated_at: at, deleted: 0 });
        }
        sales.push(sale);
      }
      // returns (~1 every 5 days)
      const daySales = sales.filter((s) => s.shift_id === shift.id && s.status === 'completed' && s.payments[0].method !== 'credit');
      if (daySales.length && rnd() < 0.2 && isMain) {
        const s = pick(daySales);
        const l = s.lines[0];
        const qty = l.unit === 'kg' ? l.qty : 1;
        const amount = Math.round((l.total / l.qty) * qty);
        const at = s.created_at + 2 * 3600e3;
        if (at < now) {
          const ret = { id: ulid(at), sale_id: s.id, branch_id: br.id, lines: [{ product_id: l.product_id, line_index: 0, qty, amount, restock: true }], refund: [{ method: 'cash', amount }], reason: pick(['Wrong size', 'Damaged packaging', 'Customer returned unused']), user_id: manager.id, shift_id: shift.id, total: amount, created_at: at, updated_at: at, deleted: 0 };
          returns.push(ret);
          s.status = l.qty > qty || s.lines.length > 1 ? 'partial_return' : 'returned'; s.updated_at = at;
          if (byId.get(l.product_id)?.track_stock) moves.push({ id: ulid(at), product_id: l.product_id, branch_id: br.id, qty: qty * (l.factor || 1), type: 'return', ref_type: 'return', ref_id: ret.id, cost: l.cost, user_id: manager.id, created_at: at, updated_at: at, deleted: 0, batch_no: l.batch_no || undefined });
          cashIn -= amount;
          audits.push({ id: ulid(at), action: 'sale.return', entity: 'returns', entity_id: ret.id, details: { no: s.no, amount }, user_id: manager.id, device_id: dev.id, at, created_at: at, updated_at: at, deleted: 0 });
        }
      }
      // cash drop / pay-out and close
      const lastT = times[times.length - 1] || openAt;
      if (rnd() < 0.5) { const amt = cents(pick([200, 300, 500, 1000])); cashMoves.push({ id: ulid(openAt + 5 * 3600e3), shift_id: shift.id, branch_id: br.id, type: 'pay_out', amount: amt, reason: pick(['Transport', 'Cleaning', 'Lunch for staff', 'Airtime']), user_id: shiftUser.id, created_at: openAt + 5 * 3600e3, updated_at: openAt + 5 * 3600e3, deleted: 0 }); cashIn -= amt; }
      const expected = shift.opening_float + cashIn;
      if (di === 0 && isMain) {
        shift.status = 'open'; shift.expected_cash = 0;
      } else {
        const variance = rnd() < 0.7 ? 0 : cents(pick([-200, -100, -50, 50, 100]));
        Object.assign(shift, { closed_at: Math.min(now - 60e3, lastT + 1800e3), counted_cash: expected + variance, expected_cash: expected, variance, totals_by_method: tbm, status: 'closed' });
        audits.push({ id: ulid(shift.closed_at), action: 'shift.close', entity: 'shifts', entity_id: shift.id, details: { variance, expected }, user_id: shiftUser.id, device_id: dev.id, at: shift.closed_at, created_at: shift.closed_at, updated_at: shift.closed_at, deleted: 0 });
      }
      shift.totals_by_method = tbm;
      shifts.push({ ...shift, created_at: openAt, updated_at: shift.closed_at || openAt, deleted: 0 });
    }
  }
  // demo: today's shift stays open only when the till is in use; demo starts without requiring a shift
  // customer payments for older credit sales (oldest first)
  for (const c of customers) {
    const credit = sales.filter((s) => s.customer_id === c.id && s.balance > 0 && s.status === 'completed').sort((a, b) => a.created_at - b.created_at);
    const owed = credit.reduce((a, s) => a + s.balance, 0);
    if (!owed) continue;
    const old = credit.filter((s) => s.created_at < now - 10 * DAY);
    const payAmt = Math.round(old.reduce((a, s) => a + s.balance, 0) * (0.5 + rnd() * 0.5) / 100) * 100;
    if (payAmt <= 0) continue;
    let left = payAmt; const alloc = [];
    for (const s of credit) { if (left <= 0) break; const a = Math.min(left, s.balance); alloc.push({ sale_id: s.id, amount: a }); left -= a; }
    const at = now - Math.floor(rnd() * 5 + 1) * DAY;
    payments.push({ id: ulid(at), customer_id: c.id, branch_id: main.id, amount: payAmt, method: rnd() < 0.7 ? 'mpesa' : 'cash', ref: mpesaCode(), sale_ids: alloc.map((a) => a.sale_id), allocations: alloc, user_id: owner.id, shift_id: null, created_at: at, updated_at: at, deleted: 0 });
  }
  // opening stock (31 days ago) = sold + target
  const openAt = now - 31 * DAY;
  for (const br of branches) for (const p of prods) {
    if (!p.track_stock) continue;
    const plan = stockPlan.get(p.id) || { target: 10 };
    const out = sold.get(p.id + '|' + br.id) || 0;
    let target = plan.low ? Math.max(0, Math.round(p.reorder_level * 0.5)) : plan.target;
    if (br !== main) target = Math.round(target * 0.5);
    if (p.track_serials) target = (serialPool.get(p.id) || []).length - out;
    let q = Math.round((out + target) * 1000) / 1000;
    if (p.unit === 'pc' && !p.track_serials) q = Math.ceil(q);
    if (q <= 0) continue;
    if (p.track_batches) {
      const [b1, b2] = batchPlan.get(p.id);
      const q1 = Math.ceil(q * 0.6), q2 = q - q1;
      moves.push({ id: ulid(openAt), product_id: p.id, branch_id: br.id, qty: q1, type: 'opening', ref_type: 'opening', ref_id: null, cost: p.cost, batch_no: b1.batch_no, expiry: b1.expiry, user_id: owner.id, created_at: openAt, updated_at: openAt, deleted: 0 });
      if (q2 > 0) moves.push({ id: ulid(openAt), product_id: p.id, branch_id: br.id, qty: q2, type: 'opening', ref_type: 'opening', ref_id: null, cost: p.cost, batch_no: b2.batch_no, expiry: b2.expiry, user_id: owner.id, created_at: openAt, updated_at: openAt, deleted: 0 });
      if (br === main) for (const [b, qq] of [[b1, q1], [b2, q2]]) batches.push(S({ id: ulid(), product_id: p.id, branch_id: br.id, batch_no: b.batch_no, expiry: b.expiry, qty_received: qq }, openAt));
    } else if (p.track_serials) {
      for (const s of serialPool.get(p.id) || []) moves.push({ id: ulid(openAt), product_id: p.id, branch_id: br.id, qty: 1, type: 'opening', ref_type: 'opening', ref_id: null, cost: p.cost, serial: s.serial, user_id: owner.id, created_at: openAt, updated_at: openAt, deleted: 0 });
    } else {
      moves.push({ id: ulid(openAt), product_id: p.id, branch_id: br.id, qty: q, type: 'opening', ref_type: 'opening', ref_id: null, cost: p.cost, user_id: owner.id, created_at: openAt, updated_at: openAt, deleted: 0 });
    }
  }
  // a few audit samples so the exceptions report is not empty
  for (let i = 0; i < 6; i++) {
    const at = now - Math.floor(rnd() * 20 + 1) * DAY - Math.floor(rnd() * 8) * 3600e3;
    audits.push({ id: ulid(at), action: pick(['drawer.open', 'price.change', 'user.login', 'drawer.open']), entity: 'sales', entity_id: null, details: { reason: 'Change for customer' }, user_id: pick(sellers).id, device_id: deviceId, at, created_at: at, updated_at: at, deleted: 0 });
  }
  // a month of expenses for the reports (see seed-reports.js); deliveries/POs/supplier payments come from seed-stock.js
  const { expenses } = seedReportExtras({ now, rnd, pick, mpesaCode, business, branches, main, users, sales, shifts });
  const extras = {};
  if (modules.restaurant) extras.tables = TABLES.map((tb) => S({ id: ulid(), branch_id: main.id, ...tb }));

  await d.transaction('rw', [d.business, d.branches, d.devices, d.users, d.categories, d.products, d.modifier_groups, d.customers, d.suppliers, d.sales, d.stock_moves, d.shifts, d.customer_payments, d.cash_moves, d.audit, d.returns, d.serials, d.batches, d.expenses, d.table('tables'), d.meta], async () => {
    await d.business.put(business);
    await d.branches.bulkPut(branches);
    await d.devices.bulkPut(devices);
    await d.users.bulkPut(users);
    await d.categories.bulkPut(cats);
    await d.products.bulkPut(prods);
    await d.modifier_groups.bulkPut(modifierGroups.map((g) => S(g)));
    await d.customers.bulkPut(customers);
    await d.suppliers.bulkPut(suppliers);
    await d.sales.bulkPut(sales);
    await d.stock_moves.bulkPut(moves);
    await d.shifts.bulkPut(shifts);
    await d.customer_payments.bulkPut(payments);
    await d.cash_moves.bulkPut(cashMoves);
    await d.audit.bulkPut(audits);
    await d.returns.bulkPut(returns);
    await d.serials.bulkPut(serials.map(({ ...s }) => s));
    await d.batches.bulkPut(batches);
    await d.expenses.bulkPut(expenses);
    if (extras.tables) await d.table('tables').bulkPut(extras.tables);
    await d.meta.bulkPut([
      { key: 'device_id', value: deviceId }, { key: 'device_no', value: 1 }, { key: 'device_name', value: 'Front counter' }, { key: 'branch_id', value: main.id },
      { key: 'tenant_id', value: tenantId }, { key: 'receipt_seq', value: seq }, { key: 'demo_type', value: tp.id }, { key: 'setup_done', value: true },
      { key: 'seeded_ms', value: Math.round(performance.now() - t0) }
    ]);
  });
  // feature modules add their own demo records (open table orders, appointments, quotes…): module.demoSeed(ctx)
  const { MODULES } = await import('../modules/registry.js');
  const seedCtx = { type: tp.id, business, branch: main, users, products: prods, categories: cats, customers, deviceId, now, stamp: S, rnd };
  for (const m of MODULES) if (m.demoSeed && (!m.enabled || m.enabled(business))) await m.demoSeed(seedCtx);
  await rebuildLevels();
  await seedStockDemo(tp.id);
  await setMeta('seed_total_ms', Math.round(performance.now() - t0));
  return { sales: sales.length, products: prods.length, ms: Math.round(performance.now() - t0) };
}

/** Add the type's template catalogue to a real business (setup wizard: "use the template catalogue"). */
export async function addTemplateCatalogue(type, { withStock = false } = {}) {
  const { categories, products, modifierGroups } = buildCatalogue(type);
  const existing = await db().categories.toArray();
  const catMap = new Map();
  for (const c of categories) {
    const ex = existing.find((e) => !e.deleted && e.name === c.name);
    if (ex) catMap.set(c.id, ex.id); else catMap.set(c.id, c.id);
  }
  await saveMany('categories', categories.filter((c) => catMap.get(c.id) === c.id));
  await saveMany('modifier_groups', modifierGroups);
  await saveMany('products', products.map((p) => ({ ...p, category_id: catMap.get(p.category_id) })));
  return products.length;
}
