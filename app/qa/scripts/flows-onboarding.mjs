// Onboarding edge cases, against the mock (default) or the real WordPress cloud:
//   CLOUD=http://127.0.0.1:8080 BASE=http://localhost:4174/pos/ node qa/scripts/flows-onboarding.mjs
// 1. trial form: email already registered → error on the email field, nothing created locally, fix → trial starts
// 2. trial started offline → works locally → registers on reconnect (tenant re-keyed) → data reaches the cloud
// 3. website/agent-started trial (server seeds a minimal business) → first sign-in runs the wizard and merges, never blanking
import { chromium, newPage, BASE, shot, sleep, report, DESK, idb, step, setFailPage } from './lib.mjs';
const CLOUD = process.env.CLOUD || 'http://127.0.0.1:8787';
const API = CLOUD + '/wp-json/pentarch-pos/v1';
const LIVE = 'pentarch-pos';
const REAL = CLOUD.includes('8080');
const tag = REAL ? 'real' : 'mock';
const post = async (path, body, tok) => { const r = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok, 'X-PPC-Token': tok } : {}) }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json().catch(() => null) }; };
const get = async (path, tok) => (await fetch(API + path, { headers: { Authorization: 'Bearer ' + tok, 'X-PPC-Token': tok } })).json();
const meta = async (p, key) => (await idb(p, 'meta', LIVE)).find((m) => m.key === key)?.value;
console.log('cloud:', CLOUD, 'app:', BASE);
const b = await chromium.launch();
const stamp = Date.now();
const fill = async (page, f) => {
  await page.getByRole('button', { name: /Start 30-day free trial/ }).click();
  await page.getByLabel('Business name').fill(f.name);
  await page.getByLabel('Type of business').selectOption(f.type || 'duka');
  await page.getByLabel('Your name').fill(f.owner || 'Test Owner');
  await page.getByLabel('Phone (M-Pesa)').fill(f.phone || '0712 000 111');
  await page.getByLabel(/^Email/).fill(f.email);
  await page.getByLabel('Password', { exact: true }).fill('Secret123');
  await page.getByLabel('Your 4-digit till PIN').fill('4321');
  await page.getByLabel('Town').fill('Nakuru');
  await page.getByText('I agree to the Pentarch POS terms').click();
};

// an existing account to collide with
const taken = `taken${stamp}@example.co.ke`;
const pre = await post('/auth/register', { business_name: 'Existing Shop', business_type: 'duka', owner_name: 'Existing Owner', phone: '0722000111', email: taken, password: 'Secret123', town: 'Nyeri', county: 'Nyeri', device_name: 'QA', source: 'app' });
console.log('   pre-registered', pre.status);

await step(`[${tag}] trial form: email already registered → field error, nothing created; fix → trial starts`, async () => {
  const { page } = await newPage(b, DESK); setFailPage(page);
  await page.goto(BASE); await page.waitForSelector('.welcome');
  await fill(page, { name: 'Collision Duka', email: taken });
  await page.getByRole('button', { name: /Start free trial/ }).last().click();
  await page.waitForSelector('.field .err', { timeout: 10000 });
  const msg = await page.locator('.field .err').first().innerText();
  await shot(page, `40-trial-email-taken-${tag}`);
  if (!/already|registered|account|exists/i.test(msg)) throw new Error('unexpected error text: ' + msg);
  if ((await idb(page, 'business', LIVE)).length) throw new Error('local business created despite rejection');
  await page.getByLabel(/^Email/).fill(`fixed${stamp}@example.co.ke`);
  await page.getByRole('button', { name: /Start free trial/ }).last().click();
  await page.waitForSelector('.wizard', { timeout: 15000 });
  if (!(await meta(page, 'device_token'))) throw new Error('not registered');
  console.log('   field error:', msg.slice(0, 70));
  await page.context().close();
});

await step(`[${tag}] trial started offline → sells → registers when back online`, async () => {
  const { ctx, page } = await newPage(b, DESK); setFailPage(page);
  // an installed app: the service worker controls the page before the connection drops
  await page.goto(BASE); await page.waitForSelector('.welcome');
  await page.evaluate(() => navigator.serviceWorker.ready); await page.reload(); await page.waitForSelector('.welcome');
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await ctx.setOffline(true);
  await fill(page, { name: 'Offline Kiosk', email: `offline${stamp}@example.co.ke`, phone: '0733 222 111' });
  await page.getByRole('button', { name: /Start free trial/ }).last().click();
  await page.waitForSelector('.wizard', { timeout: 15000 });
  const tid0 = await meta(page, 'tenant_id');
  if (!String(tid0).startsWith('local-')) throw new Error('expected a local tenant id, got ' + tid0);
  await page.getByRole('button', { name: /Skip setup for now/ }).click(); await page.waitForSelector('.shell');
  await page.goto(BASE + '#/products/new'); await page.waitForSelector('.pf-grid');
  await page.getByLabel('Product name').fill('Offline Soda 500ml'); await page.getByLabel('Selling price').fill('80');
  await page.getByRole('button', { name: 'Save product' }).click(); await sleep(600);
  await page.goto(BASE + '#/sell'); await page.waitForSelector('.tile');
  await page.locator('.tile', { hasText: 'Offline Soda' }).first().click();
  await page.getByRole('button', { name: /^Pay/ }).first().click(); await page.waitForSelector('.tender');
  await page.getByRole('button', { name: 'Exact' }).click(); await page.waitForSelector('.done-hero');
  await page.getByRole('button', { name: /New sale/ }).click();
  await ctx.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  let tid = tid0;
  for (let i = 0; i < 30 && String(tid).startsWith('local-'); i++) { await sleep(500); tid = await meta(page, 'tenant_id'); }
  if (String(tid).startsWith('local-')) throw new Error('never registered');
  let left = 1;
  for (let i = 0; i < 30 && left; i++) { await sleep(500); left = (await idb(page, 'outbox', LIVE)).length; }
  const tok = await meta(page, 'device_token');
  const pulled = await get('/sync/pull?since=0&limit=1000', tok);
  const ents = {}; for (const c of pulled.changes || []) ents[c.entity] = (ents[c.entity] || 0) + 1;
  console.log('   re-keyed', tid0.slice(0, 14) + '… →', tid, '· outbox', left, '· cloud has', JSON.stringify(ents));
  if (!ents.sales || !ents.products || !ents.business) throw new Error('cloud missing data');
  const biz = (pulled.changes || []).find((c) => c.entity === 'business');
  if (biz.id !== tid) throw new Error('business id not re-keyed on cloud');
  await shot(page, `41-offline-trial-registered-${tag}`);
  await ctx.close();
});

await step(`[${tag}] website-started trial: first sign-in runs the wizard and completes the minimal business`, async () => {
  const email = `web${stamp}@example.co.ke`;
  const r = await post('/auth/register', { business_name: 'Mama Njeri Salon', business_type: 'salon', owner_name: 'Njeri Wambui', phone: '0711 555 444', email, password: 'Secret123', town: 'Embu', county: 'Embu', device_name: 'Website', source: 'web' });
  if (r.status >= 300) throw new Error('web register failed ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 160));
  const seeded = await get('/sync/pull?since=0&limit=1000', r.body.device_token);
  const sb = (seeded.changes || []).find((c) => c.entity === 'business');
  console.log('   server seeded business:', sb ? JSON.stringify({ name: sb.data?.name, type: sb.data?.type, modules: !!sb.data?.modules, updated_at: sb.updated_at }) : 'none');
  const { page } = await newPage(b, DESK); setFailPage(page);
  await page.goto(BASE); await page.waitForSelector('.welcome');
  await page.getByRole('button', { name: /Sign in to my business/ }).click();
  await page.getByLabel('Email').fill(email); await page.getByLabel('Password').fill('Secret123');
  await page.getByRole('button', { name: /^Sign in$/ }).click();
  await page.waitForSelector('.wizard', { timeout: 20000 });
  await shot(page, `42-web-trial-wizard-${tag}`);
  const nameField = await page.getByLabel('Business name').inputValue();
  if (nameField !== 'Mama Njeri Salon') throw new Error('wizard lost the business name: ' + nameField);
  for (let i = 0; i < 6; i++) { await page.getByRole('button', { name: /Continue|Finish/ }).click(); await sleep(250); }
  await page.getByRole('button', { name: /Use the template catalogue/ }).click(); await sleep(800);
  await page.getByRole('button', { name: /Continue|Finish/ }).click(); await sleep(200);
  await page.getByRole('button', { name: /Finish/ }).click(); await sleep(200);
  await page.getByRole('button', { name: 'Go to Pentarch POS' }).click(); await page.waitForSelector('.shell, .lock');
  const biz = (await idb(page, 'business', LIVE))[0];
  if (biz.name !== 'Mama Njeri Salon' || biz.type !== 'salon' || !biz.modules?.services || !biz.settings) throw new Error('business not completed: ' + JSON.stringify({ n: biz.name, t: biz.type, m: biz.modules }));
  await page.evaluate(() => window.__pposSync.syncNow('qa')); await sleep(1500);
  const tok = await meta(page, 'device_token');
  const after = await get('/sync/pull?since=0&limit=1000', tok);
  const cb = (after.changes || []).filter((c) => c.entity === 'business').pop();
  if (!cb?.data?.modules || cb.data.name !== 'Mama Njeri Salon') throw new Error('cloud business not completed');
  const prods = (after.changes || []).filter((c) => c.entity === 'products').length;
  console.log('   cloud business now has modules + settings; products', prods);
  await page.context().close();
});

report('flows-onboarding');
await b.close();
