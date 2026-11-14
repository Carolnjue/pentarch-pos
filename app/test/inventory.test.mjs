// Inventory & Purchasing maths (src/core/stockmath.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { withRunningBalance, landedCosts, supplierAccount, allocateOldest, suggestQty, countVariance, daysUntil, expiryBucket, poStatus, poOutstanding, splitOverBatches, repackCost } from '../src/core/stockmath.js';
import { movingAverage } from '../src/db/stock.js';

const DAY = 86400000;

test('ledger running balance per branch, before/after', () => {
  const m = [
    { id: '3', branch_id: 'A', qty: -2, created_at: 30 }, { id: '1', branch_id: 'A', qty: 10, created_at: 10 },
    { id: '2', branch_id: 'B', qty: 5, created_at: 20 }, { id: '4', branch_id: 'A', qty: 0.5, created_at: 40 }, { id: 'x', branch_id: 'A', qty: 99, created_at: 5, deleted: 1 }
  ];
  const r = withRunningBalance(m);
  assert.deepEqual(r.map((x) => [x.id, x.before, x.after]), [['1', 0, 10], ['2', 0, 5], ['3', 10, 8], ['4', 8, 8.5]]);
});

test('landed cost: extra costs shared by value, by qty when costs are zero', () => {
  assert.deepEqual(landedCosts([{ qty: 10, cost: 100 }, { qty: 5, cost: 200 }], 0), [100, 200]);
  // values 1000 and 1000 → each gets 500 of 1000 extra → +50 and +100 per unit
  assert.deepEqual(landedCosts([{ qty: 10, cost: 100 }, { qty: 5, cost: 200 }], 1000), [150, 300]);
  assert.deepEqual(landedCosts([{ qty: 2, cost: 0 }, { qty: 2, cost: 0 }], 400), [100, 100]);
});

test('moving average cost on receiving', () => {
  assert.equal(movingAverage(10, 100, 10, 200), 150);
  assert.equal(movingAverage(-3, 100, 10, 200), 200); // negative stock does not drag the average
  assert.equal(movingAverage(0, 0, 5, 120), 120);
});

test('supplier account: returns and payments pay the oldest deliveries first', () => {
  const now = 100 * DAY;
  const docs = [
    { id: 'g1', kind: 'receipt', total: 10000, created_at: now - 40 * DAY },
    { id: 'g2', kind: 'receipt', total: 5000, created_at: now - 10 * DAY },
    { id: 'r1', kind: 'return', total: -1000, created_at: now - 5 * DAY },
    { id: 'g3', kind: 'receipt', total: 9999, created_at: now, deleted: 1 }
  ];
  const pays = [{ amount: 6000 }, { amount: -500 }]; // a refund from the supplier is negative
  const a = supplierAccount(docs, pays, now);
  assert.equal(a.purchased, 15000);
  assert.equal(a.returned, 1000);
  assert.equal(a.paid, 5500);
  assert.equal(a.balance, 8500);
  assert.deepEqual(a.open.map((o) => [o.grn.id, o.due, o.age]), [['g1', 3500, 40], ['g2', 5000, 10]]);
  assert.deepEqual(allocateOldest(a.open, 4000), [{ grn_id: 'g1', amount: 3500 }, { grn_id: 'g2', amount: 500 }]);
  assert.deepEqual(allocateOldest(a.open, 4000, ['g2']), [{ grn_id: 'g2', amount: 4000 }]);
});

test('reorder suggestion covers 14 days of sales, at least the reorder quantity', () => {
  assert.equal(suggestQty({ onHand: 2, reorderLevel: 5, reorderQty: 12, avgDaily: 0 }), 12);
  assert.equal(suggestQty({ onHand: 2, reorderLevel: 5, reorderQty: 12, avgDaily: 3 }), 45); // 3×14 + 5 − 2
  assert.equal(suggestQty({ onHand: 0.4, reorderLevel: 1, avgDaily: 0.5, unit: 'kg' }), 7.6);
  assert.equal(suggestQty({ onHand: 50, reorderLevel: 0, reorderQty: 0, avgDaily: 0 }), 1);
});

test('count variance with KES value', () => {
  const cost = { a: 1000, b: 250, c: 99 };
  const v = countVariance([
    { product_id: 'a', expected: 10, counted: 8 }, { product_id: 'b', expected: 4, counted: 6 }, { product_id: 'c', expected: 3, counted: null }, { product_id: 'c', expected: 1, counted: 1 }
  ], (id) => cost[id]);
  assert.equal(v.counted, 3);
  assert.equal(v.diffs, 2);
  assert.equal(v.loss, -2000);
  assert.equal(v.gain, 500);
  assert.equal(v.net, -1500);
});

test('expiry days and buckets', () => {
  const now = new Date(2026, 10, 9, 15, 0).getTime();
  assert.equal(daysUntil('2026-11-09', now), 0);
  assert.equal(daysUntil('2026-11-08', now), -1);
  assert.equal(expiryBucket('2026-11-08', now), 'expired');
  assert.equal(expiryBucket('2026-12-09', now), '30');
  assert.equal(expiryBucket('2026-12-20', now), '60');
  assert.equal(expiryBucket('2027-02-01', now), '90');
  assert.equal(expiryBucket('2027-06-01', now), 'later');
  assert.equal(expiryBucket('', now), 'none');
});

test('purchase order status from deliveries', () => {
  const po = { status: 'sent', lines: [{ product_id: 'a', qty: 10 }, { product_id: 'b', qty: 4 }] };
  assert.equal(poStatus(po, {}), 'sent');
  assert.equal(poStatus(po, { a: 10 }), 'partial');
  assert.equal(poStatus(po, { a: 10, b: 5 }), 'received');
  assert.equal(poStatus({ ...po, status: 'cancelled' }, { a: 10, b: 4 }), 'cancelled');
  assert.deepEqual(poOutstanding(po, { a: 3 }).map((l) => l.left), [7, 4]);
});

test('transfer receipt split over sent batches; repack cost', () => {
  assert.deepEqual(splitOverBatches([{ batch_no: 'X', qty: 3 }, { batch_no: 'Y', qty: 5 }], 6).map((b) => [b.batch_no, b.qty]), [['X', 3], ['Y', 3]]);
  assert.deepEqual(splitOverBatches([{ batch_no: 'X', qty: 3 }], 4).map((b) => b.qty), [4]); // extra goes on the last batch
  assert.equal(repackCost(840000, 1, 50), 16800); // KES 8,400 bag → KES 168 per kg
});
