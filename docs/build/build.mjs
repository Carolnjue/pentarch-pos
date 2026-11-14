// Build: node docs/build/build.mjs [docname ...]  → docs/*.pdf (+ PNG previews in docs/build/out/png)
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { renderDoc } from './lib.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = new URL('./', import.meta.url).pathname;
const DOCS = ROOT + '../';
const DOCS_LIST = {
  'sales-guide': ['./content/sales-guide.mjs', 'pentarch-pos-sales-guide'],
  'marketing': ['./content/marketing.mjs', 'pentarch-pos-marketing-strategy'],
  'hardware': ['./content/hardware.mjs', 'pentarch-pos-hardware-setup-guide'],
  'price-list': ['./content/price-list.mjs', 'pentarch-pos-price-list'],
};
const want = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const noPng = process.argv.includes('--no-png');
const browser = await chromium.launch();
for (const [key, [mod, out]] of Object.entries(DOCS_LIST)) {
  if (want.length && !want.includes(key)) continue;
  if (!fs.existsSync(ROOT + mod.slice(2))) { console.log('skip (no content)', key); continue; }
  const doc = (await import(mod + '?t=' + Date.now())).default;
  const html = renderDoc(doc);
  const htmlPath = `${ROOT}out/${out}.html`;
  fs.writeFileSync(htmlPath, html);
  const page = await browser.newPage();
  await page.goto('file://' + htmlPath);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const issues = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.page').forEach((pg, i) => {
      const c = pg.querySelector('.content') || pg.querySelector('.cv') || pg;
      if (c.scrollHeight > c.clientHeight + 1) out.push(`p${i + 1}: content overflows by ${c.scrollHeight - c.clientHeight}px`);
      const free = c.clientHeight - [...c.children].reduce((s, el) => Math.max(s, el.offsetTop + el.offsetHeight - c.offsetTop), 0);
      if (pg.querySelector('.content') && free > 160) out.push(`p${i + 1}: ${free}px empty at bottom`);
      pg.querySelectorAll('*').forEach((el) => { if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow === 'hidden' && el.clientWidth > 0 && !el.classList.contains('page') && !el.classList.contains('shot')) out.push(`p${i + 1}: x-overflow in ${el.className || el.tagName}`); });
    });
    return out;
  });
  const pdf = `${DOCS}${out}.pdf`;
  await page.pdf({ path: pdf, format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  await page.close();
  const pages = (execFileSync('pdfinfo', [pdf]).toString().match(/Pages:\s+(\d+)/) || [])[1];
  console.log(`${out}.pdf — ${pages} pages, ${(fs.statSync(pdf).size / 1e6).toFixed(1)} MB`);
  issues.forEach((x) => console.log('   ! ' + x));
  if (!noPng) {
    fs.mkdirSync(`${ROOT}out/png`, { recursive: true });
    for (const f of fs.readdirSync(`${ROOT}out/png`)) if (f.startsWith(out + '-')) fs.unlinkSync(`${ROOT}out/png/${f}`);
    execFileSync('pdftoppm', ['-r', '110', '-png', pdf, `${ROOT}out/png/${out}`]);
  }
}
await browser.close();
