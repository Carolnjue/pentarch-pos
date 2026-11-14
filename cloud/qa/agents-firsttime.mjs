// "First-time agent" walkthrough on a 390×844 phone, using only what is visible on screen
// (labels, button text). Sign up → admin approves in wp-admin → tour → lead → visit → demo →
// trial → WhatsApp → Today checklist → earnings → offline. Usage: node agents-firsttime.mjs [base]
import { createRequire } from 'node:module';
import { execSync, execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium } = pw;

const BASE = process.argv[2] || 'http://127.0.0.1:8080';
const SHOTS = new URL('./', import.meta.url).pathname;
const php = (...a) => execFileSync('php', ['/home/claude/wptest/wpset.php', ...a], { encoding: 'utf8' });
const sqlVar = (q) => JSON.parse(php('var', q) || '[]');
const results = [];
let fails = 0;
async function step(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('  PASS', name); }
  catch (e) { fails++; results.push({ name, ok: false, err: String(e.message || e) }); console.log('  FAIL', name, '\n      ', String(e.message || e).split('\n').slice(0, 4).join(' / ')); }
}

php('sql', 'DELETE FROM {p}rate_limits');
php('settings', JSON.stringify({ rate_register: 1000, rate_login: 1000, rate_booking: 1000 }));
const stamp = Date.now().toString(36);
const r3 = () => String(Math.floor(100 + Math.random() * 899));
const email = `otieno.${stamp}@example.com`;
const PASS = 'Agent2026pass';
const AGENT_PHONE = `0711${r3()}${r3()}`.slice(0, 10);
const SHOP = 'Mama Achieng Minimart ' + stamp.slice(-3).toUpperCase();
const SHOP_DIGITS = `0745${r3()}${r3()}`.slice(0, 10);
const SHOP_N = '254' + SHOP_DIGITS.slice(1);
const SHOP2 = 'Kibet Hardware ' + stamp.slice(-3).toUpperCase();
const SHOP3 = 'Offline Salon ' + stamp.slice(-3).toUpperCase();
const today = new Date(); const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'en-KE', geolocation: { latitude: -0.0917, longitude: 34.768, accuracy: 12 }, permissions: ['geolocation'] });
await ctx.route(/https:\/\/(wa\.me|api\.whatsapp\.com)\//, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>WhatsApp</p>' }));
const page = await ctx.newPage();
page.setDefaultTimeout(12000);
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('    [pageerror]', e.message); });
const shot = (n, full = false) => page.screenshot({ path: `${SHOTS}${n}.png`, fullPage: full });
const toast = () => page.locator('.toast');

await step('Sign up using the visible labels only', async () => {
  await page.goto(BASE + '/pos/agents/');
  await page.getByRole('link', { name: 'Apply to become an agent' }).click();
  await page.getByRole('heading', { name: 'Become a Pentarch POS agent' }).waitFor();
  await page.getByRole('button', { name: 'Send my application' }).click();
  await page.getByText('Please fix the fields marked in red.').waitFor();
  await page.getByLabel('Full name').fill('Otieno Akinyi');
  await page.getByLabel('Phone (M-Pesa)').fill(AGENT_PHONE);
  assert.match(await page.getByLabel('Phone (M-Pesa)').inputValue(), /^07\d\d \d{3} \d{3}$/, 'phone auto-formatted');
  await page.getByText('Commission is sent to +254 7').waitFor();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASS);
  await page.getByLabel('I agree to the agent terms').check();
  await shot('ft-m-01-signup');
  await page.getByRole('button', { name: 'Send my application' }).click();
  await page.getByRole('heading', { name: 'Application received' }).waitFor();
  await shot('ft-m-02-pending');
});

await step('Admin approves the agent in wp-admin', async () => {
  const admin = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const ap = await admin.newPage();
  await ap.goto(BASE + '/wp-login.php');
  await ap.fill('#user_login', 'admin');
  await ap.fill('#user_pass', 'AdminPass123!');
  await ap.click('#wp-submit');
  await ap.waitForURL(/wp-admin/, { waitUntil: 'commit', timeout: 60000 });
  await ap.goto(BASE + '/wp-admin/admin.php?page=ppc-agents&status=pending', { timeout: 60000 });
  await ap.locator('tr', { hasText: email }).locator('button:has-text("Approve")').click();
  await ap.waitForSelector('.ppc-flash--success');
  await admin.close();
  assert.equal(sqlVar(`SELECT status FROM {p}agents WHERE email='${email}'`)[0].status, 'active');
});

await step('Check status → first-run tour (4 steps) → Home "Start here"', async () => {
  await page.getByRole('button', { name: 'Check status' }).click();
  const tour = page.getByRole('dialog');
  await tour.getByRole('heading', { name: 'Add every shop you visit' }).waitFor();
  await page.waitForTimeout(450);
  await shot('ft-m-03-tour-1');
  await tour.getByRole('button', { name: 'Next' }).click();
  await tour.getByRole('heading', { name: 'Start each day on Home' }).waitFor();
  await tour.getByRole('button', { name: 'Next' }).click();
  await tour.getByRole('button', { name: 'Next' }).click();
  await tour.getByRole('heading', { name: 'Get paid by M-Pesa' }).waitFor();
  assert.match(await tour.innerText(), /You earn 20%/);
  await page.waitForTimeout(450);
  await shot('ft-m-04-tour-4');
  await tour.getByRole('button', { name: 'Start selling' }).click();
  await tour.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Add your first lead' }).waitFor();
  await page.waitForTimeout(600);
  await shot('ft-m-05-home-new');
});

await step('Tour can be replayed from More and skipped', async () => {
  await page.locator('.tabs').getByText('More').click();
  await page.getByRole('button', { name: /How to use the app/ }).click();
  await page.getByRole('dialog').getByRole('heading', { name: 'Add every shop you visit' }).waitFor();
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await page.reload();
  await page.locator('.menu').waitFor();
  assert.equal(await page.getByRole('dialog').count(), 0, 'tour stays closed after reload');
});

await step('Add a lead: only name + phone + type; phone auto-formats 07… → 2547…', async () => {
  await page.locator('.tabs').getByText('Home').click();
  await page.getByRole('button', { name: 'Add your first lead' }).click();
  await page.getByText('Just three things. You can add the rest later.').waitFor();
  await page.getByRole('button', { name: 'Save lead' }).click();
  await page.locator('.field--err').first().waitFor();
  assert.equal(await page.locator('.field--err').count(), 3, 'name, phone and type required');
  await page.getByLabel('Business name').fill(SHOP);
  await page.getByLabel('Phone number').fill(SHOP_DIGITS);
  assert.match(await page.getByLabel('Phone number').inputValue(), /^0745 \d{3} \d{3}$/);
  await page.getByText('Saved as +254 745').waitFor();
  await page.getByLabel('Type of business').selectOption({ label: 'Minimart & supermarket' });
  assert.equal(await page.getByLabel('Contact person').isVisible(), false, 'extra fields are tucked under More details');
  await shot('ft-m-06-new-lead');
  await page.getByText('More details').click();
  await page.getByLabel('Contact person').waitFor();
  await page.getByText('More details').click();
  await page.getByRole('button', { name: 'Save lead' }).click();
  await page.locator('.lhead').waitFor();
  await page.getByText('Next step: book a free demo').waitFor();
  await page.waitForTimeout(2500);
  const row = sqlVar(`SELECT data FROM {p}leads WHERE business_name='${SHOP}'`)[0];
  assert.ok(row, 'lead synced');
  assert.equal(JSON.parse(row.data).phone, SHOP_N);
  await shot('ft-m-07-lead-new');
});

await step('Log a visit', async () => {
  await page.getByRole('button', { name: 'Log visit' }).click();
  await page.getByLabel('What happened?').fill('Met Achieng. Showed the demo on my phone. She liked the credit book.');
  await page.getByRole('button', { name: 'Tomorrow' }).click();
  await shot('ft-m-08-visit');
  await page.getByRole('button', { name: 'Save activity' }).click();
  await toast().getByText('Saved').waitFor();
  await page.locator('.tl--visit').waitFor();
});

await step('Book a demo from the big "next step" button', async () => {
  await page.getByRole('button', { name: 'Book demo' }).click();
  await page.getByText('Pentarch will call the owner to confirm').waitFor();
  await page.getByRole('button', { name: 'Book the demo' }).click();
  await page.getByText('Who should Pentarch call? Enter a name.').waitFor();
  await page.getByLabel('Who should Pentarch talk to?').fill('Achieng');
  await shot('ft-m-09-demo');
  await page.getByRole('button', { name: 'Book the demo' }).click();
  await toast().getByText(/Demo booked · DB-/).waitFor();
  await page.locator('.stagebtn--demo_booked.is-on').waitFor();
  await page.getByText('Next step: start their free trial').waitFor();
  await page.waitForTimeout(1500);
  assert.equal(sqlVar(`SELECT COUNT(*) AS n FROM {p}demo_bookings WHERE business='${SHOP}'`)[0].n * 1, 1);
});

await step('Stage change shows a toast with Undo, and Undo works', async () => {
  await page.getByRole('radio', { name: 'Won' }).click();
  await toast().getByText('Moved to Won').waitFor();
  await page.waitForTimeout(350);
  await shot('ft-m-10-undo');
  await toast().getByRole('button', { name: 'Undo' }).click();
  await page.locator('.stagebtn--demo_booked.is-on').waitFor();
  await page.waitForTimeout(2500);
  assert.equal(JSON.parse(sqlVar(`SELECT data FROM {p}leads WHERE business_name='${SHOP}'`)[0].data).stage, 'demo_booked');
});

let tenantId;
await step('Start the 30-day trial → WhatsApp message ready for the owner', async () => {
  await page.getByRole('button', { name: 'Start 30-day trial' }).click();
  await page.getByText('Free for 30 days on their own computer').waitFor();
  await page.getByRole('button', { name: 'Create trial account' }).click();
  await page.locator('.sheet .field--err').first().waitFor();
  await page.getByLabel("Owner's name").fill('Achieng Odhiambo');
  await page.getByLabel("Owner's email").fill(`achieng.${stamp}@example.com`);
  await page.getByRole('button', { name: 'Create trial account' }).click();
  await page.getByText('Send these details to the owner').waitFor({ timeout: 15000 });
  const href = await page.getByRole('link', { name: 'Send on WhatsApp' }).getAttribute('href');
  assert.match(href, new RegExp('^https://wa\\.me/' + SHOP_N + '\\?text='));
  await shot('ft-m-11-trial-done');
  await page.getByRole('button', { name: 'Done' }).click();
  await page.locator('.stagebtn--trial.is-on').waitFor();
  tenantId = sqlVar(`SELECT id FROM {p}tenants WHERE email='achieng.${stamp}@example.com'`)[0].id;
});

await step('Send WhatsApp: "Check in on WhatsApp" opens wa.me with a ready message', async () => {
  await page.getByText('They are on the free trial').waitFor();
  const [wa] = await Promise.all([ctx.waitForEvent('page'), page.getByRole('button', { name: 'Check in on WhatsApp' }).click()]);
  const u = wa.url();
  await wa.close();
  assert.match(decodeURIComponent(u), new RegExp(`wa\\.me/${SHOP_N}.*Pentarch POS`), u);
  await page.locator('.tl--whatsapp').first().waitFor();
  await shot('ft-m-12-lead-trial');
});

await step('Today checklist: follow-up due today, tick ✓ with Undo; trial ending shows Remind', async () => {
  await page.locator('.tabs__fab').click();
  await page.getByLabel('Business name').fill(SHOP2);
  await page.getByLabel('Phone number').fill(`0722${r3()}${r3()}`.slice(0, 10));
  await page.getByLabel('Type of business').selectOption({ label: 'Hardware & building materials' });
  await page.getByLabel('Next follow-up').fill(iso(today));
  await page.getByRole('button', { name: 'Save lead' }).click();
  await page.locator('.lhead').waitFor();
  // Trial ends in 3 days (simulated) so it shows on Today.
  php('sql', `UPDATE {p}tenants SET trial_ends='${iso(new Date(Date.now() + 3 * 864e5))} 23:00:00' WHERE id='${tenantId}'`);
  await page.locator('.tabs').getByText('Home').click();
  await page.locator('.pill').click();
  await page.locator('.todo--trial').waitFor({ timeout: 15000 });
  await page.locator('.todo--call', { hasText: SHOP2 }).waitFor();
  await page.waitForTimeout(500);
  await shot('ft-m-13-today');
  assert.match(await page.locator('.todo--trial a.btn').getAttribute('href'), /wa\.me\/.*free%20trial%20ends/);
  await page.getByRole('button', { name: `Mark done: ${SHOP2}` }).click();
  await toast().getByText(/Done — next follow-up/).waitFor();
  assert.equal(await page.locator('.todo--call', { hasText: SHOP2 }).count(), 0);
  await toast().getByRole('button', { name: 'Undo' }).click();
  await page.locator('.todo--call', { hasText: SHOP2 }).waitFor();
});

await step('Pull down to refresh syncs', async () => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(async () => {
    const mk = (y) => new Touch({ identifier: 1, target: document.body, clientX: 200, clientY: y });
    const fire = (type, y) => window.dispatchEvent(new TouchEvent(type, { touches: y == null ? [] : [mk(y)], changedTouches: [mk(y ?? 400)], bubbles: true }));
    fire('touchstart', 150);
    for (let y = 160; y <= 360; y += 20) { fire('touchmove', y); await new Promise((r) => setTimeout(r, 16)); }
  });
  await page.getByText('Release to refresh').waitFor();
  await shot('ft-m-14-pull');
  await page.evaluate(() => window.dispatchEvent(new TouchEvent('touchend', { touches: [], bubbles: true })));
  await toast().getByText('Synced').waitFor({ timeout: 15000 });
});

await step('Earnings: client pays yearly → KES 2,400 pending; rates match the price list', async () => {
  execFileSync('php', ['-r', `$_SERVER['HTTP_HOST']='127.0.0.1:8080'; require '/home/claude/wptest/wp/wp-load.php'; PPC_Payments::record('${tenantId}', ['type'=>'subscription_yearly','qty'=>1,'method'=>'mpesa','ref'=>'TK${stamp.toUpperCase()}']);`]);
  await page.locator('.tabs').getByText('Earnings').click();
  await page.getByRole('button', { name: /Sync now/ }).click();
  await page.locator('.money3__main', { hasText: 'KES 2,400' }).waitFor({ timeout: 15000 });
  const txt = await page.locator('main').innerText();
  for (const s of ['20%', 'KES 3,000', 'KES 1,500', 'KES 1,000', 'KES 69,900', 'KES 15,000', 'KES 21,900', 'pays KES 12,000 — you get KES 2,400']) assert.ok(txt.includes(s), 'earnings shows ' + s);
  await shot('ft-m-15-earnings');
  await shot('ft-m-15-earnings-full', true);
});

await step('Prices (Resources) match pricing-decisions.md', async () => {
  await page.locator('.tabs').getByText('More').click();
  await page.locator('.menu').getByText('Resources').click();
  await page.locator('.prices').waitFor();
  const txt = await page.locator('.prices').innerText();
  for (const s of ['KES 1,200', 'KES 12,000', 'KES 1,000', 'KES 69,900', 'KES 15,000', 'KES 21,900', 'KES 44,900', 'KES 3,500']) assert.ok(txt.includes(s), 'prices show ' + s);
  await shot('ft-m-16-prices', true);
});

await step('Offline: banner explains, lead saves on the phone, sends when back online', async () => {
  await ctx.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.locator('.tabs__fab').click();
  await page.getByText('No internet').waitFor();
  await page.getByLabel('Business name').fill(SHOP3);
  await page.getByLabel('Phone number').fill(`0733${r3()}${r3()}`.slice(0, 10));
  await page.getByLabel('Type of business').selectOption({ label: 'Salon, barber & spa' });
  await page.getByRole('button', { name: 'Save lead' }).click();
  await toast().getByText('Saved on this phone — will send when you are back online').waitFor();
  await shot('ft-m-17-offline');
  await ctx.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForFunction(() => !document.querySelector('.offbar'), null, { timeout: 15000 });
  await page.waitForFunction(() => /Synced/.test(document.querySelector('.pill').innerText), null, { timeout: 20000 });
  assert.equal(sqlVar(`SELECT COUNT(*) AS n FROM {p}leads WHERE business_name='${SHOP3}'`)[0].n * 1, 1);
});

await step('Kiswahili: Home and lead form read naturally', async () => {
  await page.locator('.tabs').getByText('More').click();
  await page.getByRole('button', { name: 'SW' }).click();
  await page.locator('.tabs').getByText('Nyumbani').click();
  await page.getByRole('heading', { name: 'Leo' }).waitFor();
  await shot('ft-m-18-home-sw');
  await page.locator('.tabs__fab').click();
  await page.getByText('Vitu vitatu tu').waitFor();
  await shot('ft-m-19-form-sw');
  await page.locator('.tabs').getByText('Zaidi').click();
  await page.getByRole('button', { name: 'EN' }).click();
});

// ---------- Desktop 1366×768 ----------
const desk = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'en-KE' });
const dp = await desk.newPage();
dp.setDefaultTimeout(15000);
dp.on('pageerror', (e) => { errors.push(e.message); console.log('    [pageerror]', e.message); });
await step('Desktop 1366×768: sign in, tour, Today, lead, earnings, prices', async () => {
  await dp.goto(BASE + '/pos/agents/login');
  await dp.getByLabel('Email or phone').fill(email);
  await dp.getByLabel('Password').fill(PASS);
  await dp.getByRole('button', { name: 'Sign in' }).click();
  await dp.getByRole('dialog').getByRole('heading', { name: 'Add every shop you visit' }).waitFor();
  await dp.waitForTimeout(450);
  await dp.screenshot({ path: `${SHOTS}ft-d-01-tour.png` });
  await dp.getByRole('button', { name: 'Skip' }).click();
  await dp.locator('.todo').first().waitFor({ timeout: 20000 });
  await dp.waitForTimeout(800);
  await dp.screenshot({ path: `${SHOTS}ft-d-02-home.png` });
  await dp.locator('.side').getByText('Leads', { exact: true }).click();
  await dp.locator('.lead', { hasText: SHOP }).click();
  await dp.locator('.lhead').waitFor();
  await dp.screenshot({ path: `${SHOTS}ft-d-03-lead.png` });
  await dp.locator('.side').getByText('New lead').click();
  await dp.getByText('Just three things').waitFor();
  await dp.screenshot({ path: `${SHOTS}ft-d-04-form.png` });
  await dp.locator('.side').getByText('Earnings').click();
  await dp.locator('.money3').waitFor();
  await dp.waitForTimeout(400);
  await dp.screenshot({ path: `${SHOTS}ft-d-05-earnings.png` });
  await dp.locator('.side').getByText('Resources').click();
  await dp.locator('.prices').waitFor();
  await dp.screenshot({ path: `${SHOTS}ft-d-06-prices.png` });
});

await step('No JavaScript errors', async () => { assert.deepEqual(errors, []); });

await browser.close();
console.log(`\n${results.length - fails}/${results.length} passed`);
import('node:fs').then((fs) => fs.writeFileSync(new URL('./agents-firsttime-results.json', import.meta.url), JSON.stringify({ at: new Date().toISOString(), results }, null, 2)));
process.exitCode = fails ? 1 : 0;
