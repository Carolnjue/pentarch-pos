// Lists UI strings that have no Kiswahili translation in src/i18n/sw.js.
// Usage: node scripts/i18n-check.mjs [--json out.json]
// Collects t('…') / tn(n,'…','…') calls plus registry labels (label:/long:/title:/group:/text:/sub:) that are translated at render time.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const files = [];
const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(jsx?|mjs)$/.test(f) && !p.includes(path.sep + 'i18n' + path.sep)) files.push(p); } };
walk(root);
const keys = new Map();
const add = (k, f) => { if (k && /[a-z]/i.test(k) && !keys.has(k)) keys.set(k, path.relative(root, f)); };
const unq = (s) => s.replace(/\\'/g, "'").replace(/\\"/g, '"');
const reT = /\bt\(\s*(['"])((?:\\.|(?!\1).)*)\1/g;
const reTn = /\btn\([^,]+,\s*(['"])((?:\\.|(?!\1).)*)\1\s*,\s*(['"])((?:\\.|(?!\3).)*)\3/g;
const reProp = /\b(label|long|title|group|text|sub|hint|desc)\s*:\s*(['"])((?:\\.|(?!\2).)*)\2/g;
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = reT.exec(s))) add(unq(m[2]), f);
  while ((m = reTn.exec(s))) { add(unq(m[2]), f); add(unq(m[4]), f); }
  if (!/presets[\\/]catalogues/.test(f)) while ((m = reProp.exec(s))) add(unq(m[3]), f);
}
const sw = (await import(pathToFileURL(path.join(root, 'i18n/sw.js')).href)).default;
// CSV column names / technical keys that must stay English (spreadsheets and re-imports rely on them)
const IGNORE = new Set(['name', 'phone', 'email', 'group', 'balance', 'points', 'total_spent', 'retail', 'sku', 'barcode', 'category', 'type', 'unit', 'price', 'cost', 'tax', 'stock', 'reorder_level', 'wholesale_price', 'wholesale_min_qty', 'active', 'time', 'user', 'details']);
const missing = [...keys].filter(([k]) => !(k in sw) && !IGNORE.has(k));
console.log(`strings: ${keys.size - IGNORE.size} · translated: ${keys.size - IGNORE.size - missing.length} · missing: ${missing.length}`);
if (missing.length) process.exitCode = 1;
const out = process.argv.indexOf('--json');
if (out > 0) fs.writeFileSync(process.argv[out + 1], JSON.stringify(Object.fromEntries(missing), null, 1));
else missing.slice(0, 40).forEach(([k, f]) => console.log(`  ${f}: ${k}`));
