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

await tryStep('welcome', async () => {
  const { ctx, page } = await ctxPage();
  await page.goto(BASE); await sleep(2500); await shot(page, 'welcome'); await ctx.close();
});

await tryStep('labels', async () => {
  const { ctx, page } = await demo('duka');
  const P = await products(page);
  await page.goto(BASE + '#/products/labels'); await sleep(1200);
  await page.mouse.click(700, 400);
  for (const n of ['Kabras Sugar 1kg', 'Jogoo Maize Flour 2kg', 'Kimbo 1kg']) { const p = P.find((x) => x.name === n); await scan(page, p.barcode); await sleep(300); }
  await sleep(1500); await shot(page, 'duka-labels'); await ctx.close();
});
for (const [type, names] of [['hardware', 3], ['restaurant', 4], ['salon', 2], ['pharmacy', 3]]) {
  await tryStep(type + '-cart', async () => {
    const { ctx, page } = await demo(type);
    await page.goto(BASE + '#/sell'); await page.waitForSelector('.tiles .tile'); await sleep(600);
    for (let i = 0; i < names; i++) { await page.locator('.tiles .tile').nth(i * 2).click(); await sleep(400); const m = page.locator('.modal'); if (await m.count()) { await page.keyboard.press('Escape'); await sleep(200); } }
    await sleep(500); await shot(page, type + '-cart'); await ctx.close();
  });
}
await browser.close(); server.close(); console.log('captured', results.join(', '));
