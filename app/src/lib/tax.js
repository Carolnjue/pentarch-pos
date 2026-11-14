// KRA eTIMS tax codes. Prices are VAT-inclusive by default.
export const TAX_CODES = {
  A: { code: 'A', rate: 0, label: 'Exempt' },
  B: { code: 'B', rate: 16, label: 'VAT 16%' },
  C: { code: 'C', rate: 0, label: 'Zero-rated 0%' },
  D: { code: 'D', rate: 0, label: 'Non-VAT' },
  E: { code: 'E', rate: 8, label: 'VAT 8%' }
};
export const taxRate = (code) => (TAX_CODES[code] || TAX_CODES.B).rate;

/** Tax contained in a VAT-inclusive amount (cents). */
export const taxInclusive = (amount, rate) => (rate ? Math.round((amount * rate) / (100 + rate)) : 0);
/** Tax added on top of a VAT-exclusive amount (cents). */
export const taxExclusive = (amount, rate) => (rate ? Math.round((amount * rate) / 100) : 0);

/**
 * Compute tax for a line amount.
 * @returns {{tax:number, net:number, gross:number, rate:number}}
 */
export function lineTax(amount, code, { vatRegistered = true, inclusive = true } = {}) {
  const rate = vatRegistered ? taxRate(code) : 0;
  if (inclusive) {
    const tax = taxInclusive(amount, rate);
    return { tax, net: amount - tax, gross: amount, rate };
  }
  const tax = taxExclusive(amount, rate);
  return { tax, net: amount, gross: amount + tax, rate };
}

/** Group lines [{tax:code, amount, tax_amount}] into a breakdown by code. */
export function taxBreakdown(lines) {
  const by = {};
  for (const l of lines) {
    const code = l.tax_code || l.tax_codeX || l.taxCode || 'B';
    const b = (by[code] ||= { code, rate: taxRate(code), label: TAX_CODES[code]?.label, gross: 0, tax: 0, net: 0 });
    b.gross += l.gross; b.tax += l.tax_amount; b.net += l.gross - l.tax_amount;
  }
  return Object.values(by).sort((a, b) => a.code.localeCompare(b.code));
}
