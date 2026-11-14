// Upgrade test: a device that used the Phase 1 build (Dexie schema v1) loads the Phase 2 build (schema v2:
// kitchen_tickets, appointments) in the same browser profile — data must be intact and the new tables usable.
// OLD_DIST=<Phase 1 dist (git c775899)> node qa/scripts/upgrade-v1.mjs   (NEW_DIST defaults to ./dist; mock cloud on :8787)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { chromium, step, setFailPage, sleep, OUT } from './lib.mjs';

const OLD = process.env.OLD_DIST, NEW = process.env.NEW_DIST || new URL('../../dist', import.meta.url).pathname;
const CLOUD = process.env.CLOUD || 'http://127.0.0.1:8787';
if (!OLD || !fs.existsSync(path.join(OLD, 'index.html'))) { console.log('set OLD_DIST to the Phase 1 build'); process.exit(2); }
const PORT = 4180, BASE = `http://localhost:${PORT}/pos/`;
let root = OLD;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, BASE);
  if (u.pathname.startsWith('/wp-json/')) { // proxy to the cloud like `vite preview`
    const p = http.request(CLOUD + u.pathname + u.search, { method: req.method, headers: { ...req.headers, host: new URL(CLOUD).host } }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    p.on('error', () => { res.writeHead(502); res.end(); });
    return req.pipe(p);
  }
  let f = path.join(root, decodeURIComponent(u.pathname.replace(/^\/pos\/?/, '')));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(root, 'index.html');
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ppos-upg-'));
const open = async () => {
  const ctx = await chromium.launchPersistentContext(profile, { viewport: { width: 1366, height: 768 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('ppos.tour.sell', 'done'); } catch {} });
  const page = ctx.pages()[0] || (await ctx.newPage());
  page.on('dialog', (d) => d.accept());
  setFailPage(page);
  return { ctx, page };
};
const counts = (page, dbName, tables) => page.evaluate(([dbName, tables]) => new Promise((res, rej) => {
  const r = indexedDB.open(dbName);
  r.onsuccess = async () => {
    const d = r.result, out = { _version: d.version, _stores: [...d.objectStoreNames] };
    for (const t of tables) if (d.objectStoreNames.contains(t)) out[t] = await new Promise((ok) => { const q = d.transaction(t).objectStore(t).count(); q.onsuccess = () => ok(q.result); });
    d.close(); res(out);
  };
  r.onerror = rej;
}), [dbName, tables]);
const T = ['business', 'users', 'products', 'sales', 'stock_moves', 'customers', 'shifts', 'audit', 'outbox', 'meta'];
const fail = (m) => { throw new Error(m); };
let before = {}, beforeDemo = {};
const stamp = Date.now();

let { ctx, page } = await open();
await step('Phase 1 build: start a trial business (live) and add the template products; open a demo', async () => {
  await page.goto(BASE);
  await page.waitForSelector('.welcome', { timeout: 20000 });
  await page.getByRole('button', { name: /Start 30-day free trial/ }).click();
  await page.getByLabel('Business name').fill('Upgrade Duka');
  await page.getByLabel('Type of business').selectOption('duka');
  await page.getByLabel('Your name').fill('Upgrade Owner');
  await page.getByLabel('Phone (M-Pesa)').fill('0712 333 444');
  await page.getByLabel(/^Email/).fill(`upgrade${stamp}@example.co.ke`);
  await page.getByLabel('Password', { exact: true }).fill('Secret123');
  await page.getByLabel('Your 4-digit till PIN').fill('4321');
  await page.getByLabel('Town').fill('Embu');
  await page.getByText('I agree to the Pentarch POS terms').click();
  await page.getByRole('button', { name: /Start free trial/ }).last().click();
  await page.waitForSelector('.wizard', { timeout: 20000 });
  await page.getByRole('button', { name: /Skip setup for now/ }).click(); await page.waitForSelector('.shell');
  await page.evaluate(() => { location.hash = '#/products'; });
  await page.getByRole('button', { name: /Add typical products/ }).first().click();
  await page.waitForSelector('.vt-row', { timeout: 20000 });
  await sleep(500);
  before = await counts(page, 'pentarch-pos', T);
  if (before._version !== 10) fail('Phase 1 schema should be Dexie v1 (IDB 10), got ' + before._version);
  if (!before.products) fail('no products');
  // a demo database too (v1)
  await page.goto(BASE + '?demo=1&type=duka');
  await page.waitForSelector('.shell', { timeout: 40000 });
  beforeDemo = await counts(page, 'pentarch-pos-demo', T);
  console.log(`   v1 live: ${before.products} products, ${before.users} users, outbox ${before.outbox}; v1 demo: ${beforeDemo.sales} sales`);
  await page.screenshot({ path: OUT + 'upg-01-phase1.png' });
});
await ctx.close();

root = NEW; // the server now ships the Phase 2 build
({ ctx, page } = await open());
await step('Phase 2 build in the same profile: the update prompt installs it, the database upgrades to v2, data intact', async () => {
  await page.goto(BASE);
  // the Phase 1 service worker serves the old shell first, then offers the update (registerType: prompt)
  const btn = page.getByRole('button', { name: 'Update now' });
  const got = await btn.waitFor({ timeout: 30000 }).then(() => true).catch(() => false);
  console.log('   update prompt shown: ' + got);
  if (got) { await Promise.all([page.waitForEvent('load', { timeout: 30000 }).catch(() => {}), btn.click()]); }
  await page.waitForSelector('.lock, .shell, .welcome', { timeout: 30000 });
  // make sure we are on the new build (the new boot clears the old per-visit demo flag)
  for (let i = 0; i < 20 && (await page.evaluate(() => localStorage.getItem('ppos.mode'))) === 'demo'; i++) { await page.reload(); await sleep(500); }
  await page.waitForSelector('.lock', { timeout: 30000 });
  if (!/Upgrade Duka|Upgrade Owner/.test(await page.locator('.lock').innerText())) fail('the real business did not open (Phase 1 left the demo as default)');
  const after = await counts(page, 'pentarch-pos', [...T, 'kitchen_tickets', 'appointments']);
  if (after._version !== 20) fail('database not upgraded to v2: ' + after._version);
  if (!after._stores.includes('kitchen_tickets') || !after._stores.includes('appointments')) fail('new tables missing');
  for (const k of T) if (k !== 'meta' && k !== 'outbox' && k !== 'audit' && after[k] !== before[k]) fail(`${k}: ${before[k]} → ${after[k]}`);
  if (after.outbox < before.outbox - 0 && after.outbox !== 0) fail('outbox lost'); // it may have synced meanwhile
  console.log(`   v2 live: ${after.products} products, ${after.users} users, audit ${before.audit}→${after.audit}, tables ${after._stores.length}`);
  // unlock with the PIN and sell one product
  await page.getByText('Upgrade Owner').first().click().catch(() => {});
  for (const d of '4321') await page.keyboard.press(d);
  await page.waitForSelector('.shell', { timeout: 15000 });
  await page.evaluate(() => { location.hash = '#/sell'; });
  await page.locator('.tiles > *').first().click({ timeout: 15000 });
  await sleep(400);
  const anyway = page.getByRole('button', { name: /anyway|Add anyway|Sell anyway/i });
  if (await anyway.count()) await anyway.first().click();
  await page.locator('.pay-btn').click();
  await page.getByRole('button', { name: 'Exact' }).click();
  await page.getByRole('button', { name: /New sale/ }).click({ timeout: 15000 });
  const s = await counts(page, 'pentarch-pos', ['sales']);
  if (s.sales !== before.sales + 1) fail('sale after upgrade not saved');
  await page.screenshot({ path: OUT + 'upg-02-phase2-sold.png' });
});
await step('the old demo database upgrades too (same demo type keeps its history)', async () => {
  await page.goto(BASE + '?demo=1&type=duka');
  await page.waitForSelector('.shell', { timeout: 40000 });
  const a = await counts(page, 'pentarch-pos-demo', ['sales', 'products', 'kitchen_tickets']);
  if (a._version !== 20) fail('demo DB version ' + a._version);
  if (a.sales !== beforeDemo.sales || a.products !== beforeDemo.products) fail(`demo data changed: sales ${beforeDemo.sales}→${a.sales}`);
  console.log(`   v2 demo: ${a.sales} sales kept`);
});
await ctx.close();
server.close();
fs.rmSync(profile, { recursive: true, force: true });
