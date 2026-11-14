// Quotes & invoices (demo "hardware" + "wholesale"): seeded quotes/invoices, create quote (customer, lines, price, discount,
// validity) → A4 print / WhatsApp (status sent) → convert to invoice (credit sale, due date, bank + M-Pesa on A4) →
// receive part payment → status, delivery note, convert another quote to a cash sale, credit-limit approval, settings.
import { chromium, newPage, BASE, shot, sleep, report, DESK, idb, step, setFailPage } from './lib.mjs';
const b = await chromium.launch();
const { page, ctx } = await newPage(b, DESK);
setFailPage(page);
const frameText = async () => { const f = page.frameLocator('iframe[title="Print preview"]'); await sleep(400); return f.locator('body').textContent(); };
const closePreview = async () => { await page.keyboard.press('Escape'); await sleep(250); };
await page.goto(BASE + '?demo=1&type=hardware'); await page.waitForSelector('.shell', { timeout: 60000 });

await step('seeded quotes in every state and invoices with balances', async () => {
  await page.goto(BASE + '#/quotes'); await page.waitForSelector('.vt-row'); await sleep(400);
  const txt = await page.locator('.vt').innerText();
  for (const s of ['Draft', 'Sent', 'Accepted', 'Expired', 'Invoiced', 'Declined']) if (!txt.includes(s)) throw new Error('missing status ' + s);
  await shot(page, 'q-01-quotes');
  await page.getByRole('tab', { name: /Invoices/ }).click(); await sleep(400);
  const it = await page.locator('.vt').innerText();
  if (!/Part paid|Unpaid|Overdue/.test(it)) throw new Error('invoice statuses: ' + it.slice(0, 200));
  await shot(page, 'q-02-invoices');
});

let quoteId;
await step('new quote: customer, items by search, qty, price change, discount, validity → saved as draft', async () => {
  await page.goto(BASE + '#/quotes/new'); await page.waitForSelector('.qe-add');
  await page.getByRole('button', { name: 'Choose customer' }).click(); await page.waitForSelector('.modal');
  await page.getByPlaceholder('Phone number or name').fill('Baraka'); await sleep(200);
  await page.locator('.modal .list-item', { hasText: 'Baraka Builders' }).click(); await sleep(200);
  const add = page.getByLabel('Add item');
  await add.fill('cement'); await sleep(250); await add.press('Enter'); await sleep(150);
  await add.fill('iron sheet'); await sleep(250); await add.press('Enter'); await sleep(150);
  await add.fill('nails'); await sleep(250); await add.press('Enter'); await sleep(200);
  const n = await page.locator('.ql:not(.ql-h)').count();
  if (n !== 3) throw new Error('lines ' + n);
  const q1 = page.locator('.ql:not(.ql-h)').first();
  await q1.locator('input').nth(0).fill('40'); await q1.locator('input').nth(0).press('Tab'); await sleep(150);
  const price = page.locator('.ql:not(.ql-h)').nth(1).locator('input').nth(1);
  const p0 = await price.inputValue();
  await price.fill(String(Math.round(+p0 * 0.95))); await price.press('Tab'); await sleep(150);
  await page.locator('.ql:not(.ql-h)').nth(2).locator('input').nth(2).fill('50'); await page.locator('.ql:not(.ql-h)').nth(2).locator('input').nth(2).press('Tab');
  await page.locator('.chip', { hasText: '30 days' }).click();
  await page.getByLabel('Notes for the customer').fill('Delivery to Ruiru site included.');
  await shot(page, 'q-03-editor');
  await page.getByRole('button', { name: 'Save quote' }).click(); await sleep(600);
  const qs = (await idb(page, 'quotes')).sort((a, z) => z.created_at - a.created_at);
  const q = qs[0];
  if (q.status !== 'draft' || q.lines.length !== 3 || q.lines[0].qty !== 40 || !q.lines[1].price_edited || q.lines[2].discount !== 5000 || !/^Q-/.test(q.no)) throw new Error('quote saved wrong ' + JSON.stringify({ s: q.status, n: q.lines.length, q: q.lines[0].qty, d: q.lines[2].discount }));
  quoteId = q.id;
  if (!page.url().includes(quoteId)) throw new Error('url not updated');
  console.log('   ', q.no, q.total / 100);
});

await step('print A4 quotation; WhatsApp marks it sent', async () => {
  await page.getByRole('button', { name: 'Print' }).click(); await page.waitForSelector('iframe[title="Print preview"]');
  const txt = await frameText();
  if (!/QUOTATION/.test(txt) || !/Baraka Builders/.test(txt) || !/Valid until/.test(txt)) throw new Error('quote A4: ' + txt.slice(0, 300));
  await shot(page, 'q-04-quote-a4');
  await closePreview();
  await page.evaluate(() => { window.open = (u) => { window.__lastOpen = u; return null; }; });
  await page.getByRole('button', { name: 'WhatsApp' }).click(); await sleep(500);
  const url = await page.evaluate(() => window.__lastOpen || '');
  if (!/wa\.me\/254735418207\?text=.*QUOTATION/.test(decodeURIComponent(url))) throw new Error('wa link ' + url.slice(0, 120));
  if ((await idb(page, 'quotes')).find((x) => x.id === quoteId).status !== 'sent') throw new Error('not marked sent');
});

let invoice;
await step('convert to invoice → credit sale with due date; A4 invoice shows M-Pesa + bank + balance', async () => {
  await page.getByRole('button', { name: 'Convert to invoice' }).click(); await page.waitForSelector('.modal h2:has-text("Create invoice for")');
  await page.locator('.modal').getByRole('button', { name: 'Create invoice' }).click();
  await page.waitForSelector('iframe[title="Print preview"]');
  const txt = await frameText();
  if (!/INVOICE/.test(txt) || !/Due date/.test(txt) || !/Bank transfer/.test(txt) || !/Pay by M-Pesa/.test(txt) || !/Balance due/.test(txt)) throw new Error('invoice A4: ' + txt.slice(0, 400));
  await shot(page, 'q-05-invoice-a4');
  await closePreview();
  const q = (await idb(page, 'quotes')).find((x) => x.id === quoteId);
  invoice = (await idb(page, 'sales')).find((s) => s.id === q.invoice_sale_id);
  if (q.status !== 'invoiced' || !invoice || invoice.balance !== invoice.total || invoice.doc_type !== 'invoice' || !invoice.due_date || invoice.quote_id !== quoteId) throw new Error('invoice sale wrong');
  const moves = (await idb(page, 'stock_moves')).filter((m) => m.ref_id === invoice.id);
  if (!moves.length) throw new Error('stock not taken out');
  if (!(await page.locator('.callout.ok', { hasText: 'turned into invoice' }).count())) throw new Error('locked banner missing');
});

await step('invoices: receive payment (oldest first) → paid; delivery note', async () => {
  await page.goto(BASE + '#/quotes?tab=invoices'); await page.waitForSelector('.vt-row'); await sleep(300);
  await page.locator('.vt-row', { hasText: invoice.no }).click(); await page.waitForSelector('.modal');
  await shot(page, 'q-06-invoice-actions');
  await page.getByRole('button', { name: 'Receive payment' }).click(); await page.waitForSelector('.modal h2:has-text("Receive payment")');
  // payments are applied oldest invoice first (customer account) — receive the whole balance so this invoice clears
  await page.getByLabel('M-Pesa code').fill('TK7AB3CD9E');
  await page.getByRole('button', { name: /^Record/ }).click(); await sleep(800);
  const row = await page.locator('.vt-row', { hasText: invoice.no }).textContent();
  if (!/Paid/.test(row)) throw new Error('status after payment: ' + row);
  await page.locator('.vt-row', { hasText: invoice.no }).click(); await page.waitForSelector('.modal');
  await page.getByRole('button', { name: 'Delivery note' }).click(); await page.waitForSelector('iframe[title="Print preview"]');
  const txt = await frameText();
  if (!/DELIVERY NOTE/.test(txt) || !/Received in good order/.test(txt) || /Unit price/.test(txt)) throw new Error('delivery note: ' + txt.slice(0, 300));
  await shot(page, 'q-07-delivery-note');
  await closePreview();
});

await step('convert a quote to a cash sale: cart gets the lines + customer; quote marked sold', async () => {
  const q = (await idb(page, 'quotes')).find((x) => x.status === 'accepted');
  await page.goto(BASE + '#/quotes/' + q.id); await page.waitForSelector('.qe'); await sleep(300);
  await page.getByRole('button', { name: /Convert to sale/ }).click(); await page.waitForSelector('.cart .line'); await sleep(300);
  if (await page.locator('.cart .line').count() !== q.lines.length) throw new Error('cart lines');
  if (!(await page.locator('.cust-btn.has').count())) throw new Error('customer not attached');
  await page.locator('.pay-btn').click(); await page.waitForSelector('.tender');
  await page.getByRole('button', { name: 'Exact' }).click(); await page.waitForSelector('.done-hero');
  await page.keyboard.press('Enter'); await sleep(600);
  const q2 = (await idb(page, 'quotes')).find((x) => x.id === q.id);
  if (q2.status !== 'sold' || !q2.sale_id) throw new Error('quote status ' + q2.status);
});

await step('credit limit: invoicing above the customer limit asks for manager approval', async () => {
  // a cashier invoicing a big quote for a retail customer with a small limit
  await page.keyboard.press('Control+l'); await page.waitForSelector('.lock');
  await page.getByRole('option', { name: /Mercy/ }).click(); for (const d of '1111') await page.keyboard.press(d); await page.waitForSelector('.shell');
  await page.goto(BASE + '#/quotes/new?invoice=1'); await page.waitForSelector('.qe-add');
  await page.getByRole('button', { name: 'Choose customer' }).click(); await page.waitForSelector('.modal');
  await page.getByPlaceholder('Phone number or name').fill('Otieno'); await sleep(200);
  await page.locator('.modal .list-item', { hasText: 'Otieno' }).click(); await sleep(200);
  const add = page.getByLabel('Add item');
  await add.fill('cement'); await sleep(250); await add.press('Enter'); await sleep(150);
  const q1 = page.locator('.ql:not(.ql-h)').first();
  await q1.locator('input').nth(0).fill('200'); await q1.locator('input').nth(0).press('Tab'); await sleep(150);
  await page.locator('.qe-tot').getByRole('button', { name: 'Create invoice' }).click();
  await page.waitForSelector('.modal h2:has-text("Manager approval needed")');
  await shot(page, 'q-08-credit-limit');
  await page.keyboard.press('Escape'); await sleep(300);
  const q = (await idb(page, 'quotes')).sort((a, z) => z.created_at - a.created_at)[0];
  if (q.status === 'invoiced') throw new Error('invoiced without approval');
  await page.keyboard.press('Control+l'); await page.waitForSelector('.lock');
  await page.getByRole('option', { name: /Grace/ }).click(); for (const d of '1234') await page.keyboard.press(d); await page.waitForSelector('.shell');
});

await step('settings: payment terms + bank details appear on invoices', async () => {
  await page.goto(BASE + '#/settings/quotes'); await page.waitForSelector('.card-h');
  await page.getByLabel('Invoice payment terms (days)').fill('14');
  await page.getByLabel('Bank details for invoices').fill('KCB Bank · Acc 1122334455 · Jenga Hardware');
  await page.getByRole('button', { name: 'Save' }).click(); await sleep(400);
  await shot(page, 'q-09-settings');
  await page.goto(BASE + '#/quotes?tab=invoices'); await page.waitForSelector('.vt-row'); await sleep(300);
  await page.locator('.vt-row', { hasText: /Unpaid|Overdue|Part paid/ }).first().click(); await page.waitForSelector('.modal');
  await page.getByRole('button', { name: 'Print invoice (A4)' }).click(); await page.waitForSelector('iframe[title="Print preview"]');
  if (!/KCB Bank/.test(await frameText())) throw new Error('bank details not on invoice');
  await closePreview();
});

await step('wholesale demo: quotes module on, quotes seeded', async () => {
  const W = await newPage(b, DESK);
  await W.page.goto(BASE + '?demo=1&type=wholesale'); await W.page.waitForSelector('.shell', { timeout: 60000 });
  await W.page.goto(BASE + '#/quotes'); await W.page.waitForSelector('.vt-row'); await sleep(300);
  if (await W.page.locator('.vt-row').count() < 5) throw new Error('wholesale quotes missing');
  await W.ctx.close();
});

report('flows-quotes');
await b.close();
