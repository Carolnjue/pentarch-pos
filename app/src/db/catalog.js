// In-memory catalogue cache: products, categories, stock levels for the current branch, search index.
// Rebuilt when products/categories change; levels patched on stock changes. Read via the signals.
import { signal } from '@preact/signals';
import { db } from './index.js';
import { on } from '../lib/bus.js';
import { buildIndex, search as runSearch } from '../lib/search.js';

export const catalog = signal({ products: [], byId: new Map(), byCode: new Map(), byPlu: new Map(), categories: [], catById: new Map(), index: null, version: 0 });
export const levels = signal(new Map()); // product_id → qty in current branch
let branchId = null;
let salesRank = new Map();

export async function loadCatalog() {
  const [products, categories] = await Promise.all([db().products.toArray(), db().categories.toArray()]);
  const live = products.filter((p) => !p.deleted);
  const cats = categories.filter((c) => !c.deleted).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name));
  const catById = new Map(cats.map((c) => [c.id, c]));
  const byId = new Map(live.map((p) => [p.id, p]));
  const byCode = new Map();
  const byPlu = new Map();
  for (const p of live) {
    if (p.active === false) continue;
    if (p.barcode) byCode.set(p.barcode, { product: p });
    for (const b of p.barcodes || []) byCode.set(b, { product: p });
    for (const u of p.units_of_measure || []) if (u.barcode) byCode.set(u.barcode, { product: p, uom: u });
    if (p.sku) byCode.set(String(p.sku).toUpperCase(), { product: p, sku: true });
    if (p.plu) byPlu.set(String(p.plu).padStart(5, '0'), p);
  }
  const sellable = live.filter((p) => p.active !== false && !p.has_variants);
  const index = buildIndex(sellable.map((p) => Object.assign(p, { extra: catById.get(p.category_id)?.name || '' })));
  catalog.value = { products: live, byId, byCode, byPlu, categories: cats, catById, index, version: catalog.value.version + 1 };
}

export async function loadLevels(bid = branchId) {
  branchId = bid;
  if (!bid) return;
  const rows = await db().stock_levels.where('branch_id').equals(bid).toArray();
  levels.value = new Map(rows.map((r) => [r.product_id, r.qty]));
}

export async function loadSalesRank() {
  // popularity over the last 30 days to boost search & "top sellers"
  const since = Date.now() - 30 * 86400000;
  const rank = new Map();
  await db().sales.where('created_at').above(since).each((s) => { if (s.status !== 'void') for (const l of s.lines) rank.set(l.product_id, (rank.get(l.product_id) || 0) + 1); });
  salesRank = rank;
}
export const popularity = (id) => salesRank.get(id) || 0;

export function searchProducts(q, limit = 60) {
  const idx = catalog.value.index;
  if (!idx) return [];
  return runSearch(idx, q, { limit, boost: (p) => Math.min(10, (salesRank.get(p.id) || 0) / 20) + (p.favourite ? 3 : 0) });
}
export const stockOf = (id) => levels.value.get(id) || 0;
export const variantsOf = (parentId) => catalog.value.products.filter((p) => p.parent_id === parentId && p.active !== false);

let wired = false;
export function wireCatalog() {
  if (wired) return; wired = true;
  let t;
  const reload = () => { clearTimeout(t); t = setTimeout(loadCatalog, 30); };
  on('change', (entity) => {
    if (entity === 'products' || entity === 'categories') reload();
    if (entity === 'stock_levels' || entity === 'stock_moves') loadLevels();
  });
}

// Read-only QA / support hook (search timing, catalogue size). No data can be changed through it.
if (typeof window !== 'undefined') window.__pposCatalog = { search: (q, n) => searchProducts(q, n), size: () => catalog.value.products.length, indexed: () => catalog.value.index?.items.length || 0 };
