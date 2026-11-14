// A first-time cashier: no shortcuts, only clicking visible labels. Tour is ON.
// From a fresh demo: sign in with the PIN shown, follow the tour, cash sale, M-Pesa sale, a return approved by a manager, undo a removal.
// LANG_UI=sw runs the same flow with the Kiswahili labels (files ftc-sw-*.png).
import { chromium, newPage, BASE, shot as rawShot, sleep, report, DESK, step, setFailPage, idb } from './lib.mjs';
const LANG = process.env.LANG_UI === 'sw' ? 'sw' : 'en';
const L = {
  en: { lock: 'Lock', sell: /^Sell/, pay: /^Pay/, exact: 'Exact', newSale: /New sale/, mpesa: /M-Pesa/, code: 'M-Pesa code', complete: /Complete sale/, findReceipt: /Return items \/ find a receipt/, returnItems: 'Return items', returnTitle: 'Return items', reason: 'Wrong size', confirm: 'Confirm return', close: 'Close', undo: 'Undo', remove: 'Remove', more: 'More' },
  sw: { lock: 'Funga skrini', sell: /^Uza/, pay: /^Lipa/, exact: 'Kamili', newSale: /Mauzo mapya/, mpesa: /M-Pesa/, code: 'Namba ya M-Pesa', complete: /Kamilisha mauzo/, findReceipt: /Rudisha bidhaa \/ tafuta risiti/, returnItems: 'Rudisha bidhaa', returnTitle: 'Rudisha bidhaa', reason: 'Ukubwa si sahihi', confirm: 'Thibitisha marejesho', close: 'Funga', undo: 'Tendua', remove: 'Ondoa', more: 'Zaidi' }
}[LANG];
const shot = (page, name) => rawShot(page, LANG === 'en' ? name : name.replace('ftc-', 'ftc-sw-'));
const b = await chromium.launch();
const { ctx, page } = await newPage(b, DESK, { tour: true });
if (LANG !== 'en') await ctx.addInitScript(() => { try { localStorage.setItem('ppos.lang', 'sw'); } catch {} });
setFailPage(page);
await page.goto(BASE + '?demo=1&type=duka');
await page.waitForSelector('.shell', { timeout: 20000 });
const click = (role, name, opts = {}) => page.getByRole(role, { name, ...opts }).first().click();
await step('cashier signs in by tapping her name and the PIN shown', async () => {
  await click('button', L.lock); await page.waitForSelector('.lock');
  await shot(page, 'ftc-01-lock');
  await page.getByRole('option', { name: /Mercy/ }).click();
  for (const d of '1111') await page.locator('.numpad button', { hasText: d }).first().click();
  await page.waitForSelector('.shell');
});
await step('opens Sell from the menu and follows the tour', async () => {
  await click('link', L.sell); await page.waitForSelector('.tour-card', { timeout: 5000 });
  await sleep(300);
  await shot(page, 'ftc-02-tour');
  for (let i = 0; i < 5; i++) { await page.locator('.tour-card .btn.primary').click(); await sleep(150); }
  if (await page.locator('.tour-card').count()) throw new Error('tour still open');
});
await step('cash sale by tapping a product, Pay, Exact, New sale', async () => {
  await page.locator('.tile', { hasText: 'Brookside Milk 500ml' }).first().click();
  await page.locator('.tile', { hasText: 'Supa Loaf' }).first().click();
  await click('button', L.pay); await page.waitForSelector('.tender');
  await click('button', L.exact); await page.waitForSelector('.done-hero');
  await sleep(250);
  await shot(page, 'ftc-03-done');
  await click('button', L.newSale); await sleep(300);
});
await step('M-Pesa sale: Pay, M-Pesa, type code, Complete sale', async () => {
  await page.locator('.tile', { hasText: 'Kabras Sugar' }).first().click();
  await click('button', L.pay); await page.waitForSelector('.tender');
  await page.getByRole('tab', { name: L.mpesa }).click();
  await page.getByLabel(L.code).fill('TH4QW7ER2T');
  await click('button', L.complete); await page.waitForSelector('.done-hero');
  await click('button', L.newSale); await sleep(300);
});
await step('return: find receipt from the Sell screen, manager approves with PIN pad', async () => {
  await click('link', L.findReceipt); await page.waitForSelector('.vt-row');
  await page.locator('.vt-row').first().click(); await page.waitForSelector('.page-h');
  await click('button', L.returnItems); await page.waitForSelector('.modal .numpad');
  await sleep(400);
  await shot(page, 'ftc-04-approval');
  for (const d of '2222') await page.locator('.modal .numpad button', { hasText: d }).first().click();
  await page.waitForSelector(`.modal h2:has-text("${L.returnTitle}")`);
  await page.locator(`.modal .qty button[aria-label="${L.more}"]`).first().click();
  await click('button', L.reason);
  await click('button', L.confirm);
  await page.waitForSelector('iframe[title]');
  await sleep(400);
  await shot(page, 'ftc-05-slip');
  await click('button', L.close, { exact: true });
});
await step('removing an item can be undone', async () => {
  await click('link', L.sell); await page.waitForSelector('.tiles');
  await page.locator('.tile', { hasText: 'Kimbo 1kg' }).first().click();
  await page.locator(`.line .ops button[aria-label="${L.remove}"]`).click();
  await click('button', L.undo);
  if ((await page.locator('.line').count()) !== 1) throw new Error('undo failed');
});
const rets = await idb(page, 'returns');
const recent = rets.filter((r) => Date.now() - r.created_at < 120000).length;
console.log('returns recorded by cashier session:', recent);
if (recent !== 1) console.log('✘ expected exactly one return');
const missing = await page.evaluate(() => [...(window.__i18nMissing || [])]);
if (LANG !== 'en') console.log('untranslated strings seen:', missing.length ? missing : 'none');
report('first-time-cashier' + (LANG === 'en' ? '' : ' (Kiswahili)'));
await b.close();
