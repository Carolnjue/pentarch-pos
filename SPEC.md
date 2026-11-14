# Pentarch POS — Product & Technical Spec (shared contract)

Owner: Pentarch Communications (Nairobi) — product line "Pentarch Systems Solutions".
Contact used everywhere: +254 729 455 912 (phone/WhatsApp) · info@pentarchcommunications.com · pentarchcommunications.com
Market: Kenyan SMEs. Currency KES. Languages: English + Kiswahili (UI toggle).
Quality bar: complete, fast, friendly, stands out. Must beat Uzapoint / Simba POS / Loyverse on usability for a Kenyan duka owner. Plain professional wording — no slang, no "AI" fluff.

## 1. Components

| Component | What | Where (default, configurable) |
|---|---|---|
| POS app | Offline-first PWA (Preact + Vite, Dexie/IndexedDB). Installable from Chrome ("Install app"). | `https://pentarchcommunications.com/pos/` |
| Live demo | Same app, demo mode: seeded sample business, data only in this browser, no cloud | `/pos/?demo=1` (or "Try the demo" on welcome screen) |
| Cloud | WordPress plugin **Pentarch POS Cloud** (`pentarch-pos-cloud`): REST API, sync, licences, superadmin, agent portal, demo bookings; serves both PWAs | installed on pentarchcommunications.com |
| Agent portal | Offline-capable PWA for sales agents | `/pos/agents/` |
| Website | POS section/page under Systems on pentarchcommunications.com | `/systems/pos/` |

The plugin serves `/pos/*` and `/pos/agents/*` by rewrite → static files bundled in `pentarch-pos-cloud/public/pos/` and `public/agents/` (built output copied in). It must send correct MIME types, long cache for hashed assets, `no-cache` for `index.html`, `sw.js`, `manifest.webmanifest`, and `Service-Worker-Allowed: /pos/` for the service workers. `<base href>`/asset paths must work under `/pos/` (Vite `base: '/pos/'`, agents `base: '/pos/agents/'`). Also excluded from page cache (send `Cache-Control: no-store` on API; define `DONOTCACHEPAGE` for these routes; LiteSpeed: `X-LiteSpeed-Cache-Control: no-cache`).

## 2. Brand / design system (Pentarch)

Tokens (from the Pentarch site):
```
--ink:#0A1530; --ink-2:#101E40; --ink-3:#182A55; --navy:#1F3C7A;
--coral:#EE4B3B; --coral-d:#C9301F; --sun:#F6B22C; --sun-d:#B97A00; --teal:#14B1AC; --teal-d:#0A7F7B;
--paper:#F7F5F0; --paper-2:#EFEBE3; --line:#E4E0D7; --text:#121A2E; --body:#3D475C; --mute:#646E82;
--grad: linear-gradient(100deg,#EE4B3B 0%,#F6B22C 48%,#14B1AC 100%);
Fonts: headings 'Bricolage Grotesque'; body 'DM Sans'; numbers 'JetBrains Mono' (tabular) — self-hosted via @fontsource (offline!).
```
White text only on ink/navy/coral-d/teal-d. Contrast AA minimum. Logo: `logotrans.png` (Pentarch "P" mark + wordmark) placed at `app/public/brand/pentarch-logo.png` (orchestrator supplies; use placeholder path).
App look: dark ink sidebar (collapsible to icons), light paper workspace, white cards, big touch targets (min 44px), coral primary buttons, teal success, sun for warnings/highlights, gradient used sparingly (brand strip, hero numbers). Smooth 150–200ms transitions, skeletons not spinners, toasts bottom-center, keyboard shortcuts shown as `kbd` chips. Must work at 1366×768 laptop (primary), 1920×1080, touch all-in-one 1024×768, tablet 800×1280 and phone 390×844.

## 3. Data model (IndexedDB via Dexie; same entity names in cloud)

Every synced record: `{ id: string (ULID, client-generated), branch_id?: string, created_at: ms, updated_at: ms, deleted?: 0|1, ...fields }`. Money stored as integer **cents** (KES ×100). Quantities as numbers (decimals allowed for weight). Never hard-delete synced records — set `deleted:1`.

Entities (sync = S, append-only ledger = L, local-only = X):
- `business` S (single record, id = tenant id): name, type, kra_pin, vat_registered, phone, email, address, town, county, logo (dataURL), currency 'KES', modules {restaurant, services, variants, batches, serials, weights, wholesale, units, credit, loyalty, quotes, recipes, multi_branch}, settings {...see §8}
- `branches` S: name, code, address, phone, is_main, receipt_footer
- `devices` S: name, branch_id, last_seen
- `users` S: name, phone, role ('owner'|'manager'|'cashier'|'waiter'|'stock'|'accountant'), pin_hash (SHA-256 of tenantId+pin), branch_ids[], active, max_discount_pct, commission_pct
- `categories` S: name, color, icon, parent_id, sort
- `products` S: name, sku, barcode, barcodes[] (extra), category_id, type ('stock'|'service'|'weight'|'composite'|'non_stock'), unit ('pc','kg','g','l','ml','m','box'...), price, cost (moving average), wholesale_price, wholesale_min_qty, tax ('A'|'B'|'C'|'D'|'E' — eTIMS codes: A Exempt, B 16% VAT, C 0% zero-rated, D Non-VAT, E 8%), track_stock, reorder_level, reorder_qty, has_variants, parent_id (variant → parent), variant_attrs {size,colour,...}, units_of_measure [{name:'Carton', factor:24, barcode, price}], track_batches, track_serials, allow_price_edit, image (small dataURL ≤40KB, optional), favourite (quick key), sort, branch_prices {branch_id: price}, recipe [{product_id, qty}] (composite), service_duration_min, kitchen_station ('kitchen'|'bar'|null), modifiers_group_ids[], active, notes
- `modifier_groups` S: name, min, max, options [{name, price}]
- `stock_moves` L: product_id, branch_id, qty (+in/−out, base units), type ('sale','return','purchase','adjust','count','transfer_out','transfer_in','opening','repack_in','repack_out','recipe','void'), ref_type, ref_id, cost, batch_no, expiry, serial, reason, user_id. **Stock on hand = Σ qty per (product, branch)** — the ledger is the truth; local cache table `stock_levels` X is derived and rebuilt after sync.
- `batches` S: product_id, branch_id, batch_no, expiry (yyyy-mm-dd), qty_received
- `serials` S: product_id, branch_id, serial, status ('in_stock'|'sold'|'returned'), sale_id
- `customers` S: name, phone, email, kra_pin, group ('retail'|'wholesale'), credit_limit, loyalty_points, notes, birthday
- `customer_payments` L: customer_id, amount, method, ref, sale_ids[], user_id, shift_id
- `suppliers` S: name, phone, email, kra_pin, contact, terms_days, notes
- `purchase_orders` S: supplier_id, branch_id, no, status ('draft','sent','partial','received','cancelled'), lines [{product_id, qty, cost}], expected_date, notes
- `goods_received` L: supplier_id, branch_id, po_id, no, supplier_invoice_no, lines [{product_id, qty, cost, batch_no, expiry, serials[]}], total, paid, user_id
- `supplier_payments` L: supplier_id, amount, method, ref, grn_ids[], user_id
- `sales` L: no (branch code + device seq e.g. `NRB1-000123`), branch_id, device_id, shift_id, user_id, customer_id, table_id, order_type ('retail','dine_in','takeaway','delivery'), lines [{product_id, name, qty, unit, factor, price, cost, discount, tax, tax_rate, batch_no, serial, staff_id, modifiers[], note}], subtotal, discount, tax_total, total, rounding, payments [{method:'cash'|'mpesa'|'card'|'bank'|'credit'|'voucher'|'points', amount, ref, phone}], paid, change, balance (credit), status ('completed','void','returned','partial_return'), receipt_note, etims {cu_invoice_no, qr, signed_at} (filled later), void_reason, void_by
- `returns` L: sale_id, lines[{product_id, qty, amount, restock: bool}], refund [{method, amount}], reason, user_id, shift_id
- `quotes` S: no, customer_id, lines, totals, status ('draft','sent','accepted','invoiced','expired'), valid_until
- `orders` S (restaurant open tickets / held carts): kind ('held','table','takeaway','delivery'), table_id, waiter_id, lines (with sent_to_kitchen qty), guests, status ('open','billed','paid','cancelled'), note
- `tables` S: name, area, seats, x, y, shape
- `shifts` S: branch_id, device_id, user_id, opened_at, opening_float, closed_at, counted_cash, expected_cash, variance, totals_by_method {}, notes, status ('open','closed')
- `cash_moves` L: shift_id, type ('pay_in','pay_out','drop'), amount, reason, user_id
- `expenses` L: branch_id, category, amount, method, payee, ref, note, shift_id, user_id, date
- `transfers` S: from_branch_id, to_branch_id, no, lines[{product_id, qty}], status ('sent','received','cancelled'), sent_by, received_by
- `stock_counts` S: branch_id, no, scope ('full'|'category'|'custom'), lines [{product_id, expected, counted}], status ('open','applied'), applied_at
- `promotions` S: name, product_ids[], category_ids[], type ('pct'|'amount'|'price'), value, start, end, days_of_week[], hours
- `audit` L: action (e.g. 'sale.create','sale.void','price.change','discount.apply','drawer.open','stock.adjust','user.login','settings.change','product.delete','shift.close'), entity, entity_id, details {}, user_id, device_id, at
- `meta` X: key/value (device_id, tenant_id, tokens, last_pull_seq, outbox stats, licence cache, demo flag, receipt seq)
- `outbox` X: queued changes {entity, id, op, record, tries}

## 4. Sync protocol (app ⇄ cloud)

Base: `/wp-json/pentarch-pos/v1`. JSON. Auth: `Authorization: Bearer <device_token>` (except register/login/public).

- `POST /auth/register` {business_name, business_type, owner_name, phone, email, password, town, county, agent_code?, device_name, source:'app'|'agent'|'web'} → {tenant_id, device_id, device_token, licence}. Creates tenant with 30-day trial (setting). Phone normalised to 2547XXXXXXXX. Email unique.
- `POST /auth/login` {email, password, device_name} → {tenant_id, device_id, device_token, licence}
- `POST /auth/logout` → revokes device token.
- `GET /licence` → {status:'trial'|'active'|'grace'|'expired'|'suspended', plan, trial_ends, paid_until, days_left, max_branches, max_devices, pay: {paybill, account, amount_monthly, amount_yearly, whatsapp}}
- `POST /sync/push` {changes:[{entity, id, branch_id, data, updated_at, deleted}]} (≤500 per call) → {accepted:[ids], rejected:[{id, reason}], server_seq}. Ledger entities (L) are insert-once (duplicate id ignored = idempotent). Others: last-write-wins by `updated_at`.
- `GET /sync/pull?since=<seq>&limit=1000` → {changes:[{entity, id, branch_id, data, updated_at, deleted, seq}], next_seq, has_more}. Includes the device's own changes (client ignores identical).
- `POST /mpesa/stk` {phone, amount (KES whole), ref} → {checkout_request_id} (only if Daraja configured; else 501) ; `GET /mpesa/stk/<id>` → {status:'pending'|'paid'|'failed', mpesa_receipt}
- `POST /backup` (optional full JSON snapshot upload, gz) — nice-to-have.
- Public: `POST /public/demo-booking` {name, business, business_type, phone, email, town, preferred_date, preferred_time, message, agent_code?, source_page} → {ok, ref}. Rate-limited, honeypot field `website`.
- Public: `GET /public/config` → {trial_days, prices{...}, whatsapp, phone, email}

Client sync loop: every change written locally also goes to `outbox`; when online, push outbox in batches (exponential backoff), then pull since `last_pull_seq`, apply (skip if local updated_at newer for S entities), rebuild `stock_levels` for touched products. Triggers: app start, every 60s, after each sale (debounced 5s), `online` event, manual "Sync now". Status pill: Offline / Syncing / Synced 2 min ago / N waiting.

## 5. Licence & trial rules
- Trial: 30 days from registration (setting `trial_days`, default 30). Banner at ≤7 days. Demo mode has no licence.
- Paid: `paid_until`. After expiry → `grace` 7 days (selling allowed, red banner) → `expired`: selling, purchasing disabled; viewing, reports, export and backup ALWAYS allowed (never hold data hostage). Pay page shows M-Pesa Paybill + account = business code (`PP` + 5 digits) and WhatsApp button.
- App caches last licence; offline it trusts cache until `paid_until + grace`; if never online for 45 days on a trial, prompt to connect.
- Superadmin (Pentarch) sets plan, records payments, extends, suspends.

## 6. Agent portal (PWA at /pos/agents/)
- Sign up: full name, phone (M-Pesa for commission), email, town/county, password, how they heard, agrees to agent terms → status `pending` until Pentarch approves (email to admin). Each agent gets an **agent code** (e.g. `AG-K7Q2`).
- Login → token (`/agents/auth/login`), offline-capable: leads stored locally, queued, synced.
- Leads: business name, contact person, phone, email, business type, town/area, location (optional GPS), current system (paper/Excel/other POS), branches count, package interest ('bundle'|'software'|'unsure'), stage ('new','contacted','demo_booked','demo_done','trial','won','lost'), next follow-up date, notes, activity log (call/visit/WhatsApp/demo with timestamp), lost reason. One-tap WhatsApp/call buttons. Duplicate warning by phone.
- Actions: Book demo (creates demo booking linked to agent), **Start 30-day trial** for the client (calls register with agent_code; shows the login + a prefilled WhatsApp message to send the owner), share demo link with agent code (`/pos/?demo=1&ref=AG-K7Q2`), share website POS page with ref.
- Dashboard: leads by stage (pipeline), follow-ups due today, trials active/expiring, won this month, commission earned/pending/paid, leaderboard (first names only).
- Resources: Sales guide PDF, price list, demo script, objection answers, FAQs, product one-pager — links set in plugin settings.
- Commission: auto-created when a tenant attributed to the agent records a payment: `software_rate` % of software payments for first 12 months (default 20%) + flat `bundle_bonus` per hardware bundle (default KES 3,000). Statuses pending → approved → paid (M-Pesa ref). Rates in settings.
- Endpoints (`/agents/...`): `auth/register`, `auth/login`, `me`, `leads/push`, `leads/pull?since=`, `trials` (POST start trial), `commissions`, `leaderboard`, `resources`.

## 7. Superadmin (wp-admin → "Pentarch POS")
Dashboard (active trials, expiring in 7 days, paying businesses, MRR, new leads, agent activity), Businesses (list/search; view details, branches, devices, last sync, sales volume summary; set plan, record payment → updates paid_until & creates agent commission, extend trial, suspend, reset owner password, export), Agents (approve/suspend, code, rates override, leads, commissions, mark paid), Leads (all, filter by agent/stage), Demo bookings (status new/contacted/done, assign agent, WhatsApp link), Payments, Settings (trial days, plans & prices, commission rates, M-Pesa paybill/account format, Daraja keys (optional), WhatsApp/phone/email, resource links, admin notification email), Tools (purge demo, export CSV). Clean UI using Pentarch tokens inside wp-admin.

## 8. POS app — modules & screens (all must be complete)

Global: onboarding/welcome; PIN lock screen with staff tiles (owner can also use password); top bar: branch, shift status, sync pill, licence days, notifications bell, user menu, language EN/SW; sidebar nav; command palette (Ctrl+K) to jump anywhere/search products/customers/receipts; keyboard shortcuts; responsive.

**Welcome / onboarding**: (1) Try the demo → choose business type → seeded demo (≈40–80 realistic Kenyan products with real-looking barcodes, 30 days of sales history for charts, customers, suppliers, staff with PINs shown on lock screen e.g. Owner 1234, Cashier 1111) (2) Start free trial (30 days) → registration form (works offline: start locally, register when online) (3) Sign in to my business. Then setup wizard: business details & logo, KRA PIN & VAT, branch, receipt (58/80mm, footer, M-Pesa till/paybill), payment methods, staff & PINs, products (type template catalogue / CSV import / add manually / scan to add), printer test, done → checklist on dashboard.

**Sell (POS) screen** (the heart — fastest path to sale):
- Scan anywhere (keyboard-wedge detection: ≥4 chars within 50ms ending Enter; also weight barcodes EAN-13 starting `2` with embedded weight/price; unit-of-measure barcodes → correct pack), search box (name/SKU/barcode, fuzzy, instant over 20k products), category tabs + quick-key grid with colours/images, favourites, last-sold.
- Cart: qty +/− and typed qty (decimals for weight), unit picker (piece/carton), line discount, line note, price override (permission + audit), staff per line (services), serial capture, batch auto FEFO, modifiers popup (restaurant), remove line (permission for after-sent items).
- Cart actions: customer attach/quick create (phone first), cart discount (% or amount, capped by role), hold/park (named), recall held, clear (confirm), wholesale toggle (auto with customer group or qty threshold), order type (restaurant), add tip/service charge (optional setting).
- Pay: big tender screen; methods cash (quick notes 50/100/200/500/1000 + exact), M-Pesa (STK push if online+configured, else enter code; till/paybill shown; code format check), card (ref), bank transfer, credit (customer required, credit limit check), loyalty points, split across methods; change due big; complete → receipt preview + auto print option + "email/WhatsApp receipt" (wa.me link with text receipt) + new sale. Rounding option to nearest 1 KES.
- Receipt: logo, business, branch, KRA PIN, receipt no, date/time, cashier, customer, items, discounts, tax breakdown by code, totals, payments, change, M-Pesa till, footer, QR of receipt no, "Powered by Pentarch POS". eTIMS block placeholder when enabled. 58mm & 80mm print CSS, A4 invoice template for credit sales/quotes.
- Returns/refunds: find receipt (scan receipt QR/number, search by date/customer) → choose lines/qty → restock or damaged → refund method → print return slip. Permission-gated.
- Void last/any sale (permission, reason, audit), reprint receipt, open drawer (no sale, audited), recent sales list.
- Offline: always works; sale numbers unique per device.

**Restaurant (module)**: floor view of tables by area with status colours (free, occupied, bill printed) and elapsed time; tap table → order; guests count; send to kitchen/bar (prints KOT per station, marks sent lines), add more rounds, modifiers & notes, transfer table, merge tables, split bill (by items or equally), print bill, pay; takeaway & delivery queues (customer name/phone/address, rider); waiter mode (limited role); kitchen display screen (KDS) route optional `/kds` showing open tickets with bump.
**Services (module)**: services with duration and staff assignment per line; staff commission %; commission report; simple appointment list (optional).

**Products**: list with search, filters (category, low stock, inactive, no barcode), bulk edit price/category, columns (stock, cost, price, margin). Product form: all fields of §3, variants generator (size × colour matrix with per-variant barcode/price/stock), units of measure, wholesale tier, batches/serial toggles, recipe builder, modifiers, branch prices, image upload (compressed), barcode: scan to set, or **Generate** (EAN-13 internal prefix `20`–`29` range with check digit, or Code128 from SKU). **Print labels**: choose products & quantities (or from GRN), label size presets (38×25, 40×30, 50×25 mm for label printers; A4 sheet 3×8 / 4×10), fields (name, price, barcode, SKU, expiry), print. Categories manager with colours/icons. CSV/Excel import (template download, column mapping, preview, dry-run errors) and export.

**Inventory**: stock on hand per branch (value at cost & retail), stock movement ledger per product (filterable, every move with user & ref — "everything logged"), adjustments (reasons: damaged, expired, theft/loss, own use, found, correction), stock take (create count, scan to count or type, blind count option, variance report with value, apply → count moves), transfers between branches (send/receive with discrepancy), repack/convert (e.g. 50kg sugar → 50×1kg), low stock & reorder suggestions (→ create PO), expiry tracker (expired, ≤30/60/90 days), serial lookup.
**Purchasing**: suppliers (balances, statement), purchase orders (create from reorder suggestions, print/WhatsApp to supplier, status), receive goods (with or without PO; cost update with moving average; batch/expiry; serials; print labels after receiving), supplier payments, supplier returns (adjust out).
**Customers**: list, profile (purchases, balance, payments, points), credit sales & debtor statement (print/WhatsApp), receive payment (allocate oldest first), aging (0–30, 31–60, 61–90, 90+), loyalty settings (earn 1 pt per KES X, redeem value), customer groups (retail/wholesale), SMS/WhatsApp reminder link for debts.
**Quotes & invoices (module)**: quote → convert to invoice/credit sale; A4 PDF-ready print with logo; delivery note.
**Cash & shifts**: open shift (float), pay in/out, cash drop, close shift (count by denominations KES 1000/500/200/100/50/40/20/10/5/1 coins), expected vs counted, variance, Z report print; X report anytime; shift history.
**Expenses**: record expense (category, amount, method, payee, from drawer?), list, categories (rent, salaries, transport, utilities, supplies, airtime, repairs, other), totals.
**Dashboard**: today vs yesterday vs same day last week: sales, transactions, avg basket, gross profit; hourly sales chart; payment method split; top products; low stock; expiring soon; debtors; open shifts; branch comparison (multi-branch); setup checklist; trial banner.
**Reports** (date range presets Today/Yesterday/This week/This month/Last month/Custom; branch filter; print & CSV export): Sales summary; Sales by product; by category; by staff; by payment method; by hour/day of week; by customer; Profit & margin; VAT/tax report (by eTIMS code); Discounts, voids, returns & price overrides (exceptions — anti-theft); Stock on hand & valuation; Stock movement; Low stock; Expiry; Dead/slow stock (no sales in N days); Purchases by supplier; Supplier balances; Debtors aging; Customer statement; Expenses; Profit & Loss (sales − COGS − expenses); Shift/Z history; Staff commission; Audit log viewer (filter by user/action/date).
**Staff & roles**: users (name, phone, role, PIN, branches, max discount, commission), roles permission matrix editable by owner (view-only presets: Owner all; Manager all except billing/delete business; Cashier sell/hold/customers/own shift; Waiter tables/orders only; Stock clerk inventory/purchasing; Accountant reports/expenses read-only), manager-override PIN dialog for restricted actions, auto-lock after N minutes idle.
**Branches & devices** (multi-branch): add branches, assign devices, per-branch prices, consolidated dashboard.
**Settings**: business profile & logo; tax (VAT registered, prices include VAT, default tax code); receipt designer with live preview; printing (58/80, auto-print, copies, kitchen stations, label presets, "print test page"); payment methods (enable/disable, M-Pesa till/paybill, STK via cloud); selling options (allow selling below cost? allow negative stock? require shift? rounding, wholesale threshold, default customer); modules on/off by business type; language; notifications; backup & restore (download JSON backup, restore, auto daily backup reminder), export all to CSV (zip optional), clear sample/demo data, licence & billing, about/help (shortcuts, support WhatsApp).
**Help**: in-app quick guide per screen (short), keyboard shortcuts sheet, "Contact Pentarch support" WhatsApp.

**Business type presets** (each sets modules + demo catalogue + categories): General shop / duka; Minimart & supermarket; Hardware & building materials; Agrovet; Pharmacy / chemist (retail; batches+expiry on); Boutique, fashion & shoes (variants); Electronics & phone shop (serials/IMEI, warranty note); Cosmetics & beauty shop; Butchery (weights); Bakery & cake shop (recipes, orders); Restaurant, café & hotel (restaurant module); Bar & liquor store (restaurant module, bar station); Salon, barber & spa (services + commission); Stationery, bookshop & cyber (services + products); Wholesale & distribution (wholesale tiers, units, credit, quotes); Auto spares (quotes, credit); LPG gas & water refill (deposits handled as products); Other / services.

Performance: first load < 2s on 4G after install instant; search results < 50ms on 20k products; sale completion < 300ms offline. Code-split heavy routes (reports). Bundle core < 250KB gz.

Security: PIN hashing, role checks in UI + server tenant isolation, tokens in IndexedDB, no secrets in app, CSP-friendly (no inline eval), XSS-safe rendering.
Data safety: `navigator.storage.persist()`, outbox never dropped, backup reminders, export always allowed.

## 9. Repo layout
```
/home/claude/pos/
  SPEC.md (this file)
  research/          market & hardware research
  app/               POS PWA (Vite + Preact)  → build to app/dist (base /pos/)
  agents/            Agent portal PWA          → build to agents/dist (base /pos/agents/)
  cloud/pentarch-pos-cloud/   WordPress plugin (PHP 7.4+ compatible, WP 6.x); public/pos and public/agents receive the builds
  docs/              PDFs (sales guide, marketing strategy, hardware & setup guide)
  site/              website POS page block(s)
```
