// Dexie schema — every entity from SPEC §3. Bump VERSION and add a .version() step for changes.
export const VERSION = 2; // 2: kitchen_tickets, appointments (restaurant / services modules)

/** Entity kinds: S = synced (last-write-wins), L = append-only ledger (insert once), X = local only. */
export const ENTITIES = {
  business: 'S', branches: 'S', devices: 'S', users: 'S', categories: 'S', products: 'S',
  modifier_groups: 'S', stock_moves: 'L', batches: 'S', serials: 'S', customers: 'S',
  customer_payments: 'L', suppliers: 'S', purchase_orders: 'S', goods_received: 'L',
  supplier_payments: 'L', sales: 'L', returns: 'L', quotes: 'S', orders: 'S', tables: 'S',
  shifts: 'S', cash_moves: 'L', expenses: 'L', transfers: 'S', stock_counts: 'S',
  promotions: 'S', audit: 'L',
  kitchen_tickets: 'S', appointments: 'S'
};
export const isSynced = (e) => ENTITIES[e] === 'S' || ENTITIES[e] === 'L';
export const isLedger = (e) => ENTITIES[e] === 'L';

export const STORES = {
  business: 'id',
  branches: 'id, code, updated_at',
  devices: 'id, branch_id',
  users: 'id, role, active',
  categories: 'id, parent_id, sort',
  products: 'id, barcode, *barcodes, sku, plu, category_id, parent_id, type, updated_at',
  modifier_groups: 'id',
  stock_moves: 'id, product_id, [product_id+branch_id], branch_id, type, ref_id, created_at',
  stock_levels: '[product_id+branch_id], product_id, branch_id',
  batches: 'id, product_id, [product_id+branch_id], expiry',
  serials: 'id, product_id, serial, status, sale_id',
  customers: 'id, phone, name, group',
  customer_payments: 'id, customer_id, created_at, shift_id',
  suppliers: 'id, name, phone',
  purchase_orders: 'id, supplier_id, status, created_at',
  goods_received: 'id, supplier_id, po_id, created_at',
  supplier_payments: 'id, supplier_id, created_at',
  sales: 'id, no, created_at, customer_id, shift_id, user_id, status, branch_id',
  returns: 'id, sale_id, created_at, shift_id',
  quotes: 'id, no, customer_id, status, created_at',
  orders: 'id, kind, status, table_id, updated_at',
  tables: 'id, area',
  shifts: 'id, status, user_id, device_id, opened_at',
  cash_moves: 'id, shift_id, created_at',
  expenses: 'id, date, shift_id, created_at',
  transfers: 'id, status, from_branch_id, to_branch_id',
  stock_counts: 'id, status, branch_id',
  promotions: 'id',
  audit: 'id, at, action, user_id, entity_id',
  kitchen_tickets: 'id, order_id, status, station, updated_at',
  appointments: 'id, start, staff_id, status, customer_id',
  meta: 'key',
  outbox: '++seq, id, entity'
};
