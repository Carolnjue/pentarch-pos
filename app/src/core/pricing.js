// Pricing engine (pure): unit price selection, promotions, cart totals with VAT-inclusive tax by eTIMS code.
import { taxRate, taxInclusive, taxExclusive } from '../lib/tax.js';
import { allocate, roundTo } from '../lib/money.js';

/** Unit price (cents) for a product given selling context. */
export function unitPrice(p, { uom, wholesale, qty = 1, branchId, wholesaleAutoQty = true } = {}) {
  if (uom) return uom.price ?? Math.round((p.price || 0) * (uom.factor || 1));
  let price = p.branch_prices?.[branchId] ?? p.price ?? 0;
  if (p.wholesale_price && (wholesale || (wholesaleAutoQty && p.wholesale_min_qty && qty >= p.wholesale_min_qty))) price = p.wholesale_price;
  return price;
}

/** Active promotion for a product at time `now` (best saving wins). */
export function promoFor(p, promos, now = Date.now(), basePrice = p.price) {
  if (!promos?.length) return null;
  const d = new Date(now);
  const dow = d.getDay();
  const hhmm = d.getHours() * 60 + d.getMinutes();
  let best = null;
  for (const pr of promos) {
    if (pr.deleted || pr.active === false) continue;
    if (pr.start && now < new Date(pr.start + 'T00:00').getTime()) continue;
    if (pr.end && now > new Date(pr.end + 'T23:59:59').getTime()) continue;
    if (pr.days_of_week?.length && !pr.days_of_week.includes(dow)) continue;
    if (pr.hours) { const [a, b] = String(pr.hours).split('-').map((s) => { const [h, m] = s.split(':'); return +h * 60 + (+m || 0); }); if (!(hhmm >= a && hhmm < b)) continue; }
    const hit = pr.product_ids?.includes(p.id) || (p.parent_id && pr.product_ids?.includes(p.parent_id)) || pr.category_ids?.includes(p.category_id);
    if (!hit) continue;
    const price = promoPrice(basePrice, pr);
    if (price < basePrice && (!best || price < best.price)) best = { promo: pr, price };
  }
  return best;
}
export function promoPrice(base, pr) {
  if (pr.type === 'pct') return Math.max(0, Math.round(base * (1 - pr.value / 100)));
  if (pr.type === 'amount') return Math.max(0, base - pr.value);
  if (pr.type === 'price') return Math.max(0, pr.value);
  return base;
}

/** Gross for a line (before discounts). Modifiers add per unit. */
export const lineGross = (l) => Math.round(((l.price || 0) + (l.modifiers || []).reduce((s, m) => s + (m.price || 0), 0)) * (l.qty || 0));

/**
 * Compute cart / sale totals.
 * opts: {cartDiscount (cents), vatRegistered, inclusive, rounding (bool), serviceChargePct, tip (cents)}
 * Returns lines enriched with {gross, cart_discount, discount_total, total, tax_rate, tax_amount}.
 */
export function computeCart(lines, opts = {}) {
  const { cartDiscount = 0, vatRegistered = true, inclusive = true, rounding = false, serviceChargePct = 0, tip = 0 } = opts;
  const gross = lines.map(lineGross);
  const afterLine = lines.map((l, i) => Math.max(0, gross[i] - (l.discount || 0)));
  const sumAfter = afterLine.reduce((a, b) => a + b, 0);
  const cd = Math.min(Math.max(0, cartDiscount), sumAfter);
  const alloc = allocate(cd, afterLine);
  let taxTotal = 0, net = 0, costTotal = 0;
  const out = lines.map((l, i) => {
    const total = afterLine[i] - alloc[i];
    const rate = vatRegistered ? taxRate(l.tax) : 0;
    const tax_amount = inclusive ? taxInclusive(total, rate) : taxExclusive(total, rate);
    taxTotal += tax_amount;
    net += total;
    costTotal += Math.round((l.cost || 0) * (l.qty || 0) * (l.factor || 1));
    return { ...l, gross: gross[i], cart_discount: alloc[i], discount_total: (l.discount || 0) + alloc[i], total: inclusive ? total : total + tax_amount, tax_rate: rate, tax_amount };
  });
  const subtotal = gross.reduce((a, b) => a + b, 0);
  const lineDisc = lines.reduce((s, l) => s + (l.discount || 0), 0);
  const service_charge = serviceChargePct ? Math.round((net * serviceChargePct) / 100) : 0;
  let total = (inclusive ? net : net + taxTotal) + service_charge + (tip || 0);
  let rnd = 0;
  if (rounding) { const r = roundTo(total, 1); rnd = r.rounding; total = r.total; }
  const items = lines.reduce((s, l) => s + (l.unit === 'kg' || l.unit === 'g' || l.unit === 'l' ? 1 : (l.qty || 0)), 0);
  return {
    lines: out, subtotal, line_discount: lineDisc, cart_discount: cd, discount: lineDisc + cd, tax_total: taxTotal,
    service_charge, tip: tip || 0, rounding: rnd, total, items, cost_total: costTotal, profit: net - (inclusive ? taxTotal : 0) - costTotal
  };
}

/** Tax breakdown by code for receipts/reports: [{code, rate, gross, tax, net}] */
export function breakdownByCode(lines) {
  const by = {};
  for (const l of lines) {
    const code = l.tax || 'B';
    const b = (by[code] ||= { code, rate: l.tax_rate ?? taxRate(code), gross: 0, tax: 0, net: 0 });
    b.gross += l.total; b.tax += l.tax_amount || 0; b.net += l.total - (l.tax_amount || 0);
  }
  return Object.values(by).sort((a, b) => a.code.localeCompare(b.code));
}

/** Loyalty: points earned on an amount (cents). */
export const pointsEarned = (amount, earnPerKes) => (earnPerKes > 0 ? Math.floor(amount / 100 / earnPerKes) : 0);
