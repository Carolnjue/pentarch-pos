# Pentarch POS app — architecture

Offline-first PWA point of sale for Kenyan SMEs. **Preact 10 + @preact/signals + Dexie 4 (IndexedDB) + Vite 7 + vite-plugin-pwa.**
Built to `dist/` with base `/pos/`; the WordPress plugin `pentarch-pos-cloud` serves it at `/pos/`. The binding contract is `../SPEC.md`.
This document is for the engineers who add the Phase 2 modules (inventory, purchasing, reports & dashboard, restaurant, services, quotes).

```
npm install
npm run dev            # http://localhost:5173/pos/  (proxies /wp-json → $POS_CLOUD, default the mock on :8787)
npm run mock-cloud     # dev/mock-cloud.mjs on :8787 (same contract as the real plugin)
npm run build          # dist/ (base /pos/) + service worker
npm run preview        # http://localhost:4173/pos/ serving dist/ (QA scripts use this)
npm test               # node --test test/*.test.mjs (pure logic: money, tax, barcodes, cart, stock, search, licence, sync rule)
node scripts/i18n-check.mjs   # every UI string has a Kiswahili translation (exit 1 if not)
```

## 1. Folder map

```
src/
  main.jsx, app.jsx       boot: fonts, CSS, render <App/>, boot(), service worker
  state.js                global signals: phase, mode, business, branch(es), device, user(s), shift, sync, licence, lang, route; DEFAULT_SETTINGS
  router.js               hash router (#/path/:param?query) — works under any base path and offline
  modules/
    registry.js           ← THE list of feature modules (add one line per module)
    index.js              collects routes / nav / widgets / settings panels / commands / shortcuts / permissions from enabled modules
    home/ sell/ products/ customers/ shifts/ settings/ help/     Phase 1 modules
  shell/                  Welcome (demo · trial · sign in), Wizard (setup), Lock (PIN tiles), Shell (sidebar, top bar, banners), Palette (Ctrl+K), Shortcuts (F1), Notifications
  auth/                   session.js (boot, demo/live, trial registration, sign-in, PIN login, lock, licence refresh), permissions.js (registry + role matrix), override.jsx (manager PIN), licence.js (pure licence rules, prices)
  db/                     index.js (Dexie open/swap), schema.js (entities + indexes), repo.js (the only write API), stock.js (ledger → levels, FEFO, moving average), catalog.js (in-memory catalogue + search index)
  core/                   business logic without UI: pricing.js (cart maths, promos, tax), sales.js (complete / void / return / hold / drawer), customers.js (balances, aging, payments), shifts.js
  sync/                   api.js (REST client, both auth headers), client.js (outbox push → pull → apply → rebuild levels)
  presets/                types.js (18 business types, modules, demo staff/customers), catalogues.js (Kenyan products per type), seed.js (demo + 30 days of history, template catalogue, buildBusiness)
  print/                  print.js (hidden-iframe printing, barcode/QR SVG), templates.js (58/80 mm receipt, A4 invoice, return slip, X/Z, statement, test page), labels.js
  ui/                     kit.jsx (Btn, Input, MoneyInput, Select, Switch, Seg, Tabs, PageHeader, Empty, Stat, NumPad…), overlay.jsx (modals, confirm, promptText, toasts, Dropdown, Drawer), table.jsx (VirtualTable for 20k rows, Table), charts.jsx, daterange.jsx, printpreview.jsx, tour.jsx, icons.jsx
  lib/                    money (cents), tax (eTIMS A–E), barcode (EAN-13, scale, receipt QR), search, scanner (keyboard wedge), util, ulid, sha256, zip, bus, sound
  i18n/                   index.js (t, tn, setLang), sw.js (English → Kiswahili dictionary)
dev/mock-cloud.mjs        dependency-free mock of the cloud API (register/login/licence/me/push/pull/STK/config)
qa/scripts/*.mjs          Playwright flows (see QA-REPORT.md); qa/*.png screenshots; qa/visual/ visual passes; qa/types/ all business types
test/core.test.mjs        unit tests
```

## 2. Boot and phases

`state.phase` drives the whole screen: `boot → welcome | wizard | locked | app` (see `app.jsx`).

* `boot()` (auth/session.js) reads `?demo=1&type=…` and `?ref=AG-XXXX` (agent code, kept in localStorage and sent with the trial registration), opens the right database and calls `loadState()` (business, branches, users, device, shift, licence, catalogue, stock levels, sales rank).
* **URL intents** (1.1): `?demo=1&type=…` opens the demo; `?trial=1` opens the trial form; `?welcome=1` shows Welcome; `?ref=AG-…` is remembered. A live business on the device always wins (except `?demo=1`). Demo mode is remembered **per tab only** (`sessionStorage ppos.mode`), never inside an iframe (the website embeds the demo on the same origin) — so `/pos/` shows Welcome unless a real business is set up. `exitDemo({trial})` breaks out of an iframe to the top window. Tested by `qa/scripts/flows-demo-embed.mjs`.
* **Two databases**: `pentarch-pos` (live) and `pentarch-pos-demo`. Always call `db()` — never keep the instance, it swaps on demo/live switch. The demo never syncs and has no outbox.
* **Trial registration** (`startTrial`): online → `POST /auth/register` *first* (a 409/422 leaves nothing local and is shown on the form fields); cloud unreachable → the business is created locally with a temporary `local-…` tenant id and `pending_register` meta; `completeRegistration()` retries on the `online` event, every 60 s and after each sync, then `rekeyTenant()` swaps the tenant id, re-hashes PINs and queues every record for upload. If the cloud later rejects the details, `register_error` is stored and Settings → Licence & billing shows a fix-and-retry form.
* **Sign in** (`signIn`): `POST /auth/login`, then pulls everything (`/sync/pull` pages of 1,000) before showing the lock screen. A business started by an agent or the website arrives as a *minimal* record (no modules/settings, `updated_at: 1`): `buildBusiness({existing})` merges presets into it (never blanking a real value), creates the branch and owner (PIN 1234, hinted on the lock screen) and the setup wizard runs.
* **Lock / PIN**: `pin_hash = sha256(tenantId + pin)`. The owner can also unlock with the account password. Idle auto-lock: `settings.auto_lock_min` (checked every 15 s). `Ctrl+L` locks.

## 3. Data layer

### Entities (`db/schema.js`)
Same names as the cloud (SPEC §3). Kind: **S** synced, last-write-wins on `updated_at`; **L** append-only ledger (insert once; the only later change is a status, e.g. sale → void); **X** local only (`stock_levels`, `meta`, `outbox`).
Every synced row: `{ id (ULID), created_at, updated_at (ms), deleted: 0|1, branch_id? }`. **Money is integer cents** (`lib/money.js`), quantities are numbers (decimals for kg). Never hard-delete — `remove()` sets `deleted: 1`.

To add an entity or index: add it to `ENTITIES` (with its kind) and `STORES`, **bump `VERSION`** and add a `db.version(n).stores(...)` step in `db/index.js` if you change existing indexes. The cloud accepts any entity name matching `[a-z][a-z0-9_]{0,39}` (except `meta`, `outbox`, `stock_levels`), so new Phase 2 entities sync without plugin changes; ledger behaviour on the server is fixed to the SPEC list.

### Writing — `db/repo.js` is the only write API
```js
import { save, saveMany, patch, remove, audit, tx } from '../db/repo.js';
await save('suppliers', { name, phone }, { audit: { action: 'supplier.create', details: { name } } });
await patch('purchase_orders', id, { status: 'sent' });            // S entities only; ledgers need { force: true }
await tx(async () => { /* several writes in ONE IndexedDB transaction */ });
```
`save` stamps id/created_at/updated_at/branch_id, writes, queues the record in `outbox` (live mode), optionally writes an `audit` row in the same transaction, then emits `bus 'change' (entity, ids)`. Options: `silent` (no event), `keepTimes` (sync/seed), `outbox: false`.

### Stock — the ledger is the truth (`db/stock.js`)
`addMoves([{product_id, qty (+in/−out, base units), type, ref_type, ref_id, cost, batch_no, expiry, serial, reason}])` writes `stock_moves` and updates the `stock_levels` cache in the same transaction. Types already used: `sale, return, void, recipe, opening`; Phase 2 adds `purchase, adjust, count, transfer_out, transfer_in, repack_in, repack_out`. Helpers: `onHand`, `batchBalances` + `fefo` (first-expiry-first-out), `movingAverage(curQty, curCost, inQty, inCost)`, `rebuildLevels(productIds?)` (after sync pulls).

### Catalogue cache (`db/catalog.js`)
Signals `catalog` (products, `byId`, `byCode` incl. extra barcodes / UoM barcodes / SKU, `byPlu`, categories, search index) and `levels` (stock in the current branch). Reloads itself on `'change'` events for products/categories/stock. `searchProducts(q)` ranks by name prefix, popularity (30-day sales rank) and favourites; typo-tolerant; ~1–5 ms on 20,000 products.

## 4. Sync (`sync/client.js`, `sync/api.js`) — SPEC §4

* Token in **both** `Authorization: Bearer <t>` and `X-PPC-Token: <t>`.
* `syncNow(reason)`: push the outbox in batches of ≤500 (newest queued version per record wins) → `accepted`/`superseded` ids leave the outbox, `rejected` stay with a reason (shown in Settings → Branches & devices) → pull since `last_pull_seq` → `applyChanges` → `rebuildLevels` for touched products → `'change'` events.
* Apply rule (`shouldApply`): a pulled row replaces the local one only if its `updated_at` is **strictly newer** — for S *and* L entities, so a void made on another till reaches every device, and our own echo is ignored.
* Triggers: start, every 60 s, 5 s after each sale, `online` event, "Sync now" (top-bar pill). Exponential backoff on errors; 401 → "signed out by the cloud" notice. The lock is always released (also when offline), so reconnecting syncs immediately.
* Status pill: Offline · N waiting / Syncing / Synced 2 min ago / Sync problem. `window.__pposSync.state()` exposes read-only state for support and QA.
* M-Pesa STK: `POST /mpesa/stk` only when `settings.mpesa_stk`; a 501 (no Daraja keys for the business) hides the button for the session and asks for the code instead; status polling lasts the server's 3 minutes.

## 5. Permissions, roles, manager override

Modules declare permissions; owners override them per role in Settings → Staff & roles (`settings.role_perms`). Owner always has everything.
```js
permissions: [{ key: 'inventory.adjust', label: 'Adjust stock', group: 'Inventory', roles: ['owner', 'manager', 'stock'] }]
can('inventory.adjust')                                   // current user
const approver = await requirePerm('inventory.adjust', t('Adjust stock of {name}', { name }));  // asks for a manager PIN if needed; null = refused
```
Every sensitive action should also `audit()` (who, what, when, device). The audit log viewer is Settings → Activity log.

## 6. The module registry — how to add a Phase 2 module

1. Create `src/modules/<name>/index.js` exporting a module object.
2. Add **one line** to `src/modules/registry.js` (import + add to `MODULES`).

```js
// src/modules/inventory/index.js
import { lazy } from '../../lib/lazy.jsx';            // code-split every page
import { navigate } from '../../router.js';
const StockPage = lazy(() => import('./StockPage.jsx'));
const Adjust = lazy(() => import('./Adjust.jsx'));
export default {
  id: 'inventory',
  enabled: (biz) => true,                              // optional: e.g. (biz) => !!biz.modules?.restaurant — hides routes, nav, widgets, panels, commands
  permissions: [ { key: 'inventory.view', label: 'View stock', group: 'Inventory', roles: ['owner', 'manager', 'stock', 'accountant'] },
                 { key: 'inventory.adjust', label: 'Adjust stock', group: 'Inventory', roles: ['owner', 'manager', 'stock'] } ],
  routes:   [ { path: '/inventory', component: StockPage, perm: 'inventory.view', title: 'Stock' },
              { path: '/inventory/adjust/:id', component: Adjust, perm: 'inventory.adjust', title: 'Adjust stock' } ],  // component gets { params, query }
  nav:      [ { path: '/inventory', label: 'Stock', icon: 'layers', order: 25, perm: 'inventory.view' } ],   // order: Home 0, Sell 10, Sales 15, Products 20, Customers 30, Shifts 40; section: 'system' → lower group
  widgets:  [ { id: 'expiry', order: 23, size: 'sm', component: ExpiryWidget, perm: 'inventory.view' } ],     // Home dashboard; size 'sm' | 'md' | 'full'; component gets { f } (homeFigures())
  settings: [ { id: 'stocktake', label: 'Stock take', icon: 'clipboard', order: 12, component: lazy(() => import('./Settings.jsx')), perm: 'settings.view' } ],
  commands: [ { id: 'inv.adjust', label: 'Adjust stock', icon: 'sliders', run: () => navigate('/inventory'), perm: 'inventory.adjust', keywords: 'damaged expired theft' } ], // Ctrl+K palette
  shortcuts:[ { keys: 'Scan', label: 'Scan to count', scope: 'Stock take' } ]                                 // F1 sheet
};
```
Labels are English source strings; the shell translates them with `t()`. Add the Kiswahili to `src/i18n/sw.js` and run `node scripts/i18n-check.mjs`. Keys must be unique in `sw.js` (a later duplicate silently wins); when the same English needs a different Kiswahili, use a context key `t('Delivery@@goods')` (shown as "Delivery" in English).

### Extension points added in Phase 2 (restaurant / services / quotes)
* **Sell-screen extensions** — a module may declare `sell: { CartBar, LineExtra, afterAdd(key, product), beforePay() → bool, onHold() → bool }`; `SellPage` renders/calls them via `sellExtensions()` (`modules/index.js`). Only enabled modules take part, so retail shops see no change.
* **Cart** (`sell/cart.js`) — `cart.meta` (stored on the sale as extra fields when it completes, e.g. `{order_id}`, `{quote_id}`, `{appointment_id}`), `cart.tableId`, `emptyCart()`, and `lineGuards` (a guard can block a quantity cut / removal and handle it itself — used for items already sent to the kitchen; `setQty(key, q, true)` / `removeLine(key, true)` bypass guards).
* `completeSale({… table_id, extra})` spreads `extra` into the sale record. `openTender({ shares: n })` shows "each pays" for equal bill splits.
* **Demo seeding** — `module.demoSeed(ctx)` runs at the end of `seedDemo` for enabled modules (`ctx = {type, business, branch, users, products, customers, now, stamp, rnd}`; write with `db().<table>.bulkPut`).
* New synced entities (schema VERSION 2): `kitchen_tickets` (S: order_id, station, round, kind 'order'|'void', lines, status 'new'|'done', bumped_at) and `appointments` (S: customer, product_id, staff_id, start, duration_min, status booked|arrived|done|cancelled|no_show, sale_id). The mock cloud now accepts any entity name like the plugin. Inventory, purchasing, reports and expenses needed no schema change. Upgrading a Phase 1 (v1) database in place is tested by `qa/scripts/upgrade-v1.mjs` (`OLD_DIST=<build of c775899>`).

### Restaurant / services / quotes — how they work
* **Restaurant** (`modules/restaurant/`, on for `modules.restaurant`): `/tables` floor (areas, drag-to-arrange edit mode, status colours, elapsed time, "Ready" when all tickets are bumped), `/orders` takeaway & delivery queue, `/kds` kitchen display (syncs every 8 s, wake lock, never auto-locks). An open order lives in the Sell cart (`cart.heldId = order.id`, `meta.order_id`) and is auto-saved back to `orders` (`logic.js#flush`, read + write in one transaction so a completed sale is never re-opened). Send to kitchen = one `kitchen_tickets` row + one 80 mm KOT per station (rounds); removing a sent item needs `restaurant.void_sent` approval + reason → VOID ticket. Split by items creates a part order (`parent_id`) paid on its own; split equally uses Tender shares. Waiters land on `/tables`; payment needs `restaurant.take_payment` (approval PIN otherwise; Settings → Restaurant can allow it).
* **Services** (`modules/services/`): fast staff picker when a service is added (default: only if someone earns commission), scissors chip per line, rate = service's own `commission_pct` else staff `commission_pct` (products only if `commission_on_products`), `/commission` report, `/appointments` (arrived → sale; sale completes → appointment done).
* **Quotes** (`modules/quotes/`): `quotes` records; invoice = credit sale (`doc_type:'invoice'`, `quote_id`, `due_date`, `terms_days`) so balances, statements and customer payments are the existing ones; convert-to-sale loads the cart (`meta.quote_id` → quote "sold"). A4 quote / invoice (M-Pesa + bank details) / delivery note in `quotes/print.js`.

### Notes for each Phase 2 module
* **Inventory** — stock on hand per branch (`stock_levels` + `cost`), movement ledger per product (`stock_moves` by `product_id` index; every move has `user_id` and `ref`), adjustments (`addMoves` type `adjust` with `reason`; audit `stock.adjust`), stock take (`stock_counts` S entity → on apply write `count` moves for the variance), transfers (`transfers` S; `transfer_out` on send, `transfer_in` on receive), repack (`repack_out`/`repack_in` pair), expiry (`batchBalances`), serial lookup (`serials`). The Products list already links low-stock filters; the Home "Low stock" and "Expiring soon" widgets live once, in `modules/home/widgets.jsx` (rows drill into Stock pages when the user has `inventory.view`, the card into the report).
* **Purchasing** — `suppliers`, `purchase_orders` (S), `goods_received` and `supplier_payments` (L). Receiving: in one `tx()` save the GRN, `addMoves` type `purchase` with `cost`, `batch_no`/`expiry`/serials, update product `cost` with `movingAverage`, then offer label printing (`#/products/labels?ids=<id>,<id>` opens the label page with those products). Demo suppliers per type are in `presets/types.js` (`DEMO_SUPPLIERS`).
* **Reports & dashboard** — code-split every report page. Reuse `modules/home/data.js` (`salesBetween`, `summarize`: totals, profit net of VAT, hours, methods, top products), `ui/daterange.jsx` (Today/Yesterday/This week/This month/Last month/Custom), `ui/charts.jsx`, `VirtualTable`, `toCsv` + `download`, `previewPrint`. The exceptions report reads `audit` actions `sale.void`, `discount.apply`, `price.change`, `drawer.open`, `sale.return`, `cart.clear`. Dashboard widgets plug in through `widgets`.
* **Restaurant** — entities `orders` (kind table/takeaway/delivery; held sales already use kind `held`), `tables`. The Sell cart already supports modifiers (`modifier_groups`, popup in `sell/dialogs.jsx`), line notes, `kitchen_station` on products and `order_type`/`table_id` in `completeSale()`. Enable with `enabled: (biz) => !!biz.modules?.restaurant`; demo data for restaurant/bar types exists. KOT printing: add a template next to `receiptHtml` and print per station with `printHtml`.
* **Services** — `staff_id` per cart line and `service_duration_min` exist; `users.commission_pct` is set in Staff. The commission report = Σ line totals by `staff_id` × rate.
* **Quotes & invoices** — `quotes` (S). `print/templates.js#invoiceHtml` already renders an A4 invoice with logo and KRA PIN; convert a quote by loading its lines into the cart (`restoreCart` in `sell/cart.js`) or by calling `completeSale` with a credit payment.

### Dashboard, Reports & Expenses (Phase 2 — built)
* **Dashboard** (`modules/home/`): plain-language headline (`headline(f)`: "You sold KES 23,400 today, 12% more than last Monday at this time"), KPI cards (today vs yesterday vs same weekday last week, same time of day), hourly chart with yesterday's line, payment split, branch comparison (multi-branch only), top products, low stock, expiring soon (batch products only), debtors, open shifts, 30-day trend, setup checklist, trial card. Every card/KPI links to the report behind it when the user may open it. `homeFigures()` now also returns `yestFull`, `branches`, `at`; `salesBetween(from, to, branchId)` takes `null` for all branches. Styles in `home/dashboard.css` (also holds the shared chart CSS).
* **Reports** (`modules/reports/`): `engine.js` = pure functions over raw rows (unit-tested in `test/reports.test.mjs`), `data.js` = indexed range queries with a 60 s cache cleared on any `'change'`/`'synced'`, `defs.jsx` = the 24 report definitions (`{id, group, perm, range, filters, run(ctx) → {sentence, kpis, charts, tables, empty}}`), `ReportPage.jsx` = generic page (period presets, branch filter, sortable tables with totals row, A4 print via `format.js#reportHtml`, CSV via `exportCsv`), `viz.jsx` = responsive SVG/HTML charts (`Bars`, `HBars`, `Heat`, `Stack`). Add a report = add one object to `REPORTS`. Everything except the module stub is code-split (`defs` chunk ≈19 KB gz). `window.__report` exposes the last result for QA. Purchases/supplier reports read `goods_received` / `supplier_payments` directly (lines `{product_id, qty, cost}`, `total`, `paid`), so they work with whatever Purchasing UI writes those entities.
* Permissions: `reports.open` (nav), `reports.view`, `reports.profit`, `reports.pnl` (owner only by default), `reports.stock`, `reports.purchases`, `reports.exceptions`, plus existing `audit.view`, `shift.view_all`, `products.cost_view` (cost columns hidden without it). Accountant: all reports except P&L, read-only expenses.
* **Expenses** (`modules/expenses/`): `api.js#recordExpense` (cash + "taken from the till" + open shift → `shift_id`, so `core/shifts.js#shiftSummary` lowers expected cash), soft delete with Undo (ledger row `deleted:1`, audited `expense.create/delete/restore`), built-in categories with stable ids (`cats.js`) + custom ones in `business.settings.expense_categories` `[{id:'c_…', name, hidden?}]`.
* Demo data: `presets/seed-reports.js` adds a month of expenses sized to each shop's gross profit (some paid from the till, adjusting closed shifts' expected/counted cash). Deliveries, POs, supplier payments and returns come **only** from `presets/seed-stock.js` (integration 1.1), so stock on hand = Σ ledger and supplier balances agree everywhere.
* Purchases maths (integration 1.1): purchases are **net** of returns to suppliers (`goods_received` `kind:'return'`, negative); money paid comes only from `supplier_payments` (refund = negative payment) — `grn.paid` is informational because `receiveGoods` also writes the matching payment. Supplier payments taken from the till (`cash_moves` `purpose:'supplier'`) are not P&L expenses (stock is costed through COGS).

## 7. Selling internals (for anyone touching Sell)
* `sell/cart.js` — cart signal, persisted per device (survives reloads), `addProduct/setQty/updateLine/restoreCart`; `totals` = `computeCart()` (core/pricing.js: unit price by UoM/wholesale/branch price/promotion, line + cart discounts allocated, eTIMS tax per code, rounding, service charge).
* Scanner: `lib/scanner.js` turns ≥4 chars within 50 ms + Enter into a bus `'scan'` event anywhere; the Sell search box keeps raw input (`data-scan="keep"`) and the page uses the whole field value, so a split burst on a busy device still resolves. Weight/price barcodes (`2x` prefixes in settings), UoM barcodes (cartons) and receipt QR codes are handled in `handleCode`.
* `core/sales.js#completeSale` writes the sale, stock moves (FEFO batches, serials, recipes), loyalty points and audit rows in **one transaction** (≈20–50 ms offline). Receipt numbers: `<branch code><device no>-<6 digits>`, unique per device.
* Tender: cash quick notes, M-Pesa code format + reuse check (`sell.mpesa_reuse`), STK, card/bank refs, credit with limit check (`sell.credit_over_limit`), points, split payments.

## 8. UI, brand and copy
* Tokens and components in `src/styles.css` (SPEC §2: ink sidebar, paper workspace, coral primary, teal success, sun highlights, gradient strip). Fonts are self-hosted via @fontsource (offline). Touch targets ≥44 px; layouts tested at 1366×768, 1024×768 touch and 390×844.
* Page skeleton: `<div class="page"><PageHeader …/>…</div>`. Use `Empty` with a sentence that says what to do next and a button; `StartCatalog` (products/StartCatalog.jsx) is the "no products yet" pattern.
* Confirm destructive actions with `confirm({danger: true})`, offer **Undo** in a toast where possible (`toast(msg, {action:{label, fn}})`), put advanced fields under "More options".
* Two-column pages use `.split-360` / `.split-even` (they stack below 1100 px); never inline `gridTemplateColumns` with fixed columns (it breaks phones).
* **i18n**: wrap every string in `t('…')` (`tn(n, '{n} item', '{n} items')` for counts). Kiswahili lives in `i18n/sw.js`; `scripts/i18n-check.mjs` finds missing keys statically and `window.__i18nMissing` collects any string shown in Kiswahili without a translation (the visual QA script prints them). Use plain words: Uza, Lipa, Weka kando, Rudisha bidhaa.
* Printing: build a body with `doc()` and call `printHtml(html, {copies})`; preview with `previewPrint(html, {paper})`. 58/80 mm and A4 CSS are in `print/print.js`.
* Sell tour: `ui/tour.jsx` (`SELL_TOUR`, 5 steps, skippable, replay from Help). Add a tour for a new screen with `startTour('<id>', STEPS)`.

## 9. Presets and demo data
`presets/types.js` — 18 business types with the plugin's keys (`duka … gas_water, other`), modules switched on per type (`modules` per type, merged by `modulesFor` in seed.js), demo staff with visible PINs (Owner 1234, Manager 2222, Cashier 1111…), customers and suppliers. `catalogues.js` — realistic Kenyan products and prices per type (barcodes are internal EAN-13 `20…`, scale PLUs for weighed items, UoMs, variants, serials, batches, recipes, modifiers). `seed.js#seedDemo(type)` builds the catalogue, opening stock and **30 days of sales** with realistic hourly/weekday patterns, payments mix, credit sales and payments, returns, voids, shifts with Z reports and audit rows. `addTemplateCatalogue(type)` adds the catalogue to a real business (wizard, "Add typical products").

## 10. Testing
* Unit: `npm test`.
* End to end (Playwright, Chromium): build, then `npm run preview` (port 4173) and `npm run mock-cloud` (port 8787). For the real WordPress cloud run a second preview proxied to it: `POS_CLOUD=http://127.0.0.1:8080 npx vite preview --port 4174`, then `CLOUD=http://127.0.0.1:8080 BASE=http://localhost:4174/pos/ node qa/scripts/flows-sync.mjs` (same for `flows-onboarding.mjs`).
* `qa/scripts/run-all.sh` runs everything (unit, i18n, all flows on the mock, sync + onboarding on the real cloud when :8080 answers, perf, visual) and writes `qa/results.txt`.
* Scripts: `smoke`, `flows-sell`, `flows-products`, `flows-shell`, `flows-sync`, `flows-onboarding`, `flows-types` (all 18 business types), `first-time-cashier` (`LANG_UI=sw` for Kiswahili), `empty-states`, `perf`, `visual` (`node qa/scripts/visual.mjs desk touch phone`, `LANG_UI=sw` for Kiswahili). Results and numbers: `QA-REPORT.md`.

## 11. Conventions
* Business logic in `core/` (no JSX), UI in modules; modules talk through the registry, the bus (`'change'`, `'sale'`, `'scan'`, `'notify'`, `'synced'`) and `state.js` signals — never import another module's page component.
* Every write through `repo`; every sensitive action audited; every list that can grow uses `VirtualTable`.
* Export, backup and viewing must keep working when the licence has expired (`licenceState().canSell` gates selling and purchasing only).
* No secrets in the app; render user text through JSX or `esc()` (print templates).

## 12. Inventory & Purchasing (Phase 2)
Modules `modules/inventory` (nav **Stock**, order 25) and `modules/purchasing` (nav **Purchases**, order 27); both registered in `registry.js`.
* **Logic** — `core/stockmath.js` (pure, unit-tested in `test/inventory.test.mjs`: running balance, landed cost, supplier account FIFO, reorder qty, count variance, expiry buckets, PO status), `core/inventory.js` (adjust, stock counts, transfers, repack, batch rows, reorder suggestions, serial lookup, document numbers `PO-/GRN-/SR-/TR-/CNT-<branch><device>-0001` from `meta seq_*`), `core/purchasing.js` (suppliers, POs, `receiveGoods`, `paySupplier`, `returnToSupplier`, balances). Every quantity change goes through `addMoves` in one `tx()` with its document and an `audit` row.
* **Data** — no schema change. `goods_received` holds deliveries (`kind:'receipt'`, + total, lines with `unit_cost` incl. shared extra costs, optional `pack`) **and** returns to suppliers (`kind:'return'`, negative line qty and total). Supplier balance = Σ goods_received.total − Σ supplier_payments.amount (a refund from a supplier is a negative payment); credits pay the oldest deliveries first, payments also store `allocations`. Moves: `purchase` (ref_type `grn`), `adjust` (reason damaged/expired/theft/own_use/found/correction/returned_to_supplier), `count` (ref `stock_count`), `transfer_out/in` (ref `transfer`; lines keep FEFO batches and serials; shortages recorded on the transfer), `repack_out/in`. Cost = moving average over all branches. Serial statuses add `written_off`, `in_transit`, `lost`. Products may carry `repack {to_id, yield}`. Settings keys: `inv_approve_over` (cents, default KES 1,000), `inv_blind_default`, `inv_labels_after_receive`, `po_footer`.
* **UI helpers** — `modules/inventory/common.jsx` (sub-tabs, `ProductAdder` with `data-scan="own"` that resolves the whole field on Enter, `QtyIn`, `useScan` that ignores scans while a dialog is open unless `{dialog:true}`, `useBranchLevels`), `stock.css` (code-split). Print: `print/stockdocs.js` (PO, GRN / return note, transfer note, count sheet, supplier statement, PO WhatsApp text).
* **Permissions** — `inventory.view/adjust/approve/count/count_apply/transfer/repack`, `purchasing.view/receive/orders/pay/returns`, `suppliers.edit`; Stock clerk gets everything except approve and pay. Adjustments / count differences above the limit ask for a manager PIN (`requirePerm('inventory.approve')`); blind counts hide system quantities until a manager unlocks the differences. Licence `canPurchase` gates receiving, orders, payments and returns.
* **Demo data** — `presets/seed-stock.js` (called once from `seedDemo`): 6 deliveries with payments, POs (received/sent/draft), adjustments, an applied count, a supplier return, and for multi-branch types one received transfer (with a shortage) and one in transit. Adds ~0.1–0.5 s.
* **Shared files touched** — `modules/registry.js` (2 imports), `modules/index.js` (widgets: a later module wins on the same `id`; optional `when()`), `lib/scanner.js` (`data-scan="own"` no longer strips the field), `products/Labels.jsx` (`?qty=` and `?exp=` per id), `products/ProductForm.jsx` (“Full stock history” link), `presets/seed.js` (one call), `i18n/sw.js` (block at the end), `qa/scripts/run-all.sh`.
