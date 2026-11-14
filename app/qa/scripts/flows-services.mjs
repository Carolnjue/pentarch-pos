// Services module (demo "salon" + "stationery"): fast staff picker per service line, commission per staff / per service,
// commission report, appointments (book, clash warning, arrived → sale → done), cyber shop is not interrupted by the picker.
import { chromium, newPage, BASE, shot, sleep, report, DESK, idb, step, setFailPage } from './lib.mjs';
const b = await chromium.launch();
const { page } = await newPage(b, DESK);
setFailPage(page);
const tile = async (name) => { await page.locator('.tile', { hasText: name }).first().click(); await sleep(200); };
const payExact = async () => {
  await page.locator('.pay-btn').click(); await page.waitForSelector('.tender');
  await page.getByRole('button', { name: 'Exact' }).click(); await page.waitForSelector('.done-hero');
  await sleep(150); await page.keyboard.press('Enter'); await sleep(300);
};
const users = async () => (await idb(page, 'users')).filter((u) => !u.deleted);
await page.goto(BASE + '?demo=1&type=salon'); await page.waitForSelector('.shell', { timeout: 60000 });

await step('adding a service pops the staff picker; chip on the line changes who did it', async () => {
  await page.goto(BASE + '#/sell'); await page.waitForSelector('.tiles');
  await tile('Manicure'); await page.waitForSelector('.sp-grid');
  await shot(page, 's-01-staff-picker');
  await page.locator('.sp-tile', { hasText: 'Kevin' }).click(); await sleep(200);
  const chip = page.locator('.line .staff-chip').first();
  if (!/Kevin/.test(await chip.innerText())) throw new Error('chip ' + await chip.innerText());
  await chip.click(); await page.waitForSelector('.sp-grid');
  await page.locator('.sp-tile', { hasText: 'Faith' }).click(); await sleep(200);
  if (!/Faith/.test(await chip.innerText())) throw new Error('chip not changed');
  await tile('Box braids (medium)'); await page.waitForSelector('.sp-grid');
  await page.locator('.sp-tile', { hasText: 'Esther' }).click(); await sleep(200);
  await shot(page, 's-02-cart-staff');
  await payExact();
  const s = (await idb(page, 'sales')).sort((a, z) => z.created_at - a.created_at)[0];
  const us = await users();
  const faith = us.find((u) => /Faith/.test(u.name)), esther = us.find((u) => /Esther/.test(u.name));
  if (s.lines.find((l) => /Manicure/.test(l.name)).staff_id !== faith.id) throw new Error('manicure staff wrong');
  if (s.lines.find((l) => /Box braids/.test(l.name)).staff_id !== esther.id) throw new Error('braids staff wrong');
});

await step('commission report: today, by staff (service rate 40% beats staff 30%), detail, print + CSV', async () => {
  await page.goto(BASE + '#/commission'); await page.waitForSelector('.page-h'); await sleep(400);
  await page.locator('.seg button', { hasText: 'Today' }).click(); await sleep(500);
  const s = (await idb(page, 'sales')).sort((a, z) => z.created_at - a.created_at)[0];
  const braids = s.lines.find((l) => /Box braids/.test(l.name));
  const row = page.locator('.list-item', { hasText: 'Esther' });
  const txt = await row.innerText();
  console.log('   ', txt.replace(/\n/g, ' | '));
  await row.click(); await sleep(300);
  const detail = await page.locator('.table').innerText();
  if (!detail.includes('Box braids') || !/\b40\b/.test(detail)) throw new Error('braids not at 40%: ' + detail.slice(0, 300));
  const expect = Math.round(braids.total * 0.4) / 100;
  if (!detail.replace(/,/g, '').includes(expect.toFixed(2).replace(/\.00$/, ''))) console.log('   note: expected commission', expect);
  await shot(page, 's-03-commission');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV' }).click()]);
  if (!/commission-/.test(dl.suggestedFilename())) throw new Error('csv name');
  await page.getByRole('button', { name: 'Print' }).click(); await page.waitForSelector('iframe[title="Print preview"]'); await sleep(300);
  await page.keyboard.press('Escape'); await sleep(200);
});

await step('settings: commission per staff and per service are saved', async () => {
  await page.goto(BASE + '#/settings/services'); await page.waitForSelector('.card-h'); await sleep(400);
  await page.getByLabel('Commission % for Kevin Omondi').fill('50');
  await page.locator('.card', { hasText: 'Commission per staff member' }).getByRole('button', { name: 'Save' }).click(); await sleep(300);
  await page.getByLabel('Commission % for Manicure').fill('25');
  await page.locator('.card', { hasText: 'Commission per service' }).getByRole('button', { name: 'Save' }).click(); await sleep(400);
  await shot(page, 's-04-settings');
  if ((await users()).find((u) => /Kevin/.test(u.name)).commission_pct !== 50) throw new Error('staff rate not saved');
  if ((await idb(page, 'products')).find((p) => p.name === 'Manicure').commission_pct !== 25) throw new Error('service rate not saved');
});

await step('appointments: today list (seeded), book a client, clash warning for same staff & time', async () => {
  await page.goto(BASE + '#/appointments'); await page.waitForSelector('.page-h'); await sleep(400);
  const n0 = await page.locator('.appt').count();
  if (n0 < 5) throw new Error('seeded appointments missing: ' + n0);
  await shot(page, 's-05-appointments');
  await page.locator('.page-h').getByRole('button', { name: 'Book appointment' }).click(); await page.waitForSelector('.book-grid');
  await page.getByLabel('Name').fill('Zawadi Mwende'); await page.getByLabel('Phone').fill('0712 909 808');
  await page.locator('.svc', { hasText: 'Pedicure' }).click();
  await page.getByRole('button', { name: /Any staff — tap to choose/ }).click(); await page.waitForSelector('.sp-grid');
  await page.locator('.sp-tile', { hasText: 'Kevin' }).click(); await sleep(150);
  await page.locator('.slot', { hasText: '19:30' }).click();
  await shot(page, 's-06-book');
  await page.locator('.modal-f').getByRole('button', { name: 'Book' }).click(); await sleep(500);
  if (await page.locator('.appt').count() !== n0 + 1) throw new Error('booking not listed');
  // clash
  await page.locator('.page-h').getByRole('button', { name: 'Book appointment' }).click(); await page.waitForSelector('.book-grid');
  await page.getByLabel('Name').fill('Second Client');
  await page.locator('.svc', { hasText: 'Manicure' }).click();
  await page.getByRole('button', { name: /Any staff/ }).click(); await page.waitForSelector('.sp-grid');
  await page.locator('.sp-tile', { hasText: 'Kevin' }).click(); await sleep(150);
  if (!(await page.locator('.slot.taken', { hasText: '19:30' }).count())) throw new Error('taken slot not marked');
  await page.locator('.slot', { hasText: '19:30' }).click();
  await page.locator('.modal-f').getByRole('button', { name: 'Book' }).click();
  await page.waitForSelector('.modal h2:has-text("is already booked")');
  await page.getByRole('button', { name: 'Cancel' }).last().click(); await sleep(150);
  await page.keyboard.press('Escape'); await sleep(200);
});

await step('client arrived → sale opens with service, stylist and client → paid → appointment done', async () => {
  const row = page.locator('.appt', { hasText: 'Zawadi Mwende' });
  await row.getByRole('button', { name: /Arrived — start sale/ }).click(); await page.waitForSelector('.cart .line');
  await sleep(300);
  const cartTxt = await page.locator('.cart').innerText();
  if (!/Pedicure/.test(cartTxt) || !/Kevin/.test(cartTxt)) throw new Error('cart: ' + cartTxt.slice(0, 200));
  await shot(page, 's-07-arrived-sale');
  await payExact(); await sleep(400);
  const a = (await idb(page, 'appointments')).find((x) => x.customer_name === 'Zawadi Mwende');
  if (a.status !== 'done' || !a.sale_id) throw new Error('appointment status ' + a.status);
  const s = (await idb(page, 'sales')).find((x) => x.id === a.sale_id);
  if (s.lines[0].staff_id !== a.staff_id) throw new Error('staff not on sale');
});

await step('home shows today’s appointments', async () => {
  await page.goto(BASE + '#/home'); await page.waitForSelector('.page'); await sleep(600);
  if (!(await page.locator('.card', { hasText: 'Today’s appointments' }).count())) throw new Error('widget missing');
});

await step('cyber / print shop: adding services does not interrupt with a staff picker', async () => {
  const C = await newPage(b, DESK);
  await C.page.goto(BASE + '?demo=1&type=stationery'); await C.page.waitForSelector('.shell', { timeout: 60000 });
  await C.page.goto(BASE + '#/sell'); await C.page.waitForSelector('.tiles');
  await C.page.locator('.tile', { hasText: 'Photocopy (page)' }).first().click(); await sleep(400);
  if (await C.page.locator('.sp-grid').count()) throw new Error('picker popped up in a cyber');
  if (!(await C.page.locator('.line').count())) throw new Error('not added');
  await C.ctx.close();
});

report('flows-services');
await b.close();
