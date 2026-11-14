// Money helpers. All amounts are integer cents (KES x 100).
export const toCents = (kes) => Math.round((Number(kes) || 0) * 100);
export const fromCents = (c) => (Number(c) || 0) / 100;

/** Parse a user-typed amount ("1,250.50", "1250") into cents. Returns NaN for junk. */
export function parseMoney(str) {
  if (typeof str === 'number') return Math.round(str * 100);
  const s = String(str ?? '').replace(/[,\s]|KES|Ksh|KSh/gi, '');
  if (s === '') return 0;
  if (!/^-?\d*\.?\d*$/.test(s)) return NaN;
  return Math.round(parseFloat(s) * 100);
}

const fmt0 = new Intl.NumberFormat('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmt2 = new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Format cents. Shows decimals only when needed unless opts.dec === true. */
export function money(c, opts = {}) {
  const v = (Number(c) || 0) / 100;
  const whole = Math.abs(c % 100) === 0;
  const s = (opts.dec === true || (!whole && opts.dec !== false)) ? fmt2.format(v) : fmt0.format(v);
  return opts.symbol === false ? s : 'KES ' + s;
}
export const kes = (c) => money(c, { symbol: false });

/** Round cents to nearest whole shilling (or step in KES). Returns {total, rounding}. */
export function roundTo(c, stepKes = 1) {
  const step = stepKes * 100;
  const total = Math.round(c / step) * step;
  return { total, rounding: total - c };
}

/** Line amount: price (cents) x qty, rounded to cents. */
export const lineAmount = (priceCents, qty) => Math.round(priceCents * qty);

/** Split an amount into parts proportionally (largest-remainder, exact sum). */
export function allocate(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum) return weights.map((_, i) => (i === 0 ? total : 0));
  const raw = weights.map((w) => (total * w) / sum);
  const out = raw.map(Math.floor);
  let rem = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rem > 0; k = (k + 1) % order.length, rem--) out[order[k][1]]++;
  return out;
}

export const pct = (part, whole) => (whole ? (part / whole) * 100 : 0);
