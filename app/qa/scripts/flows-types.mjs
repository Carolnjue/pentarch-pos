// Every business type (SPEC §8 presets): demo seeds products, 30 days of sales, customers and staff; Sell works; a sale completes.
import { chromium, newPage, BASE, OUT, sleep, scan, report, DESK, idb, step, setFailPage } from './lib.mjs';
import fs from 'node:fs';
const TYPES = ['duka', 'minimart', 'hardware', 'agrovet', 'pharmacy', 'boutique', 'electronics', 'cosmetics', 'butchery', 'bakery', 'restaurant', 'bar', 'salon', 'stationery', 'wholesale', 'autospares', 'gas_water', 'other'];
const only = process.argv.slice(2);
fs.mkdirSync(OUT + 'types', { recursive: true });
const b = await chromium.launch();
const rows = [];
for (const type of only.length ? only : TYPES) {
  const { ctx, page } = await newPage(b, DESK); setFailPage(page);
  await step(`demo "${type}": seeded data + a sale`, async () => {
    const t0 = Date.now();
    await page.goto(BASE + '?demo=1&type=' + type); await page.waitForSelector('.shell', { timeout: 60000 });
    const seedMs = Date.now() - t0;
    const [products, sales, customers, users, biz] = await Promise.all(['products', 'sales', 'customers', 'users', 'business'].map((t) => idb(page, t)));
    const days = new Set(sales.map((s) => new Date(s.created_at).toDateString())).size;
    const sellable = products.filter((p) => !p.deleted && !p.has_variants && p.active !== false);
    if (sellable.length < 25) throw new Error('too few products: ' + sellable.length);
    if (days < 28) throw new Error('sales history covers only ' + days + ' days');
    if (users.length < 3) throw new Error('staff missing');
    const mods = Object.entries(biz[0].modules || {}).filter(([, v]) => v).map(([k]) => k).join(',');
    await page.goto(BASE + '#/sell'); await page.waitForSelector('.tiles .tile'); await sleep(300);
    const simple = sellable.find((p) => p.barcode && p.type === 'stock' && !p.track_serials && !(p.modifiers_group_ids?.length) && !['kg', 'g', 'l', 'ml', 'm'].includes(p.unit) && p.price > 0)
      || sellable.find((p) => p.barcode && p.price > 0 && !p.track_serials && !(p.modifiers_group_ids?.length));
    if (!simple) throw new Error('no simple barcoded product to scan');
    await scan(page, simple.barcode); await sleep(200);
    if (await page.locator('.modal').count()) { await page.locator('.modal .btn.primary').last().click(); await sleep(200); }
    if (!(await page.locator('.line').count())) throw new Error('scan did not add ' + simple.name);
    await page.screenshot({ path: `${OUT}types/${type}-sell.png` });
    await page.keyboard.press('F4'); await page.waitForSelector('.tender');
    await page.getByRole('button', { name: 'Exact' }).click(); await page.waitForSelector('.done-hero');
    await page.keyboard.press('Enter'); await sleep(150);
    await page.goto(BASE + '#/home'); await page.waitForSelector('.page'); await sleep(500);
    await page.screenshot({ path: `${OUT}types/${type}-home.png` });
    rows.push({ type, products: sellable.length, sales: sales.length, days, customers: customers.length, staff: users.length, seed_ms: seedMs, modules: mods });
  });
  await ctx.close();
}
console.table(rows);
fs.writeFileSync(OUT + 'types/summary.json', JSON.stringify(rows, null, 1));
report('flows-types');
await b.close();
