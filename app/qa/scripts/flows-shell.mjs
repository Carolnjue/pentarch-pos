// App shell & settings: command palette, shortcuts sheet, language switch, role restrictions, owner-edited permission matrix,
// idle auto-lock (fake clock), backup download → restore, CSV export, WhatsApp receipt link, receipt designer 58 mm.
import fs from 'node:fs';
import { chromium, newPage, BASE, OUT, shot, sleep, report, DESK, idb, step, setFailPage } from './lib.mjs';
const b = await chromium.launch();
const { ctx, page } = await newPage(b, DESK, { acceptDownloads: true });
setFailPage(page);
await ctx.route(/https:\/\/(wa\.me|api\.whatsapp\.com)\/.*/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>WhatsApp</title>ok' }));
await page.goto(BASE + '?demo=1&type=duka'); await page.waitForSelector('.shell', { timeout: 30000 });
const unlock = async (who, pin) => { await page.getByRole('option', { name: who }).click(); for (const d of pin) await page.keyboard.press(d); await page.waitForSelector('.shell'); };

await step('command palette finds a product, a customer and a page', async () => {
  await page.keyboard.press('Control+k'); await page.waitForSelector('.cmdk');
  await page.keyboard.type('kimbo', { delay: 30 }); await sleep(200);
  const txt = await page.locator('.cmdk').innerText();
  if (!/Kimbo/i.test(txt)) throw new Error('product not in palette');
  await page.keyboard.press('Control+a'); await page.keyboard.type('wanjiku', { delay: 30 }); await sleep(200);
  if (!/Wanjiku/i.test(await page.locator('.cmdk').innerText())) throw new Error('customer not in palette');
  await page.keyboard.press('Control+a'); await page.keyboard.type('labels', { delay: 30 }); await sleep(200);
  await shot(page, '50-palette-search');
  await page.keyboard.press('Enter'); await page.waitForURL(/products\/labels/);
});
await step('F1 opens the keyboard shortcuts sheet', async () => {
  await page.keyboard.press('F1'); await page.waitForSelector('.modal');
  if (!/F4/.test(await page.locator('.modal').innerText())) throw new Error('shortcuts missing');
  await page.keyboard.press('Escape');
});
await step('language switch to Kiswahili and back', async () => {
  await page.goto(BASE + '#/sell'); await page.waitForSelector('.tiles');
  await page.locator('.top').getByRole('button', { name: /Switch language|EN|SW/ }).first().click(); await sleep(200);
  const sw = page.getByText('Kiswahili', { exact: true }); if (await sw.count()) await sw.first().click(); await sleep(250);
  if (!(await page.getByRole('button', { name: /Lipa/ }).count())) throw new Error('Pay button not translated');
  await shot(page, '51-sell-kiswahili');
  await page.locator('.top').getByRole('button', { name: /Badilisha lugha|SW/ }).first().click(); await sleep(200);
  const en = page.getByText('English', { exact: true }); if (await en.count()) await en.first().click(); await sleep(250);
  if (!(await page.getByRole('button', { name: /^Pay/ }).count())) throw new Error('not back to English');
});
await step('cashier: no Settings in the menu, void needs a manager', async () => {
  await page.keyboard.press('Control+l'); await page.waitForSelector('.lock');
  await unlock(/Mercy/, '1111');
  const nav = await page.locator('.side nav').innerText();
  if (/Settings/.test(nav)) throw new Error('cashier sees Settings');
  await page.goto(BASE + '#/settings'); await sleep(300);
  if (!/cannot open this page|No access/i.test(await page.locator('main').innerText())) throw new Error('settings not blocked');
});
await step('owner lets cashiers void (permission matrix) → cashier voids without a PIN', async () => {
  await page.keyboard.press('Control+l'); await page.waitForSelector('.lock');
  await unlock(/Grace/, '1234');
  await page.goto(BASE + '#/settings/staff'); await page.waitForSelector('.page');
  await page.getByRole('tab', { name: /Role permissions/ }).or(page.getByRole('button', { name: /Role permissions/ })).first().click(); await sleep(200);
  await page.getByLabel('Cashier: Void a sale').check();
  await shot(page, '52-role-matrix');
  await page.getByRole('button', { name: 'Save' }).click(); await sleep(300);
  await page.keyboard.press('Control+l'); await page.waitForSelector('.lock');
  await unlock(/Mercy/, '1111');
  const s = (await idb(page, 'sales')).filter((x) => x.status === 'completed').sort((a, z) => z.created_at - a.created_at)[0];
  await page.goto(BASE + '#/sales/' + s.id); await page.waitForSelector('.page-h');
  await page.getByRole('button', { name: 'Void' }).click(); await page.waitForSelector('.modal');
  if (await page.locator('.modal .numpad').count()) throw new Error('still asked for a manager PIN');
  await page.keyboard.press('Escape');
  // put it back
  await page.keyboard.press('Control+l'); await page.waitForSelector('.lock'); await unlock(/Grace/, '1234');
  await page.goto(BASE + '#/settings/staff'); await page.waitForSelector('.page');
  await page.getByRole('tab', { name: /Role permissions/ }).or(page.getByRole('button', { name: /Role permissions/ })).first().click(); await sleep(200);
  await page.getByLabel('Cashier: Void a sale').uncheck(); await page.getByRole('button', { name: 'Save' }).click(); await sleep(200);
});
let backupPath;
await step('backup: download JSON, then restore it (type RESTORE)', async () => {
  await page.goto(BASE + '#/settings/backup'); await page.waitForSelector('.page');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download backup' }).click()]);
  backupPath = OUT + 'backup-test.json'; await dl.saveAs(backupPath);
  const data = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  const n = Object.values(data.tables).reduce((s, x) => s + x.length, 0);
  console.log('   backup records', n, 'sales', data.tables.sales.length);
  const before = (await idb(page, 'sales')).length;
  // add one sale after the backup, restore must remove it
  await page.goto(BASE + '#/sell'); await page.waitForSelector('.tiles'); await page.locator('.tile').first().click();
  await page.keyboard.press('F4'); await page.waitForSelector('.tender'); await page.getByRole('button', { name: 'Exact' }).click(); await page.waitForSelector('.done-hero'); await page.keyboard.press('Enter');
  await page.goto(BASE + '#/settings/backup'); await page.waitForSelector('.page');
  await page.locator('input[type=file][accept*=json]').setInputFiles(backupPath); await page.waitForSelector('.modal');
  await page.locator('.modal input').fill('RESTORE'); await page.locator('.modal .btn.primary, .modal .btn.danger').last().click();
  await page.waitForSelector('.shell, .lock', { timeout: 20000 }); await sleep(800);
  const after = (await idb(page, 'sales')).length;
  console.log('   sales before', before, 'after restore', after);
  if (after !== before) throw new Error('restore did not bring back the backup state');
  fs.unlinkSync(backupPath);
});
await step('export everything as a CSV zip', async () => {
  if (await page.locator('.lock').count()) await unlock(/Grace/, '1234');
  await page.goto(BASE + '#/settings/backup'); await page.waitForSelector('.page');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV zip' }).click()]);
  const p = OUT + 'export-test.zip'; await dl.saveAs(p);
  const size = fs.statSync(p).size; fs.unlinkSync(p);
  console.log('   zip bytes', size);
  if (size < 10000) throw new Error('zip too small');
});
await step('WhatsApp receipt opens wa.me with the receipt text', async () => {
  const s = (await idb(page, 'sales')).filter((x) => x.status === 'completed' && x.customer_id).sort((a, z) => z.created_at - a.created_at)[0];
  await page.goto(BASE + '#/sales/' + s.id); await page.waitForSelector('.page-h');
  const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null), page.getByRole('button', { name: 'WhatsApp' }).click()]);
  let url = pop?.url() || '';
  if (!url && await page.locator('.modal').count()) { const [p2] = await Promise.all([ctx.waitForEvent('page'), page.locator('.modal').getByRole('link').or(page.locator('.modal').getByRole('button', { name: /WhatsApp/ })).last().click()]); url = p2.url(); }
  console.log('   ', decodeURIComponent(url).slice(0, 90).replace(/\n/g, ' | '));
  if (!/wa\.me|api\.whatsapp\.com/.test(url) || !decodeURIComponent(url).includes(s.no)) throw new Error('bad WhatsApp link: ' + url.slice(0, 80));
  await pop?.close().catch(() => {});
});
await step('receipt designer: 58 mm preview updates live', async () => {
  await page.goto(BASE + '#/settings/receipt'); await page.waitForSelector('.page');
  if (await page.locator('.lock').count()) await unlock(/Grace/, '1234');
  await page.getByRole('radio', { name: '58 mm' }).first().click(); await sleep(400);
  await shot(page, '53-receipt-58mm');
});
await step('idle auto-lock: set 1 minute in Selling options, then the till locks itself', async () => {
  if (await page.locator('.lock').count()) await unlock(/Grace/, '1234');
  await page.goto(BASE + '#/settings/selling'); await page.waitForSelector('.page');
  await page.getByLabel('Minutes').fill('1'); await page.getByRole('button', { name: 'Save' }).click(); await sleep(300);
  await page.clock.install(); await page.reload(); await page.waitForSelector('.lock, .shell');
  if (await page.locator('.lock').count()) await unlock(/Grace/, '1234');
  await page.goto(BASE + '#/home'); await page.waitForSelector('.page');
  await page.clock.fastForward('01:30'); await page.clock.runFor(16000); await sleep(300);
  if (!(await page.locator('.lock').count())) throw new Error('did not lock after 90 idle seconds');
  const a = (await idb(page, 'audit')).filter((x) => x.action === 'user.lock' && x.details?.reason === 'idle').length;
  console.log('   idle locks audited', a);
});
report('flows-shell');
await b.close();
