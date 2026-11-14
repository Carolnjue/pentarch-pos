// A brand-new business (trial, setup skipped, no products): every main screen must say what to do next.
import { chromium, newPage, BASE, OUT, sleep, report, DESK } from './lib.mjs';
import fs from 'node:fs';
fs.mkdirSync(OUT + 'visual', { recursive: true });
const b = await chromium.launch();
const { page } = await newPage(b, DESK);
await page.goto(BASE); await page.waitForSelector('.welcome');
await page.getByRole('button', { name: /Start 30-day free trial/ }).click();
await page.getByLabel('Business name').fill('Empty Shop');
await page.getByLabel('Your name').fill('New Owner');
await page.getByLabel('Phone (M-Pesa)').fill('0700 111 222');
await page.getByLabel(/^Email/).fill(`empty${Date.now()}@example.co.ke`);
await page.getByLabel('Password', { exact: true }).fill('Secret123');
await page.getByLabel('Your 4-digit till PIN').fill('4321');
await page.getByLabel('Town').fill('Kisumu');
await page.getByText('I agree to the Pentarch POS terms').click();
await page.getByRole('button', { name: /Start free trial/ }).last().click();
await page.waitForSelector('.wizard');
await page.getByRole('button', { name: /Skip setup for now/ }).click(); await page.waitForSelector('.shell');
let n = 0;
for (const [h, name] of [['/home', 'home'], ['/sell', 'sell'], ['/products', 'products'], ['/customers', 'customers'], ['/sales', 'sales'], ['/shifts', 'shifts']]) {
  await page.goto(BASE + '#' + h); await sleep(700);
  await page.screenshot({ path: `${OUT}visual/empty-${String(++n).padStart(2, '0')}-${name}.png` });
}
// one tap on "Add typical products" fills the catalogue; "Clear unused template products" removes them again (none sold)
await page.goto(BASE + '#/sell'); await page.waitForSelector('.start-cat');
await page.getByRole('button', { name: 'Add typical products' }).click();
await page.waitForSelector('.tiles .tile', { timeout: 10000 }); await sleep(400);
const added = await page.locator('.tiles .tile').count();
await page.screenshot({ path: `${OUT}visual/empty-07-sell-after-typical-products.png` });
await page.goto(BASE + '#/settings/backup'); await page.waitForSelector('.page');
await page.getByRole('button', { name: 'Clear', exact: true }).click(); await page.waitForSelector('.modal');
await page.locator('.modal').getByRole('button', { name: 'Delete' }).click(); await sleep(600);
await page.goto(BASE + '#/sell'); await page.waitForSelector('.start-cat', { timeout: 5000 });
console.log(added > 20 ? `✔ typical products added (${added} tiles) and cleared again` : '✘ typical products not added');
report('empty-states');
await b.close();
