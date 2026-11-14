// Shared Playwright helpers for QA scripts. Run: node qa/scripts/<name>.mjs (needs `vite preview` on :4173 and the mock cloud on :8787)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export const { chromium } = require('playwright');
export const BASE = process.env.BASE || 'http://localhost:4173/pos/';
export const OUT = new URL('../', import.meta.url).pathname;
export const DESK = { width: 1366, height: 768 };
export const PHONE = { width: 390, height: 844 };
export const errors = [];
export async function newPage(browser, viewport = DESK, ctxOpts = {}) {
  const { tour, ...rest } = ctxOpts;
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, ...rest });
  if (!tour) await ctx.addInitScript(() => { try { localStorage.setItem('ppos.tour.sell', 'done'); } catch {} });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  page.on('dialog', (d) => d.accept());
  return { ctx, page };
}
export const shot = (page, name, full = false) => page.screenshot({ path: OUT + name + '.png', fullPage: full });
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Simulate a keyboard-wedge scanner: chars < 50 ms apart + Enter */
export async function scan(page, code) {
  for (const ch of code) await page.keyboard.press(ch, { delay: 0 });
  await page.keyboard.press('Enter');
  await sleep(120);
}
export async function pin(page, digits) { for (const d of digits) await page.keyboard.press(d); await sleep(300); }
export function report(name) {
  const errs = errors.filter((e) => !/favicon|net::ERR_INTERNET_DISCONNECTED|Failed to fetch|ERR_NAME_NOT_RESOLVED|wa\.me|status of 409|status of 422|status of 501/.test(e));
  console.log(`\n${name}: ${errs.length ? errs.length + ' console errors' : 'no console errors'}`);
  errs.slice(0, 20).forEach((e) => console.log('  ' + e));
  return errs;
}
/** Read a whole IndexedDB table from the page (raw IDB, no app hooks). */
export async function idb(page, table, dbName = 'pentarch-pos-demo') {
  return page.evaluate(([dbName, table]) => new Promise((res, rej) => {
    const r = indexedDB.open(dbName);
    r.onsuccess = () => { const d = r.result; const tx = d.transaction(table, 'readonly'); const q = tx.objectStore(table).getAll(); q.onsuccess = () => { res(q.result); d.close(); }; q.onerror = rej; };
    r.onerror = rej;
  }), [dbName, table]);
}
export let failPage = null;
export const setFailPage = (p) => { failPage = p; };
export async function step(name, fn) {
  const t0 = Date.now();
  try { await fn(); console.log(`✔ ${name} (${Date.now() - t0} ms)`); return true; }
  catch (e) {
    console.log(`✘ ${name}: ${e.message.split('\n')[0]}`);
    if (failPage) { await failPage.screenshot({ path: OUT + 'fail-' + name.replace(/[^a-z0-9]+/gi, '-').slice(0, 40) + '.png' }).catch(() => {}); await failPage.keyboard.press('Escape').catch(() => {}); await failPage.keyboard.press('Escape').catch(() => {}); }
    return false;
  }
}
