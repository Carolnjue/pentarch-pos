// Captures POS app screenshots for the docs from the built app (app/dist) in demo mode.
// Usage: node docs/build/capture.mjs   (serves app/dist under /pos/ on a free port)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const DIST = '/home/claude/pos/app/dist';
const OUT = new URL('./assets/shots/', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (!p.startsWith('/pos/')) { res.writeHead(404); return res.end(); }
  let f = path.join(DIST, p.slice(5));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Service-Worker-Allowed': '/pos/' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}/pos/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HIDE = '.toast,.toasts,[class*="toast"]{display:none!important}';

const browser = await chromium.launch();
const results = [];
async function ctxPage(vp = { width: 1366, height: 768 }) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('ppos.tour.sell', 'done'); } catch {} });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept());
  return { ctx, page };
}
async function shot(page, name) {
  await page.addStyleTag({ content: HIDE }).catch(() => {});
  await sleep(250);
  await page.screenshot({ path: OUT + name + '.png' });
  results.push(name);
}
async function scan(page, code) { for (const ch of code) await page.keyboard.press(ch, { delay: 0 }); await page.keyboard.press('Enter'); await sleep(150); }
async function products(page) {
  return page.evaluate(() => new Promise((res) => { const r = indexedDB.open('pentarch-pos-demo'); r.onsuccess = () => { const q = r.result.transaction('products').objectStore('products').getAll(); q.onsuccess = () => res(q.result); }; }));
}
async function demo(type, vp) {
  const { ctx, page } = await ctxPage(vp);
  await page.goto(BASE + `?demo=1&type=${type}`);
  await page.waitForSelector('.shell', { timeout: 30000 });
  await sleep(800);
  return { ctx, page };
}
async function tryStep(name, fn) { try { await fn(); } catch (e) { console.log('skip', name, e.message.split('\n')[0]); } }

// Welcome screen
await tryStep('welcome', async () => {
  const { ctx, page } = await ctxPage();
  await page.goto(BASE); await sleep(2500); await shot(page, 'welcome'); await ctx.close();
});

// Duka: home, sell, tender, done, products, labels, customers, shifts, settings
await tryStep('duka', async () => {
  const { ctx, page } = await demo('duka');
  await shot(page, 'duka-home');
  const P = await products(page);
  const by = (n) => P.find((p) => p.name === n);
  await page.goto(BASE + '#/sell'); await page.waitForSelector('.tiles .tile'); await sleep(500);
  for (const n of ['Brookside Milk 500ml', 'Brookside Milk 500ml', 'Kabras Sugar 1kg', 'Jogoo Maize Flour 2kg', 'Kimbo 1kg']) { const p = by(n); if (p?.barcode) await scan(page, p.barcode); }
  await page.mouse.click(5, 400); await sleep(300);
  await shot(page, 'duka-sell');
  await page.keyboard.press('F4'); await page.waitForSelector('.tender'); await sleep(400);
  await shot(page, 'duka-tender-cash');
  await tryStep('mpesa', async () => { await page.keyboard.press('Alt+2'); await sleep(250); await page.getByLabel('M-Pesa code').fill('TK7AB3CD9E'); await sleep(200); await shot(page, 'duka-tender-mpesa'); await page.keyboard.press('Alt+1'); await sleep(200); });
  await page.locator('.quick-notes .btn').last().click();
  await page.waitForSelector('.done-hero'); await sleep(400);
  await shot(page, 'duka-done');
  await page.keyboard.press('Enter'); await sleep(300);
  await page.goto(BASE + '#/products'); await sleep(1200); await shot(page, 'duka-products');
  await tryStep('labels', async () => {
    await page.goto(BASE + '#/products/labels'); await sleep(1200);
    // add a few products if a picker is present
    await shot(page, 'duka-labels');
  });
  await tryStep('product-form', async () => { await page.goto(BASE + '#/products/' + by('Kabras Sugar 1kg').id); await sleep(1200); await shot(page, 'duka-product-form'); });
  await page.goto(BASE + '#/customers'); await sleep(1200); await shot(page, 'duka-customers');
  await tryStep('cust', async () => { const c = await page.locator('a[href*="#/customers/"], tr, .row-link').nth(1); await c.click(); await sleep(1200); await shot(page, 'duka-customer'); });
  await page.goto(BASE + '#/shifts'); await sleep(3500); await shot(page, 'duka-shifts');
  await page.goto(BASE + '#/settings'); await sleep(1200); await shot(page, 'duka-settings');
  await tryStep('receipt', async () => { await page.goto(BASE + '#/settings/receipt'); await sleep(1200); await shot(page, 'duka-settings-receipt'); });
  await page.goto(BASE + '#/sales'); await sleep(1200); await shot(page, 'duka-sales');
  await ctx.close();
});

for (const type of ['hardware', 'pharmacy', 'boutique', 'restaurant', 'salon', 'butchery', 'agrovet', 'wholesale', 'minimart']) {
  await tryStep(type, async () => {
    const { ctx, page } = await demo(type);
    await shot(page, type + '-home');
    await page.goto(BASE + '#/sell'); await sleep(1200);
    await shot(page, type + '-sell');
    await ctx.close();
  });
}

// Phone view
await tryStep('phone', async () => {
  const { ctx, page } = await demo('duka', { width: 390, height: 844 });
  await shot(page, 'phone-home');
  await page.goto(BASE + '#/sell'); await sleep(1200); await shot(page, 'phone-sell');
  await ctx.close();
});

await browser.close();
server.close();
console.log('captured', results.length, results.join(', '));
