# Pentarch POS app — QA report

## Integrated build — Phase 1 + 2, plugin 1.1.0 (9 Nov 2026)

Main branch after merging Inventory & Purchasing, Reports & Dashboard & Expenses, and Restaurant & Services & Quotes. Run **serially** on an idle 2-CPU machine (`qa/scripts/run-all.sh` with `OLD_DIST`, log `qa/results-integrated.txt`; previews :4173 → mock :8787 and :4174 → real WordPress :8080).

**Result: 178 of 178 end-to-end steps pass (0 failed, 0 re-runs needed), 30/30 unit tests, Kiswahili 2,748/2,748 strings, 0 untranslated strings seen at runtime, no console errors. Cloud: API 37/37, agent portal 15/15 + first-time 18/18, wp-admin 12/12, POS served by WordPress smoke OK, fresh zip install + live smoke 9/9.**

| Script | Result | Notes |
|---|---|---|
| `npm test` (core, reports, inventory, …) | 30/30 | new: purchases net of supplier returns, refund = negative payment, paid-on-delivery not double counted |
| `i18n-check` | 2,748/2,748 | 54 duplicate keys from the union merge removed (18 had conflicting Kiswahili); `'English@@context'` keys for Delivery (goods vs. restaurant), Delivered, Deliver to (PO), Done (appointment status) |
| smoke · flows-sell · flows-products · flows-shell | 1 + 12 + 6 + 10 | retail Sell unchanged (screens compared with Phase 1 for duka, minimart, hardware, pharmacy: only new nav items + stock figures differ) |
| flows-sync · flows-onboarding (mock **and real WordPress**) | 8+8 · 3+3 | |
| first-time-cashier (EN + SW) | 6 + 6 | |
| **first-time-cashier-p2** (EN + SW, new) | 7 + 7 | restaurant: waiter signs in → lands on Tables → table for 2, food with a side + drink → Send to kitchen (kitchen + bar tickets) → Kitchen display "Done" → table "ready" → waiter prints bill → cashier pays → table free · pharmacy: sale takes the earliest-expiry batch (FEFO) of a medicine with two live batches |
| empty-states · flows-types (18 types) | 1 · 18 | |
| flows-reports | 15/15 | supplier balance = Σ goods_received (net of returns) − Σ supplier_payments; demo must contain a supplier return |
| flows-inventory | 19/19 | new assertions: one source of demo GRNs, every purchase move belongs to a delivery, stock on hand = Σ ledger for every product/branch |
| flows-restaurant · flows-services · flows-quotes · flows-kds-sync | 17 · 7 · 9 · 6 | |
| **flows-demo-embed** (new) | 6/6 | iframe demo on the same origin persists nothing; then `/pos/?trial=1` → trial form, `/pos/`, `?ref=`, `?welcome=1` → Welcome; demo's "Start free trial" inside the iframe opens the full app's trial form; full-screen demo survives a reload of its tab, a new tab shows Welcome, "Leave demo" → Welcome; a real business always wins |
| **upgrade-v1** (new) | 3/3 | Phase 1 build (git c775899) creates a trial business + 55 products and a demo (2,046 sales) → Phase 2 build in the same browser profile: "Update now" prompt, IndexedDB v1→v2 (`kitchen_tickets`, `appointments` added), live + demo data intact, sale after upgrade OK |
| perf | met | search over 20,074 products worst median **7.4 ms** (< 50), sale offline median 39 ms, core JS **196.8 KB gz** (< 250) + 14 KB CSS, Welcome first load 253 ms |
| visual: Phase 1 (40 screens), reports (29), inventory (33), restaurant/services/quotes (23) × desk 1366×768 / touch 1024×768 / phone 390×844 + Kiswahili desk/phone | 632 screenshots | 36 reviewed across modules |

### Integration fixes
| Issue | Fix |
|---|---|
| Demo deliveries seeded twice (reports + inventory seeders), reports' GRNs carved out of opening stock | GRN/payment half of `seed-reports.js` removed; `seed-stock.js` is the single source (deliveries, POs, payments, a supplier return, transfers); reports keep expenses |
| Supplier "paid" double counted (`grn.paid` + the payment `receiveGoods` also writes); returns to suppliers not netted | `purchasesBySupplier` / `supplierBalances`: purchases net of `kind:'return'`, paid = Σ supplier_payments only (on-delivery vs later split by allocation time), oldest-unpaid uses payments + returns; Purchases report shows Received/Returned columns when there are returns |
| Supplier payments from the till counted as P&L expenses (pay-out cash move) | cash move tagged `purpose:'supplier'`, excluded from P&L pay-outs |
| Two "Low stock" / "Expiring soon" widgets (inventory silently replaced the dashboard's, losing report links and card style) | one of each in `home/widgets.jsx`: dashboard card style, header → report, rows → Stock history / Expiry when allowed, "Order these items" for buyers |
| Website demo iframe (same origin) made the demo the default for `/pos/` | demo remembered per tab only and never in an iframe; `?trial=1`, `?welcome=1`; live business always wins; legacy `ppos.mode=demo` cleared; website + `[pentarch_pos_trial_link]` now link to `/pos/?trial=1` |
| Waiter signing in on a till showing Home stayed on the dashboard | restaurant module also redirects on sign-in (not only on route change) |
| Activity log showed raw audit codes (`po.create`, `transfer.send` …) and raw ids in details | 46 Phase 2 action labels (EN + SW); ids shown as branch/supplier/customer/staff names |
| Phone Expiry table: 4 truncated column headers | batch + expiry folded under the item name on phones |
| Count review stat cards truncated at 1024 px ("KES 20,097.…") | whole shillings in the stat cards (exact values stay in the table) |
| Cloud: no Extra till price | `extra_till` setting (default 44,900) in Settings, `/public/config`, `/agents/resources` (portal shows the server value) and as a payment type; defaults verified 69,900 / 21,900 |
| QA fixtures | api-test expected stale prices (84,900/25,900); admin-e2e picked an agent whose businesses were all paid (order-dependent) — both made robust |

Dexie: only the restaurant/services v2 tables were needed; every index used in code exists in `STORES` (checked by script).

### Known limits (integrated build)
* Local WordPress runs on PHP's built-in server: its 2 MB default upload limit is below the 2.2 MB zip, so it was started with `upload_max_filesize=64M` (normal hosting allows this).
* Same as before: no real printers/drawers/scanners, live M-Pesa STK, Safari/Firefox.

---

# Phase 1 report

Date: 9 November 2026 · Build: `npm run build` → `dist/` (base `/pos/`, 55 assets, 1.4 MB, service worker precaches everything for offline use).

**Result: 82 of 82 end-to-end steps pass, 14 of 14 unit tests pass, 1,369 of 1,369 UI strings translated to Kiswahili, no console errors.**
Sync and onboarding were run against **both** the mock cloud and the **real WordPress plugin** (`pentarch-pos-cloud`, WordPress 6.8.3 / PHP 8.3 at `/home/claude/wptest`, `php -S 127.0.0.1:8080 -t wp router.php`).
Full log: `qa/results.txt` (regenerate with `qa/scripts/run-all.sh`).

## Environment
| Item | Detail |
|---|---|
| Browser | Playwright Chromium (headless), viewports 1366×768 (laptop), 1024×768 touch, 390×844 phone |
| App | `vite preview` on :4173 (→ mock cloud :8787) and on :4174 (→ real cloud :8080, `POS_CLOUD=http://127.0.0.1:8080`) |
| Mock cloud | `dev/mock-cloud.mjs` — same contract as the plugin (201 register, 422 `data.fields`, 409 `email_exists`, `superseded`, `/me`, `/licence` with `business_code`/`grace_*`, `/public/config` with `business_types`/prices, minimal business seeded for web/agent trials, STK 501 unless `MOCK_STK=1`) |

## Tests and results

| Script | What it proves | Result |
|---|---|---|
| `npm test` (`test/core.test.mjs`) | money & rounding, eTIMS tax A–E, EAN-13 & scale barcodes, cart maths (discount allocation, tax, rounding), wholesale/UoM/branch prices, promotions, stock ledger + FEFO + moving average, ULID/SHA-256/phone/M-Pesa code, CSV, search ranking + 20k speed, licence (trial/grace/expired, server `grace_days`), prices from `/licence` or `/public/config`, sync apply rule (newer ledger row wins, never resurrect) | 14/14 |
| `scripts/i18n-check.mjs` | every `t()` string and registry label has Kiswahili; runtime misses are also collected (`window.__i18nMissing`) during the Kiswahili visual pass | 1,369/1,369, 0 seen at runtime |
| `flows-sell` | wedge scanning (merge repeat scans, carton UoM barcode), search + `3*` quantity prefix, cash with quick notes + change, M-Pesa code check (rejects bad codes), split cash + M-Pesa, credit sale + later debt payment (allocated oldest first), hold & recall, line discount within role limit + price change, partial return + return slip, void (stock reversed, audited), cashier needs manager PIN to void, close shift with KES denominations → Z report, open new shift | 12/12 |
| `flows-products` | 20k-ready virtual list + low-stock filter, size × colour variants with generated EAN-13s, selling a variant via the picker, labels 38×25 and A4 3×8, CSV import (template, column mapping, error rows skipped), "More options" collapsed for simple use | 6/6 |
| `flows-shell` | Ctrl+K palette (product, customer, page), F1 shortcuts, English ↔ Kiswahili, cashier sees no Settings and is blocked from it, owner edits the role matrix (cashier may void → no PIN asked), JSON backup → restore (`RESTORE`), CSV zip export, WhatsApp receipt (`wa.me` with receipt text), receipt designer 58 mm live preview, idle auto-lock (fake clock, audited) | 10/10 |
| `flows-sync` ×2 (mock **and real cloud**) | trial from welcome with `?ref=AG-K7Q2` prefilled, setup wizard all steps + template catalogue, sale on device A pushes (outbox empty), device B signs in and pulls the sale and stock, **void on B reaches A** (ledger row update), **offline reload still sells** and syncs on reconnect, Licence page shows the **business code as the M-Pesa account number**, **STK 501 → falls back to code entry** | 8/8 + 8/8 |
| `flows-onboarding` ×2 (mock **and real cloud**) | email already registered (409) → message on the email field, nothing created locally, corrected → trial starts; trial started **offline** → sells → registers on reconnect (tenant re-keyed, all data uploaded); **website-started trial** (server seeds minimal business, `updated_at: 1`) → first sign-in runs the wizard and merges (name/type kept, modules + settings added, pushed back) | 3/3 + 3/3 |
| `first-time-cashier` (English **and Kiswahili**) | only visible labels, tour on: tap name + PIN shown, follow the 5-step Sell tour, cash sale (Pay → Exact → New sale), M-Pesa sale (type code → Complete sale), return from the Sell screen approved by a manager PIN pad, undo a removed item | 6/6 + 6/6 |
| `empty-states` | brand-new business: Home checklist, Sell/Products "Your shop has no products yet" with one-tap **Add typical products**, Customers/Sales guidance; template products added (55) and cleared again | pass |
| `flows-types` | all 18 business types (plugin keys `duka … gas_water, other`): demo seeds 34–74 products, 30 days of sales (338–4,699 sales), customers, staff; Sell scan + pay works | 18/18 |
| `perf` | see below | targets met |
| `visual` | 40 screens × 3 viewports in English + desk/phone in Kiswahili (209 screenshots), no console errors | reviewed |

### Defects found and fixed in this pass
| Defect | Fix |
|---|---|
| After the first offline sync attempt the sync lock was never released → no sync until reload (the "offline reload … syncs when back" and two-device tests failed) | `syncNow` releases its lock in `finally` for every path; `online` also re-checks |
| A trial started offline never registered on reconnect (no token → sync returned before `completeRegistration`) | registration retried on `online`, every 60 s and after each sync |
| Trial form: 422/409 from the cloud left a half-created business on the device that could not be corrected | register **first** when online; on 4xx nothing is created and field errors show on the form; background rejections stored and fixable in Licence & billing |
| Offline trial start failed on a fresh install (lazy business-builder chunk not cached yet) | chunk prefetched when the trial form opens |
| M-Pesa code typed quickly after choosing M-Pesa was wiped (method-change effect raced the input) | method switch resets fields synchronously; focus goes to the code field |
| Scans into the Sell search box could concatenate on a busy device ("2000002000000000015" not found) | scan handler uses the whole field value, resolves the real code, clears the box; Enter never handled twice |
| Virtual tables showed a blank band above the first row | rows positioned from 0 under the sticky header |
| Gross profit compared VAT-exclusive sales with VAT-inclusive cost (profit far too low for VAT shops) | cost made net of input VAT for taxed lines |
| Kiswahili dictionary was empty | 1,369 strings translated (plain Kiswahili; "Lock" = "Funga skrini" so it differs from "Close" = "Funga") |
| Phone: sale detail, licence page and trial form overflowed or were squeezed (inline grid templates, `1fr` columns growing to content), sidebar text leaked into the demo banner | `.split-*` / `minmax(0,1fr)` grids, secondary table columns hidden on phones, off-canvas sidebar hidden, compact EN/SW switch, 2-up KPI cards |
| Licence page read old price keys only; no prominent business code | prices from `/licence` → `/public/config` (`software_*` and old keys) → defaults; business code chip with copy; branch-aware totals; grace end date from server `grace_days` |
| "1 items", empty Sell category tabs, vague empty states | pluralised counters, only categories with products, actionable empty states |
| STK kept being offered after a 501 and polling stopped before the server's 3-minute timeout | button hidden after 501 with an explanation; polling covers 3 minutes |

## Performance (`qa/perf.json`, Chromium on this machine)
| Measure | Target (SPEC §8) | Result |
|---|---|---|
| Search over **20,074 products** (worst median of 10 queries incl. typos, barcodes, SKUs) | < 50 ms | **4.8 ms** (best 0.4 ms) |
| Typed search on the Sell screen, input → results painted | — | 23–32 ms |
| Sale completion offline (one IndexedDB transaction: sale, stock moves, audit) | < 300 ms | **median 38 ms** (28–42 ms, 8 sales) |
| Core bundle (entry JS, gzip) | < 250 KB | **141 KB** JS + 10 KB CSS (includes the Kiswahili dictionary); every other page is code-split |
| Welcome screen first load (preview server, no cache) | < 2 s | 187 ms |
| Demo seeding (minimart: 74 products, 4,699 sales, 30 days) | — | 2.1 s |
| Re-index 20k products after reload | — | 0.9 s |

## Screenshots
* Flows: `qa/02-…53-*.png`, first-time cashier `qa/ftc-0[1-5]-*.png` and `qa/ftc-sw-*.png` (Kiswahili), real cloud `qa/37-licence-real-cloud.png`, `qa/4[0-2]-*-real.png`.
* Visual passes: `qa/visual/{desk,touch,phone}-NN-<screen>.png`, Kiswahili `qa/visual/{desk,phone}-sw-NN-<screen>.png`, new business `qa/visual/empty-*.png`.
* Every business type: `qa/types/<type>-sell.png`, `qa/types/<type>-home.png`, `qa/types/summary.json`.

Three visual passes were made (after functionality was complete): pass 1 found the table offset, phone overflow (sale detail, settings, trial form), sidebar leak, sparkline overlap, receipt-number wrapping; pass 2 (after fixes) found the cramped phone KPIs, welcome header overlap and tablet copy ("on the right"); pass 3 found the wrapped licence amounts — all fixed and re-shot.

## Phase 2 — Dashboard, Reports & Expenses
| Script | What it proves | Result |
|---|---|---|
| `test/reports.test.mjs` | engine: totals net of voids/refunds, cost net of input VAT, VAT by eTIMS code with returns, P&L, aging buckets + statement running balance, stock valuation per branch, low stock, expiry, dead/slow, exceptions, commission | 6/6 |
| `flows-reports` | dashboard headline amount = raw today's sales, every card present, KPI drill-down; **every report's totals recomputed from raw IndexedDB rows** (sales, products, categories, staff, payments, hours, customers, profit, VAT A–E incl. returns, P&L, stock value from the *ledger*, movement, purchases, supplier balances, aging = statement closing, expenses, shifts, exceptions, audit + action filter); branch filter; CSV (all rows + totals row, total matches); A4 print document; expense taken from the till lowers the shift's expected cash by exactly the amount and appears in P&L; delete + Undo, audited; custom category; accountant (no P&L, cannot record expenses) and stock clerk (stock reports only); offline reload; empty periods explain what fills each report; pharmacy expiry | 15/15 |
| `visual-reports` | dashboard, catalogue, 24 reports, expenses page + dialog at 1366×768, 1024×768, 390×844, and Kiswahili desk + phone | 0 console errors, 0 untranslated strings |

Speed (minimart demo, 4,660 sales / 30 days, Chromium): every report builds in **< 0.4 s** (sales summary ≈ 80–110 ms, VAT ≈ 110 ms, hours ≈ 150 ms, dead stock ≈ 200–400 ms, most others < 20 ms) — no Web Worker needed. Core bundle 158.6 KB gz (was 144 KB; +9 KB is mostly the new Kiswahili strings), reports chunk 19 KB gz loaded on first report.
Visual passes: (1) value colours / decimals in KPIs, quick tiles wrapping, filter layout, dashboard yesterday line too loud; (2) P&L rows clashing with the Sell `.grand` class, "0.0%" on the Expenses heading, truncated top-product names (stacked bars), expense dialog unstyled; (3) phone period selector wrapping, hourly legend crowding the title, branch filter shown on reports that ignore branches, "min" read as minutes in Kiswahili — all fixed. Screenshots: `qa/visual/{desk,touch,phone}[-sw]-r-NN-*.png`, flow shots `qa/r0[1-9]-*.png`.
Full suite (`run-all.sh`, log in `qa/results-reports.txt`): every Phase 1 flow on the mock cloud passes; the only failures are the 11 real-WordPress steps (a server answered on :8080 but no preview ran on :4174), plus an intermittent keyboard-wedge timing miss in `flows-types` under heavy CPU load (a different business type each run; re-runs pass; Sell code untouched).
Known limits: seeded history is 30 days, so the aging report shows only the 0–30 bucket and "Last month" has partial sales; the real-cloud steps of `run-all.sh` need a preview on :4174.
## Phase 2 — Inventory & Purchasing

| Script | What it proves | Result |
|---|---|---|
| `test/inventory.test.mjs` | ledger before/after per branch, landed cost (extra costs by value), moving average, supplier account (returns + payments pay oldest first, refunds), allocation, reorder quantity, count variance in KES, expiry buckets, PO status/outstanding, transfer batch split, repack cost | 9/9 |
| `flows-inventory` | demo seeds deliveries/POs/payments/adjustments/count/transfers; stock on hand (values at cost & retail, low-stock filter, search, CSV, scan → history with before/after); adjust (damaged, scan in dialog, audited); stock clerk big adjustment → manager PIN (approved_by); **blind** count by stock clerk (scan adds one, typed number, autosave, print sheet, manager unlocks differences, apply → count moves); transfer with shortage (lost in transit, `transfer.discrepancy` audit) and receiving an incoming transfer; repack 50 kg → 50 × 1 kg (remembered pairing); reorder → POs per supplier; PO print A4 + WhatsApp (→ sent); receive against PO (partial, invoice no., transport cost, part payment → PO partial, moving-average cost up, labels page with quantities); carton barcode (bale of 20 → +40); add supplier, pay oldest deliveries, statement; supplier return (stock out + credit); **offline** reload + adjust + receive; pharmacy batch + expiry receive and expired-batch write-off; electronics IMEI receive (count enforced) + IMEI lookup; **live business on the mock cloud**: supplier, GRN, payment, purchase moves pulled by a second device | 21/21 |
| `visual-inventory` | 33 screens × desk/touch/phone + Kiswahili desk/phone (165 screenshots `qa/visual/inv-*`), no console errors, 0 untranslated strings seen | reviewed |

Full suite with both modules (`qa/results-inventory.txt`, preview :4273 → mock :8887): unit 23/23, i18n 1,958/1,958, all Phase 1 flows pass. In the full run, 3 Phase 1 steps timed out under load (flows-sell scan, flows-shell role matrix, flows-sync STK fallback) and passed on an immediate re-run of each script; the 11 `[real]`/:4174 steps failed only because a WordPress answered on :8080 without the :4174 preview running (environment, not code).

Three visual passes: pass 1 fixed oversized action tiles and stat cards, a class clash (`.main`), decimals in stat values, the receive line's “last cost” wrapping, the empty pay amount in the pay dialog and night-time demo delivery times; pass 2 (phone) fixed the line editors (remove button and cost on their own rows), ledger and supplier tables (date folded into the description), and the scan bar; pass 3 hid the scan hint on phones and the expiry widget for businesses without batches.
Defects found by the flows and fixed: scanner bursts into a search field could lose the first digit on a busy page (finders now read the whole field, `data-scan="own"` no longer strips it); a stale effect could overwrite the typed “Paid now” amount; `?new=1` links could open two dialogs; re-opening “Receive stock” from a finished delivery kept the old state (forms are keyed by their link).
## Phase 2 — Restaurant, Services, Quotes & invoices (9 Nov 2026)

`qa/scripts/run-p2.sh` (also wired into `run-all.sh`): **39 of 39 steps pass**, no console errors; i18n 1,779/1,779 (Kiswahili block "Restaurant, Services & Quotes" at the end of `sw.js`), 0 untranslated strings seen in the Kiswahili visual pass; unit tests 14/14.

| Script | What it proves | Result |
|---|---|---|
| `flows-restaurant` | floor by area + status colours + elapsed time + home strip; open table with guests; modifiers + note; send → one KOT per station (kitchen/bar), round 2 prints only new items; cashier removes a sent item → manager PIN + reason → VOID ticket printed + audited; print bill → "bill printed"; transfer (KDS tickets follow) and merge; split by items (part sale, rest stays) and equally (3 shares in Tender, table freed, back to floor); counter sale unchanged; takeaway from Sell → queue statuses → pay → collected; delivery needs phone + address, rider shown; KDS bump + recall; waiter lands on tables, payment needs a cashier/manager PIN; layout edit (add, drag, shape); service charge on dine-in only; bar demo | 17/17 |
| `flows-services` | staff picker pops when a service is added, chip changes staff, sale lines carry staff; commission report (service's own 40 % beats staff 30 %), print + CSV; per-staff / per-service rates saved; appointments: seeded day, book, taken slot + clash warning, arrived → sale with service/staff/client → appointment done; home widget; cyber shop not interrupted | 7/7 |
| `flows-quotes` | seeded quotes in every state + invoices; new quote (customer, search add, qty, price change, discount, validity); A4 print; WhatsApp (status → sent); convert to invoice (credit sale, stock out, due date, A4 with M-Pesa + bank + balance); receive payment → paid; delivery note; convert another quote to a cash sale → sold; credit limit asks manager approval; settings on invoice; wholesale demo | 9/9 |
| `flows-kds-sync` | **two devices on the mock cloud**: restaurant trial on A, typical layout, send to kitchen; B (kitchen tablet, sign in) KDS shows both tickets; B bumps → A floor "Food ready"; **A offline** sends round 2 (own KDS shows it, outbox queued, B does not) → reconnect → B receives it; A pays → B sees order paid + sale | 6/6 |
| `visual-p2` | 23 screens × desk/touch/phone + Kiswahili desk/phone → `qa/visual/p2-*.png` | reviewed (3 passes) |

Defects found and fixed: keyboard focus stayed in the hidden print frame after a KOT/bill print (scanner and Ctrl+L dead) → focus restored; areas ordered alphabetically (bar counter first) → creation order / biggest room first; long tables overlapped round ones → sizes + demo spacing; KDS timer looked like a clock time ("16:06") → "16 min"; equal split shares had cents → whole shillings; appointment service list cut at 18 → full scrollable list; module pages failed to open offline on a fresh install (lazy chunks) → preloaded in the background once the module is on; previous demo's table order stayed in the cart after switching demo type → cart cleared on reseed and orphaned order carts fall back to a counter cart; table bar crowded the cart on the 1024 px tablet and overflowed in Kiswahili → compact one-row bar with wrapping labels; KPI cards stacked; phone quote lines unlabeled.

Phase 1 suite re-run (mock cloud): all pass except timing-sensitive `flows-sell` steps (wedge scan / M-Pesa / hold) that fail intermittently while other engineers' suites load the machine — the **unchanged Phase 1 build fails the same steps under the same load**, so this is environmental. The real-cloud sections were skipped (the :4174 real-cloud preview was not running). Core JS grew 141 → 164 KB gz (Kiswahili strings + Sell extensions), still under 250 KB.

## Not covered / known limits
* Real thermal printers, cash drawers and USB scanners were not available: printing is verified through the print-preview HTML (58/80 mm, A4) and scanning through simulated keyboard-wedge bursts.
* Live M-Pesa STK (needs Daraja keys on the server) was not tested; the 501 fallback was, on both clouds.
* Agent attribution of `?ref=` is asserted on the mock (`__dev/state`); on the real cloud the code `AG-K7Q2` is sent but no such agent exists in the test site.
* Safari/iOS and Firefox were not run (Chromium only).
