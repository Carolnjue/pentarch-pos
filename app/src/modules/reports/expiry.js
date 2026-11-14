// Batch balances → expiry list (kept apart from engine.js so the dashboard can use it without pulling in all reports).
const DAY = 86400000;
const r3 = (n) => Math.round(n * 1000) / 1000;

/** Batch balances from moves → expiry list. today: 'yyyy-mm-dd' */
export function expiryList(moves, products = new Map(), branchId, now = Date.now()) {
  const by = new Map();
  for (const m of moves) {
    if (m.deleted || !m.batch_no || (branchId && m.branch_id !== branchId)) continue;
    const k = m.product_id + '|' + m.branch_id + '|' + m.batch_no;
    const b = by.get(k) || { product_id: m.product_id, branch_id: m.branch_id, batch_no: m.batch_no, expiry: '', qty: 0 };
    b.qty = r3(b.qty + m.qty); if (m.expiry && !b.expiry) b.expiry = m.expiry;
    by.set(k, b);
  }
  const t0 = new Date(new Date(now).toDateString()).getTime();
  return [...by.values()].filter((b) => b.qty > 0 && b.expiry).map((b) => {
    const p = products.get(b.product_id);
    const days = Math.round((new Date(b.expiry + 'T00:00').getTime() - t0) / DAY);
    return { ...b, id: b.product_id + b.batch_no + b.branch_id, name: p?.name || '', days, cost: p?.cost || 0, value: Math.round(b.qty * (p?.cost || 0)), bucket: days < 0 ? 'expired' : days <= 30 ? '30' : days <= 60 ? '60' : days <= 90 ? '90' : 'later' };
  }).sort((a, b) => a.days - b.days);
}

