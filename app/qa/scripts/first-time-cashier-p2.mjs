// First-time staff on Phase 2 businesses — only clicks on visible labels, no keyboard shortcuts.
// Restaurant: a waiter opens a table and sends the order → the kitchen bumps it on the kitchen display → the waiter prints
//             the bill → the cashier takes payment and the table is free again.
// Pharmacy:  a cashier sells a medicine tracked by batch → the batch with the earliest expiry (FEFO) leaves stock.
// LANG_UI=sw runs the same flow with Kiswahili labels.
import { chromium, newPage, BASE, shot as rawShot, sleep, report, DESK, step, setFailPage, idb } from './lib.mjs';
const LANG = process.env.LANG_UI === 'sw' ? 'sw' : 'en';
const L = {
  en: { lock: 'Lock', tables: 'Tables', kds: 'Kitchen display', addToOrder: 'Add to order', send: /Send to kitchen/, done: /Done|Seen/, bill: 'Print bill', pay: /^Pay/, exact: 'Exact', newSale: /New sale/, sell: /^Sell/ },
  sw: { lock: 'Funga skrini', tables: 'Meza', kds: 'Skrini ya jikoni', addToOrder: 'Ongeza kwenye oda', send: /Tuma jikoni/, done: /Tayari|Nimeona/, bill: 'Chapisha bili', pay: /^Lipa/, exact: 'Kamili', newSale: /Mauzo mapya/, sell: /^Uza/ }
}[LANG];
const shot = (page, name) => rawShot(page, LANG === 'en' ? name : name.replace('ftc2-', 'ftc2-sw-'));
const fail = (m) => { throw new Error(m); };
const b = await chromium.launch();

/* ---------------- restaurant ---------------- */
{
  const { ctx, page } = await newPage(b, DESK);
  if (LANG !== 'en') await ctx.addInitScript(() => { try { localStorage.setItem('ppos.lang', 'sw'); } catch {} });
  setFailPage(page);
  await page.goto(BASE + '?demo=1&type=restaurant');
  await page.waitForSelector('.shell', { timeout: 60000 });
  const signIn = async (name, pin) => {
    await page.getByRole('button', { name: L.lock }).first().click(); await page.waitForSelector('.lock');
    await page.getByRole('option', { name }).click();
    for (const d of pin) await page.locator('.numpad button', { hasText: d }).first().click();
    await page.waitForSelector('.shell'); await sleep(300);
  };
  const orders = async () => (await idb(page, 'orders')).filter((o) => !o.deleted);
  let tableName, orderId;
  await step('[restaurant] waiter signs in with her PIN and lands on the tables', async () => {
    await signIn(/Lilian/, '3434');
    await page.waitForSelector('.floor', { timeout: 10000 });
    await shot(page, 'ftc2-01-waiter-tables');
  });
  await step('[restaurant] waiter opens a free table for 2 and adds food (with a side) and a drink', async () => {
    const free = page.locator('.ftable.s-free').first();
    tableName = (await free.locator('.fn').innerText()).trim();
    await free.click(); await page.waitForSelector('.guest-grid');
    await page.locator('.guest-btn', { hasText: '2' }).first().click();
    await page.waitForSelector('.tbar');
    await page.locator('.tile', { hasText: 'Beef stew & ugali' }).first().click(); await page.waitForSelector('.modal');
    await page.locator('.modal .chip').first().click();
    await page.getByRole('button', { name: L.addToOrder }).click(); await sleep(200);
    await page.locator('.tile', { hasText: 'Soda 500ml' }).first().click(); await sleep(200);
    orderId = (await orders()).find((o) => o.table_name === tableName && o.status === 'open')?.id;
    if (!orderId) fail('no open order on ' + tableName);
  });
  await step('[restaurant] waiter taps "Send to kitchen" → kitchen and bar tickets', async () => {
    await page.getByRole('button', { name: L.send }).click(); await sleep(1500);
    const tk = (await idb(page, 'kitchen_tickets')).filter((x) => x.order_id === orderId);
    if (tk.map((x) => x.station).sort().join(',') !== 'bar,kitchen') fail('tickets ' + tk.map((x) => x.station));
    await shot(page, 'ftc2-02-sent');
  });
  await step('[restaurant] kitchen display: tap Done on the ticket → the table shows the food is ready', async () => {
    await page.getByRole('link', { name: L.kds }).click(); await page.waitForSelector('.kds'); await sleep(500);
    await shot(page, 'ftc2-03-kds');
    // one ticket per station (kitchen + bar): bump each, waiting for the screen to update
    for (let i = 0; i < 4 && (await page.locator('.kt', { hasText: tableName }).count()); i++) {
      const n = await page.locator('.kt', { hasText: tableName }).count();
      await page.locator('.kt', { hasText: tableName }).first().getByRole('button', { name: L.done }).click();
      await page.waitForFunction(([t, n]) => [...document.querySelectorAll('.kt')].filter((e) => e.innerText.includes(t)).length < n, [tableName, n], { timeout: 5000 });
    }
    const left = (await idb(page, 'kitchen_tickets')).filter((x) => x.order_id === orderId && x.status !== 'done');
    if (left.length) fail(left.length + ' tickets not bumped');
    await page.getByRole('link', { name: L.tables }).click(); await page.waitForSelector('.floor'); await sleep(400);
    const t = page.locator('.ftable').filter({ has: page.locator('.fn', { hasText: new RegExp('^' + tableName + '$') }) });
    if (!(await t.getAttribute('class')).includes('ready')) fail('table not shown as ready');
    await shot(page, 'ftc2-03b-ready');
  });
  await step('[restaurant] waiter prints the bill', async () => {
    const t = page.locator('.ftable').filter({ has: page.locator('.fn', { hasText: new RegExp('^' + tableName + '$') }) });
    await t.click(); await page.waitForSelector('.tbar');
    await page.getByRole('button', { name: L.bill }).click(); await sleep(1500);
    if ((await orders()).find((o) => o.id === orderId)?.status !== 'billed') fail('order not billed');
  });
  await step('[restaurant] cashier takes payment: table → Pay → Exact → New sale; the table is free again', async () => {
    await signIn(/Mercy/, '1111');
    await page.getByRole('link', { name: L.tables }).click(); await page.waitForSelector('.floor'); await sleep(300);
    const t = page.locator('.ftable').filter({ has: page.locator('.fn', { hasText: new RegExp('^' + tableName + '$') }) });
    await t.click(); await page.waitForSelector('.tbar');
    await page.locator('.pay-btn').click(); await page.waitForSelector('.tender');
    await page.getByRole('button', { name: L.exact, exact: true }).click(); await page.waitForSelector('.done-hero');
    await shot(page, 'ftc2-04-paid');
    await page.getByRole('button', { name: L.newSale }).click(); await sleep(600);
    const o = (await orders()).find((x) => x.id === orderId);
    if (o?.status !== 'paid') fail('order status ' + o?.status);
    const sale = (await idb(page, 'sales')).find((s) => s.order_id === orderId);
    if (!sale || sale.table_id == null) fail('sale not linked to the table order');
    await page.getByRole('link', { name: L.tables }).click(); await page.waitForSelector('.floor'); await sleep(300);
    const cls = await page.locator('.ftable').filter({ has: page.locator('.fn', { hasText: new RegExp('^' + tableName + '$') }) }).getAttribute('class');
    if (!cls.includes('s-free')) fail('table not freed: ' + cls);
  });
  await ctx.close();
}

/* ---------------- pharmacy ---------------- */
{
  const { ctx, page } = await newPage(b, DESK);
  if (LANG !== 'en') await ctx.addInitScript(() => { try { localStorage.setItem('ppos.lang', 'sw'); } catch {} });
  setFailPage(page);
  await page.goto(BASE + '?demo=1&type=pharmacy');
  await page.waitForSelector('.shell', { timeout: 60000 });
  await step('[pharmacy] cashier sells a batch-tracked medicine → the earliest-expiry batch leaves stock (FEFO)', async () => {
    await page.getByRole('button', { name: L.lock }).first().click(); await page.waitForSelector('.lock');
    await page.getByRole('option', { name: /Mercy/ }).click();
    for (const d of '1111') await page.locator('.numpad button', { hasText: d }).first().click();
    await page.waitForSelector('.shell');
    const P = (await idb(page, 'products')).filter((x) => x.track_batches && !x.deleted && x.active !== false);
    const allMoves = await idb(page, 'stock_moves');
    const today = new Date().toISOString().slice(0, 10);
    const batchesOf = (pid) => {
      const bal = new Map();
      for (const m of allMoves.filter((m) => m.product_id === pid && m.batch_no)) { const v = bal.get(m.batch_no) || { qty: 0, expiry: m.expiry }; v.qty += m.qty; if (m.expiry) v.expiry = m.expiry; bal.set(m.batch_no, v); }
      return [...bal.entries()].filter(([, v]) => v.qty > 0 && v.expiry >= today).sort((a, z) => a[1].expiry.localeCompare(z[1].expiry));
    };
    const p = P.find((x) => batchesOf(x.id).length >= 2);
    if (!p) fail('no medicine with two batches in stock');
    const live = batchesOf(p.id);
    const expect = live[0][0];
    await page.getByRole('link', { name: L.sell }).first().click(); await page.waitForSelector('.tiles');
    await page.locator('.tile', { hasText: p.name }).first().click(); await sleep(300);
    await shot(page, 'ftc2-05-pharmacy-cart');
    await page.locator('.pay-btn').click(); await page.waitForSelector('.tender');
    await page.getByRole('button', { name: L.exact, exact: true }).click(); await page.waitForSelector('.done-hero');
    await page.getByRole('button', { name: L.newSale }).click(); await sleep(400);
    const mv = (await idb(page, 'stock_moves')).filter((m) => m.product_id === p.id && m.type === 'sale').sort((a, z) => z.created_at - a.created_at)[0];
    if (!mv || mv.batch_no !== expect) fail(`sold batch ${mv?.batch_no}, expected earliest expiry ${expect} (${live.map(([b, v]) => b + ' ' + v.expiry + ' ×' + v.qty).join(', ')})`);
    console.log(`   ${p.name}: sold from batch ${mv.batch_no} (expires ${live[0][1].expiry}); later batches: ${live.slice(1).map(([b, v]) => b + ' ' + v.expiry).join(', ') || 'none'}`);
  });
  await ctx.close();
}
const errs = report('first-time-cashier-p2' + (LANG === 'en' ? '' : ' (Kiswahili)'));
await b.close();
process.exit(errs.length ? 1 : 0);
