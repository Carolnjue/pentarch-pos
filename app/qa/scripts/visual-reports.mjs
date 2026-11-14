// Visual pass for the Dashboard, Reports and Expenses: every report at laptop 1366×768, touch 1024×768 and phone 390×844.
// Run: node qa/scripts/visual-reports.mjs [desk|touch|phone ...]   (LANG_UI=sw for Kiswahili, TYPE=<business type>, default minimart)
// → qa/visual/<view>-r-NN-<name>.png ; prints build time per report and any untranslated strings.
import fs from 'node:fs';
import { chromium, newPage, BASE, OUT, sleep, report } from './lib.mjs';
const VIEWS = { desk: { width: 1366, height: 768 }, touch: { width: 1024, height: 768 }, phone: { width: 390, height: 844 } };
const LANG = process.env.LANG_UI || 'en';
const TYPE = process.env.TYPE || 'minimart';
const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(VIEWS);
const DIR = OUT + 'visual/';
fs.mkdirSync(DIR, { recursive: true });
const REPORTS = ['sales', 'products', 'categories', 'staff', 'payments', 'hours', 'customers', 'profit', 'vat', 'pnl', 'stock', 'movement', 'low-stock', 'expiry', 'dead-stock', 'purchases', 'supplier-balances', 'aging', 'statement', 'expenses', 'shifts', 'exceptions', 'commission', 'audit'];
const missing = new Set();
const b = await chromium.launch();
for (const v of want) {
  const vp = VIEWS[v];
  const { ctx, page } = await newPage(b, vp, { hasTouch: v !== 'desk', isMobile: v === 'phone' });
  if (LANG !== 'en') await ctx.addInitScript((l) => { try { localStorage.setItem('ppos.lang', l); } catch {} }, LANG);
  let n = 0;
  const pre = LANG === 'en' ? '' : LANG + '-';
  const collect = async () => { for (const m of await page.evaluate(() => [...(window.__i18nMissing || [])]).catch(() => [])) missing.add(m); };
  const shot = async (name, full = false) => {
    await sleep(300); await collect();
    // the app scrolls inside .content — let the page grow for full-length shots
    const tag = full ? await page.addStyleTag({ content: '.shell{height:auto!important}.content{overflow:visible!important}.side{position:sticky;top:0;height:100vh}' + (v === 'phone' ? '.side{position:fixed}' : '') }) : null;
    await page.screenshot({ path: `${DIR}${v}-${pre}r-${String(++n).padStart(2, '0')}-${name}.png`, fullPage: full });
    if (tag) await tag.evaluate((el) => el.remove());
  };
  await page.goto(BASE + `?demo=1&type=${TYPE}`); await page.waitForSelector('.shell', { timeout: 40000 }); await sleep(800);
  await shot('dashboard'); await shot('dashboard-full', true);
  await page.goto(BASE + '#/reports'); await page.waitForSelector('.rpt-card'); await shot('reports-home', v === 'phone');
  const times = {};
  for (const id of REPORTS) {
    await page.goto(BASE + '#/reports/' + id); await page.waitForSelector('.rpt-body, .rpt .empty', { timeout: 15000 });
    await page.waitForFunction((id) => window.__report?.id === id || document.querySelector('.rpt .empty'), id, { timeout: 15000 }).catch(() => {});
    if (id === 'statement') {
      const sel = page.locator('.rpt-filters select[data-filter=customer]');
      await sel.selectOption(await sel.locator('option').nth(1).getAttribute('value')); await page.waitForFunction(() => window.__report?.id === 'statement' && window.__report.tables[0]?.rows > 0, null, { timeout: 10000 }).catch(() => {});
    }
    await sleep(200);
    times[id] = await page.evaluate(() => window.__report?.ms ?? null);
    await shot('report-' + id, v === 'desk' && ['sales', 'pnl', 'hours', 'exceptions'].includes(id));
  }
  console.log(v, 'report build ms', JSON.stringify(times));
  await page.goto(BASE + '#/expenses'); await page.waitForSelector('.exp-page .stat'); await sleep(400); await shot('expenses', v === 'desk');
  await page.getByRole('button', { name: /Record expense|Rekodi matumizi/ }).first().click(); await page.waitForSelector('.exp-form'); await shot('expense-record');
  await page.keyboard.press('Escape'); await sleep(200);
  report('visual-reports ' + v);
  await ctx.close();
}
if (LANG !== 'en') { console.log(`untranslated strings seen (${missing.size}):`); [...missing].sort().forEach((m) => console.log('  ' + JSON.stringify(m))); }
await b.close();
