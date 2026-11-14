// Visual pass for the restaurant, services and quotes modules at laptop 1366×768, tablet waiter 1024×768 and phone 390×844.
// Run: node qa/scripts/visual-p2.mjs [desk|touch|phone ...]  (LANG_UI=sw for Kiswahili) → qa/visual/p2-<view>-NN-name.png
import fs from 'node:fs';
import { chromium, newPage, BASE, OUT, sleep, report } from './lib.mjs';
const VIEWS = { desk: { width: 1366, height: 768 }, touch: { width: 1024, height: 768 }, phone: { width: 390, height: 844 } };
const LANG = process.env.LANG_UI || 'en';
const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(VIEWS);
const DIR = OUT + 'visual/';
fs.mkdirSync(DIR, { recursive: true });
const missing = new Set();
const b = await chromium.launch();
for (const v of want) {
  const { ctx, page } = await newPage(b, VIEWS[v], { hasTouch: v !== 'desk', isMobile: v === 'phone' });
  if (LANG !== 'en') await ctx.addInitScript((l) => { try { localStorage.setItem('ppos.lang', l); } catch {} }, LANG);
  let n = 0;
  const pre = LANG === 'en' ? '' : LANG + '-';
  const shot = async (name) => { await sleep(350); for (const m of await page.evaluate(() => [...(window.__i18nMissing || [])]).catch(() => [])) missing.add(m); await page.screenshot({ path: `${DIR}p2-${v}-${pre}${String(++n).padStart(2, '0')}-${name}.png` }); };
  const go = async (hash, sel = '.page, .sell, .kds') => { await page.goto(BASE + '#' + hash); await page.waitForSelector(sel, { timeout: 15000 }); await sleep(500); };
  const esc = async () => { await page.keyboard.press('Escape'); await sleep(200); };
  const demo = async (type) => { await page.goto(BASE + '?demo=1&type=' + type); await page.waitForSelector('.shell', { timeout: 60000 }); };
  const openCart = async () => { if (v === 'phone' && await page.locator('.mini-cart-bar .btn').isVisible()) { await page.locator('.mini-cart-bar .btn').click(); await sleep(300); } };

  // restaurant
  await demo('restaurant');
  await go('/home'); await shot('r-home');
  await go('/tables', '.floor'); await shot('r-floor');
  await page.locator('.ftable.s-busy').first().click(); await page.waitForSelector('.tbar'); await openCart(); await shot('r-table-order');
  await page.getByRole('button', { name: /Split bill|Gawa bili/ }).click(); await sleep(300); await shot('r-split'); await esc();
  await go('/tables', '.floor');
  await page.locator('.ftable.s-free').first().click(); await page.waitForSelector('.guest-grid'); await shot('r-guests'); await esc();
  if (v !== 'phone') { await page.getByRole('button', { name: /Edit layout|Panga meza/ }).click(); await sleep(300); await shot('r-floor-edit'); }
  await go('/sell', '.sell'); await openCart(); await shot('r-sell-counter');
  await go('/orders'); await shot('r-queue');
  await go('/kds', '.kds'); await shot('r-kds');
  await go('/settings/restaurant'); await shot('r-settings');

  // services
  await demo('salon');
  await go('/sell', '.sell');
  await page.locator('.tile', { hasText: 'Manicure' }).first().click(); await page.waitForSelector('.sp-grid'); await shot('s-staff-picker');
  await page.locator('.sp-tile').nth(1).click(); await sleep(200); await openCart(); await shot('s-sell-staff-chip');
  await go('/appointments'); await shot('s-appointments');
  await page.locator('.page-h .btn.primary').click(); await page.waitForSelector('.book-grid'); await shot('s-book'); await esc();
  await go('/commission'); await shot('s-commission');
  await go('/settings/services'); await shot('s-settings');

  // quotes
  await demo('hardware');
  await go('/quotes'); await shot('q-quotes');
  await page.getByRole('tab', { name: /Invoices|Ankara/ }).click(); await sleep(300); await shot('q-invoices');
  await page.locator('.vt-row').first().click(); await sleep(300); await shot('q-invoice-actions'); await esc();
  await go('/quotes'); await page.getByRole('tab', { name: /^Quotes|^Nukuu/ }).click(); await sleep(300); await page.locator('.vt-row').first().click(); await page.waitForSelector('.qe'); await sleep(400); await shot('q-editor');
  await page.getByRole('button', { name: /^Print$|^Chapisha$/ }).first().click(); await page.waitForSelector('iframe[title]'); await sleep(500); await shot('q-quote-a4'); await esc();
  await go('/quotes/new?invoice=1'); await shot('q-new-invoice');
  await go('/settings/quotes'); await shot('q-settings');
  await ctx.close();
}
if (LANG !== 'en') { console.log(`untranslated strings seen (${missing.size}):`); [...missing].slice(0, 40).forEach((m) => console.log('  ' + m)); }
report('visual-p2');
await b.close();
