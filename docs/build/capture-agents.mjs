// Clean agent-portal screenshots for the docs, against the local WordPress test site (127.0.0.1:8080).
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:8080';
const API = BASE + '/wp-json/pentarch-pos/v1';
const OUT = new URL('./assets/shots/', import.meta.url).pathname;
const php = (...a) => execFileSync('php', ['/home/claude/wptest/wpset.php', ...a], { encoding: 'utf8' });
const sqlVar = (q) => JSON.parse(php('var', q) || '[]');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(method, path, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(API + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
}
const EMAIL = 'wanjiku.mwangi@example.com', PASS = 'AgentPass2026';
// clean previous runs
const old = sqlVar(`SELECT id FROM {p}agents WHERE email='${EMAIL}'`);
for (const o of old) { php('sql', `DELETE FROM {p}leads WHERE agent_id=${o.id}`); php('sql', `DELETE FROM {p}commissions WHERE agent_id=${o.id}`); php('sql', `DELETE FROM {p}agents WHERE id=${o.id}`); }
php('sql', `DELETE FROM {p}tenants WHERE email IN ('amani.kioko@example.com','baraka.butchery@example.com','glamour.cuts@example.com')`);
php('sql', 'DELETE FROM {p}rate_limits');
php('settings', JSON.stringify({ rate_register: 1000, rate_login: 1000, rate_booking: 1000 }));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, geolocation: { latitude: -1.0388, longitude: 37.0834, accuracy: 15 }, permissions: ['geolocation'], locale: 'en-KE', serviceWorkers: 'block' });
const page = await ctx.newPage();
const HIDE = '.toast,.toasts,[class*="toast"],.snack{display:none!important}';
async function shot(name) { await page.addStyleTag({ content: HIDE }).catch(() => {}); await sleep(700); await page.screenshot({ path: OUT + 'ag-' + name + '.png' }); console.log('shot', name); }
// Rewrite local host in API responses so links read like production.
await page.route('**/wp-json/pentarch-pos/v1/agents/**', async (route) => {
  const resp = await route.fetch();
  let body = await resp.text();
  body = body.replaceAll('http:\\/\\/127.0.0.1:8080', 'https:\\/\\/pentarchcommunications.com').replaceAll('http://127.0.0.1:8080', 'https://pentarchcommunications.com').replaceAll('127.0.0.1:8080', 'pentarchcommunications.com');
  route.fulfill({ response: resp, body });
});

await page.goto(BASE + '/pos/agents/');
await page.waitForSelector('text=Sign in');
await page.click('text=Apply to become an agent');
await page.waitForSelector('text=Become a Pentarch POS agent');
await page.fill('input[autocomplete=name]', 'Wanjiku Mwangi');
await page.fill('input[type=tel]', '0712 300 400');
await page.fill('input[type=email]', EMAIL);
await page.fill('input[autocomplete=new-password]', PASS);
await page.fill('input[autocomplete=address-level2]', 'Thika');
await page.selectOption('select >> nth=0', 'Kiambu');
await page.selectOption('select >> nth=1', 'Facebook');
await page.check('input[type=checkbox]');
await page.evaluate(() => window.scrollTo(0, 0));
await shot('signup');
await page.click('button:has-text("Create account")');
await page.waitForSelector('text=Application received');
await shot('pending');

const agent = sqlVar(`SELECT id, code FROM {p}agents WHERE email='${EMAIL}'`)[0];
php('sql', `UPDATE {p}agents SET status='active', approved_at='2026-11-09 08:00:00' WHERE id=${agent.id}`);
const tok = (await api('POST', '/agents/auth/login', { login: EMAIL, password: PASS })).body.token;
const now = Date.now();
const day = (n) => new Date(now + n * 864e5).toISOString().slice(0, 10);
const stamp = now.toString(36).toUpperCase();
const seed = [
  ['Mama Mboga Fresh', 'Mary Njeri', '0722410201', 'minimart', 'Thika', 'contacted', day(0), 'software'],
  ['Kamau Hardware & Paints', 'Peter Kamau', '0722410202', 'hardware', 'Juja', 'demo_booked', day(0), 'bundle'],
  ['Shiloh Agrovet', 'Grace Wairimu', '0722410203', 'agrovet', 'Gatundu', 'new', day(-1), 'unsure'],
  ['Neema Chemist', 'Dr. Otieno', '0722410204', 'pharmacy', 'Thika', 'demo_done', day(2), 'bundle'],
  ['Baraka Butchery', 'John Mutua', '0722410205', 'butchery', 'Ruiru', 'trial', day(5), 'software'],
  ['Glamour Cuts Salon', 'Beth Wambui', '0722410206', 'salon', 'Thika', 'won', '', 'software'],
  ['Kilimo Bora Supplies', 'James Kariuki', '0722410207', 'agrovet', 'Makuyu', 'lost', '', 'unsure'],
  ['Upendo Boutique', 'Faith Akinyi', '0722410208', 'boutique', 'Thika', 'new', day(1), 'software']
].map(([business_name, contact_name, phone, business_type, town, stage, next_follow_up, package_interest], i) => {
  const id = ('DOC' + stamp + i).padEnd(26, '0').slice(0, 26);
  return { entity: 'leads', id, updated_at: now - i * 3600e3, data: { id, business_name, contact_name, phone: '254' + phone.slice(1), business_type, town, stage, next_follow_up, package_interest, current_system: 'paper', branches: 1, notes: '', lost_reason: stage === 'lost' ? 'Using another system' : '', created_at: now - i * 864e5, updated_at: now - i * 3600e3 } };
});
await api('POST', '/agents/leads/push', { changes: seed }, tok);
await api('POST', '/agents/trials', { lead_id: seed[4].id, business_name: 'Baraka Butchery', owner_name: 'John Mutua', phone: '0722410205', email: 'baraka.butchery@example.com', business_type: 'butchery', town: 'Ruiru' }, tok);
const tB = await api('POST', '/agents/trials', { lead_id: seed[5].id, business_name: 'Glamour Cuts Salon', owner_name: 'Beth Wambui', phone: '0722410206', email: 'glamour.cuts@example.com', business_type: 'salon', town: 'Thika' }, tok);
execFileSync('php', ['-r', `
$_SERVER['HTTP_HOST']='127.0.0.1:8080'; require '/home/claude/wptest/wp/wp-load.php';
PPC_Payments::record('${tB.body.tenant_id}', ['type'=>'subscription_yearly','qty'=>1,'method'=>'mpesa','ref'=>'TKS${stamp}']);
PPC_Payments::record('${tB.body.tenant_id}', ['type'=>'package_software_setup','qty'=>1,'method'=>'mpesa','ref'=>'TKB${stamp}']);
global $wpdb; $id = $wpdb->get_var("SELECT id FROM {$wpdb->prefix}ppc_commissions WHERE agent_id=${agent.id} AND kind='bonus' LIMIT 1");
PPC_Payments::set_commission_status($id, 'paid', 'TKP${stamp}');
`]);

await page.click('button:has-text("Check status")');
await page.waitForSelector('.hero');
await page.click('.pill');
await page.waitForFunction(() => document.querySelectorAll('.pipe li').length >= 7, null, { timeout: 15000 }).catch(() => {});
await sleep(1500);
await shot('home');

await page.click('.tabs >> text=Leads');
await page.waitForSelector('.lead'); await sleep(500);
await shot('leads');

await page.click('.tabs__fab');
await page.waitForSelector('text=Save lead');
await page.fill('input[autocomplete=organization]', 'Duka la Amani');
await page.fill('input[autocomplete=name]', 'Amani Kioko');
await page.fill('input[type=tel]', '0722 303 796');
await page.selectOption('select >> nth=0', 'duka');
await page.fill('input[placeholder^="e.g. Kitengela"]', 'Thika Road');
await page.click('button:has-text("Capture GPS location")');
await page.waitForSelector('text=Location saved');
await page.click('button[role=radio]:has-text("Complete Till")');
await page.fill('textarea', 'Busy shop near the stage. Owner keeps stock in a book.');
await page.evaluate(() => window.scrollTo(0, 0));
await shot('lead-form');
await page.evaluate(() => window.scrollTo(0, 520));
await shot('lead-form-2');
await page.click('button:has-text("Save lead")');
await page.waitForSelector('.lhead');
await sleep(2500);
await page.click('button:has-text("Log visit")');
await page.fill('.sheet textarea', 'Showed the demo on my phone. Wants to see the receipt printer.');
await page.click('.sheet button:has-text("+3 days")');
await shot('log-visit');
await page.click('button:has-text("Save activity")');
await sleep(1500);
await page.evaluate(() => window.scrollTo(0, 0));
await shot('lead-detail');

await page.click('button.action--primary');
await page.waitForSelector('text=Create trial account');
await page.fill('.sheet input[type=email]', 'amani.kioko@example.com');
await sleep(800);
await shot('trial-form');
await page.click('button:has-text("Create trial account")');
await page.waitForSelector('text=Send these details to the owner', { timeout: 15000 });
await shot('trial-done');
await page.click('.sheet button:has-text("Done")');
await sleep(800);

// Offline: log a call while offline
await ctx.setOffline(true);
await sleep(800);
await page.click('button:has-text("Log call")').catch(() => {});
await page.fill('.sheet textarea', 'Called to check the owner signed in. Will visit Thursday.').catch(() => {});
await page.click('button:has-text("Save activity")').catch(() => {});
await sleep(1200);
await page.evaluate(() => window.scrollTo(0, 0));
await shot('offline');
await ctx.setOffline(false);
await sleep(3000);

await page.click('.tabs >> text=Earnings');
await sleep(1500);
await shot('commissions');
await page.click('.tabs >> text=More').catch(() => {});
await sleep(1000);
await shot('more');
await browser.close();
