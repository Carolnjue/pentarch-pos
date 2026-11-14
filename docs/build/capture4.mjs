// Captures the Phase 2 (release 1.1.0) screens for the docs: restaurant, services, quotes, stock, purchases, reports.
// Usage: node docs/build/capture4.mjs   (serves app/dist under /pos/ on a free port)
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
// marks: { shot: [[x%, y%], ...] } — left edge, vertical centre of key elements, read by the content files for numbered markers
const MARKS_FILE = OUT + 'marks.json';
const MARKS = fs.existsSync(MARKS_FILE) ? JSON.parse(fs.readFileSync(MARKS_FILE, 'utf8')) : {};
async function shot(page, name, marks = []) {
  await page.addStyleTag({ content: HIDE }).catch(() => {});
  await sleep(250);
  const vp = page.viewportSize(); const pts = [];
  for (const m of marks) {
    const loc = typeof m === 'string' ? page.locator(m).first() : m.first();
    const b = await loc.boundingBox().catch(() => null);
    pts.push(b ? [+(Math.max(b.x - 4, 8) / vp.width * 100).toFixed(1), +((b.y + b.height / 2) / vp.height * 100).toFixed(1)] : null);
    if (!b) console.log('  no mark', name, String(m));
  }
  MARKS[name] = pts;
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
async function idb(page, table) {
  return page.evaluate((table) => new Promise((res) => { const r = indexedDB.open('pentarch-pos-demo'); r.onsuccess = () => { const q = r.result.transaction(table).objectStore(table).getAll(); q.onsuccess = () => res(q.result); }; }), table);
}
const go = async (page, hash, sel = '.page, .sell, .kds') => { await page.goto(BASE + '#/home'); await page.goto(BASE + '#' + hash); await page.waitForSelector(sel, { timeout: 15000 }); await sleep(700); };
const esc = async (page) => { await page.keyboard.press('Escape'); await sleep(250); };

// Phase 2 screens (release 1.1.0) for the docs
const btn = (page, re) => page.getByRole('button', { name: re });
await tryStep('restaurant', async () => {
  const { ctx, page } = await demo('restaurant');
  await go(page, '/tables', '.floor'); await shot(page, 'r-floor', ['.ftable.s-free']);
  await page.locator('.ftable.s-busy').first().click(); await page.waitForSelector('.tbar'); await sleep(600);
  await tryStep('split', async () => { await btn(page, /Split bill/).click(); await sleep(500); const plus = page.locator('.modal button[aria-label=More]'); await plus.nth(0).click(); await sleep(150); await plus.nth(2).click(); await plus.nth(2).click(); await sleep(400); await shot(page, 'r-split', [page.locator('.modal button[aria-label=More]'), btn(page, /Pay for these items/)]); await esc(page); });
  await tryStep('add', async () => {
    await page.locator('.tiles .tile', { hasText: 'Chapati' }).first().click(); await sleep(500);
    if (await page.locator('.modal').count()) { await page.locator('.modal .btn.primary').last().click(); await sleep(400); }
  });
  await sleep(500); await shot(page, 'r-table-order', ['.tiles .tile', btn(page, /Send to kitchen/)]);
  await go(page, '/kds', '.kds'); await sleep(800); await shot(page, 'r-kds', [btn(page, /^Done$/).nth(1)]);
  await go(page, '/orders'); await shot(page, 'r-orders');
  await ctx.close();
});
await tryStep('salon', async () => {
  const { ctx, page } = await demo('salon');
  await go(page, '/sell', '.sell'); await page.waitForSelector('.tiles .tile');
  await page.locator('.tile', { hasText: 'Manicure' }).first().click(); await page.waitForSelector('.sp-grid'); await sleep(400); await shot(page, 's-staff-picker', ['.sp-tile >> nth=1']);
  await page.locator('.sp-tile').nth(1).click(); await sleep(300);
  await go(page, '/commission'); await shot(page, 's-commission', ['.stat']);
  await go(page, '/appointments'); await shot(page, 's-appointments', [btn(page, /Book appointment/), btn(page, /Arrived/)]);
  await ctx.close();
});
await tryStep('hardware-quotes', async () => {
  const { ctx, page } = await demo('hardware');
  await go(page, '/quotes'); await shot(page, 'q-quotes', [btn(page, /New quote/)]);
  await page.getByRole('tab', { name: /^Quotes/ }).click(); await sleep(300);
  await page.locator('.vt-row').first().click(); await page.waitForSelector('.qe'); await sleep(600);
  await shot(page, 'q-editor', ['.qe input >> nth=0', btn(page, /WhatsApp/), btn(page, /Convert to invoice/)]);
  await go(page, '/quotes'); await page.getByRole('tab', { name: /Invoices/ }).click(); await sleep(500); await shot(page, 'q-invoices', [page.getByRole('tab', { name: /Invoices/ }), 'text=Owed on invoices']);
  await ctx.close();
});
await tryStep('shop-stock', async () => {
  const { ctx, page } = await demo('minimart');
  const P = await idb(page, 'products');
  const codes = P.filter((p) => p.track_stock && p.barcode && !p.track_batches).slice(0, 5).map((p) => p.barcode);
  await go(page, '/inventory', '.vt-row'); await shot(page, 'i-stock');
  await go(page, '/purchasing/receive');
  await page.getByLabel(/^Supplier$/).selectOption({ index: 1 }); await sleep(300);
  await page.mouse.click(700, 300);
  for (const c of codes.slice(0, 4)) { await page.locator('.adder input').fill(c); await page.keyboard.press('Enter'); await sleep(250); }
  await sleep(500); await shot(page, 'p-receive', [page.getByLabel(/^Supplier$/), '.adder input', btn(page, /^Receive stock$/)]);
  await go(page, '/inventory/counts'); await page.locator('.page-h .btn.primary').click(); await page.waitForSelector('.modal');
  await page.locator('.modal .inv-act').nth(2).click(); await page.locator('.modal-f .btn.primary').click(); await page.waitForSelector('.count-scan'); await sleep(500);
  for (const c of codes) await scan(page, c);
  await sleep(500); await shot(page, 'i-count', ['.count-scan input', page.getByText(/Check differences/)]);
  await ctx.close();
});
await tryStep('owner', async () => {
  const { ctx, page } = await demo('duka');
  await shot(page, 'o-home', [page.getByText(/You sold KES/), '.stat >> nth=3']);
  await go(page, '/reports', '.rpt-card'); await shot(page, 'o-reports');
  for (const id of ['pnl', 'exceptions']) {
    await page.goto(BASE + '#/reports/' + id); await page.waitForSelector('.rpt-body, .rpt .empty', { timeout: 15000 });
    await page.waitForFunction((id) => window.__report?.id === id, id, { timeout: 15000 }).catch(() => {}); await sleep(500);
    if (id === 'pnl') { await btn(page, /^Last month$/).first().click().catch(() => {}); await sleep(1500); }
    await shot(page, 'o-' + id, id === 'pnl' ? ['.stat >> nth=3', btn(page, /^Last month$/)] : [page.getByText(/exceptions recorded/), '.stat >> nth=1']);
  }
  await go(page, '/expenses', '.exp-page .stat'); await shot(page, 'o-expenses');
  await ctx.close();
});
fs.writeFileSync(MARKS_FILE, JSON.stringify(MARKS, null, 1));
await browser.close(); server.close(); console.log('captured', results.join(', '));
