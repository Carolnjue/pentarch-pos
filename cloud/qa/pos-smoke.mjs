import { createRequire } from 'node:module'; import { execSync } from 'node:child_process';
const require = createRequire(import.meta.url); let pw; try { pw = require('playwright'); } catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const b = await pw.chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://127.0.0.1:8080/pos/?demo=1'); await p.waitForTimeout(4000);
await p.screenshot({ path: new URL('./pos-app-served.png', import.meta.url).pathname });
const sw = await p.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration('/pos/'); return r ? r.scope : null; });
console.log('title:', await p.title(), '| sw scope:', sw, '| page errors:', errs.length ? errs : 'none');
await b.close();
