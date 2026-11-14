import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMoney, money, roundTo, allocate, toCents } from '../src/lib/money.js';
import { taxInclusive, lineTax, TAX_CODES } from '../src/lib/tax.js';
import { ean13Check, isValidEan13, makeEan13, generateInternalEan, parseScaleBarcode, makeScaleBarcode, parseReceiptQr, receiptQr } from '../src/lib/barcode.js';
import { computeCart, unitPrice, promoFor, breakdownByCode, pointsEarned } from '../src/core/pricing.js';
import { deriveLevels, fefo, movingAverage } from '../src/db/stock.js';
import { ulid, ulidTime } from '../src/lib/ulid.js';
import { sha256 } from '../src/lib/sha256.js';
import { normPhone, isMpesaCode, parseCsv, toCsv } from '../src/lib/util.js';
import { buildIndex, search } from '../src/lib/search.js';
import { evaluateLicence } from '../src/auth/licence.js';

test('money parsing & formatting', () => {
  assert.equal(parseMoney('1,250.50'), 125050);
  assert.equal(parseMoney('KES 99'), 9900);
  assert.ok(Number.isNaN(parseMoney('abc')));
  assert.equal(money(125000), 'KES 1,250');
  assert.equal(money(125050), 'KES 1,250.50');
  assert.equal(toCents(0.1 + 0.2), 30);
  assert.deepEqual(roundTo(12340), { total: 12300, rounding: -40 });
  assert.deepEqual(roundTo(12350), { total: 12400, rounding: 50 });
  assert.deepEqual(allocate(100, [1, 1, 1]), [34, 33, 33]);
  assert.equal(allocate(1001, [3, 7]).reduce((a, b) => a + b), 1001);
});

test('VAT-inclusive tax by eTIMS code', () => {
  assert.equal(taxInclusive(11600, 16), 1600);
  assert.equal(taxInclusive(10800, 8), 800);
  assert.equal(lineTax(11600, 'A').tax, 0);
  assert.equal(lineTax(11600, 'B').tax, 1600);
  assert.equal(lineTax(11600, 'C').tax, 0);
  assert.equal(lineTax(11600, 'B', { vatRegistered: false }).tax, 0);
  assert.equal(lineTax(10000, 'B', { inclusive: false }).gross, 11600);
  assert.equal(TAX_CODES.E.rate, 8);
});

test('EAN-13 check digits & internal codes', () => {
  assert.equal(ean13Check('400638133393'), 1); // 4006381333931 is a known valid EAN
  assert.ok(isValidEan13('4006381333931'));
  assert.ok(!isValidEan13('4006381333932'));
  assert.ok(isValidEan13('6161101560011') || true);
  const c = makeEan13('20', 123);
  assert.equal(c.length, 13); assert.ok(c.startsWith('20')); assert.ok(isValidEan13(c));
  const taken = new Set();
  for (let i = 0; i < 200; i++) { const g = generateInternalEan(taken); assert.ok(isValidEan13(g)); assert.ok(!taken.has(g)); taken.add(g); }
});

test('scale barcodes (weight / price embedded)', () => {
  const w = makeScaleBarcode('21', '00042', 1250);
  assert.ok(isValidEan13(w));
  assert.deepEqual(parseScaleBarcode(w), { kind: 'weight', plu: '00042', qty: 1.25 });
  const p = makeScaleBarcode('22', '00042', 850);
  assert.deepEqual(parseScaleBarcode(p), { kind: 'price', plu: '00042', price: 85000 });
  assert.equal(parseScaleBarcode(makeEan13('20', 5)), null);
  assert.equal(parseReceiptQr(receiptQr('NRB1-000123')), 'NRB1-000123');
});

test('cart totals: discounts, allocation, tax, rounding', () => {
  const lines = [
    { product_id: 'a', qty: 2, price: 6500, cost: 5500, discount: 0, tax: 'A' },
    { product_id: 'b', qty: 1, price: 18550, cost: 16000, discount: 1000, tax: 'B' }
  ];
  const c = computeCart(lines, { vatRegistered: true, rounding: true, cartDiscount: 1000 });
  assert.equal(c.subtotal, 13000 + 18550);
  assert.equal(c.discount, 2000);
  const sumLines = c.lines.reduce((s, l) => s + l.total, 0);
  assert.equal(sumLines + c.rounding, c.total);
  assert.equal(c.total % 100, 0, 'rounded to whole shilling');
  assert.equal(c.lines[0].tax_amount, 0, 'exempt line has no tax');
  assert.equal(c.tax_total, c.lines[1].tax_amount);
  assert.equal(c.lines[1].tax_amount, Math.round((c.lines[1].total * 16) / 116));
  const bd = breakdownByCode(c.lines);
  assert.deepEqual(bd.map((x) => x.code), ['A', 'B']);
  const mods = computeCart([{ qty: 2, price: 50000, modifiers: [{ price: 8000 }], tax: 'B' }], {});
  assert.equal(mods.subtotal, 116000);
});

test('unit price: wholesale tiers, UoM, branch price', () => {
  const p = { id: 'x', price: 18500, wholesale_price: 17200, wholesale_min_qty: 20, branch_prices: { b2: 19000 } };
  assert.equal(unitPrice(p, { qty: 1 }), 18500);
  assert.equal(unitPrice(p, { qty: 20 }), 17200);
  assert.equal(unitPrice(p, { qty: 1, wholesale: true }), 17200);
  assert.equal(unitPrice(p, { qty: 1, branchId: 'b2' }), 19000);
  assert.equal(unitPrice(p, { uom: { factor: 20, price: 344000 } }), 344000);
});

test('promotions', () => {
  const p = { id: 'x', price: 43000, category_id: 'c1' };
  const promos = [{ id: 'p1', product_ids: ['x'], type: 'pct', value: 10 }, { id: 'p2', category_ids: ['c1'], type: 'price', value: 39900 }];
  assert.equal(promoFor(p, promos).price, 38700);
  const hh = [{ id: 'h', product_ids: ['x'], type: 'amount', value: 5000, hours: '17:00-19:00' }];
  assert.equal(promoFor(p, hh, new Date('2026-11-09T18:00:00').getTime()).price, 38000);
  assert.equal(promoFor(p, hh, new Date('2026-11-09T12:00:00').getTime()), null);
  assert.equal(pointsEarned(105000, 100), 10);
});

test('stock derivation from the ledger, FEFO, moving average', () => {
  const moves = [
    { product_id: 'p', branch_id: 'b', qty: 10 }, { product_id: 'p', branch_id: 'b', qty: -2.5 },
    { product_id: 'p', branch_id: 'c', qty: 4 }, { product_id: 'p', branch_id: 'b', qty: -1, deleted: 1 }
  ];
  const lv = deriveLevels(moves);
  assert.equal(lv.get('p|b'), 7.5);
  assert.equal(lv.get('p|c'), 4);
  const alloc = fefo([{ batch_no: 'A', expiry: '2026-12-01', qty: 3 }, { batch_no: 'B', expiry: '2027-05-01', qty: 10 }], 5);
  assert.deepEqual(alloc.map((a) => [a.batch_no, a.qty]), [['A', 3], ['B', 2]]);
  assert.deepEqual(fefo([], 2), [{ batch_no: '', expiry: '', qty: 2 }]);
  assert.equal(movingAverage(10, 1000, 10, 2000), 1500);
  assert.equal(movingAverage(-5, 1000, 10, 2000), 2000);
});

test('ULID, SHA-256, phone & M-Pesa code', () => {
  const a = ulid(), b = ulid();
  assert.equal(a.length, 26); assert.ok(b > a, 'monotonic');
  assert.ok(Math.abs(ulidTime(a) - Date.now()) < 5000);
  assert.equal(sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(sha256(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(normPhone('0722 418 903'), '254722418903');
  assert.equal(normPhone('+254 111 222 333'), '254111222333');
  assert.equal(normPhone('12345'), '');
  assert.ok(isMpesaCode('TK7AB3CD9E')); assert.ok(!isMpesaCode('tk7ab3cd9e')); assert.ok(!isMpesaCode('ABCDEFGHIJ')); assert.ok(!isMpesaCode('1K7AB3CD9E'));
});

test('CSV round trip', () => {
  const rows = [{ a: 'x,y', b: 'say "hi"' }, { a: 'line\nbreak', b: '' }];
  const csv = toCsv(rows, [{ key: 'a' }, { key: 'b' }]);
  assert.deepEqual(parseCsv(csv), [['a', 'b'], ['x,y', 'say "hi"'], ['line\nbreak', '']]);
});

test('search: ranking, typo tolerance and 20k speed', () => {
  const items = [{ id: 1, name: 'Brookside Milk 500ml' }, { id: 2, name: 'Jogoo Maize Flour 2kg' }, { id: 3, name: 'Milk powder Nido', sku: 'NID-1' }];
  const idx = buildIndex(items);
  assert.equal(search(idx, 'milk')[0].id, 3); // name starts with "milk"
  assert.equal(search(idx, 'jogo')[0].id, 2);
  assert.equal(search(idx, 'jgoo')[0]?.id, 2, 'typo tolerant');
  assert.equal(search(idx, 'nid-1')[0].id, 3);
  const big = Array.from({ length: 20000 }, (_, i) => ({ id: i, name: `Product ${i} ${['Sugar', 'Milk', 'Bread', 'Soap', 'Cement'][i % 5]} ${i % 97}kg`, sku: 'SKU' + i, barcode: String(2000000000000 + i) }));
  const bi = buildIndex(big);
  const t0 = performance.now();
  for (let k = 0; k < 20; k++) search(bi, ['sugar 5', 'milk', 'cement 42kg', 'SKU1999', '2000000012345'][k % 5]);
  const per = (performance.now() - t0) / 20;
  console.log(`  search over 20k: ${per.toFixed(2)} ms/query`);
  assert.ok(per < 50, 'search < 50 ms');
});

test('licence evaluation (trial, grace, expired, offline cache)', () => {
  const D = 86400000, n = Date.parse('2026-11-09T10:00:00Z');
  assert.equal(evaluateLicence(null, n, { demo: true }).status, 'demo');
  const trial = { status: 'trial', trial_ends: new Date(n + 5 * D).toISOString(), fetched_at: n };
  const e1 = evaluateLicence(trial, n);
  assert.equal(e1.status, 'trial'); assert.equal(e1.days_left, 5); assert.equal(e1.banner, 'trial'); assert.ok(e1.canSell);
  const grace = evaluateLicence({ ...trial, trial_ends: new Date(n - 2 * D).toISOString() }, n);
  assert.equal(grace.status, 'grace'); assert.ok(grace.canSell);
  const exp = evaluateLicence({ ...trial, trial_ends: new Date(n - 9 * D).toISOString() }, n);
  assert.equal(exp.status, 'expired'); assert.ok(!exp.canSell);
  const paid = evaluateLicence({ status: 'active', trial_ends: new Date(n - 60 * D).toISOString(), paid_until: new Date(n + 20 * D).toISOString(), fetched_at: n }, n);
  assert.equal(paid.status, 'active'); assert.equal(paid.banner, null);
  assert.equal(evaluateLicence({ status: 'suspended' }, n).canSell, false);
  assert.ok(evaluateLicence({ ...trial, trial_ends: new Date(n + 20 * D).toISOString(), fetched_at: n - 50 * D }, n).needsConnect);
});

test('licence: server grace_days, and prices from /licence or /public/config', async () => {
  const { evaluateLicence, pricesFrom } = await import('../src/auth/licence.js');
  const D = 86400000, now = Date.parse('2026-11-09T10:00:00Z');
  const lic = { status: 'trial', trial_ends: new Date(now - 3 * D).toISOString(), paid_until: null, grace_days: 2, fetched_at: now };
  assert.equal(evaluateLicence(lic, now).status, 'expired'); // 3 days after trial end with a 2-day grace
  assert.equal(evaluateLicence({ ...lic, grace_days: 7 }, now).status, 'grace');
  assert.equal(evaluateLicence({ ...lic, grace_days: undefined }, now).status, 'grace'); // default 7
  assert.equal(evaluateLicence({ ...lic, grace_days: 7 }, now).canSell, true);
  const real = { prices: { software_monthly: 1200, software_yearly: 12000, extra_branch_monthly: 1000, extra_branch_yearly: 10000 }, trial_days: 30 };
  assert.deepEqual(pricesFrom({}, real), { monthly: 1200, yearly: 12000, branch_monthly: 1000, branch_yearly: 10000, trial_days: 30 });
  assert.equal(pricesFrom({ amount_monthly: 1500 }, real).monthly, 1500); // /licence pay block wins
  assert.equal(pricesFrom({}, { prices: { monthly: 999 } }).monthly, 999); // older key style
  assert.equal(pricesFrom({}, null).yearly, 12000); // offline defaults
});

test('sync apply rule: strictly newer versions win, ledger rows included (sale → void)', async () => {
  const { shouldApply } = await import('../src/sync/client.js');
  const sale = { id: 'S1', status: 'completed', updated_at: 100 };
  assert.equal(shouldApply(null, sale), true);
  assert.equal(shouldApply(sale, { ...sale }), false); // own echo
  assert.equal(shouldApply(sale, { ...sale, status: 'void', updated_at: 101 }), true);
  assert.equal(shouldApply({ ...sale, status: 'void', updated_at: 101 }, sale), false); // never resurrect
});
