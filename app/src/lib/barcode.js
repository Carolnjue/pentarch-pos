// EAN-13 / internal barcode helpers.
/** EAN-13 check digit for the first 12 digits. */
export function ean13Check(d12) {
  const s = String(d12);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += (+s[i]) * (i % 2 ? 3 : 1);
  return (10 - (sum % 10)) % 10;
}
export function isValidEan13(code) {
  return /^\d{13}$/.test(code) && ean13Check(code.slice(0, 12)) === +code[12];
}
export function isValidEan8(code) {
  if (!/^\d{8}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += (+code[i]) * (i % 2 ? 1 : 3);
  return (10 - (sum % 10)) % 10 === +code[7];
}
/** Build an internal EAN-13 with a 2-digit prefix (20–29) and a numeric body. */
export function makeEan13(prefix, n) {
  const body = String(prefix) + String(n).padStart(10, '0').slice(-10);
  return body + ean13Check(body);
}
/** Generate a fresh internal EAN-13 (prefix 20) not in `taken` (Set or fn). */
export function generateInternalEan(taken, prefix = '20') {
  const has = typeof taken === 'function' ? taken : (c) => taken?.has?.(c);
  for (let i = 0; i < 50; i++) {
    const n = Math.floor(Math.random() * 1e10);
    const code = makeEan13(prefix, n);
    if (!has(code)) return code;
  }
  throw new Error('Could not generate a unique barcode');
}

/**
 * Parse a scale (weight/price-embedded) EAN-13.
 * Format: PP IIIII VVVVV C  (PP = prefix, IIIII = item PLU, VVVVV = grams or price)
 * cfg: {weight_prefix:'21', price_prefix:'22', price_decimals:0}
 */
export function parseScaleBarcode(code, cfg = {}) {
  const wp = cfg.weight_prefix || '21';
  const pp = cfg.price_prefix || '22';
  if (!/^\d{13}$/.test(code) || !isValidEan13(code)) return null;
  const prefix = code.slice(0, 2);
  if (prefix !== wp && prefix !== pp) return null;
  const plu = code.slice(2, 7);
  const v = parseInt(code.slice(7, 12), 10);
  if (prefix === wp) return { kind: 'weight', plu, qty: v / 1000 };
  const dec = cfg.price_decimals ?? 0;
  return { kind: 'price', plu, price: Math.round((v / Math.pow(10, dec)) * 100) };
}
export const makeScaleBarcode = (prefix, plu, value) => {
  const body = String(prefix) + String(plu).padStart(5, '0') + String(value).padStart(5, '0');
  return body + ean13Check(body);
};

/** Receipt QR payload: "PPOS:R:<sale no>" */
export const receiptQr = (no) => 'PPOS:R:' + no;
export const parseReceiptQr = (s) => (/^PPOS:R:(.+)$/.exec(s || '') || [])[1] || null;
