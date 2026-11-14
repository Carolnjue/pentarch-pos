// Visual pass for Inventory & Purchasing at laptop 1366×768, touch 1024×768 and phone 390×844.
// Run: node qa/scripts/visual-inventory.mjs [desk|touch|phone ...]  → qa/visual/inv-<view>-NN-<screen>.png
// LANG_UI=sw → Kiswahili (files inv-<view>-sw-NN-…) and a list of strings shown without a translation.
import fs from 'node:fs';
import { chromium, newPage, BASE, OUT, sleep, scan, report, idb } from './lib.mjs';
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
  const collect = async () => { for (const m of await page.evaluate(() => [...(window.__i18nMissing || [])]).catch(() => [])) missing.add(m); };
  const shot = async (name, full = false) => { await sleep(300); await collect(); await page.screenshot({ path: `${DIR}inv-${v}-${pre}${String(++n).padStart(2, '0')}-${name}.png`, fullPage: full }); };
  const go = async (hash, sel = '.page') => { await page.goto(BASE + '#/home'); await page.goto(BASE + '#' + hash); await page.waitForSelector(sel, { timeout: 15000 }); await sleep(500); };
  const esc = async () => { await page.keyboard.press('Escape'); await sleep(200); };
  for (const type of ['wholesale']) {
    await page.goto(BASE + '?demo=1&type=' + type); await page.waitForSelector('.shell', { timeout: 30000 }); await sleep(500);
    const P = await idb(page, 'products');
    const codes = P.filter((p) => p.track_stock && p.barcode && !p.track_batches).slice(0, 4).map((p) => p.barcode);
    await go('/home'); await page.evaluate(() => { const el = [...document.querySelectorAll('.content, main, .main')].find((x) => x.scrollHeight > x.clientHeight); (el || document.scrollingElement).scrollTo(0, 99999); }); await shot('home-widgets');
    await go('/inventory', '.vt-row'); await shot('stock');
    await shot('stock-full', true);
    await go('/inventory/product/' + P.find((p) => /Maize Flour/.test(p.name)).id, '.vt-row'); await shot('ledger');
    await go('/inventory'); await page.getByRole('button', { name: /Adjust stock|Rekebisha stoki/ }).first().click(); await page.waitForSelector('.modal');
    await page.locator('.modal .adder input').fill(P.find((p) => p.track_stock).name.slice(0, 6)); await page.keyboard.press('Enter'); await sleep(300);
    await page.locator('.reason-grid button').first().click(); await shot('adjust-dialog'); await esc();
    await go('/inventory/adjustments', '.vt-row'); await shot('adjustments');
    await go('/inventory/counts'); await shot('counts');
    await page.locator('.page-h .btn.primary').click(); await page.waitForSelector('.modal'); await shot('count-start');
    await page.locator('.modal .inv-act').nth(2).click(); await page.locator('.modal-f .btn.primary').click(); await page.waitForSelector('.count-scan'); await sleep(400);
    if (v === 'desk') { for (const c of codes) await scan(page, c); } else { for (const c of codes.slice(0, 2)) { await page.locator('.count-scan input').fill(c); await page.keyboard.press('Enter'); await sleep(150); } }
    await shot('count-scan');
    await page.locator('.tabs button').nth(1).click(); await sleep(400); await shot('count-review');
    const cnt = (await idb(page, 'stock_counts')).find((c) => c.status === 'applied');
    await go('/inventory/counts/' + cnt.id); await shot('count-applied');
    await go('/inventory/transfers'); await shot('transfers');
    await go('/inventory/transfers/new');
    if (v === 'desk') { for (const c of codes.slice(0, 3)) await scan(page, c); } else { for (const c of codes.slice(0, 2)) { await page.locator('.adder input').fill(c); await page.keyboard.press('Enter'); await sleep(150); } }
    await shot('transfer-new');
    const tr = (await idb(page, 'transfers')).find((x) => x.status === 'sent');
    if (tr) { await go('/inventory/transfers/' + tr.id); await shot('transfer-incoming'); }
    await go('/inventory/reorder', '.vt-row'); await shot('reorder');
    await go('/inventory/expiry'); await shot('expiry');
    await go('/inventory/serials'); await shot('serials');
    await go('/inventory/repack'); await page.locator('.adder input').first().fill('Mumias Sugar 50kg'); await page.keyboard.press('Enter'); await sleep(500); await shot('repack');
    await go('/purchasing', '.vt-row'); await shot('deliveries');
    await go('/purchasing/receive');
    await page.getByLabel(/^(Supplier|Msambazaji)$/).selectOption({ index: 1 });
    if (v === 'desk') { for (const c of codes) await scan(page, c); } else { for (const c of codes.slice(0, 3)) { await page.locator('.adder input').fill(c); await page.keyboard.press('Enter'); await sleep(150); } }
    const kg = P.find((p) => /Kabras Sugar 1kg/.test(p.name));
    if (kg?.units_of_measure?.[0]) { await page.locator('.adder input').fill(kg.units_of_measure[0].barcode); await page.keyboard.press('Enter'); await sleep(200); }
    await shot('receive');
    await page.locator('.more-toggle').click(); await sleep(200); await shot('receive-full', true);
    const g = (await idb(page, 'goods_received')).find((x) => x.kind === 'receipt');
    await go('/purchasing/grn/' + g.id); await shot('grn');
    await go('/purchasing/orders', '.vt-row'); await shot('orders');
    const po = (await idb(page, 'purchase_orders')).find((x) => x.status === 'draft');
    await go('/purchasing/orders/' + po.id); await shot('po-edit');
    const po2 = (await idb(page, 'purchase_orders')).find((x) => x.status === 'received');
    await go('/purchasing/orders/' + po2.id); await shot('po-received');
    await go('/purchasing/suppliers', '.vt-row'); await shot('suppliers');
    await page.locator('.page-h .btn.primary').click(); await page.waitForSelector('.modal'); await shot('supplier-add'); await esc();
    const sup = (await idb(page, 'suppliers'))[0];
    await go('/purchasing/suppliers/' + sup.id, '.stat'); await shot('supplier-profile');
    await page.locator('.page-h .btn.primary').click(); await page.waitForSelector('.modal'); await shot('pay-dialog'); await esc();
    await go('/purchasing/payments', '.vt-row'); await shot('payments');
    await go('/purchasing/returns'); await shot('returns');
    await go('/purchasing/returns/new?supplier=' + sup.id); await page.locator('.adder input').fill(codes[0]); await page.keyboard.press('Enter'); await sleep(300); await shot('return-new');
    await go('/settings/stock'); await shot('settings-stock');
  }
  report(`visual-inventory ${v} ${LANG}`);
  await ctx.close();
}
if (LANG !== 'en') { console.log(`untranslated strings seen (${missing.size}):`); [...missing].sort().forEach((m) => console.log('  ' + JSON.stringify(m))); }
await b.close();
