// Print helper: renders a full HTML document into a hidden iframe and opens the browser print dialog.
// Works offline; with a thermal printer set as default + "kiosk printing" Chrome flag, printing is silent.
import { esc } from '../lib/util.js';

export const PAPER = {
  58: { page: '58mm auto', width: '48mm', font: 11 },
  80: { page: '80mm auto', width: '72mm', font: 12 },
  a4: { page: 'A4', width: '186mm', font: 12 }
};

/** Wrap body HTML in a print document. */
export function doc(body, { paper = 80, title = 'Print', css = '', fontSize } = {}) {
  const p = PAPER[paper] || PAPER[80];
  const fs = fontSize || p.font;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
@page { size: ${p.page}; margin: ${paper === 'a4' ? '12mm' : '2mm 3mm'}; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #000; }
body { width: ${p.width}; font: ${fs}px/1.35 ${paper === 'a4' ? "'DM Sans', Arial, sans-serif" : "'JetBrains Mono', 'Courier New', monospace"}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.c { text-align: center; } .r { text-align: right; } .b { font-weight: 700; } .s { font-size: .86em; } .xl { font-size: 1.5em; font-weight: 800; } .l { font-size: 1.15em; }
.hr { border-top: 1px dashed #000; margin: 6px 0; } .hr2 { border-top: 2px solid #000; margin: 6px 0; }
table { width: 100%; border-collapse: collapse; } td, th { padding: 1px 0; vertical-align: top; } th { text-align: left; }
.row { display: flex; justify-content: space-between; gap: 8px; } .row > :last-child { text-align: right; white-space: nowrap; }
img.logo { max-width: 60%; max-height: 70px; display: block; margin: 0 auto 4px; object-fit: contain; filter: grayscale(1); }
svg { display: block; margin: 0 auto; }
${css}
</style></head><body>${body}</body></html>`;
}

let frame = null;
/** Print an HTML document (string from doc()). Resolves after the dialog closes (or ~1s on browsers without afterprint). */
export function printHtml(html, { copies = 1 } = {}) {
  return new Promise((resolve) => {
    frame?.remove();
    frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(frame);
    const d = frame.contentDocument;
    const many = copies > 1 ? html.replace(/<body>([\s\S]*)<\/body>/, (_, b) => '<body>' + Array.from({ length: copies }, () => b).join('<div style="page-break-after:always"></div>') + '</body>') : html;
    d.open(); d.write(many); d.close();
    const go = () => {
      const w = frame.contentWindow;
      let done = false;
      const fin = () => { if (!done) { done = true; resolve(); } };
      w.addEventListener('afterprint', fin);
      try { w.focus(); w.print(); } catch (e) { console.warn(e); }
      setTimeout(fin, 1500);
    };
    const imgs = [...d.images];
    Promise.all(imgs.map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })))).then(() => setTimeout(go, 60));
  });
}

/** Barcode as inline SVG markup (lazy-loads JsBarcode). format: 'EAN13' | 'CODE128' */
export async function barcodeSvg(code, { format, height = 40, width = 1.6, fontSize = 12, displayValue = true, margin = 0 } = {}) {
  const { default: JsBarcode } = await import('jsbarcode');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const fmt = format || (/^\d{13}$/.test(code) ? 'EAN13' : /^\d{8}$/.test(code) ? 'EAN8' : 'CODE128');
  try { JsBarcode(svg, code, { format: fmt, height, width, fontSize, displayValue, margin, background: 'transparent', font: 'monospace' }); }
  catch { JsBarcode(svg, code, { format: 'CODE128', height, width, fontSize, displayValue, margin, background: 'transparent' }); }
  return svg.outerHTML;
}
/** QR code as inline SVG markup (lazy-loads qrcode-generator). */
export async function qrSvg(text, cell = 3) {
  const mod = await import('qrcode-generator');
  const qrcode = mod.default || mod;
  const qr = qrcode(0, 'M');
  qr.addData(text); qr.make();
  return qr.createSvgTag({ cellSize: cell, margin: 0, scalable: false });
}
