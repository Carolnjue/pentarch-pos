// Fresh install of cloud/pentarch-pos-cloud.zip through wp-admin (like a user would) + quick live smoke through WordPress:
// deactivate the old copy → upload the zip → activate → version 1.1.0 → /pos/ demo, trial registration, sale, sync →
// /pos/agents/ sign-in → demo-booking shortcode on a new test page.
// node cloud/qa/install-smoke.mjs [http://127.0.0.1:8080]
// NOTE: if wp-content/plugins/pentarch-pos-cloud is a SYMLINK to the repo, it is unlinked (never deleted through WordPress,
// which would delete the repo source) before the upload. Pass KEEP_LINK=1 to only run the smoke.
import { createRequire } from 'node:module';
import { execSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const BASE = process.argv[2] || 'http://127.0.0.1:8080';
const DIR = new URL('./', import.meta.url).pathname;
const ZIP = new URL('../pentarch-pos-cloud.zip', import.meta.url).pathname;
const PLUGDIR = '/home/claude/wptest/wp/wp-content/plugins/pentarch-pos-cloud';
const php = (...a) => execFileSync('php', ['/home/claude/wptest/wpset.php', ...a], { encoding: 'utf8' });
const sqlVar = (q) => JSON.parse(php('var', q) || '[]');
const results = []; let fails = 0;
async function step(name, fn) {
  const t0 = Date.now();
  try { await fn(); results.push({ name, ok: true }); console.log(`  PASS ${name} (${Date.now() - t0} ms)`); }
  catch (e) { fails++; results.push({ name, ok: false, err: String(e.message || e) }); console.log('  FAIL', name, '\n      ', String(e.message).split('\n')[0]); await page.screenshot({ path: DIR + 'install-fail.png' }).catch(() => {}); }
}
const browser = await pw.chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('dialog', (d) => d.accept());
const shot = (n) => page.screenshot({ path: `${DIR}${n}.png` });
const stamp = Date.now();

await step('Admin login', async () => {
  await page.goto(BASE + '/wp-login.php');
  await page.fill('#user_login', 'admin'); await page.fill('#user_pass', 'AdminPass123!');
  await page.click('#wp-submit'); await page.waitForURL(/wp-admin/);
});

await step('Deactivate the installed copy and remove it (symlink unlinked, never deleted through WordPress)', async () => {
  if (process.env.KEEP_LINK) return;
  await page.goto(BASE + '/wp-admin/plugins.php');
  const row = page.locator('tr[data-slug="pentarch-pos-cloud"]');
  if (await row.locator('.deactivate a').count()) { await row.locator('.deactivate a').click(); await page.waitForSelector('#message, .notice'); }
  const st = fs.lstatSync(PLUGDIR, { throwIfNoEntry: false });
  if (st?.isSymbolicLink()) fs.unlinkSync(PLUGDIR);
  else if (st) fs.rmSync(PLUGDIR, { recursive: true, force: true }); // a previous zip install (a real copy, not the repo)
  assert.ok(fs.existsSync(new URL('../pentarch-pos-cloud/pentarch-pos-cloud.php', import.meta.url)), 'repo source intact');
});

await step('Upload the zip in Plugins → Add New → Upload Plugin, Install Now, Activate', async () => {
  if (process.env.KEEP_LINK) return;
  await page.goto(BASE + '/wp-admin/plugin-install.php?tab=upload');
  if (!(await page.locator('#pluginzip').isVisible())) await page.locator('.upload-view-toggle').click();
  await page.setInputFiles('#pluginzip', ZIP);
  await shot('install-01-upload');
  await page.click('#install-plugin-submit');
  await page.waitForSelector('text=Plugin installed successfully', { timeout: 60000 });
  await shot('install-02-installed');
  await page.getByRole('link', { name: /Activate Plugin/ }).click();
  await page.waitForSelector('tr[data-slug="pentarch-pos-cloud"].active', { timeout: 30000 });
  const ver = await page.locator('tr[data-slug="pentarch-pos-cloud"] .plugin-version-author-uri').innerText();
  assert.match(ver, /Version 1\.1\.0/);
  await shot('install-03-active');
  assert.ok(!fs.lstatSync(PLUGDIR).isSymbolicLink(), 'installed as a real copy');
  assert.ok(fs.existsSync(PLUGDIR + '/public/pos/index.html') && fs.existsSync(PLUGDIR + '/public/agents/index.html'), 'builds inside');
});

await step('Health: /public/ping 1.1.0, /public/config prices incl. extra_till, every admin screen renders', async () => {
  const ping = await (await fetch(BASE + '/wp-json/pentarch-pos/v1/public/ping')).json();
  assert.equal(ping.version, '1.1.0');
  const cfg = await (await fetch(BASE + '/wp-json/pentarch-pos/v1/public/config')).json();
  assert.equal(cfg.prices.extra_till, 44900); assert.equal(cfg.prices.package_complete_till, 69900); assert.equal(cfg.prices.counter_kit, 21900);
  for (const slug of ['ppc', 'ppc-businesses', 'ppc-settings', 'ppc-tools']) {
    await page.goto(`${BASE}/wp-admin/admin.php?page=${slug}`); await page.waitForSelector('.ppc-wrap');
    assert.ok(!/(Warning|Notice|Fatal error|Deprecated)<\/b>:/.test(await page.content()), 'PHP notice on ' + slug);
  }
  await page.goto(`${BASE}/wp-admin/admin.php?page=ppc-settings#prices`);
  assert.equal(await page.locator('[name="s[extra_till]"]').first().inputValue().then((v) => v.replace(/\D/g, '')), '44900');
  await page.locator('#prices').scrollIntoViewIfNeeded(); await shot('install-04-settings-prices');
});

const app = await browser.newContext({ viewport: { width: 1366, height: 768 } });
await app.addInitScript(() => { try { localStorage.setItem('ppos.tour.sell', 'done'); } catch {} });
const ap = await app.newPage();
ap.on('pageerror', (e) => errors.push('[pos] ' + e.message));
await step('POS through WordPress: /pos/ Welcome, demo opens (supermarket)', async () => {
  await ap.goto(BASE + '/pos/'); await ap.waitForSelector('.welcome', { timeout: 30000 });
  await ap.goto(BASE + '/pos/?demo=1&type=supermarket'); await ap.waitForSelector('.shell', { timeout: 60000 });
  await ap.screenshot({ path: DIR + 'install-05-pos-demo.png' });
});
let tenant;
await step('POS: trial registration (/pos/?trial=1) → business on the cloud', async () => {
  await ap.goto(BASE + '/pos/?trial=1'); await ap.getByLabel('Business name').waitFor({ timeout: 30000 });
  await ap.getByLabel('Business name').fill('Live Smoke Duka ' + String(stamp).slice(-4));
  await ap.getByLabel('Type of business').selectOption('duka');
  await ap.getByLabel('Your name').fill('Smoke Owner');
  await ap.getByLabel('Phone (M-Pesa)').fill('0712 ' + String(stamp).slice(-6, -3) + ' ' + String(stamp).slice(-3));
  await ap.getByLabel(/^Email/).fill(`smoke${stamp}@example.co.ke`);
  await ap.getByLabel('Password', { exact: true }).fill('Secret123');
  await ap.getByLabel('Your 4-digit till PIN').fill('4321');
  await ap.getByLabel('Town').fill('Embu');
  await ap.getByText('I agree to the Pentarch POS terms').click();
  await ap.getByRole('button', { name: /Start free trial/ }).last().click();
  await ap.waitForSelector('.wizard', { timeout: 30000 });
  await ap.getByRole('button', { name: /Skip setup for now/ }).click(); await ap.waitForSelector('.shell');
  tenant = sqlVar(`SELECT id, code FROM {p}tenants WHERE email='smoke${stamp}@example.co.ke'`)[0];
  assert.ok(tenant, 'tenant registered on the cloud');
});
await step('POS: template products, a cash sale, sync → the sale is on the cloud', async () => {
  await ap.evaluate(() => { location.hash = '#/products'; });
  await ap.getByRole('button', { name: /Add typical products/ }).first().click();
  await ap.waitForSelector('.vt-row', { timeout: 20000 });
  await ap.evaluate(() => { location.hash = '#/sell'; });
  await ap.locator('.tiles > *').first().click(); await ap.waitForTimeout(400);
  const anyway = ap.getByRole('button', { name: /anyway/i }); if (await anyway.count()) await anyway.first().click();
  await ap.locator('.pay-btn').click(); await ap.waitForSelector('.tender');
  await ap.getByRole('button', { name: 'Exact', exact: true }).click(); await ap.waitForSelector('.done-hero');
  await ap.getByRole('button', { name: /New sale/ }).click();
  await ap.waitForFunction(() => window.__pposSync && window.__pposSync.state().pending === 0, null, { timeout: 60000 }).catch(() => {});
  const r = sqlVar(`SELECT entity, COUNT(*) n FROM {p}records WHERE tenant_id='${tenant.id}' GROUP BY entity`);
  const n = Object.fromEntries(r.map((x) => [x.entity, +x.n]));
  console.log('      cloud records:', JSON.stringify(n));
  assert.ok(n.sales >= 1 && n.products >= 10, 'sale + products synced');
  await ap.screenshot({ path: DIR + 'install-06-pos-live.png' });
});

await step('Agent portal through WordPress: an approved agent signs in', async () => {
  php('sql', 'DELETE FROM {p}rate_limits');
  const email = `smoke.agent.${stamp}@example.com`;
  const reg = await (await fetch(BASE + '/wp-json/pentarch-pos/v1/agents/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Smoke Agent', phone: '0711' + String(stamp).slice(-6), email, password: 'agentpass99', town: 'Embu', county: 'Embu', heard_from: 'Pentarch staff', agree_terms: true }) })).json();
  php('sql', `UPDATE {p}agents SET status='active' WHERE id=${reg.agent.id}`);
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await m.newPage();
  await p.goto(BASE + '/pos/agents/'); await p.waitForSelector('text=Sign in', { timeout: 30000 });
  await p.fill('input[autocomplete=username]', email); await p.fill('input[type=password]', 'agentpass99');
  await p.click('button:has-text("Sign in")');
  await p.locator('.tour button:has-text("Skip")').click({ timeout: 15000 }).catch(() => {});
  await p.waitForSelector('.hero', { timeout: 20000 });
  await p.goto(BASE + '/pos/agents/resources'); await p.waitForTimeout(1500);
  const txt = await p.locator('body').innerText();
  assert.match(txt, /44,900/, 'agent price list shows the server extra till price');
  await p.screenshot({ path: DIR + 'install-07-agent-prices.png' });
  await m.close();
});

await step('Demo-booking form shortcode on a new test page books a demo', async () => {
  const nonce = await page.evaluate(async (b) => (await fetch(b + '/wp-admin/admin-ajax.php?action=rest-nonce')).text(), BASE);
  const pg = await page.evaluate(async ([b, nonce, s]) => (await fetch(b + '/wp-json/wp/v2/pages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce }, body: JSON.stringify({ title: 'Smoke test ' + s, slug: 'smoke-' + s, status: 'publish', content: '[pentarch_pos_demo_form]\n\n[pentarch_pos_trial_link]' }) })).json(), [BASE, nonce, stamp]);
  assert.ok(pg.link, 'page created: ' + JSON.stringify(pg).slice(0, 200));
  const w = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const p = await w.newPage();
  await p.goto(pg.link); await p.waitForSelector('.ppc-demo');
  assert.match(await p.locator('.ppc-trial-link').first().getAttribute('href'), /\/pos\/\?trial=1/);
  await p.fill('.ppc-demo input[name=name]', 'Smoke Visitor');
  await p.fill('.ppc-demo input[name=phone]', '0720 ' + String(stamp).slice(-6, -3) + ' ' + String(stamp).slice(-3));
  await p.fill('.ppc-demo input[name=business]', 'Smoke Shop ' + String(stamp).slice(-3));
  await p.selectOption('.ppc-demo select[name=business_type]', 'duka');
  await p.fill('.ppc-demo input[name=town]', 'Embu');
  await p.click('.ppc-demo button[type=submit]');
  await p.waitForSelector('.ppc-demo__ok:not([hidden])', { timeout: 20000 });
  const ref = await p.locator('.ppc-demo__ref').innerText();
  assert.equal(Number(sqlVar(`SELECT COUNT(*) n FROM {p}demo_bookings WHERE ref='${ref}'`)[0].n), 1);
  await p.screenshot({ path: DIR + 'install-08-booking.png' });
  await w.close();
  await page.evaluate(async ([b, nonce, id]) => fetch(b + '/wp-json/wp/v2/pages/' + id + '?force=true', { method: 'DELETE', headers: { 'X-WP-Nonce': nonce } }), [BASE, nonce, pg.id]);
});

const errs = errors.filter((e) => !/favicon|Failed to fetch|ERR_/.test(e));
if (errs.length) { fails++; console.log('  page errors:', errs.slice(0, 5)); }
fs.writeFileSync(DIR + 'install-results.json', JSON.stringify({ at: new Date().toISOString(), zip: ZIP, size: fs.statSync(ZIP).size, results, errors: errs }, null, 2));
console.log(`install-smoke: ${results.length - fails}/${results.length} passed`);
await browser.close();
process.exit(fails ? 1 : 0);
