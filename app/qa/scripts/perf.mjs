// Performance: first load, demo seeding, search over 20,000 products, sale completion offline.
// SPEC §8 targets: search < 50 ms on 20k products, sale completion < 300 ms offline, core bundle < 250 KB gz.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { chromium, newPage, BASE, OUT, sleep, report, DESK } from './lib.mjs';
const out = {};
// bundle size (core = entry chunk + CSS)
const dist = new URL('../../dist/assets/', import.meta.url).pathname;
const files = fs.readdirSync(dist);
const gz = (f) => zlib.gzipSync(fs.readFileSync(dist + f)).length;
const entry = files.find((f) => /^index-.*\.js$/.test(f)), css = files.find((f) => /^index-.*\.css$/.test(f));
out.core_js_gz_kb = +(gz(entry) / 1024).toFixed(1);
out.core_css_gz_kb = css ? +(gz(css) / 1024).toFixed(1) : 0;
const b = await chromium.launch();
const { ctx, page } = await newPage(b, DESK);
let t0 = Date.now();
await page.goto(BASE); await page.waitForSelector('.welcome');
out.first_load_welcome_ms = Date.now() - t0;
t0 = Date.now();
await page.goto(BASE + '?demo=1&type=minimart'); await page.waitForSelector('.shell', { timeout: 60000 });
out.demo_seed_ms = Date.now() - t0;
// add 20,000 products straight into IndexedDB, then reload so the app indexes them
const N = 20000;
await page.evaluate((N) => new Promise((res, rej) => {
  const words = ['Brookside', 'Kabras', 'Jogoo', 'Pembe', 'Kimbo', 'Elianto', 'Royco', 'Ketepa', 'Omo', 'Sunlight', 'Colgate', 'Dettol', 'Geisha', 'Menengai', 'Daawat', 'Mumias', 'Tuzo', 'Exe', 'Soko', 'Ajab', 'Golden', 'Fresh', 'Super', 'Premium', 'Classic'];
  const kinds = ['Milk', 'Sugar', 'Flour', 'Rice', 'Oil', 'Soap', 'Tea', 'Juice', 'Biscuits', 'Bread', 'Salt', 'Spice', 'Detergent', 'Toothpaste', 'Lotion', 'Noodles', 'Beans', 'Maize', 'Water', 'Soda'];
  const sizes = ['250ml', '500ml', '1L', '2L', '500g', '1kg', '2kg', '5kg', '100g', '200g'];
  const r = indexedDB.open('pentarch-pos-demo');
  r.onsuccess = () => {
    const d = r.result; const tx = d.transaction('products', 'readwrite'); const st = tx.objectStore('products');
    const now = Date.now();
    for (let i = 0; i < N; i++) {
      const name = `${words[i % 25]} ${kinds[(i * 7) % 20]} ${sizes[(i * 3) % 10]} #${i}`;
      st.put({ id: 'perf' + String(i).padStart(6, '0'), name, sku: 'P' + i, barcode: String(6160000000000 + i), barcodes: [], category_id: null, type: 'stock', unit: 'pc', price: 5000 + (i % 900) * 10, cost: 4000, tax: 'B', track_stock: true, active: true, created_at: now, updated_at: now, deleted: 0 });
    }
    tx.oncomplete = () => { d.close(); res(); }; tx.onerror = rej;
  };
  r.onerror = rej;
}), N);
t0 = Date.now();
await page.reload(); await page.waitForSelector('.shell, .lock', { timeout: 60000 });
await page.waitForFunction((N) => window.__pposCatalog?.indexed() >= N, N, { timeout: 60000 });
out.reload_and_index_20k_ms = Date.now() - t0;
out.catalogue_size = await page.evaluate(() => window.__pposCatalog.size());
const queries = ['milk', 'kabras sugar', 'jogo', 'premium soap 1kg', '6160000012345', 'P1999', 'brokside', 'oil 2l', 'zzzz', 'tea'];
out.search = await page.evaluate((qs) => {
  const s = window.__pposCatalog.search;
  for (const q of qs) s(q, 40); // warm up
  const rows = [];
  for (const q of qs) {
    const runs = [];
    for (let k = 0; k < 15; k++) { const a = performance.now(); s(q, 40); runs.push(performance.now() - a); }
    runs.sort((x, y) => x - y);
    rows.push({ q, median_ms: +runs[7].toFixed(2), max_ms: +runs[14].toFixed(2), hits: s(q, 40).length });
  }
  return rows;
}, queries);
out.search_worst_median_ms = Math.max(...out.search.map((r) => r.median_ms));
// typed search on the Sell screen, end to end (input → results rendered)
if (await page.locator('.lock').count()) { await page.getByRole('option', { name: /Grace/ }).click(); for (const d of '1234') await page.keyboard.press(d); await page.waitForSelector('.shell'); }
await page.goto(BASE + '#/sell'); await page.waitForSelector('.tiles'); await sleep(500);
out.typed_search_ms = await page.evaluate(async () => {
  const el = document.querySelector('.sell .search input');
  const times = [];
  for (const q of ['kimbo', 'golden rice', 'colgate 100g']) {
    el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); await new Promise((r) => setTimeout(r, 50));
    const a = performance.now();
    el.value = q; el.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    times.push(+(performance.now() - a).toFixed(1));
  }
  el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true }));
  return times;
});
// sale completion, offline (time measured inside completeSale and shown on the receipt dialog)
await ctx.setOffline(true);
const saleMs = [];
for (let i = 0; i < 8; i++) {
  await page.locator('.tile').nth(i % 6).click(); await page.locator('.tile').nth((i + 2) % 6).click();
  await page.keyboard.press('F4'); await page.waitForSelector('.tender');
  await page.getByRole('button', { name: 'Exact' }).click(); await page.waitForSelector('.done-hero');
  const txt = await page.locator('.done-hero').innerText();
  saleMs.push(+(/(\d+) ms/.exec(txt)?.[1] || NaN));
  await page.keyboard.press('Enter'); await sleep(150);
}
out.sale_complete_offline_ms = saleMs;
out.sale_complete_offline_median_ms = saleMs.slice().sort((a, z) => a - z)[Math.floor(saleMs.length / 2)];
await ctx.setOffline(false);
console.log(JSON.stringify(out, null, 1));
fs.writeFileSync(OUT + 'perf.json', JSON.stringify({ at: new Date().toISOString(), ...out }, null, 1));
const ok = out.search_worst_median_ms < 50 && out.sale_complete_offline_median_ms < 300 && out.core_js_gz_kb < 250;
console.log(ok ? '✔ performance targets met' : '✘ performance target missed');
report('perf');
await b.close();
