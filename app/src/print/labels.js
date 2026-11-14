// Barcode label printing: label-printer sizes (one label per page) and A4 sheets.
import { doc, barcodeSvg } from './print.js';
import { esc } from '../lib/util.js';
import { kes } from '../lib/money.js';

export const LABEL_PRESETS = {
  '38x25': { name: '38 × 25 mm', w: 38, h: 25, sheet: false },
  '40x30': { name: '40 × 30 mm', w: 40, h: 30, sheet: false },
  '50x25': { name: '50 × 25 mm', w: 50, h: 25, sheet: false },
  'a4-3x8': { name: 'A4 sheet 3 × 8 (70 × 37 mm)', w: 70, h: 37.1, cols: 3, rows: 8, sheet: true },
  'a4-4x10': { name: 'A4 sheet 4 × 10 (52.5 × 29.7 mm)', w: 52.5, h: 29.7, cols: 4, rows: 10, sheet: true }
};

/** items: [{product, qty}] fields: {name, price, barcode, sku, expiry, business} */
export async function labelsHtml(items, presetKey, fields, { businessName = '', expiry = '' } = {}) {
  const P = LABEL_PRESETS[presetKey] || LABEL_PRESETS['38x25'];
  const small = P.h < 30;
  const cache = new Map();
  const cells = [];
  for (const { product: p, qty, expiry: ex } of items) {
    const code = p.barcode || p.sku || '';
    let svg = '';
    if (fields.barcode && code) {
      if (!cache.has(code)) cache.set(code, await barcodeSvg(code, { height: small ? 22 : 30, width: P.w < 45 ? 1.15 : 1.4, fontSize: small ? 9 : 10 }));
      svg = cache.get(code);
    }
    const html = `<div class="lab">
      ${fields.business && businessName ? `<div class="biz">${esc(businessName)}</div>` : ''}
      ${fields.name ? `<div class="nm">${esc(p.name)}</div>` : ''}
      ${svg ? `<div class="bc">${svg}</div>` : ''}
      <div class="ft">${fields.sku && p.sku ? `<span>${esc(p.sku)}</span>` : '<span></span>'}${fields.price ? `<b>KES ${kes(p.price)}</b>` : ''}</div>
      ${fields.expiry && (ex || expiry) ? `<div class="ex">EXP ${esc(ex || expiry)}</div>` : ''}
    </div>`;
    for (let i = 0; i < qty; i++) cells.push(html);
  }
  const css = `
  @page { size: ${P.sheet ? 'A4' : `${P.w}mm ${P.h}mm`}; margin: ${P.sheet ? '10.7mm 0 0 0' : '0'}; }
  body { width: ${P.sheet ? '210mm' : P.w + 'mm'}; font-family: 'DM Sans', Arial, sans-serif; }
  .sheet { display: grid; grid-template-columns: repeat(${P.cols || 1}, ${P.w}mm); ${P.sheet ? 'justify-content: center;' : ''} }
  .lab { width: ${P.w}mm; height: ${P.h}mm; padding: 1.2mm 1.8mm; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; ${P.sheet ? '' : 'page-break-after: always;'} }
  .biz { font-size: 6.5pt; text-transform: uppercase; letter-spacing: .05em; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .nm { font-size: ${small ? 7.5 : 9}pt; font-weight: 700; line-height: 1.1; max-height: 2.2em; overflow: hidden; }
  .bc { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0; } .bc svg { max-width: 100%; max-height: 100%; }
  .ft { display: flex; justify-content: space-between; align-items: baseline; font-size: 6.5pt; } .ft b { font: 800 ${small ? 9 : 11}pt 'JetBrains Mono', monospace; }
  .ex { font-size: 6.5pt; font-weight: 700; }`;
  return { html: doc(`<div class="sheet">${cells.join('')}</div>`, { paper: 'a4', title: 'Labels', css }).replace(/@page \{ size: A4; margin: 12mm; \}/, ''), count: cells.length, preset: P };
}
