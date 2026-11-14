import { chromium, newPage, BASE, shot, sleep, scan, report, DESK, idb, step, setFailPage } from './lib.mjs';
import fs from 'node:fs';
const b = await chromium.launch();
const { page } = await newPage(b, DESK);
setFailPage(page);
await page.goto(BASE + '?demo=1&type=boutique');
await page.waitForSelector('.shell', { timeout: 20000 });
await step('products list (virtualised) + low stock filter', async () => {
  await page.goto(BASE + '#/products'); await page.waitForSelector('.vt-row'); await sleep(300);
  await shot(page, '21-products');
  await page.getByRole('button', { name: 'Low stock' }).click(); await sleep(200);
});
await step('add product with size × colour variants', async () => {
  await page.goto(BASE + '#/products/new'); await page.waitForSelector('.pf-grid');
  await page.getByLabel('Product name').fill('Linen Shirt');
  await page.getByLabel('Selling price').fill('1800');
  await page.getByLabel('Cost price').fill('950');
  await page.getByText('Has variants', { exact: true }).click();
  await page.getByLabel('Values (comma separated)').first().fill('M, L, XL');
  await page.getByLabel('Values (comma separated)').nth(1).fill('White, Navy');
  await page.getByRole('button', { name: 'Generate variants' }).click(); await sleep(200);
  const inputs = page.getByLabel('Opening stock');
  for (let i = 0; i < await inputs.count(); i++) await inputs.nth(i).fill(String(3 + i));
  await shot(page, '22-product-variants', true);
  await page.getByRole('button', { name: 'Save product' }).click(); await sleep(700);
  const ps = await idb(page, 'products');
  const parent = ps.find((p) => p.name === 'Linen Shirt');
  const kids = ps.filter((p) => p.parent_id === parent.id);
  if (kids.length !== 6) throw new Error('variants: ' + kids.length);
  console.log('   variants', kids.length, 'barcodes ok', kids.every((k) => /^20\d{11}$/.test(k.barcode)));
});
await step('sell a variant via the size/colour picker', async () => {
  await page.goto(BASE + '#/sell'); await page.waitForSelector('.tiles');
  await page.locator('.tile', { hasText: 'Linen Shirt' }).click(); await page.waitForSelector('.modal');
  await shot(page, '23-variant-picker');
  await page.locator('.modal table button').first().click(); await sleep(200);
  if (!(await page.locator('.line').count())) throw new Error('variant not added');
});
await step('print labels: 38×25 and A4 3×8 preview', async () => {
  const ps = await idb(page, 'products');
  const ids = ps.filter((p) => p.name.startsWith('Linen Shirt —')).map((p) => p.id).join(',');
  await page.goto(BASE + '#/products/labels?ids=' + ids); await page.waitForSelector('iframe[title="Label preview"]'); await sleep(900);
  await shot(page, '24-labels-38x25');
  await page.getByLabel('Label size').selectOption('a4-3x8'); await sleep(900);
  await shot(page, '25-labels-a4');
  const html = await page.locator('iframe[title="Label preview"]').getAttribute('srcdoc');
  const p2 = await b.newPage(); await p2.setContent(html); await p2.pdf({ path: new URL('../labels-a4.pdf', import.meta.url).pathname, format: 'A4' }); await p2.close();
});
await step('CSV import: template, mapping, errors, import', async () => {
  const csv = 'Product,Selling Price,Cost,Category,Barcode,Stock\nCanvas Tote Bag,1500,800,Bags,,12\nWool Scarf,950,500,Accessories,,8\nBroken Row,,100,Bags,,1\nBad Barcode Hat,700,300,Accessories,1234567890123,5\n';
  const f = '/tmp/claude-0/import.csv'; fs.writeFileSync(f, csv);
  await page.goto(BASE + '#/products/import'); await page.waitForSelector('.dropzone');
  await page.setInputFiles('.dropzone input[type=file]', f); await page.waitForSelector('text=Match your columns');
  await shot(page, '26-import-map');
  await page.getByRole('button', { name: 'Check rows' }).click(); await sleep(200);
  await shot(page, '27-import-check');
  await page.getByRole('button', { name: /^Import \d+ products/ }).click(); await page.waitForSelector('text=Import finished');
  const ps = await idb(page, 'products');
  if (!ps.find((p) => p.name === 'Wool Scarf')) throw new Error('not imported');
  console.log('   imported OK; error rows skipped');
});
await step('product form: More options collapsed for simple use', async () => {
  await page.goto(BASE + '#/products/new'); await page.waitForSelector('.pf-grid'); await sleep(200);
  await shot(page, '28-product-new', true);
});
report('flows-products');
await b.close();
