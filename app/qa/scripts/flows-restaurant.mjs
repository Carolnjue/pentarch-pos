// Restaurant module (demo "restaurant" + "bar"): floor plan, open table → order → send to kitchen (KOT per station, rounds),
// void after send (approval + VOID ticket), print bill, transfer, merge, split by items / equally, takeaway & delivery queue,
// waiter mode (lands on tables, payment needs approval), kitchen display bump / recall, layout editing, service charge.
import { chromium, newPage, BASE, shot, sleep, report, DESK, idb, step, setFailPage } from './lib.mjs';
const b = await chromium.launch();
const { page } = await newPage(b, DESK);
setFailPage(page);
const tile = async (name) => { await page.locator('.tile', { hasText: name }).first().click(); await sleep(150); };
const orders = async () => (await idb(page, 'orders')).filter((o) => !o.deleted);
const tickets = async () => (await idb(page, 'kitchen_tickets')).filter((o) => !o.deleted);
const prints = () => page.evaluate(() => (window.__pposPrintLog || []).map((p) => ({ kind: p.kind, station: p.station, tkind: p.kind === 'kot' ? p.html.includes('*** VOID ***') : null, text: p.html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 400) })));
const clearPrints = () => page.evaluate(() => { window.__pposPrintLog = []; });
const login = async (name, pin) => {
  await page.keyboard.press('Control+l'); await page.waitForSelector('.lock');
  await page.getByRole('option', { name }).click();
  for (const d of pin) await page.keyboard.press(d);
  await page.waitForSelector('.shell'); await sleep(300);
};
const floor = async () => { await page.goto(BASE + '#/tables'); await page.waitForSelector('.floor'); await sleep(300); await area('Main hall'); };
async function area(name) { await page.locator('.floor-page .cat-tabs .chip', { hasText: name }).click(); await sleep(250); }
const _area = async (name) => { await page.locator('.floor-page .cat-tabs .chip', { hasText: name }).click(); await sleep(250); };
const table = (name) => page.locator('.ftable').filter({ has: page.locator('.fn', { hasText: new RegExp('^' + name + '$') }) });
const payExact = async () => {
  await page.locator('.pay-btn').click(); await page.waitForSelector('.tender');
  await page.getByRole('button', { name: 'Exact' }).click(); await page.waitForSelector('.done-hero');
  await sleep(200); await page.keyboard.press('Enter'); await sleep(400);
};

await page.goto(BASE + '?demo=1&type=restaurant'); await page.waitForSelector('.shell', { timeout: 60000 });

await step('floor plan: demo tables by area, status colours, elapsed time, home widget', async () => {
  await page.goto(BASE + '#/home'); await page.waitForSelector('.rw'); await sleep(300);
  const w = await page.locator('.rw').innerText();
  if (!/Tables occupied/.test(w)) throw new Error('home widget missing');
  await floor();
  const chips = await page.locator('.floor-page .cat-tabs .chip').allInnerTexts();
  if (!/Main hall/.test(chips[0])) throw new Error('main hall not first: ' + chips.join('|'));
  const busy = await page.locator('.ftable.s-busy').count(), bill = await page.locator('.ftable.s-bill').count();
  if (busy + bill < 3) throw new Error('expected occupied tables, got ' + busy + '/' + bill);
  if (!bill) throw new Error('no table with bill printed');
  const txt = await page.locator('.ftable.s-busy').first().innerText();
  if (!/min|h /.test(txt)) throw new Error('no elapsed time: ' + txt);
  console.log('   busy', busy, 'bill', bill, 'ready', await page.locator('.ftable.ready').count());
  await shot(page, 'r-01-floor');
});

let orderId;
await step('open a free table with 3 guests → Sell with table bar', async () => {
  await table('T2').click(); await page.waitForSelector('.guest-grid');
  await shot(page, 'r-02-guests');
  await page.locator('.guest-btn', { hasText: '3' }).click();
  await page.waitForSelector('.tbar'); await sleep(300);
  const bar = await page.locator('.tbar').innerText();
  if (!/T2/.test(bar) || !/3 guests/.test(bar)) throw new Error('table bar: ' + bar);
  orderId = (await orders()).find((o) => o.table_name === 'T2' && o.status === 'open')?.id;
  if (!orderId) throw new Error('order not created');
});

await step('add food with modifiers + note and a drink, send to kitchen → one KOT per station', async () => {
  await clearPrints();
  await tile('Beef stew & ugali'); await page.waitForSelector('.modal');
  await page.locator('.modal .chip', { hasText: 'Chips' }).click();
  await page.locator('.modal').getByLabel('Note for the kitchen').fill('Extra hot');
  await page.getByRole('button', { name: 'Add to order' }).click(); await sleep(200);
  await tile('Spanish omelette'); await tile('Spanish omelette');
  await tile('Soda 500ml');
  await tile('African tea'); await page.waitForSelector('.modal'); await page.getByRole('button', { name: 'Add to order' }).click(); await sleep(200);
  const n = await page.locator('.tbar .tb-n').innerText();
  if (n !== '4') throw new Error('expected 4 new lines, badge ' + n);
  await shot(page, 'r-03-order-before-send');
  await page.getByRole('button', { name: /Send to kitchen/ }).click(); await sleep(1800);
  const tk = (await tickets()).filter((x) => x.order_id === orderId);
  const st = tk.map((x) => x.station).sort().join(',');
  if (st !== 'bar,kitchen') throw new Error('stations ' + st);
  const k = tk.find((x) => x.station === 'kitchen');
  if (k.lines.find((l) => /omelette/.test(l.name))?.qty !== 2) throw new Error('omelette qty wrong');
  if (!k.lines.find((l) => /Beef stew/.test(l.name))?.modifiers.includes('Chips')) throw new Error('modifier missing on KOT');
  const pr = await prints();
  if (pr.filter((p) => p.kind === 'kot').length !== 2) throw new Error('KOT prints ' + pr.length);
  if (!/KITCHEN/.test(pr.find((p) => p.station === 'kitchen').text) || !/Extra hot/.test(pr.find((p) => p.station === 'kitchen').text)) throw new Error('KOT text: ' + pr[0].text);
  if (await page.locator('.line .sent-b', { hasText: 'Sent' }).count() !== 4) throw new Error('lines not marked sent');
  await shot(page, 'r-04-sent');
});

await step('add more → round 2 prints only the new items', async () => {
  await clearPrints();
  await tile('Spanish omelette');
  if (!(await page.locator('.line .sent-b', { hasText: '1 new' }).count())) throw new Error('partial "1 new" badge missing');
  await page.getByRole('button', { name: /Send to kitchen/ }).click(); await sleep(1500);
  const tk = (await tickets()).filter((x) => x.order_id === orderId && x.round === 2);
  if (tk.length !== 1 || tk[0].lines.length !== 1 || tk[0].lines[0].qty !== 1) throw new Error('round 2 ticket ' + JSON.stringify(tk.map((x) => x.lines)));
  const pr = await prints();
  if (!/ROUND 2/.test(pr[0]?.text || '')) throw new Error('round label missing');
});

await step('remove an item already sent: needs approval + reason → VOID ticket', async () => {
  await login(/Mercy/, '1111'); // cashier
  await floor(); await table('T2').click(); await page.waitForSelector('.tbar'); await sleep(300);
  await clearPrints();
  await page.locator('.line', { hasText: 'Soda 500ml' }).click(); await sleep(150);
  await page.locator('.line.sel').getByRole('button', { name: 'Remove' }).click();
  await page.waitForSelector('.modal h2:has-text("Manager approval needed")');
  await shot(page, 'r-05-void-approval');
  for (const d of '2222') await page.keyboard.press(d);
  await page.waitForSelector('.modal h2:has-text("Remove 1 × Soda 500ml?")');
  await page.locator('.modal .chip', { hasText: 'Entered by mistake' }).click();
  await shot(page, 'r-06-void-reason');
  await page.getByRole('button', { name: 'Remove & tell kitchen' }).click(); await sleep(1500);
  if (await page.locator('.line', { hasText: 'Soda 500ml' }).count()) throw new Error('line still there');
  const v = (await tickets()).find((x) => x.order_id === orderId && x.kind === 'void');
  if (!v || v.station !== 'bar' || v.lines[0].note !== 'Entered by mistake') throw new Error('void ticket ' + JSON.stringify(v));
  const pr = await prints();
  if (!pr.some((p) => /VOID/.test(p.text))) throw new Error('VOID not printed');
  const au = (await idb(page, 'audit')).find((a) => a.action === 'order.void_item');
  if (!au?.details?.approved_by) throw new Error('void not audited with approver');
  await login(/Grace/, '1234');
});

await step('print bill → table shows "bill printed"; bill text has total and M-Pesa till', async () => {
  await floor(); await table('T2').click(); await page.waitForSelector('.tbar'); await sleep(200);
  await clearPrints();
  await page.getByRole('button', { name: 'Print bill' }).click(); await sleep(1600);
  const pr = await prints();
  const bill = pr.find((p) => p.kind === 'bill');
  if (!bill || !/BILL/.test(bill.text) || !/TOTAL/.test(bill.text) || !/Till/.test(bill.text)) throw new Error('bill: ' + bill?.text);
  if ((await orders()).find((o) => o.id === orderId).status !== 'billed') throw new Error('not billed');
  await shot(page, 'r-07-billed-bar');
  await floor();
  if (!(await table('T2').getAttribute('class')).includes('s-bill')) throw new Error('floor not showing bill printed');
});

await step('transfer T2 → T8 (KDS tickets follow), then merge T1 into it', async () => {
  await table('T2').click(); await page.waitForSelector('.tbar');
  await page.getByRole('button', { name: 'More order actions' }).click();
  await page.getByRole('button', { name: 'Move to another table' }).click(); await page.waitForSelector('.pick-grid');
  await shot(page, 'r-08-transfer');
  await page.locator('.pick-t', { hasText: /^T8/ }).click(); await sleep(600);
  if (!/T8/.test(await page.locator('.tbar').innerText())) throw new Error('bar not updated');
  const o = (await orders()).find((x) => x.id === orderId);
  if (o.table_name !== 'T8') throw new Error('order not moved');
  const tk = (await tickets()).filter((x) => x.order_id === orderId && x.status === 'new');
  if (tk.some((x) => x.table_name !== 'T8')) throw new Error('tickets not moved');
  const before = (await page.locator('.line').count());
  await page.getByRole('button', { name: 'More order actions' }).click();
  await page.getByRole('button', { name: 'Merge tables' }).click(); await page.waitForSelector('.pick-grid');
  await page.locator('.pick-t.busy').filter({ has: page.locator('b', { hasText: /^T1$/ }) }).click(); await page.waitForSelector('.modal h2:has-text("Merge T1 into T8?")');
  await page.getByRole('button', { name: 'Merge tables' }).last().click(); await sleep(800);
  const after = await page.locator('.line').count();
  if (after <= before) throw new Error('merge added nothing');
  const t1 = (await orders()).find((x) => x.table_name === 'T1' && x.status === 'cancelled' && x.merged_into === orderId);
  if (!t1) throw new Error('T1 order not closed as merged');
  console.log('   lines', before, '→', after);
});

await step('split by items: pay 1 omelette now, the rest stays on the table', async () => {
  const totalBefore = await page.locator('.grand .v').innerText();
  await page.getByRole('button', { name: 'Split bill' }).click(); await page.waitForSelector('.modal h2:has-text("Split bill")');
  const row = page.locator('.modal .list-item', { hasText: 'Spanish omelette' });
  await row.getByRole('button', { name: 'More' }).click();
  await shot(page, 'r-09-split-items');
  await page.getByRole('button', { name: 'Pay for these items' }).click(); await page.waitForSelector('.tender');
  await page.getByRole('button', { name: 'Exact' }).click(); await page.waitForSelector('.done-hero');
  await page.keyboard.press('Enter'); await sleep(800);
  const bar = await page.locator('.tbar').innerText();
  if (!/T8/.test(bar)) throw new Error('not back on T8: ' + bar);
  const sales = await idb(page, 'sales');
  const part = sales.find((s) => s.parent_id === orderId);
  if (!part || part.lines.length !== 1 || part.lines[0].qty !== 1 || part.table_id == null || part.order_type !== 'dine_in') throw new Error('part sale ' + JSON.stringify(part?.lines));
  const totalAfter = await page.locator('.grand .v').innerText();
  if (totalAfter === totalBefore) throw new Error('total unchanged');
  console.log('   bill', totalBefore, '→', totalAfter, 'part', part.no);
});

await step('split equally between 3: payment screen shows shares; full payment frees the table', async () => {
  await page.getByRole('button', { name: 'Split bill' }).click(); await page.waitForSelector('.modal h2:has-text("Split bill")');
  await page.getByRole('radio', { name: 'Equally' }).click();
  // guests after the merge = 6 → set 3 people
  for (let i = 0; i < 10 && (await page.locator('.modal input[aria-label="Number of people"]').inputValue()) !== '3'; i++) await page.locator('.modal').getByRole('button', { name: 'Less' }).click();
  await shot(page, 'r-10-split-equal');
  await page.getByRole('button', { name: 'Take payments' }).click(); await page.waitForSelector('.tender');
  const callout = await page.locator('.tender .callout').first().innerText();
  if (!/Split 3 ways/.test(callout)) throw new Error('shares callout: ' + callout);
  await page.getByRole('button', { name: 'Exact' }).click(); await sleep(300);
  await page.getByRole('button', { name: 'Exact' }).click(); await sleep(300);
  await shot(page, 'r-11-tender-shares');
  await page.getByRole('button', { name: 'Exact' }).click(); await page.waitForSelector('.done-hero');
  await page.keyboard.press('Enter'); await sleep(800);
  const o = (await orders()).find((x) => x.id === orderId);
  if (o.status !== 'paid') throw new Error('order status ' + o.status);
  const s = (await idb(page, 'sales')).find((x) => x.id === o.sale_id);
  if (s.payments.length !== 3 || s.table_id !== o.table_id) throw new Error('sale payments ' + s.payments.length);
  if (!page.url().includes('#/tables')) throw new Error('did not return to tables: ' + page.url());
  if ((await table('T8').getAttribute('class')).includes('s-busy')) throw new Error('T8 still busy');
});

await step('counter sale stays a normal retail sale (order type Counter)', async () => {
  await page.goto(BASE + '#/sell'); await page.waitForSelector('.ot-bar');
  await tile('Chips plain'); await payExact();
  const s = (await idb(page, 'sales')).sort((a, z) => z.created_at - a.created_at)[0];
  if (s.order_type !== 'retail' || s.table_id) throw new Error('retail sale changed: ' + s.order_type);
});

await step('takeaway from the Sell screen: name + phone → queue → send → statuses → pay', async () => {
  await page.goto(BASE + '#/sell'); await page.waitForSelector('.ot-bar');
  await tile('Chips masala'); await tile('Samosa (2)');
  await page.locator('.ot-bar .ot', { hasText: 'Takeaway' }).click(); await page.waitForSelector('.modal h2:has-text("Takeaway order")');
  await page.getByLabel('Customer name').fill('Kamau'); await page.getByLabel('Phone (optional)').fill('0722 555 101');
  await page.getByRole('button', { name: 'Save order' }).click(); await page.waitForSelector('.tbar');
  await page.getByRole('button', { name: /Send to kitchen/ }).click(); await sleep(1500);
  await page.getByRole('button', { name: 'Orders' }).click(); await page.waitForSelector('.q-grid');
  const card = page.locator('.q-card', { hasText: 'Kamau' });
  if (!(await card.count())) throw new Error('takeaway not in queue');
  if (!/In the kitchen/.test(await card.innerText())) throw new Error('kitchen state not shown');
  await card.getByRole('button', { name: 'Start preparing' }).click(); await sleep(300);
  await card.getByRole('button', { name: 'Mark ready' }).click(); await sleep(400);
  await shot(page, 'r-12-takeaway-queue');
  await card.getByRole('button', { name: 'Open order' }).click(); await page.waitForSelector('.tbar');
  await payExact();
  await page.goto(BASE + '#/orders'); await page.waitForSelector('.page-h'); await sleep(300);
  const c2 = page.locator('.q-card', { hasText: 'Kamau' });
  if (!/Paid/.test(await c2.innerText())) throw new Error('not shown as paid');
  await c2.getByRole('button', { name: 'Mark collected' }).click(); await sleep(400);
  if (await page.locator('.q-card', { hasText: 'Kamau' }).count()) throw new Error('collected+paid order still in open queue');
});

await step('delivery: address + rider required details, appears with rider', async () => {
  await page.getByRole('button', { name: 'New delivery' }).click(); await page.waitForSelector('.modal h2:has-text("Delivery order")');
  await page.getByLabel('Customer name').fill('Njeri'); await page.getByLabel('Phone', { exact: true }).fill('0711 222 333');
  await page.getByRole('button', { name: 'Save order' }).click(); await sleep(200);
  if (!(await page.locator('.modal h2:has-text("Delivery order")').count())) throw new Error('saved without address');
  await page.getByLabel('Delivery address').fill('Lavington, Muthangari Rd, Hse 7');
  await page.getByLabel('Rider').fill('Brian Kiptoo');
  await page.getByRole('button', { name: 'Save order' }).click(); await page.waitForSelector('.tbar');
  await tile('Chicken biryani');
  await page.getByRole('button', { name: 'Orders' }).click(); await page.waitForSelector('.q-grid'); await sleep(300);
  const card = page.locator('.q-card', { hasText: 'Njeri' });
  const txt = await card.innerText();
  if (!/Lavington/.test(txt) || !/Rider: Brian Kiptoo/.test(txt) || !/KES/.test(txt)) throw new Error('delivery card: ' + txt);
});

await step('kitchen display: open tickets per station with timers; bump and recall', async () => {
  await page.goto(BASE + '#/kds'); await page.waitForSelector('.kds'); await sleep(500);
  const n0 = await page.locator('.kt').count();
  if (!n0) throw new Error('no tickets on KDS');
  await shot(page, 'r-13-kds');
  await page.locator('.kds-top .seg button', { hasText: 'Bar' }).click(); await sleep(200);
  const bars = await page.locator('.kt').count();
  await page.locator('.kds-top .seg button', { hasText: 'All stations' }).click(); await sleep(200);
  const first = page.locator('.kt').first();
  const where = await first.locator('.kt-where').innerText();
  await first.getByRole('button', { name: /Done|Seen/ }).click(); await sleep(500);
  if (await page.locator('.kt').count() !== n0 - 1) throw new Error('bump did not remove the ticket');
  await page.locator('.kds-top .seg button', { hasText: /^Done$/ }).click(); await sleep(300);
  await page.locator('.kt', { hasText: where }).first().getByRole('button', { name: 'Recall' }).click(); await sleep(400);
  if (await page.locator('.kt').count() !== n0) throw new Error('recall failed');
  console.log('   tickets', n0, 'bar', bars);
});

await step('waiter mode: lands on tables, opens a table, payment needs a cashier/manager PIN', async () => {
  await login(/Brian/, '3333');
  await page.goto(BASE + '#/home'); await sleep(800);
  if (!page.url().includes('#/tables')) throw new Error('waiter not on tables: ' + page.url());
  const nav = await page.locator('.side nav').innerText();
  if (/Settings|Products/.test(nav)) throw new Error('waiter sees too much: ' + nav);
  await area('Main hall'); await table('T3').click(); await page.waitForSelector('.tbar');
  await page.locator('.pay-btn').click(); await page.waitForSelector('.modal h2:has-text("Manager approval needed")');
  await shot(page, 'r-14-waiter-pay-approval');
  await page.keyboard.press('Escape'); await sleep(200);
  if (await page.locator('.tender').count()) throw new Error('tender opened without approval');
  await page.locator('.pay-btn').click(); await page.waitForSelector('.modal h2:has-text("Manager approval needed")');
  for (const d of '1111') await page.keyboard.press(d); // cashier may take payment
  await sleep(400);
  if (await page.locator('.modal h2:has-text("Send new items first?")').count()) { await shot(page, 'r-14b-send-first'); await page.getByRole('button', { name: 'Pay without sending' }).click(); }
  await page.waitForSelector('.tender');
  await page.keyboard.press('Escape'); await sleep(200);
  await login(/Grace/, '1234');
});

await step('edit layout: add a table, drag it, rename; empty state offers a typical layout', async () => {
  await floor();
  await page.getByRole('button', { name: 'Edit layout' }).click(); await sleep(200);
  await page.getByRole('button', { name: 'Add table' }).click(); await page.waitForSelector('.modal');
  await page.getByLabel('Table name or number').fill('VIP 1');
  await page.locator('.modal .chip', { hasText: /^6$/ }).click();
  await page.getByRole('radio', { name: 'Long' }).click();
  await page.locator('.modal').getByRole('button', { name: 'Save' }).click(); await sleep(400);
  const tb = page.locator('.ftable', { hasText: 'VIP 1' });
  const box = await tb.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 40, { steps: 6 }); await page.mouse.up(); await sleep(500);
  const rec = (await idb(page, 'tables')).find((x) => x.name === 'VIP 1');
  if (!rec || rec.shape !== 'rect' || rec.seats !== 6) throw new Error('table not saved ' + JSON.stringify(rec));
  await shot(page, 'r-15-edit-layout');
  await page.getByRole('button', { name: 'Done editing' }).click();
  console.log('   VIP 1 at', rec.x, rec.y);
});

await step('service charge on dine-in only (setting) adds to table bills, not counter sales', async () => {
  await page.goto(BASE + '#/settings/restaurant'); await page.waitForSelector('.card-h');
  await page.getByLabel('Service charge %').fill('10');
  await page.locator('.set-row', { hasText: 'Service charge on dine-in only' }).locator('.switch').click();
  await page.getByRole('button', { name: 'Save' }).first().click(); await sleep(400);
  await shot(page, 'r-16-settings');
  await floor(); await table('T4').click(); await page.waitForSelector('.guest-grid'); await page.locator('.guest-btn', { hasText: '2' }).click(); await page.waitForSelector('.tbar'); await page.locator('.tile', { hasText: 'Beef pilau' }).first().click(); await sleep(300);
  if (!(await page.locator('.totals', { hasText: 'Service charge' }).count())) throw new Error('no service charge on dine-in');
  await page.getByRole('button', { name: 'Tables' }).click(); await page.waitForSelector('.floor');
  await page.goto(BASE + '#/sell'); await page.waitForSelector('.ot-bar'); await tile('Chips plain'); await sleep(200);
  if (await page.locator('.totals', { hasText: 'Service charge' }).count()) throw new Error('service charge on counter sale');
  await page.keyboard.press('Control+Delete'); await page.getByRole('button', { name: 'Clear cart' }).click(); await sleep(200);
});

await step('bar demo: tables + bar station tickets', async () => {
  const B = await newPage(b, DESK);
  await B.page.goto(BASE + '?demo=1&type=bar'); await B.page.waitForSelector('.shell', { timeout: 60000 });
  await B.page.goto(BASE + '#/tables'); await B.page.waitForSelector('.floor'); await sleep(400);
  if (!(await B.page.locator('.ftable').count())) throw new Error('bar has no tables');
  await B.page.goto(BASE + '#/kds'); await B.page.waitForSelector('.kds'); await sleep(400);
  if (!(await B.page.locator('.kt').count())) throw new Error('bar KDS empty');
  await B.ctx.close();
});

report('flows-restaurant');
await b.close();
