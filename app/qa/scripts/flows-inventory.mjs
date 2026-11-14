// Inventory & Purchasing flows (Phase 2): stock on hand, ledger, adjustments with manager approval, blind stock take,
// transfers with a discrepancy, repack, reorder → PO → print / WhatsApp → receive against the PO (partial, extra costs,
// moving-average cost, labels), cartons, supplier add / pay / statement / return, batches & expiry (pharmacy),
// serial / IMEI (electronics), offline, and sync of the new records to the cloud.
// Run: node qa/scripts/flows-inventory.mjs   (needs `vite preview` and the mock cloud; BASE / CLOUD env as in lib.mjs)
import { chromium, newPage, BASE, shot, sleep, scan, report, DESK, idb, step, setFailPage } from './lib.mjs';
const CLOUD = process.env.CLOUD || 'http://127.0.0.1:8787';
const API = CLOUD + '/wp-json/pentarch-pos/v1';
const b = await chromium.launch();
let { ctx, page } = await newPage(b, DESK);
setFailPage(page);
const go = async (hash, sel = '.page') => { if (page.url().endsWith('#' + hash)) { await page.goto(BASE + '#/home'); await sleep(200); } await page.goto(BASE + '#' + hash); await page.waitForSelector(sel, { timeout: 15000 }); await sleep(350); };
const unlock = async (who, pin) => { await page.getByRole('option', { name: who }).click(); for (const d of pin) await page.keyboard.press(d); await page.waitForSelector('.shell'); await sleep(300); };
const as = async (who, pin) => { await page.keyboard.press('Control+l'); await page.waitForSelector('.lock'); await unlock(who, pin); };
const managerPin = async (pin = '2222') => { await page.waitForSelector('text=Manager approval needed'); for (const d of pin) await page.keyboard.press(d); await sleep(400); };
const confirmYes = async (name) => { await page.locator('.modal').getByRole('button', { name }).click(); await sleep(500); };
const level = async (pid, bid) => (await idb(page, 'stock_levels')).find((l) => l.product_id === pid && (!bid || l.branch_id === bid))?.qty || 0;
const fail = (m) => { throw new Error(m); };

await ctx.route(/wa\.me/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>WhatsApp</p>' }));
await page.goto(BASE + '?demo=1&type=wholesale');
await page.waitForSelector('.shell', { timeout: 30000 });
const P = await idb(page, 'products');
const BR = await idb(page, 'branches');
const main = BR.find((x) => x.is_main), other = BR.find((x) => !x.is_main);
const byName = (re) => P.find((p) => re.test(p.name));

await step('demo seeds deliveries, orders, payments, adjustments, a count and transfers', async () => {
  const [g, po, sp, sc, tr] = await Promise.all(['goods_received', 'purchase_orders', 'supplier_payments', 'stock_counts', 'transfers'].map((x) => idb(page, x)));
  console.log(`   GRNs ${g.filter((x) => x.kind === 'receipt').length}, returns ${g.filter((x) => x.kind === 'return').length}, POs ${po.length} (${po.map((x) => x.status).join('/')}), payments ${sp.length}, counts ${sc.length}, transfers ${tr.length}`);
  if (g.length < 4 || po.length < 2 || !sc.length || tr.length < 2) fail('demo data missing');
  // ONE source of demo deliveries (seed-stock.js): every GRN/return has a document number of the Purchasing format
  const bad = g.filter((x) => !/^(GRN|SR)-[A-Z0-9]+-\d{4}$/.test(x.no || ''));
  if (bad.length) fail('deliveries from another seeder: ' + bad.map((x) => x.no).join(', '));
  // every purchase move belongs to a delivery, every delivery line to a move; stock on hand = Σ ledger
  const [mv, lv] = await Promise.all([idb(page, 'stock_moves'), idb(page, 'stock_levels')]);
  const gids = new Set(g.map((x) => x.id));
  const orphan = mv.filter((m) => m.type === 'purchase' && !gids.has(m.ref_id));
  if (orphan.length) fail(orphan.length + ' purchase moves without a delivery');
  const sum = new Map();
  for (const m of mv) if (!m.deleted) sum.set(m.product_id + '|' + m.branch_id, (sum.get(m.product_id + '|' + m.branch_id) || 0) + m.qty);
  const off = lv.filter((l) => Math.abs((sum.get(l.product_id + '|' + l.branch_id) || 0) - l.qty) > 1e-6);
  if (off.length) fail(off.length + ' stock levels differ from the ledger');
  const owed = g.reduce((a, x) => a + x.total, 0) - sp.reduce((a, x) => a + x.amount, 0);
  console.log(`   ledger = stock on hand for ${lv.length} product/branch rows; suppliers owed KES ${(owed / 100).toLocaleString('en-KE')}`);
  if (owed <= 0) fail('demo suppliers should be owed something');
});

await step('stock on hand: value at cost & retail, low-stock filter, search, CSV export, scan opens the history', async () => {
  await go('/inventory', '.vt-row');
  await shot(page, '60-stock-on-hand');
  const v = await page.locator('.inv-stats').innerText();
  if (!/Value at cost/.test(v) || !/Value at selling price/.test(v)) fail('values missing');
  await page.getByRole('button', { name: 'Low stock', exact: true }).first().click(); await sleep(200);
  const low = await page.locator('.vt-row').count();
  await page.getByRole('button', { name: 'All items' }).click();
  await page.getByPlaceholder('Search name, SKU or barcode (or scan)').fill('maize'); await sleep(200);
  const n = await page.locator('.vt-row').count();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export' }).click()]);
  if (!/^stock-.*\.csv$/.test(dl.suggestedFilename())) fail('csv ' + dl.suggestedFilename());
  await page.getByPlaceholder('Search name, SKU or barcode (or scan)').fill('');
  await page.locator('h1').click();
  const flour = byName(/Maize Flour/);
  await scan(page, flour.barcode); await page.waitForSelector('text=Stock history'); await sleep(400);
  await shot(page, '61-stock-history');
  const rows = await page.locator('.vt-row').count();
  const txt = await page.locator('.vt').innerText();
  if (!/Sale/.test(txt) || !/BEFORE|Before/.test(txt)) fail('ledger');
  console.log(`   low stock rows ${low}, search "maize" ${n}, ledger rows ${rows}, csv ${dl.suggestedFilename()}`);
});

await step('adjust stock: damaged (scan in the dialog) — move + audit', async () => {
  await go('/inventory', '.vt-row');
  const p = byName(/Omo 1kg|Omo/) || P.find((x) => x.track_stock);
  const before = await level(p.id, main.id);
  await page.getByRole('button', { name: /Adjust stock/ }).first().click(); await page.waitForSelector('.modal');
  await scan(page, p.barcode); await sleep(300);
  await page.getByRole('radio', { name: 'Damaged' }).click();
  await page.getByLabel('Quantity', { exact: true }).fill('2');
  await page.getByLabel('Note (optional)').fill('Water damage');
  await shot(page, '62-adjust-dialog');
  await page.locator('.modal-f .btn.primary').click(); await sleep(600);
  const after = await level(p.id, main.id);
  const mv = (await idb(page, 'stock_moves')).filter((m) => m.type === 'adjust' && m.product_id === p.id).pop();
  const au = (await idb(page, 'audit')).filter((a) => a.action === 'stock.adjust').pop();
  if (Math.abs(after - (before - 2)) > 1e-6 || mv.reason !== 'damaged' || mv.note !== 'Water damage' || au.details.reason !== 'damaged') fail(`adjust ${before}→${after} ${mv?.reason}`);
  console.log(`   ${p.name}: ${before} → ${after}, audited with user`);
});

await step('stock clerk: a big adjustment needs a manager PIN (approved_by recorded)', async () => {
  await as(/Samuel/, '4444');
  await go('/inventory/adjustments');
  const bag = byName(/50kg bag/);
  await scan(page, bag.barcode); await page.waitForSelector('.modal'); await sleep(300);
  await page.getByRole('radio', { name: 'Theft / loss' }).click();
  if (!(await page.getByText('a manager will be asked to approve it').count())) fail('no approval warning');
  await page.locator('.modal-f .btn.primary').click();
  await managerPin('2222'); await sleep(600);
  const au = (await idb(page, 'audit')).filter((a) => a.action === 'stock.adjust').pop();
  if (au.details.approved_by !== 'Peter Ouma') fail('approved_by ' + au.details.approved_by);
  await shot(page, '63-adjustments');
  console.log('   approved by', au.details.approved_by, 'value', au.details.value);
});

let countId;
await step('blind stock take by the stock clerk: scan to count, type a number, manager unlocks differences, apply', async () => {
  await go('/inventory/counts?new=1', '.modal');
  await page.locator('.modal').getByRole('radio', { name: /Some categories/ }).click();
  const cat = (await idb(page, 'categories'))[0];
  await page.locator('.modal .chip', { hasText: cat.name }).click();
  const blindOn = await page.locator('.modal input[type=checkbox]').isChecked();
  if (!blindOn) await page.locator('.modal .switch').click();
  await page.locator('.modal').getByRole('button', { name: 'Start counting' }).click();
  await page.waitForSelector('.count-scan'); await sleep(300);
  if (await page.getByRole('columnheader', { name: 'System' }).count()) fail('blind count shows system qty');
  const inCat = P.filter((p) => p.category_id === cat.id && p.track_stock && p.barcode);
  const a = inCat[0], c = inCat[1];
  for (let i = 0; i < 3; i++) await scan(page, a.barcode);
  await scan(page, c.barcode);
  await page.getByLabel('Counted quantity', { exact: true }).fill('7'); await sleep(900);
  await shot(page, '64-count-scan');
  const rec = (await idb(page, 'stock_counts')).find((x) => x.status === 'open');
  countId = rec.id;
  const la = rec.lines.find((l) => l.product_id === a.id)?.counted, lc = rec.lines.find((l) => l.product_id === c.id)?.counted;
  if (la !== 3 || lc !== 7) fail(`autosave ${la}/${lc}`);
  await page.getByRole('button', { name: 'Print count sheet' }).click(); await page.waitForSelector('iframe[title="Print preview"]'); await page.keyboard.press('Escape'); await sleep(200);
  await page.getByRole('button', { name: 'Check differences' }).click();
  await managerPin('2222');
  await page.waitForSelector('text=Items with a difference'); await sleep(300);
  if (await page.getByText('Net difference').count()) fail('stock clerk sees KES values');
  await shot(page, '65-count-review');
  await page.getByRole('button', { name: 'Update stock' }).click(); await sleep(300);
  if (await page.getByText('Manager approval needed').count()) await managerPin('2222');
  await confirmYes('Yes, update stock'); await page.waitForSelector('text=Stock updated');
  const done = (await idb(page, 'stock_counts')).find((x) => x.id === countId);
  const mvs = (await idb(page, 'stock_moves')).filter((m) => m.ref_id === countId && m.type === 'count');
  if (done.status !== 'applied' || (await level(a.id, main.id)) !== 3 || (await level(c.id, main.id)) !== 7) fail('count not applied');
  console.log(`   applied: ${mvs.length} count moves, net ${done.gain + done.loss} cents; uncounted items left as they were`);
  await shot(page, '66-count-applied');
});
await step('back to the owner', async () => { await as(/Grace/, '1234'); });

await step('transfer: send to the other branch, receive there with a shortage (lost in transit)', async () => {
  await go('/inventory/transfers/new');
  const x1 = byName(/Maize Flour/), x2 = P.filter((p) => p.track_stock && p.barcode && !p.track_batches)[5];
  const s1 = await level(x1.id, main.id), o1 = await level(x1.id, other.id);
  await scan(page, x1.barcode); await scan(page, x1.barcode); await scan(page, x2.barcode);
  await page.getByLabel('Quantity of ' + x1.name).fill('10');
  await shot(page, '67-transfer-new');
  await page.getByRole('button', { name: 'Send stock' }).click(); await confirmYes('Yes, send');
  await page.waitForSelector('text=Stock sent to');
  if ((await level(x1.id, main.id)) !== s1 - 10) fail('not sent');
  await page.getByRole('button', { name: 'View transfer' }).click(); await page.waitForSelector('text=On the way');
  await page.getByRole('button', { name: /Receive for/ }).click();
  await page.getByLabel('Received quantity of ' + x1.name).fill('9');
  await shot(page, '68-transfer-receive');
  await page.getByRole('button', { name: /Receive with 1 differences/ }).click(); await confirmYes('Yes, receive'); await sleep(400);
  const tr = (await idb(page, 'transfers')).sort((a, z) => z.created_at - a.created_at)[0];
  if (tr.status !== 'received' || !tr.discrepancy || tr.short !== 1 || (await level(x1.id, other.id)) !== o1 + 9) fail('receive ' + JSON.stringify({ s: tr.status, d: tr.discrepancy, short: tr.short }));
  const au = (await idb(page, 'audit')).filter((a) => a.action === 'transfer.discrepancy').length;
  console.log(`   ${tr.no}: sent 10, received 9 → short 1 recorded, audit transfer.discrepancy ×${au}`);
});

await step('transfer: incoming delivery from the branch is received in full', async () => {
  await go('/inventory/transfers');
  await page.getByRole('button', { name: 'Receive now' }).click(); await page.waitForSelector('text=Count what arrived');
  await page.getByRole('button', { name: 'Receive all' }).click(); await confirmYes('Yes, receive');
  const pend = (await idb(page, 'transfers')).filter((t) => t.status === 'sent').length;
  if (pend) fail('still pending');
  await go('/inventory/transfers'); await shot(page, '69-transfers');
});

await step('repack: one 50 kg bag of sugar → 50 × 1 kg (remembered pairing, cost carried over)', async () => {
  await go('/inventory/repack');
  const bag = byName(/Sugar 50kg bag/), kg = byName(/Kabras Sugar 1kg/);
  const b0 = await level(bag.id, main.id), k0 = await level(kg.id, main.id);
  await page.getByPlaceholder('Scan or type the item').first().fill('Mumias Sugar 50kg'); await page.keyboard.press('Enter'); await sleep(400);
  if ((await page.getByLabel('Quantity packed').inputValue()) !== '50') fail('yield not suggested');
  await shot(page, '70-repack');
  await page.getByRole('button', { name: 'Repack', exact: true }).click(); await confirmYes('Yes, repack'); await page.waitForSelector('text=Repacked');
  if ((await level(bag.id, main.id)) !== b0 - 1 || (await level(kg.id, main.id)) !== k0 + 50) fail('levels');
  const mv = (await idb(page, 'stock_moves')).filter((m) => m.type === 'repack_in').pop();
  console.log(`   bag ${b0}→${b0 - 1}, 1 kg ${k0}→${k0 + 50}, cost per kg KES ${mv.cost / 100}`);
});

let poId;
await step('reorder suggestions → purchase orders per supplier', async () => {
  const before = (await idb(page, 'purchase_orders')).length;
  await go('/inventory/reorder', '.vt-row');
  await shot(page, '71-reorder');
  await page.getByRole('button', { name: /Create (\d+ )?purchase orders?/ }).click(); await page.waitForURL(/purchasing\/orders/); await sleep(500);
  const pos = await idb(page, 'purchase_orders');
  if (pos.length <= before) fail('no PO');
  poId = pos.filter((p) => p.status === 'draft').sort((a, z) => z.created_at - a.created_at)[0].id;
  console.log(`   ${pos.length - before} new draft order(s)`);
});

await step('purchase order: print A4, send on WhatsApp (status → sent)', async () => {
  await go('/purchasing/orders/' + poId);
  await shot(page, '72-po');
  await page.getByRole('button', { name: 'Print / PDF' }).click(); await page.waitForSelector('iframe[title="Print preview"]'); await sleep(400);
  const html = await page.locator('iframe[title="Print preview"]').getAttribute('srcdoc');
  if (!/PURCHASE ORDER/.test(html)) fail('po print');
  await page.keyboard.press('Escape'); await sleep(200);
  const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 5000 }), page.locator('.sum-card').getByRole('button', { name: 'Send on WhatsApp' }).click()]);
  const url = pop.url(); await pop.close();
  if (!/wa\.me\/254/.test(url) || !/PO-/.test(decodeURIComponent(url))) fail('wa ' + url.slice(0, 80));
  await sleep(400);
  if ((await idb(page, 'purchase_orders')).find((p) => p.id === poId).status !== 'sent') fail('not sent');
  console.log('   WhatsApp link', url.slice(0, 60) + '…');
});

await step('receive against the order: partial quantity, invoice no., transport cost, part payment → PO partial, moving-average cost, labels', async () => {
  const po = (await idb(page, 'purchase_orders')).find((p) => p.id === poId);
  const l0 = po.lines[0];
  const p0 = P.find((p) => p.id === l0.product_id);
  const cost0 = (await idb(page, 'products')).find((p) => p.id === p0.id).cost;
  await go('/purchasing/orders/' + poId);
  await page.getByRole('button', { name: 'Receive goods' }).click(); await page.waitForSelector('.le-row:not(.head)'); await sleep(400);
  await page.getByLabel('Quantity of ' + p0.name).fill(String(Math.max(1, Math.floor(l0.qty / 2))));
  await page.getByLabel('Supplier invoice / delivery note no.').fill('INV-77812');
  await page.getByRole('button', { name: /More options/ }).click();
  await page.getByLabel('Extra cost name').fill('Transport'); await page.getByLabel('Extra cost amount').fill('500');
  await page.getByLabel('Paid now').fill('1000');
  await shot(page, '73-receive-po', true);
  await page.locator('.sum-card').getByRole('button', { name: 'Receive stock' }).click(); await confirmYes('Yes, receive');
  await page.waitForSelector('text=Stock received');
  await shot(page, '74-received');
  const g = (await idb(page, 'goods_received')).sort((a, z) => z.created_at - a.created_at)[0];
  const po2 = (await idb(page, 'purchase_orders')).find((p) => p.id === poId);
  const cost1 = (await idb(page, 'products')).find((p) => p.id === p0.id).cost;
  const pay = (await idb(page, 'supplier_payments')).sort((a, z) => z.created_at - a.created_at)[0];
  if (g.po_id !== poId || g.supplier_invoice_no !== 'INV-77812' || po2.status !== 'partial' || !(cost1 > cost0) || pay.amount !== 100000 || pay.allocations[0].grn_id !== g.id) fail(JSON.stringify({ po: po2.status, cost0, cost1, pay: pay.amount }));
  console.log(`   ${g.no}: total ${g.total / 100} incl. transport 500; PO → partial; ${p0.name} cost ${cost0 / 100} → ${cost1 / 100}; paid 1,000 on delivery`);
  await page.getByRole('button', { name: 'Print price labels' }).click(); await page.waitForSelector('iframe[title="Label preview"]'); await sleep(600);
  const btn = await page.getByRole('button', { name: /Print \d+ labels/ }).innerText();
  console.log('   labels page:', btn.trim());
  await shot(page, '75-labels-after-receive');
});

await step('receive without an order: scan a carton (bale of 20) → 40 pieces in stock', async () => {
  const kg = byName(/Kabras Sugar 1kg/);
  const bale = kg.units_of_measure[0];
  const k0 = await level(kg.id, main.id);
  await go('/purchasing/receive');
  const sup = (await idb(page, 'suppliers'))[1];
  await page.getByLabel('Supplier', { exact: true }).selectOption(sup.id);
  await scan(page, bale.barcode); await scan(page, bale.barcode); await sleep(200);
  if (!(await page.getByText('20 per Bale (20)').count())) fail('carton not recognised');
  await page.locator('.sum-card').getByRole('button', { name: 'Receive stock' }).click(); await confirmYes('Yes, receive'); await page.waitForSelector('text=Stock received');
  if ((await level(kg.id, main.id)) !== k0 + 40) fail('qty ' + (await level(kg.id, main.id)));
  console.log(`   ${kg.name}: +40 (2 × ${bale.name})`);
});

await step('suppliers: add one, pay the oldest deliveries, statement, balances', async () => {
  await go('/purchasing/suppliers?new=1', '.modal');
  await page.getByLabel('Supplier name', { exact: true }).fill('Kamau Distributors');
  await page.getByLabel('Phone (WhatsApp)').fill('0722 909 101');
  await page.locator('.modal').getByRole('radio', { name: '30 days' }).click();
  await shot(page, '76-supplier-add');
  await page.getByRole('button', { name: 'Save supplier' }).click(); await page.waitForSelector('text=Kamau Distributors'); await sleep(300);
  const s = (await idb(page, 'suppliers')).find((x) => x.name === 'Kamau Distributors');
  if (s.phone !== '254722909101' || s.terms_days !== 30) fail('supplier');
  await go('/purchasing/suppliers', '.vt-row');
  await shot(page, '77-suppliers');
  const owing = (await idb(page, 'suppliers')).find((x) => x.name === 'Bidco Africa');
  await go('/purchasing/suppliers/' + owing.id, '.stat');
  const pays0 = (await idb(page, 'supplier_payments')).length;
  await page.getByRole('button', { name: 'Pay supplier' }).click(); await page.waitForSelector('text=Unpaid deliveries');
  await page.getByLabel('Amount').fill('5000');
  await page.getByLabel('M-Pesa code').fill('TKX4R2P9QA');
  await page.locator('.modal-f .btn.primary').click(); await sleep(600);
  const pays = await idb(page, 'supplier_payments');
  const p = pays.sort((a, z) => z.created_at - a.created_at)[0];
  if (pays.length !== pays0 + 1 || p.amount !== 500000 || !p.allocations.length) fail('payment');
  await shot(page, '78-supplier-profile');
  await page.getByRole('button', { name: 'Statement' }).click(); await page.waitForSelector('iframe[title="Print preview"]'); await sleep(300);
  if (!/SUPPLIER STATEMENT/.test(await page.locator('iframe[title="Print preview"]').getAttribute('srcdoc'))) fail('statement');
  await page.keyboard.press('Escape');
  console.log(`   paid KES 5,000 (${p.ref}) allocated to ${p.allocations.map((a) => a.amount / 100).join(' + ')}`);
});

await step('return goods to a supplier: stock out + credit on the account', async () => {
  const s = (await idb(page, 'suppliers')).find((x) => x.name === 'Bidco Africa');
  const x = byName(/Maize Flour/);
  const l0 = await level(x.id, main.id);
  await go('/purchasing/returns/new?supplier=' + s.id);
  await scan(page, x.barcode); await scan(page, x.barcode);
  await page.locator('.sum-card .chip', { hasText: 'Damaged' }).click();
  await shot(page, '79-supplier-return');
  await page.locator('.sum-card').getByRole('button', { name: 'Return goods' }).click(); await confirmYes('Yes, return'); await page.waitForSelector('text=Goods returned');
  const doc = (await idb(page, 'goods_received')).filter((g) => g.kind === 'return').sort((a, z) => z.created_at - a.created_at)[0];
  if ((await level(x.id, main.id)) !== l0 - 2 || doc.total >= 0) fail('return');
  console.log(`   ${doc.no}: credit ${-doc.total / 100}, stock ${l0} → ${l0 - 2}`);
});

await step('offline: adjust and receive stock with no connection, pages keep working after a reload', async () => {
  await ctx.setOffline(true);
  await page.reload(); await page.waitForSelector('.shell, .lock', { timeout: 20000 }); await sleep(500);
  if (await page.locator('.lock').count()) await unlock(/Grace/, '1234');
  await go('/inventory/adjustments');
  const x = P.filter((p) => p.track_stock && p.barcode && !p.track_batches)[8];
  const l0 = await level(x.id, main.id);
  await scan(page, x.barcode); await page.waitForSelector('.modal');
  await page.getByRole('radio', { name: 'Found' }).click();
  await page.locator('.modal-f .btn.primary').click(); await sleep(500);
  await go('/purchasing/receive');
  await page.getByLabel('Supplier', { exact: true }).selectOption('none');
  await scan(page, x.barcode); await scan(page, x.barcode); await scan(page, x.barcode);
  await page.locator('.sum-card').getByRole('button', { name: 'Receive stock' }).click(); await confirmYes('Yes, receive'); await page.waitForSelector('text=Stock received');
  if ((await level(x.id, main.id)) !== l0 + 4) fail('offline levels ' + l0 + ' → ' + (await level(x.id, main.id)));
  await shot(page, '80-offline-received');
  await ctx.setOffline(false);
  console.log(`   offline: ${x.name} ${l0} → ${l0 + 4} (found +1, delivery +3)`);
});
await ctx.close();

// ---------- pharmacy: batches & expiry ----------
({ ctx, page } = await newPage(b, DESK)); setFailPage(page);
await page.goto(BASE + '?demo=1&type=pharmacy'); await page.waitForSelector('.shell', { timeout: 30000 });
await step('pharmacy: receive a batch with expiry, expiry tracker (≤30/60/90), remove an expired batch (FEFO)', async () => {
  const PP = await idb(page, 'products');
  const bp = PP.find((p) => p.track_batches && p.barcode);
  await go('/purchasing/receive');
  await page.getByLabel('Supplier', { exact: true }).selectOption((await idb(page, 'suppliers'))[0].id);
  await scan(page, bp.barcode);
  await page.getByLabel('Quantity of ' + bp.name).fill('24');
  await page.getByLabel('Expiry date').fill('2028-03-31');
  await page.getByLabel('Batch / lot no.').fill('LOT-QA-1');
  await shot(page, '81-receive-batch');
  await page.locator('.sum-card').getByRole('button', { name: 'Receive stock' }).click(); await confirmYes('Yes, receive'); await page.waitForSelector('text=Stock received');
  const bt = (await idb(page, 'batches')).find((x) => x.batch_no === 'LOT-QA-1');
  const mv = (await idb(page, 'stock_moves')).find((m) => m.batch_no === 'LOT-QA-1');
  if (!bt || bt.expiry !== '2028-03-31' || mv?.qty !== 24) fail('batch');
  await go('/inventory/expiry');
  await page.getByRole('button', { name: /^Expired/ }).first().click(); await sleep(300);
  await shot(page, '82-expiry');
  const nExp = await page.locator('.vt-row').count();
  if (nExp) {
    await page.locator('.vt-row').first().getByRole('button', { name: 'Remove' }).click(); await confirmYes('Yes, remove'); await sleep(500);
    const adj = (await idb(page, 'stock_moves')).filter((m) => m.type === 'adjust' && m.reason === 'expired');
    if (!adj.length || !adj[0].batch_no) fail('expired write-off');
    console.log(`   expired batches ${nExp}; removed ${-adj[0].qty} of batch ${adj[0].batch_no}`);
  } else console.log('   no expired batches in this demo');
});
await ctx.close();

// ---------- electronics: serial / IMEI ----------
({ ctx, page } = await newPage(b, DESK)); setFailPage(page);
await page.goto(BASE + '?demo=1&type=electronics'); await page.waitForSelector('.shell', { timeout: 30000 });
await step('electronics: receive 2 phones with IMEIs (count enforced), IMEI lookup shows supplier delivery', async () => {
  const PP = await idb(page, 'products');
  const ph = PP.find((p) => p.track_serials && p.barcode);
  await go('/purchasing/receive');
  await page.getByLabel('Supplier', { exact: true }).selectOption((await idb(page, 'suppliers'))[0].id);
  await scan(page, ph.barcode); await scan(page, ph.barcode);
  await page.locator('.sum-card').getByRole('button', { name: 'Receive stock' }).click(); await sleep(300);
  if (!(await page.getByText(/scan 2 serial/).count())) fail('serial count not enforced');
  await page.getByLabel('Serial / IMEI numbers', { exact: true }).fill('356789012345671\n356789012345689');
  await shot(page, '83-receive-serials');
  await page.locator('.sum-card').getByRole('button', { name: 'Receive stock' }).click(); await confirmYes('Yes, receive'); await page.waitForSelector('text=Stock received');
  const sr = (await idb(page, 'serials')).filter((s) => s.serial.startsWith('3567890123456'));
  if (sr.length !== 2 || sr.some((s) => s.status !== 'in_stock')) fail('serials');
  await go('/inventory/serials');
  await page.getByLabel('Serial / IMEI number').fill('356789012345671'); await page.getByRole('button', { name: 'Find' }).click(); await page.waitForSelector('text=Delivered'); await sleep(300);
  await shot(page, '84-serial-lookup');
  console.log('   IMEIs saved in stock; lookup shows the delivery note');
});
await ctx.close();

// ---------- sync of the new records (live business on the mock cloud) ----------
await step('live business: supplier, delivery, payment and stock moves sync to the cloud', async () => {
  const email = `inv${Date.now()}@example.co.ke`;
  const post = async (p, body, tok) => { const r = await fetch(API + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok, 'X-PPC-Token': tok } : {}) }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
  const r = await post('/auth/register', { business_name: 'Kiprop Duka', business_type: 'duka', owner_name: 'Ann Kiprop', phone: '0711 222 909', email, password: 'Secret123', town: 'Eldoret', county: 'Uasin Gishu', device_name: 'Website', source: 'web' });
  if (r.status >= 300) fail('register ' + r.status);
  ({ ctx, page } = await newPage(b, DESK)); setFailPage(page);
  await page.goto(BASE); await page.waitForSelector('.welcome');
  await page.getByRole('button', { name: /Sign in to my business/ }).click();
  await page.getByLabel('Email').fill(email); await page.getByLabel('Password').fill('Secret123');
  await page.getByRole('button', { name: /^Sign in$/ }).click(); await page.waitForSelector('.wizard', { timeout: 20000 });
  for (let i = 0; i < 6; i++) { await page.getByRole('button', { name: /Continue|Finish/ }).click(); await sleep(250); }
  await page.getByRole('button', { name: /Use the template catalogue/ }).click(); await sleep(800);
  await page.getByRole('button', { name: /Continue|Finish/ }).click(); await sleep(200);
  await page.getByRole('button', { name: /Finish/ }).click(); await sleep(200);
  await page.getByRole('button', { name: 'Go to Pentarch POS' }).click(); await page.waitForSelector('.shell, .lock');
  if (await page.locator('.lock').count()) await unlock(/Ann/, '1234');
  const LIVE = 'pentarch-pos';
  const prods = await idb(page, 'products', LIVE);
  const milk = prods.find((p) => p.barcode && p.track_stock);
  await go('/purchasing/receive');
  await page.getByRole('button', { name: 'Add supplier' }).click(); await page.waitForSelector('.modal');
  await page.getByLabel('Supplier name', { exact: true }).fill('Brookside Dairy Depot'); await page.getByLabel('Phone (WhatsApp)').fill('0733 400 500');
  await page.getByRole('button', { name: 'Save supplier' }).click(); await sleep(500);
  for (let i = 0; i < 5; i++) await scan(page, milk.barcode);
  await page.getByLabel('Paid now').fill('100');
  await page.locator('.sum-card').getByRole('button', { name: 'Receive stock' }).click(); await confirmYes('Yes, receive'); await page.waitForSelector('text=Stock received');
  await page.evaluate(() => window.__pposSync.syncNow('qa')); await sleep(2000);
  const login = await post('/auth/login', { email, password: 'Secret123', device_name: 'QA device B' });
  const pull = await (await fetch(API + '/sync/pull?since=0&limit=1000', { headers: { Authorization: 'Bearer ' + login.body.device_token, 'X-PPC-Token': login.body.device_token } })).json();
  const ents = {};
  for (const c of pull.changes || []) ents[c.entity] = (ents[c.entity] || 0) + 1;
  const purchase = (pull.changes || []).filter((c) => c.entity === 'stock_moves' && c.data.type === 'purchase').length;
  if (!ents.suppliers || !ents.goods_received || !ents.supplier_payments || !purchase) fail('not synced ' + JSON.stringify(ents));
  const out = (await idb(page, 'outbox', LIVE)).length;
  console.log(`   cloud has suppliers ${ents.suppliers}, goods_received ${ents.goods_received}, supplier_payments ${ents.supplier_payments}, purchase moves ${purchase}; outbox left ${out}`);
  await ctx.close();
});

report('flows-inventory');
await b.close();
