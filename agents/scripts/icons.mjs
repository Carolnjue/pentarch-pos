// Renders PWA icons from the Pentarch mark using Playwright (already installed).
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium } = pw;
import { readFileSync } from 'node:fs';
const svg = readFileSync(new URL('../public/brand/pentarch-mark.svg', import.meta.url), 'utf8');
const b64 = Buffer.from(svg).toString('base64');
const browser = await chromium.launch();
const page = await browser.newPage();
async function render(size, pad, out, radius) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px;background:#0A1530;border-radius:${radius}px;display:grid;place-items:center;position:relative;overflow:hidden"><div style="position:absolute;left:0;right:0;bottom:0;height:${Math.round(size*0.045)}px;background:linear-gradient(100deg,#EE4B3B 0%,#F6B22C 48%,#14B1AC 100%)"></div><img src="data:image/svg+xml;base64,${b64}" style="width:${size - pad * 2}px;height:${size - pad * 2}px;object-fit:contain"></div></body></html>`);
  await page.waitForTimeout(100);
  await page.screenshot({ path: new URL('../public/icons/' + out, import.meta.url).pathname, omitBackground: true });
}
await render(192, 30, 'icon-192.png', 40);
await render(512, 80, 'icon-512.png', 108);
await render(512, 130, 'maskable-512.png', 0);
await browser.close();
console.log('icons written');
