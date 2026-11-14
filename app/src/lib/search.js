// Fast in-memory product search (name / SKU / barcode), typo tolerant.
export const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9.%]+/g, ' ').trim();

/** Build an index from items with {id, name, sku, barcode, barcodes, extra}. */
export function buildIndex(items) {
  const n = items.length;
  const hay = new Array(n);
  const names = new Array(n);
  const words = new Array(n);
  for (let i = 0; i < n; i++) {
    const p = items[i];
    names[i] = ' ' + norm(p.name);
    words[i] = names[i].split(' ').filter(Boolean);
    hay[i] = names[i] + ' ' + norm(p.sku) + ' ' + (p.barcode || '') + ' ' + (p.barcodes || []).join(' ') + ' ' + norm(p.extra);
  }
  return { items, hay, names, words };
}

function within1(a, b) {
  // true if edit distance(a, b) <= 1
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0, j = 0, e = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++e > 1) return false;
    if (la > lb) i++; else if (lb > la) j++; else { i++; j++; }
  }
  return e + (la - i) + (lb - j) <= 1;
}

/** Search; returns up to `limit` items ranked. boost(item) adds to the score. */
export function search(index, q, { limit = 60, boost } = {}) {
  const query = norm(q);
  if (!query) return [];
  const toks = query.split(' ').filter(Boolean);
  const { hay, names, items, words: W } = index;
  const res = [];
  for (let i = 0; i < hay.length; i++) {
    const h = hay[i];
    let score = 0, ok = true;
    for (const t of toks) {
      const pos = h.indexOf(t);
      if (pos < 0) { ok = false; break; }
      const inName = names[i].indexOf(t);
      score += inName === 1 ? 30 : (inName > 0 && names[i][inName - 1] === ' ') ? 20 : inName > 0 ? 8 : (h[pos - 1] === ' ' ? 6 : 2);
    }
    if (ok) res.push([score + (boost ? boost(items[i]) : 0) - names[i].length * 0.02, i]);
  }
  if (!res.length) {
    // typo-tolerant fallback: every query token within 1 edit of some word prefix
    const long = toks.filter((t) => t.length >= 3);
    if (long.length) {
      for (let i = 0; i < hay.length; i++) {
        const words = W ? W[i] : names[i].split(' ');
        let hits = 0;
        for (const t of long) if (words.some((w) => within1(t, w.slice(0, t.length)) || within1(t, w))) hits++;
        if (hits === long.length) res.push([hits * 5 - names[i].length * 0.02, i]);
      }
    }
  }
  res.sort((a, b) => b[0] - a[0]);
  return res.slice(0, limit).map((r) => items[r[1]]);
}
