// Agent portal E2E + screenshots (Playwright). Usage: node agents-e2e.mjs [base]
import { createRequire } from 'node:module';
import { execSync, execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium } = pw;

const BASE = process.argv[2] || 'http://127.0.0.1:8080';
const API = BASE + '/wp-json/pentarch-pos/v1';
const SHOTS = new URL('./', import.meta.url).pathname;
const php = (...a) => execFileSync('php', ['/home/claude/wptest/wpset.php', ...a], { encoding: 'utf8' });
const sqlVar = (q) => JSON.parse(php('var', q) || '[]');
const results = [];
let fails = 0;
async function step(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('  PASS', name); }
  catch (e) { fails++; results.push({ name, ok: false, err: String(e.message || e) }); console.log('  FAIL', name, '\n      ', e.message); }
}
async function api(method, path, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(API + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
}

php('sql', 'DELETE FROM {p}rate_limits');
php('settings', JSON.stringify({ rate_register: 1000, rate_login: 1000, rate_booking: 1000 }));
const stamp = Date.now().toString(36);
const email = `wanjiku.${stamp}@example.com`;
const PASS = 'AgentPass2026';
const rnd3 = () => String(Math.floor(100 + Math.random() * 899));
const PH1 = '0722 ' + rnd3() + ' ' + rnd3();
const PH1N = '254' + PH1.replace(/\D/g, '').slice(1);
const PH2 = '0733 ' + rnd3() + ' ' + rnd3();
const AMANI = 'Duka la Amani ' + stamp.slice(-4).toUpperCase();
const OFFL = 'Offline Kiosk ' + stamp.slice(-4).toUpperCase();

const browser = await chromium.launch();
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, geolocation: { latitude: -1.2921, longitude: 36.8219, accuracy: 18 }, permissions: ['geolocation'], locale: 'en-KE' });
const page = await mobile.newPage();
page.on('pageerror', (e) => { console.log('    [pageerror]', e.message); });
const shot = (name) => page.screenshot({ path: `${SHOTS}${name}.png`, fullPage: false });
const shotFull = (name) => page.screenshot({ path: `${SHOTS}${name}.png`, fullPage: true });

await step('Unauthenticated visit redirects to sign-in', async () => {
  await page.goto(BASE + '/pos/agents/');
  await page.waitForSelector('text=Sign in');
  assert.match(page.url(), /\/pos\/agents\/login$/);
  await shot('agents-m-01-login');
});

await step('Sign up → pending approval screen', async () => {
  await page.click('text=Apply to become an agent');
  await page.waitForSelector('text=Become a Pentarch POS agent');
  await page.click('button:has-text("Send my application")');
  await page.waitForSelector('.field--err');
  await shot('agents-m-02-signup-errors');
  await page.fill('input[autocomplete=name]', 'Wanjiku Mwangi');
  await page.fill('input[type=tel]', '0712 300 400');
  await page.fill('input[type=email]', email);
  await page.fill('input[autocomplete=new-password]', PASS);
  await page.fill('input[autocomplete=address-level2]', 'Thika');
  await page.selectOption('select >> nth=0', 'Kiambu');
  await page.selectOption('select >> nth=1', 'Facebook');
  await page.check('input[type=checkbox]');
  await shot('agents-m-03-signup');
  await page.click('button:has-text("Send my application")');
  await page.waitForSelector('text=Application received');
  await shot('agents-m-04-pending');
});

const agent = sqlVar(`SELECT id, code FROM {p}agents WHERE email='${email}'`)[0];
await step('Admin approval → Check status opens the dashboard', async () => {
  php('sql', `UPDATE {p}agents SET status='active', approved_at='2026-11-09 08:00:00' WHERE id=${agent.id}`);
  await page.click('button:has-text("Check status")');
  await page.click('.tour button:has-text("Skip")');
  await page.waitForSelector('.hero');
  assert.match(page.url(), /\/pos\/agents\/$/);
  await page.waitForTimeout(800);
  await shot('agents-m-05-home-empty');
});

// Seed realistic leads through the API with a second session.
const login = await api('POST', '/agents/auth/login', { login: email, password: PASS });
const tok = login.body.token;
const now = Date.now();
const day = (n) => new Date(now + n * 864e5).toISOString().slice(0, 10);
const seed = [
  ['Mama Mboga Fresh', 'Mary Njeri', '0722100201', 'minimart', 'Thika', 'contacted', day(0), 'software'],
  ['Kamau Hardware & Paints', 'Peter Kamau', '0722100202', 'hardware', 'Juja', 'demo_booked', day(0), 'bundle'],
  ['Shiloh Agrovet', 'Grace Wairimu', '0722100203', 'agrovet', 'Gatundu', 'new', day(-1), 'unsure'],
  ['Neema Chemist', 'Dr. Otieno', '0722100204', 'pharmacy', 'Thika', 'demo_done', day(2), 'bundle'],
  ['Baraka Butchery', 'John Mutua', '0722100205', 'butchery', 'Ruiru', 'trial', day(5), 'software'],
  ['Glamour Cuts Salon', 'Beth Wambui', '0722100206', 'salon', 'Thika', 'won', '', 'software'],
  ['Kilimo Bora Supplies', 'James Kariuki', '0722100207', 'agrovet', 'Makuyu', 'lost', '', 'unsure'],
  ['Upendo Boutique', 'Faith Akinyi', '0722100208', 'boutique', 'Thika', 'new', day(1), 'software']
].map(([business_name, contact_name, phone, business_type, town, stage, next_follow_up, package_interest], i) => {
  const id = ('SEED' + stamp + i).toUpperCase().padEnd(26, '0').slice(0, 26);
  return { entity: 'leads', id, updated_at: now - i * 3600e3, data: { id, business_name, contact_name, phone: '254' + phone.slice(1), business_type, town, stage, next_follow_up, package_interest, current_system: 'paper', branches: 1, notes: '', lost_reason: stage === 'lost' ? 'Using another system' : '', created_at: now - i * 864e5, updated_at: now - i * 3600e3 } };
});
await api('POST', '/agents/leads/push', { changes: seed }, tok);
// Two of them became clients → commissions.
const trialA = await api('POST', '/agents/trials', { lead_id: seed[4].id, business_name: 'Baraka Butchery', owner_name: 'John Mutua', phone: '0722100205', email: `baraka.${stamp}@example.com`, business_type: 'butchery', town: 'Ruiru' }, tok);
const trialB = await api('POST', '/agents/trials', { lead_id: seed[5].id, business_name: 'Glamour Cuts Salon', owner_name: 'Beth Wambui', phone: '0722100206', email: `glamour.${stamp}@example.com`, business_type: 'salon', town: 'Thika' }, tok);
execFileSync('php', ['-r', `
$_SERVER['HTTP_HOST']='127.0.0.1:8080'; require '/home/claude/wptest/wp/wp-load.php';
PPC_Payments::record('${trialB.body.tenant_id}', ['type'=>'subscription_yearly','qty'=>1,'method'=>'mpesa','ref'=>'TKS${stamp.toUpperCase()}']);
PPC_Payments::record('${trialB.body.tenant_id}', ['type'=>'counter_kit','qty'=>1,'method'=>'cash']);
global $wpdb; $id = $wpdb->get_var("SELECT id FROM {$wpdb->prefix}ppc_commissions WHERE agent_id=${agent.id} AND kind='bonus' LIMIT 1");
PPC_Payments::set_commission_status($id, 'paid', 'TKP${stamp.toUpperCase()}');
`]);

await step('Sync pulls seeded leads, trials and commissions; dashboard renders', async () => {
  await page.click('.pill');
  await page.waitForFunction(() => document.querySelectorAll('.pipe li').length === 7, null, { timeout: 15000 });
  await page.waitForTimeout(1200);
  const due = await page.locator('.todo--call').count();
  assert.equal(due, 3, 'two due today + one overdue');
  await shot('agents-m-06-home');
  await shotFull('agents-m-06-home-full');
});

await step('Leads list with search and stage filters', async () => {
  await page.click('.tabs >> text=Leads');
  await page.waitForSelector('.lead');
  assert.equal(await page.locator('.lead').count(), 8);
  await shot('agents-m-07-leads');
  await page.fill('input[type=search]', 'chem');
  assert.equal(await page.locator('.lead').count(), 1);
  await page.fill('input[type=search]', '');
  await page.click('.chip--due');
  assert.equal(await page.locator('.lead').count(), 3);
  await page.click('.chip--due');
});

await step('New lead: validation, duplicate phone warning, GPS capture, save', async () => {
  await page.click('.tabs__fab');
  await page.waitForSelector('text=Save lead');
  await page.click('button:has-text("Save lead")');
  await page.waitForSelector('.field--err');
  await page.fill('input[autocomplete=organization]', AMANI);
  await page.click('summary:has-text("More details")');
  await page.fill('input[autocomplete=name]', 'Amani Kioko');
  await page.fill('input[type=tel]', '0722 100 203');
  await page.waitForSelector('.warn', { timeout: 5000 });
  assert.match(await page.locator('.warn').innerText(), /Shiloh Agrovet/);
  await page.fill('input[type=tel]', PH1);
  await page.waitForTimeout(700);
  assert.equal(await page.locator('.warn').count(), 0);
  await page.selectOption('select >> nth=0', 'duka');
  await page.fill('input[placeholder^="e.g. Kitengela"]', 'Thika Road');
  await page.click('button:has-text("Capture GPS location")');
  await page.waitForSelector('text=Location saved');
  await page.click('button[role=radio]:has-text("Complete Till")');
  await page.fill('textarea', 'Busy shop near the stage. Owner keeps stock in a book.');
  await shotFull('agents-m-08-lead-form');
  await page.click('button:has-text("Save lead")');
  await page.waitForSelector('.lhead');
  await page.waitForTimeout(2500);
  const row = sqlVar(`SELECT data FROM {p}leads WHERE agent_id=${agent.id} AND business_name='${AMANI}'`)[0];
  assert.ok(row, 'lead synced to cloud');
  assert.equal(JSON.parse(row.data).location.lat, -1.2921);
  await shot('agents-m-09-lead-detail');
  await shotFull('agents-m-09-lead-detail-full');
});

await step('Log a visit with follow-up date', async () => {
  await page.click('button:has-text("Log visit")');
  await page.fill('.sheet textarea', 'Showed the demo on my phone. Wants to see the receipt printer.');
  await page.click('.sheet button:has-text("+3 days")');
  await shot('agents-m-10-log-visit');
  await page.click('button:has-text("Save activity")');
  await page.waitForSelector('.tl--visit');
});

await step('Book a demo (online) → booking stored and stage demo_booked', async () => {
  await page.click('button.action:has-text("Book demo")');
  await page.waitForSelector('text=Book the demo');
  await shot('agents-m-11-book-demo');
  await page.click('button:has-text("Book the demo")');
  await page.waitForSelector('.stagebtn--demo_booked.is-on');
  await page.waitForTimeout(2500);
  const b = sqlVar(`SELECT ref FROM {p}demo_bookings WHERE agent_id=${agent.id} AND business='${AMANI}'`);
  assert.equal(b.length, 1);
});

await step('Start 30-day trial → credentials + WhatsApp message', async () => {
  await page.click('button.action--primary');
  await page.waitForSelector('text=Create trial account');
  await page.fill('.sheet input[type=email]', `amani.${stamp}@example.com`);
  await shot('agents-m-12-trial-form');
  await page.click('button:has-text("Create trial account")');
  await page.waitForSelector('text=Send these details to the owner', { timeout: 15000 });
  const href = await page.locator('a:has-text("Send on WhatsApp")').getAttribute('href');
  assert.match(href, new RegExp('^https://wa\\.me/' + PH1N + '\\?text='));
  await shot('agents-m-13-trial-done');
  const t = sqlVar(`SELECT agent_id, source FROM {p}tenants WHERE email='amani.${stamp}@example.com'`)[0];
  assert.equal(Number(t.agent_id), Number(agent.id));
  await page.click('.sheet button:has-text("Done")');
  await page.waitForSelector('.stagebtn--trial.is-on');
});

await step('Offline: create lead while offline → queued → syncs when back online', async () => {
  await mobile.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.click('.tabs__fab');
  await page.waitForSelector('text=Save lead');
  await page.fill('input[autocomplete=organization]', OFFL);
  await page.fill('input[type=tel]', PH2);
  await page.selectOption('select >> nth=0', 'salon');
  await page.click('summary:has-text("More details")');
  await page.fill('input[autocomplete=name]', 'Musa Hassan');
  await page.click('button:has-text("Save lead")');
  await page.waitForSelector('.lhead');
  await page.waitForSelector('.pill--off');
  const pill = await page.locator('.pill').innerText();
  assert.match(pill, /Offline · \d+ waiting/);
  await shot('agents-m-14-offline');
  assert.equal(sqlVar(`SELECT COUNT(*) AS n FROM {p}leads WHERE business_name='${OFFL}'`)[0].n * 1, 0, 'not on server yet');
  // Book a demo offline too (queued action).
  await page.click('button.action:has-text("Book demo")');
  await page.click('button:has-text("Book the demo")');
  await page.waitForTimeout(300);
  await mobile.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForFunction(() => /Synced/.test(document.querySelector('.pill').innerText), null, { timeout: 20000 });
  assert.equal(sqlVar(`SELECT COUNT(*) AS n FROM {p}leads WHERE business_name='${OFFL}'`)[0].n * 1, 1, 'synced after reconnect');
  assert.equal(sqlVar(`SELECT COUNT(*) AS n FROM {p}demo_bookings WHERE business='${OFFL}'`)[0].n * 1, 1, 'queued demo booking sent');
  assert.equal(await page.evaluate(async () => {
    const req = indexedDB.open('pentarch-agents');
    return await new Promise((res) => { req.onsuccess = () => { const tx = req.result.transaction('outbox'); const c = tx.objectStore('outbox').count(); c.onsuccess = () => res(c.result); }; });
  }), 0, 'outbox empty');
  await shot('agents-m-15-back-online');
});

await step('App shell works offline after first load (service worker)', async () => {
  await page.goto(BASE + '/pos/agents/');
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => {});
  await page.reload();
  await page.waitForSelector('.hero');
  await mobile.setOffline(true);
  await page.goto(BASE + '/pos/agents/leads');
  await page.waitForSelector('.lead', { timeout: 10000 });
  assert.ok((await page.locator('.lead').count()) >= 10);
  await mobile.setOffline(false);
});

await step('Commissions, resources, more, profile screens', async () => {
  await page.click('.tabs >> text=Earnings');
  await page.waitForSelector('.money3');
  await page.waitForTimeout(500);
  assert.match(await page.locator('.money3__main').innerText(), /KES 3,400/);
  await shot('agents-m-16-commissions');
  await page.click('.tabs >> text=More');
  await page.waitForSelector('.menu');
  await shot('agents-m-17-more');
  await page.click('.menu >> text=Resources');
  await page.waitForSelector('.prices');
  await shot('agents-m-18-resources');
  await page.goto(BASE + '/pos/agents/profile');
  await page.waitForSelector('.codecard');
  assert.equal(await page.locator('.codecard__code').innerText(), agent.code);
  await shot('agents-m-19-profile');
});

await step('Kiswahili toggle translates the UI and persists', async () => {
  await page.click('.seg button:has-text("SW")');
  await page.waitForSelector('.top__title:has-text("Wasifu")');
  await page.waitForTimeout(400);
  await page.goto(BASE + '/pos/agents/');
  await page.waitForSelector('h3:has-text("Leo")');
  await shot('agents-m-20-home-sw');
  await page.goto(BASE + '/pos/agents/leads');
  await page.waitForSelector('.lead');
  await shot('agents-m-21-leads-sw');
  await page.click('.lead >> nth=0');
  await page.waitForSelector('.lhead');
  await shot('agents-m-22-lead-sw');
  await page.goto(BASE + '/pos/agents/profile');
  await page.click('.seg button:has-text("EN")');
});

// ---------- Desktop ----------
const desk = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'en-KE' });
const dp = await desk.newPage();
dp.on('pageerror', (e) => { console.log('    [pageerror]', e.message); });
await step('Desktop 1366×768: login, dashboard, leads, lead detail, commissions', async () => {
  await dp.goto(BASE + '/pos/agents/login');
  await dp.waitForSelector('text=Sign in');
  await dp.screenshot({ path: `${SHOTS}agents-d-01-login.png` });
  await dp.goto(BASE + '/pos/agents/signup');
  await dp.waitForSelector('text=Become a Pentarch POS agent');
  await dp.screenshot({ path: `${SHOTS}agents-d-02-signup.png` });
  await dp.goto(BASE + '/pos/agents/login');
  await dp.fill('input[autocomplete=username]', email);
  await dp.fill('input[type=password]', PASS);
  await dp.click('button:has-text("Sign in")');
  await dp.click('.tour button:has-text("Skip")');
  await dp.waitForSelector('.hero');
  await dp.waitForFunction(() => document.querySelectorAll('.lead, .pipe li').length >= 7 && /Synced/.test(document.querySelector('.pill').innerText), null, { timeout: 20000 });
  await dp.waitForTimeout(800);
  await dp.screenshot({ path: `${SHOTS}agents-d-03-home.png` });
  await dp.click('.side >> text=Leads');
  await dp.waitForSelector('.lead');
  await dp.screenshot({ path: `${SHOTS}agents-d-04-leads.png` });
  await dp.click('.lead >> text=' + AMANI);
  await dp.waitForSelector('.lhead');
  await dp.screenshot({ path: `${SHOTS}agents-d-05-lead-detail.png` });
  await dp.click('.logbar button:has-text("Log call")');
  await dp.waitForSelector('.sheet');
  await dp.screenshot({ path: `${SHOTS}agents-d-06-sheet.png` });
  await dp.keyboard.press('Escape');
  await dp.click('.side >> text=New lead');
  await dp.waitForSelector('text=Save lead');
  await dp.screenshot({ path: `${SHOTS}agents-d-07-lead-form.png` });
  await dp.click('.side >> text=Earnings');
  await dp.waitForSelector('.money3');
  await dp.screenshot({ path: `${SHOTS}agents-d-08-commissions.png` });
  await dp.click('.side >> text=Resources');
  await dp.waitForSelector('.prices');
  await dp.screenshot({ path: `${SHOTS}agents-d-09-resources.png` });
  await dp.click('.side >> text=Profile');
  await dp.waitForSelector('.codecard');
  await dp.screenshot({ path: `${SHOTS}agents-d-10-profile.png` });
});

await step('PWA manifest and service worker are installable', async () => {
  const m = await (await fetch(BASE + '/pos/agents/manifest.webmanifest')).json();
  assert.equal(m.scope, '/pos/agents/');
  assert.equal(m.start_url, '/pos/agents/');
  assert.ok(m.icons.some((i) => i.sizes === '512x512'));
  const sw = await dp.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return r ? r.scope : null; });
  assert.equal(sw, BASE + '/pos/agents/');
});

await browser.close();
console.log(`\n${results.length - fails}/${results.length} passed`);
import('node:fs').then((fs) => fs.writeFileSync(new URL('./agents-results.json', import.meta.url), JSON.stringify({ at: new Date().toISOString(), results }, null, 2)));
process.exitCode = fails ? 1 : 0;
