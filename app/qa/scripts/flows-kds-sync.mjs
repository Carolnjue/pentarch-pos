// Two devices on the mock cloud: a restaurant trial; device A (till) opens a table and sends to the kitchen, device B (kitchen
// tablet) shows the tickets on the KDS, bumps them, A's floor shows "Ready". Offline: A keeps sending (ticket on A's own KDS,
// queued in the outbox) and B receives it after A reconnects. Also: appointments and quotes sync as new entities.
import { chromium, newPage, BASE, shot, sleep, report, DESK, idb, step, setFailPage } from './lib.mjs';
const LIVE = 'pentarch-pos';
const b = await chromium.launch();
const A = await newPage(b, DESK);
const page = A.page;
setFailPage(page);
const email = `kitchen${Date.now()}@example.co.ke`;
const sync = async (p) => { await p.evaluate(() => window.__pposSync.syncNow('qa')); await sleep(1200); };
const tile = async (p, name) => { await p.locator('.tile', { hasText: name }).first().click(); await sleep(200); if (await p.locator('.modal h2').count() && await p.getByRole('button', { name: 'Add to order' }).count()) { await p.getByRole('button', { name: 'Add to order' }).click(); await sleep(150); } };
const waitFor = async (fn, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await sleep(500); } return false; };

await step('restaurant trial on device A (wizard + template menu) → typical table layout', async () => {
  await page.goto(BASE); await page.waitForSelector('.welcome');
  await page.getByRole('button', { name: /Start 30-day free trial/ }).click();
  await page.getByLabel('Business name').fill('Mama Oliech Kitchen');
  await page.getByLabel('Type of business').selectOption('restaurant');
  await page.getByLabel('Your name').fill('Akinyi Oliech');
  await page.getByLabel('Phone (M-Pesa)').fill('0712 777 888');
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Secret123');
  await page.getByLabel('Your 4-digit till PIN').fill('4321');
  await page.getByLabel('Town').fill('Kisumu');
  await page.getByText('I agree to the Pentarch POS terms').click();
  await page.getByRole('button', { name: /Start free trial/ }).last().click();
  await page.waitForSelector('.wizard', { timeout: 15000 });
  for (let i = 0; i < 6; i++) { await page.getByRole('button', { name: /Continue|Finish/ }).click(); await sleep(250); }
  await page.getByRole('button', { name: /Use the template catalogue/ }).click(); await sleep(800);
  await page.getByRole('button', { name: /Continue|Finish/ }).click(); await sleep(200);
  await page.getByRole('button', { name: /Finish/ }).click(); await sleep(200);
  await page.getByRole('button', { name: 'Go to Pentarch POS' }).click(); await page.waitForSelector('.shell');
  await page.goto(BASE + '#/tables'); await page.waitForSelector('.page-h'); await sleep(300);
  await shot(page, 'k-01-no-tables');
  await page.getByRole('button', { name: /Add a typical layout/ }).click(); await page.waitForSelector('.ftable'); await sleep(300);
  if (await page.locator('.ftable').count() < 8) throw new Error('layout not added');
});

let orderId;
await step('A: open T1, add food + drink, send to kitchen → pushed to the cloud', async () => {
  await page.locator('.ftable', { hasText: /^T1/ }).first().click(); await page.waitForSelector('.guest-grid');
  await page.locator('.guest-btn', { hasText: '2' }).click(); await page.waitForSelector('.tbar');
  await tile(page, 'Beef pilau'); await tile(page, 'Soda 500ml');
  await page.getByRole('button', { name: /Send to kitchen/ }).click(); await sleep(1500);
  await sync(page);
  const tk = (await idb(page, 'kitchen_tickets', LIVE));
  orderId = tk[0]?.order_id;
  if (tk.length !== 2) throw new Error('tickets ' + tk.length);
  const out = (await idb(page, 'outbox', LIVE)).length;
  if (out) throw new Error('outbox not empty: ' + out);
});

const B = await newPage(b, { width: 1024, height: 768 }, { hasTouch: true });
await step('B (kitchen tablet) signs in → KDS shows both tickets from A', async () => {
  const p = B.page;
  await p.goto(BASE); await p.waitForSelector('.welcome');
  await p.getByRole('button', { name: /Sign in to my business/ }).click();
  await p.getByLabel('Email').fill(email); await p.getByLabel('Password').fill('Secret123');
  await p.getByRole('button', { name: /^Sign in$/ }).click();
  await p.waitForSelector('.lock', { timeout: 20000 });
  await p.getByRole('option', { name: /Akinyi/ }).click();
  for (const d of '4321') await p.keyboard.press(d);
  await p.waitForSelector('.shell');
  await p.goto(BASE + '#/kds'); await p.waitForSelector('.kds');
  if (!(await waitFor(async () => (await p.locator('.kt').count()) === 2))) throw new Error('B KDS shows ' + await p.locator('.kt').count());
  const txt = await p.locator('.kds-grid').innerText();
  if (!/T1/.test(txt) || !/Beef pilau/.test(txt) || !/Soda/.test(txt)) throw new Error('KDS text ' + txt);
  await shot(p, 'k-02-kds-device-b');
});

await step('B bumps both tickets → A sees the order as "Food ready"', async () => {
  const p = B.page;
  for (let i = 0; i < 2; i++) { await p.locator('.kt').first().getByRole('button', { name: 'Done' }).click(); await sleep(400); }
  await sync(p);
  await sync(page);
  await page.goto(BASE + '#/tables'); await page.waitForSelector('.floor');
  if (!(await waitFor(async () => (await page.locator('.ftable.ready').count()) > 0, 15000))) throw new Error('A floor not showing ready');
  await shot(page, 'k-03-a-food-ready');
});

await step('offline: A sends round 2 with no network (own KDS shows it, outbox queued), B gets it after reconnect', async () => {
  await A.ctx.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.locator('.ftable', { hasText: /^T1/ }).first().click(); await page.waitForSelector('.tbar');
  await tile(page, 'Chips plain');
  await page.getByRole('button', { name: /Send to kitchen/ }).click(); await sleep(1500);
  const pend = (await idb(page, 'outbox', LIVE)).filter((o) => o.entity === 'kitchen_tickets').length;
  if (!pend) throw new Error('ticket not queued offline');
  await page.goto(BASE + '#/kds'); await page.waitForSelector('.kds'); await sleep(500);
  if (!/Chips plain/.test(await page.locator('.kds').innerText())) throw new Error('A KDS missing offline ticket');
  await shot(page, 'k-04-a-offline-kds');
  if (/Chips plain/.test(await B.page.locator('.kds').innerText())) throw new Error('B saw it while A offline?');
  await A.ctx.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  if (!(await waitFor(async () => !(await idb(page, 'outbox', LIVE)).length, 15000))) throw new Error('A outbox not flushed');
  if (!(await waitFor(async () => /Chips plain/.test(await B.page.locator('.kds').innerText()), 20000))) throw new Error('B did not receive the offline ticket');
  await shot(B.page, 'k-05-b-after-reconnect');
});

await step('A pays the table; B sees the order closed (paid)', async () => {
  await page.goto(BASE + '#/tables'); await page.waitForSelector('.floor');
  await page.locator('.ftable', { hasText: /^T1/ }).first().click(); await page.waitForSelector('.tbar');
  await page.locator('.pay-btn').click(); await page.waitForSelector('.tender');
  await page.getByRole('button', { name: 'Exact' }).click(); await page.waitForSelector('.done-hero');
  await page.keyboard.press('Enter'); await sleep(500);
  await sync(page); await sync(B.page);
  const o = (await idb(B.page, 'orders', LIVE)).find((x) => x.id === orderId);
  if (o?.status !== 'paid') throw new Error('B order status ' + o?.status);
  const s = (await idb(B.page, 'sales', LIVE)).find((x) => x.order_id === orderId);
  if (!s || s.order_type !== 'dine_in') throw new Error('sale not synced');
});

report('flows-kds-sync');
await b.close();
