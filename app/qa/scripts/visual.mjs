// Visual pass: screenshots of every Phase 1 screen at laptop 1366×768, touch 1024×768 and phone 390×844.
// Run: node qa/scripts/visual.mjs [desk|touch|phone ...]  → qa/visual/<view>-NN-name.png
import fs from 'node:fs';
import { chromium, newPage, BASE, OUT, sleep, scan, report, idb } from './lib.mjs';
const VIEWS = { desk: { width: 1366, height: 768 }, touch: { width: 1024, height: 768 }, phone: { width: 390, height: 844 } };
// LANG=sw → Kiswahili UI (files named <view>-sw-NN-…) and a list of strings still missing a translation
const LANG = process.env.LANG_UI || 'en';
const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(VIEWS);
const missing = new Set();
const DIR = OUT + 'visual/';
fs.mkdirSync(DIR, { recursive: true });
const b = await chromium.launch();

for (const v of want) {
  const vp = VIEWS[v];
  const touch = v !== 'desk';
  const { ctx, page } = await newPage(b, vp, { hasTouch: touch, isMobile: v === 'phone' });
  if (LANG !== 'en') await ctx.addInitScript((l) => { try { localStorage.setItem('ppos.lang', l); } catch {} }, LANG);
  const collect = async () => { for (const m of await page.evaluate(() => [...(window.__i18nMissing || [])]).catch(() => [])) missing.add(m); };
  let n = 0;
  const pre = LANG === 'en' ? '' : LANG + '-';
  const shot = async (name, full = false) => { await sleep(250); await collect(); await page.screenshot({ path: `${DIR}${v}-${pre}${String(++n).padStart(2, '0')}-${name}.png`, fullPage: full }); };
  const go = async (hash, sel = '.page, .sell') => { await page.goto(BASE + '#' + hash); await page.waitForSelector(sel, { timeout: 10000 }); await sleep(400); };
  const esc = async () => { await page.keyboard.press('Escape'); await sleep(150); };

  // welcome + demo picker + trial form + sign in
  await page.goto(BASE); await page.waitForSelector('.welcome'); await shot('welcome');
  const choice = (i) => page.locator('.welcome .choice, .welcome .choice-grid > *').nth(i).click();
  await choice(0); await sleep(300); await shot('demo-types');
  await page.goto(BASE); await page.waitForSelector('.welcome');
  await choice(1); await sleep(300); await shot('trial-form');
  await page.goto(BASE); await page.waitForSelector('.welcome');
  await choice(2); await sleep(300); await shot('sign-in');

  // demo
  await page.goto(BASE + '?demo=1&type=minimart'); await page.waitForSelector('.shell', { timeout: 30000 }); await sleep(600);
  await shot('home');
  await shot('home-full', true);
  await go('/sell', '.tiles'); await shot('sell-empty');
  const products = await idb(page, 'products');
  const codes = products.filter((p) => p.barcode && !p.has_variants && p.type !== 'weight').slice(0, 4).map((p) => p.barcode);
  if (!touch) { for (const c of codes) await scan(page, c); }
  else { for (const t of await page.locator('.tile').all().then((a) => a.slice(0, 4))) { await t.click(); await sleep(120); } }
  await shot('sell-cart');
  if (v === 'phone') { await page.locator('.mini-cart-bar .btn').click(); await sleep(250); await shot('sell-cart-open'); }
  await page.locator('.pay-btn').click(); await page.waitForSelector('.tender'); await shot('tender-cash');
  await page.locator('.tender .m').nth(1).click(); await shot('tender-mpesa');
  await page.locator('.tender .m').nth(0).click();
  await page.locator('.quick-notes .btn').first().click(); await page.waitForSelector('.done-hero'); await shot('sale-done');
  await page.locator('.modal-f .btn.primary').click(); await sleep(200);
  await go('/sales', '.vt-row'); await shot('sales-list');
  await page.locator('.vt-row').first().click(); await page.waitForSelector('.page-h'); await sleep(400); await shot('sale-detail');
  await go('/products', '.vt-row'); await shot('products');
  await go('/products/new', '.pf-grid'); await shot('product-new');
  await go('/products/categories'); await shot('categories');
  await go('/products/labels'); await shot('labels');
  await go('/products/import'); await shot('import');
  await go('/customers', '.page'); await shot('customers');
  const cust = (await idb(page, 'customers')).find((c) => c.credit_limit > 0) || (await idb(page, 'customers'))[0];
  await go('/customers/' + cust.id, '.stat'); await shot('customer-profile');
  await go('/shifts'); await shot('shifts');
  for (const p of ['business', 'tax', 'receipt', 'printing', 'payments', 'selling', 'promotions', 'modules', 'staff', 'branches', 'language', 'backup', 'loyalty', 'audit', 'licence', 'about']) {
    await go('/settings/' + p); await shot('settings-' + p);
  }
  await go('/help'); await shot('help');
  await go('/home');
  await page.keyboard.press('Control+k'); await sleep(250); await shot('palette'); await esc();
  await page.keyboard.press('Control+l'); await page.waitForSelector('.lock'); await shot('lock');
  report('visual ' + v);
  await ctx.close();
}
if (LANG !== 'en') { console.log(`untranslated strings seen (${missing.size}):`); [...missing].sort().forEach((m) => console.log('  ' + JSON.stringify(m))); }
await b.close();
