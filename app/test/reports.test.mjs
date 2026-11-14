// Reports engine: totals, VAT by code, P&L, aging, statement, stock valuation, exceptions, commission.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/modules/reports/engine.js';

const DAY = 86400000;
const NOW = new Date('2026-11-09T15:00:00').getTime();
const line = (o) => ({ product_id: 'p1', name: 'Sugar', qty: 1, factor: 1, price: 11600, cost: 9280, tax: 'B', tax_rate: 16, total: 11600, tax_amount: 1600, ...o });
const sale = (o) => ({ id: 's' + Math.random(), no: 'A1-1', branch_id: 'b1', user_id: 'u1', created_at: NOW - DAY, status: 'completed', total: 11600, tax_total: 1600, discount: 0, payments: [{ method: 'cash', amount: 11600 }], lines: [line()], balance: 0, ...o });

test('sales totals ignore voids and subtract refunds', () => {
  const s = [sale(), sale({ status: 'void' }), sale({ total: 5000, tax_total: 0, lines: [line({ tax: 'A', tax_rate: 0, total: 5000, tax_amount: 0, cost: 4000 })], payments: [{ method: 'mpesa', amount: 5000 }] })];
  const t = E.salesTotals(s, [{ total: 1000, refund: [{ method: 'cash', amount: 1000 }] }]);
  assert.equal(t.count, 2); assert.equal(t.total, 16600); assert.equal(t.refunds, 1000); assert.equal(t.net, 15600);
  // cost net of input VAT for the VAT sale: 9280/1.16 = 8000; zero-rated sale cost 4000
  assert.equal(t.cost, 12000); assert.equal(t.profit, 16600 - 1600 - 12000);
  const m = E.byMethod(s);
  assert.deepEqual(m.map((x) => [x.method, x.sales]), [['cash', 11600], ['mpesa', 5000]]);
});

test('VAT by eTIMS code with returns matched to the sale line', () => {
  const s1 = sale({ id: 'S1' });
  const v = E.vatByCode([s1], [{ sale_id: 'S1', lines: [{ line_index: 0, product_id: 'p1', qty: 1, amount: 5800 }] }], new Map([['S1', s1]]));
  assert.equal(v.length, 1); assert.equal(v[0].code, 'B'); assert.equal(v[0].sales, 11600); assert.equal(v[0].returns, 5800);
  assert.equal(v[0].vat, 1600 - 800); assert.equal(v[0].exVat, 5800 - 800);
});

test('profit & loss: sales − returns − VAT − COGS − expenses − pay-outs', () => {
  const s1 = sale({ id: 'S1' });
  const p = E.profitAndLoss({ sales: [s1], returns: [], expenses: [{ category: 'rent', amount: 1000, method: 'bank' }], cashMoves: [{ type: 'pay_out', amount: 500 }, { type: 'drop', amount: 9999 }], saleById: new Map() });
  assert.equal(p.netSales, 10000); assert.equal(p.cogs, 8000); assert.equal(p.gross, 2000); assert.equal(p.totalExp, 1500); assert.equal(p.net, 500);
});

test('debtors aging buckets and payments allocated', () => {
  const cs = [{ id: 'c1', name: 'Wanjiku', credit_limit: 10000 }];
  const ss = [sale({ id: 'A', customer_id: 'c1', balance: 3000, created_at: NOW - 70 * DAY }), sale({ id: 'B', customer_id: 'c1', balance: 4000, created_at: NOW - 5 * DAY })];
  const rows = E.debtorsAging(cs, ss, [{ customer_id: 'c1', amount: 1000, allocations: [{ sale_id: 'A', amount: 1000 }] }], [], NOW);
  assert.equal(rows.length, 1); assert.equal(rows[0].b60, 2000); assert.equal(rows[0].b0, 4000); assert.equal(rows[0].balance, 6000);
  const st = E.statement('c1', ss, [{ customer_id: 'c1', amount: 1000, created_at: NOW - DAY, method: 'mpesa' }], [], NOW - 30 * DAY, NOW);
  assert.equal(st.opening, 3000); assert.equal(st.closing, 6000); assert.equal(st.rows.length, 2);
});

test('stock valuation, low stock, expiry and dead stock', () => {
  const prods = [{ id: 'p1', name: 'Sugar', cost: 9000, price: 11600, reorder_level: 10, track_stock: true }, { id: 'p2', name: 'Service', type: 'service', cost: 0, price: 500 }];
  const val = E.stockValuation(prods, [{ product_id: 'p1', branch_id: 'b1', qty: 4 }, { product_id: 'p1', branch_id: 'b2', qty: 2 }]);
  assert.equal(val.length, 1); assert.equal(val[0].qty, 6); assert.equal(val[0].costValue, 54000);
  assert.equal(E.stockValuation(prods, [{ product_id: 'p1', branch_id: 'b1', qty: 4 }, { product_id: 'p1', branch_id: 'b2', qty: 2 }], 'b2')[0].qty, 2);
  assert.equal(E.lowStock(val)[0].suggest, 14);
  const ex = E.expiryList([{ product_id: 'p1', branch_id: 'b1', batch_no: 'X', expiry: '2026-11-01', qty: 5 }, { product_id: 'p1', branch_id: 'b1', batch_no: 'X', qty: -2 }], new Map([['p1', prods[0]]]), null, NOW);
  assert.equal(ex[0].qty, 3); assert.equal(ex[0].bucket, 'expired');
  assert.equal(E.deadStock(val, [], 30).length, 1);
  assert.equal(E.deadStock(val, [sale()], 30)[0].sold, 1); // slow: 6 on hand covers 180 days
  assert.equal(E.deadStock(val, [sale({ lines: [line({ qty: 10 })] })], 30).length, 0);
});

test('exceptions summary and staff commission', () => {
  const x = E.exceptions([{ action: 'sale.void', user_id: 'u1', details: { total: 500 }, at: 2 }, { action: 'discount.apply', user_id: 'u2', details: { amount: 50 }, at: 1 }, { action: 'user.login', user_id: 'u1', at: 3 }]);
  assert.equal(x.rows.length, 2); assert.equal(x.sum['sale.void'].amount, 500); assert.equal(x.staff[0].count, 1);
  const c = E.commission([sale({ lines: [line({ staff_id: 'u2', total: 2000 }), line({ total: 1000 })] })], [{ id: 'u1', name: 'A', commission_pct: 0 }, { id: 'u2', name: 'B', commission_pct: 10 }]);
  assert.equal(c.find((r) => r.id === 'u2').commission, 200);
  assert.equal(c.find((r) => r.id === 'u1').base, 1000);
});

test('purchases are net of supplier returns; balance = deliveries − returns − payments (refund = negative payment)', () => {
  const g = [
    { id: 'g1', kind: 'receipt', supplier_id: 'S', total: 100000, paid: 100000, lines: [{}], created_at: NOW - 10 * DAY },
    { id: 'g2', kind: 'receipt', supplier_id: 'S', total: 50000, paid: 0, lines: [{}, {}], created_at: NOW - 5 * DAY },
    { id: 'r1', kind: 'return', supplier_id: 'S', total: -8000, paid: 0, lines: [{ qty: -2 }], created_at: NOW - 4 * DAY }
  ];
  const p = [
    { supplier_id: 'S', amount: 100000, allocations: [{ grn_id: 'g1', amount: 100000 }], created_at: NOW - 10 * DAY + 60000 }, // paid on delivery
    { supplier_id: 'S', amount: 20000, allocations: [{ grn_id: 'g2', amount: 20000 }], created_at: NOW - 2 * DAY },
    { supplier_id: 'S', amount: -1000, allocations: [], created_at: NOW - DAY } // refund from the supplier
  ];
  const [r] = E.purchasesBySupplier(g, p);
  assert.equal(r.grns, 2); assert.equal(r.returnsCount, 1);
  assert.equal(r.received, 150000); assert.equal(r.returns, 8000); assert.equal(r.total, 142000);
  assert.equal(r.paidAtDelivery, 100000); assert.equal(r.payments, 19000); assert.equal(r.paid, 119000);
  const [b] = E.supplierBalances([{ id: 'S', name: 'Bidco', terms_days: 1 }], g, p, NOW);
  assert.equal(b.balance, 142000 - 119000);
  assert.equal(b.oldest, NOW - 5 * DAY); assert.ok(b.overdue > 0);
});
