// Website demo embed (same origin) vs. "Start free trial": the demo must never become the default for /pos/.
// 1. /pos/?demo=1&type=… inside an iframe (like the product page) → demo runs, nothing persisted
// 2. then /pos/?trial=1 (website "Start free trial") → the trial form; /pos/ → Welcome; /pos/?ref=AG-… → Welcome; ?welcome=1 → Welcome
// 3. the demo's "Start free trial" inside the iframe breaks out to the full app (top window) with the trial form
// 4. demo opened full screen: a reload of that tab stays in the demo, a new tab (or /pos/?welcome=1) shows Welcome; "Leave demo" → Welcome
// 5. a real business on the device always wins over the demo
import { chromium, BASE, DESK, newPage, step, setFailPage, report, sleep } from './lib.mjs';

const b = await chromium.launch();
const { ctx, page } = await newPage(b, DESK);
setFailPage(page);
const origin = new URL(BASE).origin;
const HOST = origin + '/systems/pos/'; // a fake product page on the same origin as the app
await ctx.route(HOST, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: `<!doctype html><title>Product page</title><h1>Pentarch POS</h1>
  <iframe id="demo" src="${BASE}?demo=1&type=duka" style="width:1200px;height:700px;border:0"></iframe>
  <a id="trial" href="${BASE}?trial=1">Start free trial</a> <a id="trial-ref" href="${BASE}?ref=AG-K7Q2">Start (agent link)</a>` }));
const storage = (p) => p.evaluate(() => ({ ls: localStorage.getItem('ppos.mode'), ss: sessionStorage.getItem('ppos.mode') }));
const fail = (m) => { throw new Error(m); };
const isWelcomeHome = async (p) => { await p.waitForSelector('.welcome', { timeout: 20000 }); return p.getByRole('button', { name: /Try the demo/ }).isVisible(); };

await step('product page iframe runs the demo without remembering it', async () => {
  await page.goto(HOST);
  const fr = page.frameLocator('#demo');
  await fr.locator('.shell').waitFor({ timeout: 40000 });
  await fr.getByText('Demo — your changes stay in this browser').waitFor();
  const st = await storage(page);
  if (st.ls === 'demo' || st.ss === 'demo') fail('demo mode persisted from the iframe: ' + JSON.stringify(st));
  const src = page.frames().find((f) => f !== page.mainFrame())?.url();
  if (!/demo=1/.test(src || '')) fail('iframe URL lost its demo params: ' + src);
});

await step('then "Start free trial" (/pos/?trial=1) opens the trial form, not the demo', async () => {
  await page.click('#trial');
  await page.waitForSelector('.welcome', { timeout: 20000 });
  await page.getByLabel('Business name').waitFor({ timeout: 5000 });
  if (new URL(page.url()).search) fail('URL not cleaned: ' + page.url());
});

await step('/pos/, /pos/?ref=AG-… and /pos/?welcome=1 all show Welcome after the iframe demo', async () => {
  await page.goto(HOST); await page.frameLocator('#demo').locator('.shell').waitFor({ timeout: 40000 });
  await page.goto(BASE); if (!(await isWelcomeHome(page))) fail('/pos/ did not show Welcome');
  await page.goto(HOST); await page.frameLocator('#demo').locator('.shell').waitFor({ timeout: 40000 });
  await page.click('#trial-ref'); if (!(await isWelcomeHome(page))) fail('?ref did not show Welcome');
  if ((await page.evaluate(() => localStorage.getItem('ppos.ref'))) !== 'AG-K7Q2') fail('agent code not kept');
  await page.goto(BASE + '?welcome=1'); if (!(await isWelcomeHome(page))) fail('?welcome=1 did not show Welcome');
});

await step('"Start free trial" inside the embedded demo opens the full app with the trial form', async () => {
  await page.goto(HOST);
  const fr = page.frameLocator('#demo');
  await fr.locator('.shell').waitFor({ timeout: 40000 });
  await Promise.all([page.waitForURL((u) => !String(u).includes('/systems/pos/'), { timeout: 15000 }), fr.getByRole('button', { name: 'Start free trial' }).first().click()]);
  await page.getByLabel('Business name').waitFor({ timeout: 20000 });
});

await step('full-screen demo: reload stays in the demo, a new tab shows Welcome, "Leave demo" → Welcome', async () => {
  await page.goto(BASE + '?demo=1&type=supermarket');
  await page.waitForSelector('.shell', { timeout: 40000 });
  await page.reload();
  await page.waitForSelector('.lock, .shell', { timeout: 30000 });
  if (!(await page.getByText(/Demo/).first().isVisible())) fail('reload left the demo');
  const p2 = await ctx.newPage();
  await p2.goto(BASE); if (!(await isWelcomeHome(p2))) fail('new tab did not show Welcome');
  await p2.close();
  // back in the demo tab (reload shows the PIN screen) → Leave demo
  await page.locator('.lock').waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: 'Leave demo' }).click();
  if (!(await isWelcomeHome(page))) fail('Leave demo did not show Welcome');
  await page.reload(); if (!(await isWelcomeHome(page))) fail('reload after leaving went back to the demo');
});

await step('a real business on this device always wins over the demo', async () => {
  const stamp = Date.now();
  await page.goto(BASE + '?trial=1');
  await page.getByLabel('Business name').fill('Embed Test Duka');
  await page.getByLabel('Type of business').selectOption('duka');
  await page.getByLabel('Your name').fill('Embed Owner');
  await page.getByLabel('Phone (M-Pesa)').fill('0712 000 222');
  await page.getByLabel(/^Email/).fill(`embed${stamp}@example.co.ke`);
  await page.getByLabel('Password', { exact: true }).fill('Secret123');
  await page.getByLabel('Your 4-digit till PIN').fill('4321');
  await page.getByLabel('Town').fill('Thika');
  await page.getByText('I agree to the Pentarch POS terms').click();
  await page.getByRole('button', { name: /Start free trial/ }).last().click();
  await page.waitForSelector('.wizard', { timeout: 20000 });
  await page.getByRole('button', { name: /Skip setup for now/ }).click(); await page.waitForSelector('.shell');
  await page.goto(HOST); await page.frameLocator('#demo').locator('.shell').waitFor({ timeout: 40000 });
  for (const u of [BASE, BASE + '?trial=1', BASE + '?welcome=1']) {
    await page.goto(u);
    await page.waitForSelector('.lock, .shell', { timeout: 20000 });
    if (await page.getByText('Demo — your changes stay in this browser').count()) fail(u + ' opened the demo');
    const name = await page.locator('.lock').innerText().catch(() => '');
    if (!/Embed Test Duka|Embed Owner/.test(name)) fail(u + ' did not open the real business');
  }
  // the embed itself still runs the demo next to a real business
  await page.goto(HOST); await page.frameLocator('#demo').getByText('Demo — your changes stay in this browser').waitFor({ timeout: 40000 });
});

const errs = report('flows-demo-embed');
await b.close();
process.exit(errs.length ? 1 : 0);
