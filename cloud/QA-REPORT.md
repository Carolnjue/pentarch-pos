# Pentarch POS Cloud — QA report

Date: 9 Nov 2026.

**Result: 64 of 64 automated checks pass** (API 37/37, agent portal 15/15, admin and website 12/12).

## Test environment

| Item | Version / detail |
|---|---|
| WordPress | 6.8.3, cloned from GitHub |
| PHP | 8.3.6 CLI, served with `php -S -t wp router.php` (router imitates Apache's WordPress rewrite) |
| Database | `WordPress/sqlite-database-integration` drop-in (MySQL-on-SQLite). No MySQL was available. |
| Browser automation | Playwright Chromium |
| Email | a test-only mu-plugin captured `wp_mail` to `wp-content/mail.log` |

The SQL is written for MySQL/MariaDB first:
- `dbDelta` uses the required formatting, `utf8mb4`, and index lengths ≤ 191.
- Pushes take a `GET_LOCK` per business; this is skipped on SQLite.
- The sync code uses only `INSERT IGNORE`, multi-row inserts and transactions.

The SQLite emulation handled all of it, including a clean `dbDelta` re-run.

## What was tested

### 1. Static checks
- `php -l` on every PHP file (also run by `build.sh`).
- A scan for PHP 8-only syntax and functions (`match`, `?->`, `str_contains`, attributes, enums…): none found, so the code is 7.4-compatible.
- `fputcsv` takes explicit arguments, so it will not trigger PHP 8.4 deprecations.

### 2. Packaging and install
- `build.sh` builds the agent portal, copies `agents/dist` and `app/dist`, precompresses text assets, lints and zips. Output: `pentarch-pos-cloud.zip`, 1.7 MB, 175 files, zip root `pentarch-pos-cloud/`.
- On a **fresh** WordPress with **plain permalinks**, the zip was installed with WordPress's own `Plugin_Upgrader`, the same path wp-admin uses for "Upload Plugin". Results:
  - activation OK, 13 tables created
  - `dbDelta` re-run: no errors
  - `/pos/` → 200
  - `/pos/agents/sw.js` → 200 `text/javascript`
  - `/wp-json/pentarch-pos/v1/public/ping` → 200
- **Uninstall:**
  - without the delete flag, tables and settings are kept
  - with *Delete ALL data* ticked, 0 tables are left and the options are deleted
- **`.htaccess` writer** (with `$is_apache` simulated):
  - the block is placed *above* the WordPress block
  - writing twice does not duplicate it
  - removal on deactivation is clean

### 3. API — `qa/api-test.mjs` (37/37)

**Owner accounts**
- `register`: validation (422 with field errors); duplicate email (409); phone stored as `2547…`; email lower-cased; 30-day trial; `PP` + 5-digit code; only the SHA-256 of the token is stored; password hashed.
- `login`: wrong password 401; a second device gets its own token.
- `/licence`: full response shape; 401 with no token or a bad token.
- The `X-PPC-Token` fallback header works.

**Sync**
- **2,000 mixed records** (products, customers, categories, sales, stock_moves, audit, suppliers, expenses) pushed in 4 batches of 500: all accepted, **439 ms total**.
- A 501-item batch gets **413**.
- **Pull with paging:** `limit=1000` gives 2 pages with `has_more`/`next_seq`. All 2,000 ids came back with strictly increasing `seq`. `limit=5000` is capped at 1000. Pulling 2,000 took **35 ms**.
- **LWW:** a newer edit from device 2 wins; an older edit from device 1 is ignored (`superseded`); the changed record appears once after `since`; soft delete propagates.
- **Ledger idempotency:**
  - re-pushing 250 sales: no new rows, `MAX(server_seq)` unchanged, empty pull
  - a strictly newer version (sale `void`) is applied
  - duplicates within one batch collapse to one row
- **Rejections:** `local_only_entity`, `invalid_entity`, `invalid_id`, `invalid_updated_at` and `updated_at_in_future` are reported while valid items in the same batch are accepted.
- **Tenant isolation:**
  - business B pulls none of A's data
  - the same record id under B is stored separately and never reaches A
  - A cannot read B's M-Pesa request (404)

**M-Pesa**
- STK push returns **501** `mpesa_not_configured`.
- Callback with a wrong secret gets 403.
- A valid licence callback marks the request `paid` (receipt stored), auto-records the payment and turns the licence `active` with plan `monthly`.

**Backup, profile, logout**
- `/backup` stores the JSON snapshot; `/me` works.
- `logout` revokes only that device's token.

**Agents**
- Sign-up: terms are required; the account is `pending` with an `AG-XXXX` code; duplicate email gets 409.
- A pending agent can log in (by email or phone) and read `/me`, but `leads/push` gets 403 `agent_pending`.
- **Admin approves in wp-admin.** This went through the real `admin-post.php` handler with a nonce and logged-in cookies, and sent the approval email.
- Leads push/pull: 3 leads + 2 activities. Activities come back merged into the lead; GPS is kept; LWW applies (older ignored, newer applied); duplicate check by phone works.
- **Start trial for a lead:**
  - creates a business with `agent_id`, `source=agent` and `lead_id`
  - returns a password and a `wa.me/254…` link
  - the owner can log in with those details
  - the seeded `business` record is pulled with `updated_at=1`
  - the lead moves to `trial` and gains a `trial` activity
  - `GET /agents/trials` lists it
- **Agent books a demo** for a lead: the booking is linked to the agent and the lead, and the lead moves to `demo_booked`.

**Payments and commission** (recorded in wp-admin)
- Yearly subscription:
  - paid period starts after the trial (about 365 days later)
  - plan becomes `yearly`
  - **20% commission = KES 2,400**
  - the agent's lead becomes **won**
  - recording the same M-Pesa reference again is refused
- **Complete Till → KES 3,000 bonus. Counter Kit → KES 1,000** (amount defaults to the price). **Setup only → no commission.**
- Bulk approve; "mark paid" without a reference is refused; with a reference it is stored upper-cased.

**Leaderboard and profile**
- Leaderboard shows first names only (no surnames anywhere in the response).
- Resources: 6 items and the commission rates.
- Profile update (M-Pesa number normalised, language); logout of one session leaves the others signed in.

**Public demo booking**
- The honeypot returns `ok` but stores nothing.
- Validation 422.
- A booking with `agent_code` is stored (phone normalised), creates a `demo_booked` lead for that agent, and emails the admin.

**Licence lifecycle** (driven through the API)
- trial (3 days left) → grace (5 days left) → expired (0); an expired business **can still pull**
- monthly × 2 → active (≈60 days)
- suspend → `suspended`; a suspended business can still pull
- reactivate → active
- extending the trial by 10 days gives 40 days left

**Admin password reset:** the old password is rejected and the new one works.

**Rate limits**
- Demo booking with a limit of 3: `200,200,200,429,429`, with `Retry-After`.
- Login per account with a limit of 4: `401×4, 429, 429`. Another account from the same IP is not locked out.

**CORS:** an `Origin: https://evil.example` request gets no `Access-Control-Allow-Origin`; same-origin is echoed.

**Static hosting**
- `/pos` gives 301 to `/pos/`.
- `/pos/` returns `text/html` with `no-cache` and the LiteSpeed no-cache header.
- `/pos/agents/` and SPA routes (`/pos/agents/leads/123`) return 200.
- A missing asset gets 404; path traversal does not return 200.
- `sw.js`: `Service-Worker-Allowed`, JavaScript MIME type, no-cache.
- `manifest.webmanifest`: `application/manifest+json`.
- Hashed assets: `immutable`, and the ETag gives a 304.
- The site home and `/wp-json/` still return 200.

### 4. Agent portal — `qa/agents-e2e.mjs` (15/15, Playwright, 390×844 @2x and 1366×768)
1. A visitor who is not signed in is sent to `/pos/agents/login`.
2. Sign-up shows inline validation, then the *Application received* screen with the agent code.
3. After admin approval, **Check status** opens the dashboard.
4. Sync pulls the seeded leads, trials and commissions. The dashboard counts 3 follow-ups due (2 today + 1 overdue) and shows the pipeline, trials and leaderboard.
5. Leads list: 8 leads; search narrows to 1; the "Due" chip shows 3.
6. New lead:
   - required-field errors appear, and clear as soon as the field is edited
   - a phone already in the agent's leads triggers the **duplicate warning**, which disappears for a new number
   - **GPS capture** (geolocation permission): location saved ±18 m, and stored in the cloud with `lat -1.2921`
7. Log a visit with a "+3 days" follow-up; it appears in the timeline.
8. Book a demo while online: one booking row in the cloud; stage becomes *Demo booked*.
9. **Start 30-day trial:** the credentials sheet appears and the WhatsApp link goes to the owner's `2547…` number. The business is attributed to the agent and the stage becomes *On trial*.
10. **Offline** (`context.setOffline(true)`):
    - creating a lead shows the pill *Offline · N waiting*
    - the lead is **not** on the server yet
    - a demo booking made offline is queued
    - back online: the pill returns to *Synced*, the lead **is** on the server, the queued booking was sent, and the IndexedDB outbox is empty
11. App shell offline: after the service worker takes control, `/pos/agents/leads` loads and lists more than 10 leads with no network.
12. Commissions (KES 3,400 earned: 2,400 pending + 1,000 paid), More, Resources and Profile (the code matches the server).
13. **Kiswahili** toggle: the UI switches ("Ufuatiliaji wa leo") and the choice survives reloads.
14. Desktop 1366×768: login, sign-up, dashboard, leads, lead detail, the sheet as a centred dialog, lead form, commissions, resources, profile.
15. Manifest (`scope` and `start_url` are `/pos/agents/`; 192, 512 and maskable icons); the service worker is registered with scope `/pos/agents/`.

### 5. wp-admin and website — `qa/admin-e2e.mjs` (12/12)
- All 9 admin screens render with no PHP warnings or notices and no JavaScript errors. Only sandbox-blocked external requests (Gravatar) were ignored.
- Approve a pending agent from the list; agent detail pages show the pipeline and commissions.
- **Business detail → Record a payment:**
  - choosing *Software + Setup* fills KES 15,000 and the note "adds 12 months"
  - on submit: "Agent commission created: KES 1,500"
- Business actions: extend trial; reset owner password (new password shown once); suspend shows the ink badge; reactivate.
- Commissions: bulk approve, then bulk mark paid with an M-Pesa reference leaves 0 open.
- **Website page with the shortcodes** (Twenty Twenty-Five theme):
  - the trial button carries `?ref=AG-…`
  - submitting empty shows inline errors
  - a valid submit shows the success state with a `DB-XXXXXX` reference and a WhatsApp button
  - the booking is stored with the agent code
  - the mobile view was checked
- Bookings: change status inline; booking detail page; lead detail page.
- Settings save round-trip: changing the monthly price to 1,250 shows up in `/public/config`; reverted afterwards.
- The CSV export downloads with a UTF-8 BOM and headers; the Tools Authorization check runs.
- The admin at 390 px wide (dashboard, businesses, business detail) stays usable.

### 6. Real POS build under /pos/ — `qa/pos-smoke.mjs`
`app/dist` (the POS engineer's current build) was copied in by `build.sh`. Results:
- `/pos/?demo=1` renders the welcome / business-type screen with no page errors
- `/pos/sw.js` is served gzip with `Service-Worker-Allowed: /pos/`
- the service worker registers with scope `/pos/`

### 7. Notifications (captured `mail.log`)
All four types were sent:
- new trial (admin)
- new agent sign-up (admin)
- new demo booking (admin)
- agent approved (to the agent)

## Bugs found and fixed during QA

| Problem | Fix |
|---|---|
| Starting a trial for a lead that was already *won* moved it back to *trial*; a first payment did not mark the lead won. | The server now keeps *won*, and moves the lead to *won* on the first payment. |
| POS business-type key was `general`, but the POS app uses `duka`. | Aligned to `duka`. |
| Admin: the "raise branch limit" row ignored `hidden`; the checkbox stretched full width; no left gutter; system fonts. | Fixed. Brand fonts are self-hosted in `assets/fonts`. |
| Agent portal: field errors stayed after correcting a field; the segmented control's selected state was weak; activity labels were lowercase; one action button was orphaned; the mobile login was bare. | All polished. |
| The test harness itself: the server docroot, and test data colliding between runs. | Fixed. |

## Not covered here (environment limits)
- **Real MySQL/MariaDB, LiteSpeed and Apache.** Nothing here can run them. The `.htaccess` logic was checked by simulation and the SQL is MySQL-first. The first deploy should run **Tools → System status**.
- **Live Daraja calls** (no credentials). The STK request code follows Safaricom's documented payload, and the callback handling was tested end to end with a simulated callback.
- **Real `wp_mail` delivery.** Use an SMTP plugin on HostPinnacle.

## Screenshots (`/home/claude/pos/cloud/qa/`)

| Area | Files |
|---|---|
| Agent portal, phone | `agents-m-01-login` … `agents-m-22-lead-sw`. Key ones: `agents-m-06-home`, `agents-m-07-leads`, `agents-m-08-lead-form`, `agents-m-09-lead-detail`, `agents-m-13-trial-done`, `agents-m-14-offline`, `agents-m-16-commissions`, `agents-m-20-home-sw` |
| Agent portal, laptop | `agents-d-01-login` … `agents-d-10-profile`. Key ones: `agents-d-03-home`, `agents-d-05-lead-detail` |
| wp-admin | `admin-01-dashboard`, `admin-02-businesses`, `admin-03-agents`, `admin-04-leads`, `admin-05-bookings`, `admin-06-payments`, `admin-07-commissions`, `admin-08-settings(-full)`, `admin-09-tools`, `admin-11/12-agent-detail`, `admin-13/14-business-detail`, `admin-15-password-reset`, `admin-16-commissions-paid`, `admin-17-bookings`, `admin-18-booking-detail`, `admin-19-lead-detail`, `admin-m-*` (phone) |
| Website shortcode | `site-01-demo-form`, `site-02-demo-form-errors`, `site-03-demo-success`, `site-04-demo-form-mobile` |
| POS app served by the plugin | `pos-app-served` |

Raw results: `qa/api-results.json`, `qa/agents-results.json`, `qa/admin-results.json`.
