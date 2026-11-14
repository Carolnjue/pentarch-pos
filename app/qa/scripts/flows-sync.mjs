// Trial registration against the mock cloud, sync push/pull between two devices, void propagation, offline selling after reload.
import { chromium, newPage, BASE, shot, sleep, scan, report, DESK, PHONE, idb, step, setFailPage } from './lib.mjs';
const b = await chromium.launch();
const A = await newPage(b, DESK);
const page = A.page;
setFailPage(page);
const email = `owner${Date.now()}@example.co.ke`;
const LIVE = 'pentarch-pos';
// CLOUD = the server the preview proxies /wp-json to (mock :8787 by default; real WordPress: CLOUD=http://127.0.0.1:8080 BASE=http://localhost:4174/pos/)
const CLOUD = process.env.CLOUD || 'http://127.0.0.1:8787';
const API = CLOUD + '/wp-json/pentarch-pos/v1';
const me = async (p) => { const tok = (await idb(p, 'meta', LIVE)).find((m) => m.key === 'device_token')?.value; const r = await fetch(API + '/me', { headers: { Authorization: 'Bearer ' + tok, 'X-PPC-Token': tok } }); return r.json(); };
console.log('cloud:', CLOUD, 'app:', BASE);
const syncNow = async (p) => { await p.locator('.top .tchip').filter({ hasText: /Synced|waiting|Not synced|Syncing|Offline|Sync/ }).first().click(); await sleep(1500); };
await step('welcome → start free trial (with agent code from ?ref=)', async () => {
  await page.goto(BASE + '?ref=AG-K7Q2'); await page.waitForSelector('.welcome');
  await shot(page, '30-welcome');
  await page.getByRole('button', { name: /Start 30-day free trial/ }).click();
  await page.getByLabel('Business name').fill('Wairimu General Stores');
  await page.getByLabel('Type of business').selectOption('duka');
  await page.getByLabel('Your name').fill('Jane Wairimu');
  await page.getByLabel('Phone (M-Pesa)').fill('0712 345 678');
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Secret123');
  await page.getByLabel('Your 4-digit till PIN').fill('4321');
  await page.getByLabel('Town').fill('Thika');
  if ((await page.getByLabel('Agent code (optional)').inputValue()) !== 'AG-K7Q2') throw new Error('agent ref not prefilled');
  await page.getByText('I agree to the Pentarch POS terms').click();
  await shot(page, '31-trial-form');
  await page.getByRole('button', { name: /Start free trial/ }).last().click();
  await page.waitForSelector('.wizard', { timeout: 15000 });
});
await step('setup wizard: all steps incl. template catalogue', async () => {
  await shot(page, '32-wizard');
  for (let i = 0; i < 6; i++) { await page.getByRole('button', { name: /Continue|Finish/ }).click(); await sleep(250); }
  await page.getByRole('button', { name: /Use the template catalogue/ }).click(); await sleep(800);
  await shot(page, '33-wizard-products');
  await page.getByRole('button', { name: /Continue|Finish/ }).click(); await sleep(200);
  await page.getByRole('button', { name: /Finish/ }).click(); await sleep(200);
  await page.getByRole('button', { name: 'Go to Pentarch POS' }).click(); await page.waitForSelector('.shell');
  const m = await me(page);
  if (!m.tenant_id || (m.email && m.email !== email)) throw new Error('not registered on cloud: ' + JSON.stringify(m).slice(0, 200));
  console.log('   registered', m.tenant_id, m.business_code, 'licence', m.licence?.status, m.licence?.days_left + 'd');
  if (!CLOUD.includes('8080')) {
    const st = await (await fetch(API + '/__dev/state')).json();
    const t = st.tenants.find((x) => x.email === email);
    if (t?.agent_code !== 'AG-K7Q2') throw new Error('agent code not attributed');
  }
});
let saleNo;
await step('sale on device A pushes to cloud', async () => {
  const products = await idb(page, 'products', LIVE);
  const milk = products.find((p) => p.name === 'Brookside Milk 500ml');
  await page.goto(BASE + '#/sell'); await page.waitForSelector('.tiles');
  await scan(page, milk.barcode); await scan(page, milk.barcode);
  await page.keyboard.press('F4'); await page.waitForSelector('.tender'); await sleep(150);
  await page.getByRole('button', { name: 'Exact' }).click(); await page.waitForSelector('.done-hero');
  saleNo = (await idb(page, 'sales', LIVE))[0].no;
  await page.keyboard.press('Enter');
  await syncNow(page);
  const pend = await idb(page, 'outbox', LIVE);
  console.log('   sale', saleNo, 'outbox after sync', pend.length);
  if (pend.length) throw new Error('outbox not empty');
  await shot(page, '34-synced');
});
const B = await newPage(b, DESK);
await step('device B signs in, pulls, sees the sale and stock', async () => {
  const p = B.page;
  await p.goto(BASE); await p.waitForSelector('.welcome');
  await p.getByRole('button', { name: /Sign in to my business/ }).click();
  await p.getByLabel('Email').fill(email); await p.getByLabel('Password').fill('Secret123');
  await p.getByRole('button', { name: /^Sign in$/ }).click();
  await p.waitForSelector('.lock', { timeout: 20000 });
  await p.getByRole('option', { name: /Jane/ }).click();
  for (const d of '4321') await p.keyboard.press(d);
  await p.waitForSelector('.shell');
  const sales = await idb(p, 'sales', LIVE);
  if (!sales.find((s) => s.no === saleNo)) throw new Error('sale not on B');
  const lv = await idb(p, 'stock_levels', LIVE);
  console.log('   B sees', sales.length, 'sale(s); stock rows', lv.length);
  await p.goto(BASE + '#/sales'); await p.waitForSelector('.vt-row'); await shot(p, '35-device-b-sales');
});
await step('void on B propagates to A (ledger row update)', async () => {
  const p = B.page;
  const s = (await idb(p, 'sales', LIVE)).find((x) => x.no === saleNo);
  await p.goto(BASE + '#/sales/' + s.id); await p.waitForSelector('.page-h');
  await p.getByRole('button', { name: 'Void' }).click(); await p.waitForSelector('.modal');
  await p.getByRole('button', { name: 'Wrong item scanned' }).click(); await p.getByRole('button', { name: 'Void sale' }).click(); await sleep(400);
  await syncNow(p); await syncNow(page);
  const a = (await idb(page, 'sales', LIVE)).find((x) => x.no === saleNo);
  console.log('   A sees status', a.status);
  if (a.status !== 'void') throw new Error('void did not sync');
});
await step('offline: reload with no network, still sells; syncs when back', async () => {
  await A.ctx.setOffline(true);
  await page.reload(); await page.waitForSelector('.lock, .shell', { timeout: 15000 });
  if (await page.locator('.lock').count()) { await page.getByRole('option', { name: /Jane/ }).click(); for (const d of '4321') await page.keyboard.press(d); await page.waitForSelector('.shell'); }
  await page.goto(BASE + '#/sell'); await page.waitForSelector('.tiles');
  await page.locator('.tile').first().click(); await sleep(150);
  await page.keyboard.press('F4'); await page.waitForSelector('.tender'); await sleep(150);
  await page.getByRole('button', { name: 'Exact' }).click(); await page.waitForSelector('.done-hero');
  await page.keyboard.press('Enter'); await sleep(300);
  await shot(page, '36-offline-sell');
  const pend = (await idb(page, 'outbox', LIVE)).length;
  console.log('   offline outbox', pend);
  if (!pend) throw new Error('nothing queued');
  await A.ctx.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  let left = 1;
  for (let i = 0; i < 20 && left; i++) { await sleep(500); left = (await idb(page, 'outbox', LIVE)).length; }
  console.log('   sync state', JSON.stringify(await page.evaluate(() => window.__pposSync.state())));
  console.log('   pill', await page.locator('.top .tchip').filter({ hasText: /Synced|waiting|Not synced|Syncing|Offline|Sync/ }).first().innerText().catch(() => '?'), 'online', await page.evaluate(() => navigator.onLine));
  console.log('   after reconnect outbox', left);
  await syncNow(B.page);
  const bs = await idb(B.page, 'sales', LIVE);
  console.log('   B now has', bs.length, 'sales');
  if (left) throw new Error('outbox not flushed');
});
await step('licence page shows business code as M-Pesa account', async () => {
  await page.goto(BASE + '#/settings/licence'); await page.waitForSelector('text=How to pay'); await sleep(300);
  const m = await me(page);
  const txt = await page.locator('main').innerText();
  if (!m.business_code || !txt.includes(m.business_code)) throw new Error('business code ' + m.business_code + ' not shown');
  await shot(page, CLOUD.includes('8080') ? '37-licence-real-cloud' : '37-licence');
});
await step('M-Pesa STK without Daraja keys (501) falls back to typing the code', async () => {
  await page.goto(BASE + '#/settings/payments'); await page.waitForSelector('.page');
  await page.locator('.set-row', { hasText: 'Send STK push' }).locator('.switch').click(); await page.getByRole('button', { name: 'Save' }).click(); await sleep(300);
  await page.goto(BASE + '#/sell'); await page.waitForSelector('.tiles');
  await page.locator('.tile').first().click(); await page.keyboard.press('F4'); await page.waitForSelector('.tender');
  await page.getByRole('tab', { name: /M-Pesa/ }).click();
  await page.getByLabel('Customer phone (optional)').fill('0712345678');
  await page.getByRole('button', { name: 'Send STK request to phone' }).click();
  await page.waitForSelector('.callout.bad', { timeout: 10000 });
  const msg = await page.locator('.callout.bad').innerText();
  console.log('   ', msg.slice(0, 90));
  if (!/not set up|enter the code|M-Pesa code/i.test(msg)) throw new Error('no fallback message');
  if (await page.getByRole('button', { name: 'Send STK request to phone' }).count()) throw new Error('STK button still offered after 501');
  await page.getByLabel('M-Pesa code').fill('TK7AB3CD9E'); await page.getByLabel('M-Pesa code').press('Enter');
  await page.waitForSelector('.done-hero'); await page.keyboard.press('Enter');
});
report('flows-sync');
await b.close();
