// wp-admin superadmin UI + website shortcode E2E with screenshots. Usage: node admin-e2e.mjs [base]
import { createRequire } from 'node:module';
import { execSync, execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium } = pw;
const BASE = process.argv[2] || 'http://127.0.0.1:8080';
const DIR = new URL('./', import.meta.url).pathname;
const php = (...a) => execFileSync('php', ['/home/claude/wptest/wpset.php', ...a], { encoding: 'utf8' });
const sqlVar = (q) => JSON.parse(php('var', q) || '[]');
const results = []; let fails = 0;
async function step(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('  PASS', name); }
  catch (e) { fails++; results.push({ name, ok: false, err: String(e.message || e) }); console.log('  FAIL', name, '\n      ', e.message.split('\n')[0]); }
}
php('sql', 'DELETE FROM {p}rate_limits');
php('settings', JSON.stringify({ rate_booking: 1000, paybill: '247247', admin_email: 'sales@pentarchcommunications.com' }));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const shot = (n, full = false) => page.screenshot({ path: `${DIR}${n}.png`, fullPage: full });

await step('Admin login', async () => {
  await page.goto(BASE + '/wp-login.php');
  await page.fill('#user_login', 'admin');
  await page.fill('#user_pass', 'AdminPass123!');
  await page.click('#wp-submit');
  await page.waitForURL(/wp-admin/);
});

// Create a pending agent to approve in the UI.
const stamp = Date.now().toString(36);
const reg = await fetch(BASE + '/wp-json/pentarch-pos/v1/agents/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Brian Kiprono', phone: '0711' + String(Math.floor(100000 + Math.random() * 899999)), email: `brian.${stamp}@example.com`, password: 'agentpass99', town: 'Eldoret', county: 'Uasin Gishu', heard_from: 'Pentarch staff', agree_terms: true }) }).then((r) => r.json());

const pages = [['ppc', 'dashboard'], ['ppc-businesses', 'businesses'], ['ppc-agents', 'agents'], ['ppc-leads', 'leads'], ['ppc-bookings', 'bookings'], ['ppc-payments', 'payments'], ['ppc-commissions', 'commissions'], ['ppc-settings', 'settings'], ['ppc-tools', 'tools']];
await step('Every admin screen renders without PHP notices or JS errors', async () => {
  for (const [slug, name] of pages) {
    await page.goto(`${BASE}/wp-admin/admin.php?page=${slug}`);
    await page.waitForSelector('.ppc-wrap');
    const html = await page.content();
    assert.ok(!/(Warning|Notice|Fatal error|Deprecated)<\/b>:/.test(html), `PHP notice on ${slug}`);
    await page.waitForTimeout(250);
    await shot(`admin-${String(pages.findIndex((p) => p[0] === slug) + 1).padStart(2, '0')}-${name}`);
  }
  await page.goto(`${BASE}/wp-admin/admin.php?page=ppc-settings`);
  await shot('admin-08-settings-full', true);
  assert.deepEqual(errors.filter((e) => !/favicon|ERR_TUNNEL|ERR_NAME|ERR_CONNECTION/.test(e)), []);
});

await step('Agents: approve pending agent from the list', async () => {
  await page.goto(`${BASE}/wp-admin/admin.php?page=ppc-agents&status=pending`);
  const row = page.locator('tr', { hasText: 'Brian Kiprono' });
  await row.locator('button:has-text("Approve")').click();
  await page.waitForSelector('.ppc-flash--success');
  assert.equal(sqlVar(`SELECT status FROM {p}agents WHERE id=${reg.agent.id}`)[0].status, 'active');
  await page.goto(`${BASE}/wp-admin/admin.php?page=ppc-agents&id=${reg.agent.id}`);
  await shot('admin-11-agent-detail');
});

// an agent with commissions AND a business not paid yet (does not depend on which test ran last)
const agentWithData = sqlVar(`SELECT a.id FROM {p}agents a WHERE EXISTS (SELECT 1 FROM {p}commissions c WHERE c.agent_id=a.id) AND EXISTS (SELECT 1 FROM {p}tenants t WHERE t.agent_id=a.id AND t.first_paid_at IS NULL) ORDER BY a.id DESC LIMIT 1`)[0]
  || sqlVar(`SELECT a.id FROM {p}agents a WHERE EXISTS (SELECT 1 FROM {p}commissions c WHERE c.agent_id=a.id) ORDER BY a.id DESC LIMIT 1`)[0];
await step('Agent detail with pipeline and commissions', async () => {
  await page.goto(`${BASE}/wp-admin/admin.php?page=ppc-agents&id=${agentWithData.id}`);
  await page.waitForSelector('.ppc-pipeline');
  await shot('admin-12-agent-detail-data');
  await shot('admin-12-agent-detail-data-full', true);
});

const tenant = sqlVar(`SELECT id, code FROM {p}tenants WHERE agent_id=${agentWithData.id} AND first_paid_at IS NULL ORDER BY created_at DESC LIMIT 1`)[0];
await step('Business detail: record a payment via the form (auto amount) → commission flash', async () => {
  await page.goto(`${BASE}/wp-admin/admin.php?page=ppc-businesses&id=${tenant.id}`);
  await page.waitForSelector('.ppc-pay-form');
  await page.selectOption('[data-pay-type]', 'package_software_setup');
  assert.equal(await page.inputValue('[data-pay-amount]'), '15000');
  assert.match(await page.locator('[data-pay-summary]').innerText(), /adds 12 months/);
  await page.fill('input[name=ref]', 'TKQ' + stamp.toUpperCase().slice(-6));
  await shot('admin-13-business-detail');
  await page.click('.ppc-pay-form button[type=submit]');
  await page.waitForSelector('.ppc-flash--success');
  const msg = await page.locator('.ppc-flash').innerText();
  assert.match(msg, /commission created: KES 1,500/);
  await shot('admin-14-business-after-payment');
  await shot('admin-14-business-after-payment-full', true);
});

await step('Business detail actions: extend trial, reset password, suspend/reactivate', async () => {
  await page.goto(`${BASE}/wp-admin/admin.php?page=ppc-businesses&id=${tenant.id}`);
  await page.click('button:has-text("Extend trial")');
  await page.waitForSelector('.ppc-flash--success');
  page.once('dialog', (d) => d.accept());
  await page.click('button:has-text("Reset owner password")');
  await page.waitForSelector('.ppc-flash code.ppc-secret');
  await shot('admin-15-password-reset');
  page.once('dialog', (d) => d.accept());
  await page.click('button:has-text("Suspend")');
  await page.waitForSelector('.ppc-badge--ink');
  await page.click('button:has-text("Reactivate")');
  await page.waitForSelector('.ppc-flash--success');
});

await step('Commissions: bulk approve then mark paid with M-Pesa ref', async () => {
  await page.goto(`${BASE}/wp-admin/admin.php?page=ppc-commissions&agent=${agentWithData.id}`);
  await page.check('[data-check-all]');
  await page.selectOption('.ppc-bulkbar select', 'approved');
  await page.click('.ppc-bulkbar button');
  await page.waitForSelector('.ppc-flash--success');
  await page.check('[data-check-all]');
  await page.selectOption('.ppc-bulkbar select', 'paid');
  await page.fill('.ppc-bulkbar input', 'tkz9ab12');
  await page.click('.ppc-bulkbar button');
  await page.waitForSelector('.ppc-flash--success');
  const open = sqlVar(`SELECT COUNT(*) AS n FROM {p}commissions WHERE agent_id=${agentWithData.id} AND status IN ('pending','approved')`)[0].n * 1;
  assert.equal(open, 0);
  await shot('admin-16-commissions-paid');
});

await step('Website page: shortcode form validates, books (with ?ref) and shows success', async () => {
  const code = sqlVar(`SELECT code FROM {p}agents WHERE id=${agentWithData.id}`)[0].code;
  const w = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const p = await w.newPage();
  await p.goto(`${BASE}/systems/pos/?ref=${code}`);
  await p.waitForSelector('.ppc-demo');
  const trial = await p.locator('.ppc-trial-link').first().getAttribute('href');
  assert.ok(trial.includes('ref=' + code), 'trial link carries ref');
  if (!/[?&]demo=1/.test(trial)) assert.ok(/[?&]trial=1/.test(trial), 'trial link opens the trial form (?trial=1): ' + trial);
  await p.locator('.ppc-demo').scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${DIR}site-01-demo-form.png` });
  await p.click('.ppc-demo button[type=submit]');
  await p.waitForSelector('.ppc-f.is-invalid');
  await p.screenshot({ path: `${DIR}site-02-demo-form-errors.png` });
  await p.fill('.ppc-demo input[name=name]', 'Esther Achieng');
  await p.fill('.ppc-demo input[name=phone]', '0720 456 789');
  await p.fill('.ppc-demo input[name=business]', 'Achieng Cosmetics ' + stamp.slice(-3));
  await p.selectOption('.ppc-demo select[name=business_type]', 'cosmetics');
  await p.fill('.ppc-demo input[name=town]', 'Kisumu');
  await p.click('.ppc-demo button[type=submit]');
  await p.waitForSelector('.ppc-demo__ok:not([hidden])');
  const ref = await p.locator('.ppc-demo__ref').innerText();
  assert.match(ref, /^DB-[A-Z0-9]{6}$/);
  const b = sqlVar(`SELECT agent_code FROM {p}demo_bookings WHERE ref='${ref}'`)[0];
  assert.equal(b.agent_code, code);
  await p.waitForTimeout(400);
  await p.locator('.ppc-demo').scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${DIR}site-03-demo-success.png` });
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const mp = await m.newPage();
  await mp.goto(`${BASE}/systems/pos/`);
  await mp.locator('.ppc-demo').scrollIntoViewIfNeeded();
  await mp.screenshot({ path: `${DIR}site-04-demo-form-mobile.png` });
  await w.close(); await m.close();
});

await step('Bookings: assign agent + status from the list', async () => {
  await page.goto(`${BASE}/wp-admin/admin.php?page=ppc-bookings`);
  const row = page.locator('tr', { hasText: 'Achieng Cosmetics' }).first();
  await row.locator('select[name=status]').selectOption('contacted');
  await row.locator('button:has-text("Save")').click();
  await page.waitForSelector('.ppc-flash--success');
  await shot('admin-17-bookings');
  const id = sqlVar(`SELECT id FROM {p}demo_bookings ORDER BY id DESC LIMIT 1`)[0].id;
  await page.goto(`${BASE}/wp-admin/admin.php?page=ppc-bookings&id=${id}`);
  await shot('admin-18-booking-detail');
});

await step('Lead detail and settings save round-trip', async () => {
  const l = sqlVar(`SELECT agent_id, lead_id FROM {p}leads WHERE agent_id=${agentWithData.id} ORDER BY server_seq DESC LIMIT 1`)[0];
  await page.goto(`${BASE}/wp-admin/admin.php?page=ppc-leads&agent=${l.agent_id}&lead=${l.lead_id}`);
  await page.waitForSelector('.ppc-dl');
  await shot('admin-19-lead-detail');
  await page.goto(`${BASE}/wp-admin/admin.php?page=ppc-settings`);
  await page.fill('input[name="s[software_monthly]"]', '1250');
  await page.click('.ppc-savebar button');
  await page.waitForSelector('.ppc-flash--success');
  const cfg = await fetch(BASE + '/wp-json/pentarch-pos/v1/public/config').then((r) => r.json());
  assert.equal(cfg.prices.software_monthly, 1250);
  assert.equal(cfg.paybill, '247247');
  await page.fill('input[name="s[software_monthly]"]', '1200');
  await page.click('.ppc-savebar button');
  await page.waitForSelector('.ppc-flash--success');
});

await step('CSV export downloads with BOM and headers', async () => {
  await page.goto(`${BASE}/wp-admin/admin.php?page=ppc-tools`);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.ppc-export:has-text("Businesses")')]);
  const p = await dl.path();
  const txt = require('node:fs').readFileSync(p, 'utf8');
  assert.ok(txt.startsWith('﻿Code,Business,'));
  await page.waitForSelector('[data-ppc-authcheck] .ppc-ok, [data-ppc-authcheck] .ppc-warn');
  await shot('admin-09-tools');
});

await step('Admin at phone width (390px) stays usable', async () => {
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, storageState: await ctx.storageState() });
  const mp = await m.newPage();
  for (const [slug, name] of [['ppc', 'dashboard'], ['ppc-businesses', 'businesses']]) {
    await mp.goto(`${BASE}/wp-admin/admin.php?page=${slug}`);
    await mp.waitForSelector('.ppc-wrap');
    await mp.screenshot({ path: `${DIR}admin-m-${name}.png` });
  }
  await mp.goto(`${BASE}/wp-admin/admin.php?page=ppc-businesses&id=${tenant.id}`);
  await mp.screenshot({ path: `${DIR}admin-m-business.png` });
  await m.close();
});

await browser.close();
console.log(`\n${results.length - fails}/${results.length} passed`);
require('node:fs').writeFileSync(DIR + 'admin-results.json', JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
process.exitCode = fails ? 1 : 0;
