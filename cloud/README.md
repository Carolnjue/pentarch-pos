# Pentarch POS Cloud — WordPress plugin

`pentarch-pos-cloud` is the backend of Pentarch POS. It provides:

- the sync, licence and M-Pesa REST API for the POS app (`/wp-json/pentarch-pos/v1`)
- hosting for the POS app at **/pos/** and the agent portal at **/pos/agents/**
- the superadmin screens in wp-admin (**Pentarch POS** menu)
- the website shortcodes `[pentarch_pos_demo_form]` and `[pentarch_pos_trial_link]`

**Version 1.1.0** (9 Nov 2026) — ships the Phase 2 POS app (inventory & purchasing, reports & expenses, restaurant / services / quotes) and adds the **Extra till** price. See *What changed in 1.1.0* below.

It runs on PHP 7.4–8.3 and WordPress 6.x, needs no Composer packages, and is built for HostPinnacle shared hosting (LiteSpeed with MySQL or MariaDB).

```
cloud/
  pentarch-pos-cloud/        plugin source (public/pos and public/agents receive the builds)
  pentarch-pos-cloud.zip     installable package (zip root = pentarch-pos-cloud/)
  build.sh                   builds agents/, copies app/dist + agents/dist in, precompresses, zips
  qa/                        test scripts, results JSON, screenshots
agents/                      agent portal PWA source (Vite + Preact + Dexie + vite-plugin-pwa)
```

## 1. Build

```bash
cd /home/claude/pos/cloud
./build.sh                 # builds agents/, copies app/dist (if present), zips
SKIP_AGENTS=1 ./build.sh   # re-zip without rebuilding the agent portal
```

The script:

1. builds `agents/` into `agents/dist`
2. copies that build to `public/agents/`
3. copies `app/dist` to `public/pos/` (if `app/dist` is missing, the placeholder page stays)
4. writes `.gz` copies of text assets
5. runs `php -l` on every PHP file
6. writes `pentarch-pos-cloud.zip`

## 2. Install on pentarchcommunications.com

1. In **wp-admin → Plugins → Add New → Upload Plugin**, choose `pentarch-pos-cloud.zip` (about 2.2 MB — PHP `upload_max_filesize` and `post_max_size` must be above that; hosting panels usually allow 64 MB+, a bare PHP default of 2 MB does not), then click **Install Now** and **Activate**. Activation:
   - creates 13 tables (`wp_ppc_*`)
   - registers the /pos/ rewrite rules
   - adds a small **Pentarch POS** block at the top of `.htaccess`
2. Go to **Settings → Permalinks** and click **Save** once. This refreshes the rewrite rules.
3. In **Pentarch POS → Settings**, fill in at least:
   - **Prices**: these are set to the decided prices (KES 1,200 per month / 12,000 per year, extra branch 1,000 / 10,000, Software + Setup 15,000, setup only 3,500, Complete Till 69,900, Counter Kit 21,900, Extra till 44,900). Check them.
   - **Agent commission**: 20% for 12 months, plus bonuses of 3,000 (Complete Till), 1,500 (Software + Setup) and 1,000 (Counter Kit).
   - **M-Pesa payments**: the **Paybill number**. The account format defaults to the business code (`PP12345`).
   - **Contact**: WhatsApp, phone, support email and **Admin notification email**.
   - **Agent resources**: upload the PDFs to the Media Library and paste their URLs here.
   - **Daraja** (optional): see section 6.
4. **LiteSpeed Cache** (LiteSpeed Cache → Cache → Excludes → *Do Not Cache URIs*): add these two lines:
   ```
   /pos/
   /wp-json/pentarch-pos/
   ```
   The plugin already sends `X-LiteSpeed-Cache-Control: no-cache` and `Cache-Control: no-store` on the API, defines `DONOTCACHEPAGE`, and adds an `E=Cache-Control:no-cache` rewrite in `.htaccess`. The exclusions are an extra safety net. If you use Cloudflare, add a *Bypass cache* rule for the same two paths.
5. Add the shortcodes to the website POS page (`/systems/pos/`):
   ```
   [pentarch_pos_trial_link]  [pentarch_pos_trial_link demo="1" label="Try the live demo" style="ghost"]
   [pentarch_pos_demo_form]
   ```
6. Open **Pentarch POS → Tools** and check that every line under System status is green, in particular:
   - *Authorization header*
   - *POS app*
   - *Agent portal*
   - *.htaccess block*
7. Open `https://pentarchcommunications.com/pos/` and `/pos/agents/` and confirm both load.

**Updating:** build a new zip and upload it again (WordPress offers *Replace current with uploaded*). Your data is kept, and database upgrades run on their own (`PPC_DB_VERSION`).

**Uninstalling:** data is **kept** unless *Settings → Security & data → Delete ALL Pentarch POS data* is ticked before you delete the plugin. Deactivating removes only the `.htaccess` block.

### Security plugins

Plugins that block the REST API for logged-out visitors (for example "Disable REST API" or some Wordfence or iThemes options) must allow the `pentarch-pos/v1` namespace.

## 3. Endpoint reference

Base URL: `/wp-json/pentarch-pos/v1`. Everything is JSON. Errors use the WordPress format `{code, message, data:{status, fields?}}`.

**Auth:**
- POS app: `Authorization: Bearer ppd_…`
- Agents: `Bearer ppa_…`
- Fallback: hosts that strip `Authorization` can send the token in an `X-PPC-Token` header instead.
- The server stores only SHA-256 hashes of tokens. Passwords use `wp_hash_password`.

All API responses carry:
- `Cache-Control: no-store`
- `X-LiteSpeed-Cache-Control: no-cache`
- same-origin CORS only

### POS app (SPEC §4)

| Method | Path | Auth | Body / query → response |
|---|---|---|---|
| POST | `/auth/register` | — | `{business_name, business_type, owner_name, phone, email, password(≥6), town, county, agent_code?, device_name, source:'app'\|'agent'\|'web'}` → **201** `{tenant_id, device_id, device_token, licence, business_code}`. 422 with `data.fields`; 409 `email_exists`; 429. |
| POST | `/auth/login` | — | `{email, password, device_name}` → `{tenant_id, device_id, device_token, licence, business_code}`. 401 `invalid_credentials`; 429. |
| POST | `/auth/logout` | device | → `{ok:true}` (revokes this device token only) |
| GET | `/me` | device | → `{tenant_id, business_code, business_name, owner_name, email, phone, device_id, device_name, licence}` *(additive)* |
| GET | `/licence` | device | → `{status, plan, trial_ends, paid_until, days_left, max_branches, max_devices, pay:{paybill, account, amount_monthly, amount_yearly, whatsapp}, business_code, grace_ends, grace_days, server_time}` |
| POST | `/sync/push` | device | `{changes:[{entity, id, branch_id, data, updated_at, deleted}]}` (≤500, else **413**) → `{accepted:[ids], rejected:[{id, reason}], server_seq, superseded:[ids]}` |
| GET | `/sync/pull?since=&limit=` | device | limit ≤1000 → `{changes:[{entity, id, branch_id, data, updated_at, deleted, seq}], next_seq, has_more}` |
| POST | `/mpesa/stk` | device | `{phone, amount, ref}` → `{checkout_request_id, customer_message}`; **501** `mpesa_not_configured` |
| GET | `/mpesa/stk/{id}` | device | → `{status:'pending'\|'paid'\|'failed', mpesa_receipt, result_desc, amount}` (pending for more than 3 minutes becomes failed) |
| POST | `/mpesa/callback/{secret}` | Safaricom | Daraja STK callback → `{ResultCode:0}` |
| POST | `/backup` | device | raw JSON or gzip body (≤25 MB) → `{ok, size, stored_at, kept}`; keeps the newest 5 per business in `uploads/ppc-backups/` (web access denied) |
| GET | `/public/config` | — | → `{trial_days, grace_days, prices{…}, whatsapp, phone, email, paybill, business_types{key:label}, mpesa_stk, agent_terms_url, agent_commission{…}}` |
| POST | `/public/demo-booking` | — | `{name, business, business_type, phone, email, town, preferred_date, preferred_time, message, agent_code?, source_page, website(honeypot)}` → `{ok, ref:'DB-XXXXXX', whatsapp}` |
| GET | `/public/ping` | — | → `{ok, version, time, auth_header_received}` (health check) |

**Sync rules**

- **Entities.** `entity` must be `[a-z][a-z0-9_]{0,39}`. The local-only entities `meta`, `outbox` and `stock_levels` are rejected.
- **Record ids.** Ids must be `[A-Za-z0-9_\-:.]{1,64}`.
- **`updated_at`.** It is required, in ms. A value more than 1 day in the future is rejected.
- **Size.** Each record may be up to 512 KB of JSON.
- **Synced (S) entities** use last-write-wins on `updated_at`. An older or equal version is reported in `accepted` and also in `superseded`, so the client can drop it from its outbox.
- **Ledger (L) entities** (`stock_moves, customer_payments, goods_received, supplier_payments, sales, returns, cash_moves, expenses, audit`) are insert-once. A duplicate id with the same or older `updated_at` is ignored, which makes retries safe. A strictly newer version, such as a sale marked `void`, is applied.
- **Duplicates within one batch** collapse to the newest version.
- **Ordering.** Each write gets a new `server_seq`. Pushes are serialised per business with `GET_LOCK` on MySQL, so `seq` order matches commit order.
- **Rejection reasons:** `invalid_change`, `invalid_entity`, `local_only_entity`, `invalid_id`, `invalid_data`, `invalid_updated_at`, `updated_at_in_future`, `record_too_large`, `server_error`.
- **Expired or suspended businesses** can still push and pull. Data is never held hostage.

**Licence (SPEC §5)**

- **suspended**: set by Pentarch. This overrides everything else.
- **active**: `paid_until` is in the future.
- **trial**: `trial_ends` is in the future.
- **grace**: within `grace_days` (7) after the later of the two dates.
- **expired**: after grace ends.

`days_left` counts down to the end of the current phase.

### Agents (SPEC §6)

| Method | Path | Auth | Body → response |
|---|---|---|---|
| POST | `/agents/auth/register` | — | `{name, phone, email, password(≥8), town, county, heard_from, agree_terms:true, mpesa_phone?, device_name, lang}` → **201** `{ok, status:'pending', token, agent}` |
| POST | `/agents/auth/login` | — | `{login\|email\|phone, password, device_name}` → `{token, status, agent}` (works while pending; suspended gets 403) |
| POST | `/agents/auth/logout` | agent | → `{ok}` |
| GET | `/agents/me` | agent* | → `{agent, stats{leads_by_stage, won_this_month, commission{pending, approved, paid, earned}}, contact}` |
| POST | `/agents/me` | agent* | `{mpesa_phone?, lang?, town?, county?, current_password+new_password?}` → `{agent}` |
| POST | `/agents/leads/push` | agent | `{changes:[{entity:'leads'\|'lead_activities', id, data, updated_at, deleted}]}` → `{accepted, rejected, server_seq}` |
| GET | `/agents/leads/pull?since=&limit=` | agent | → `{changes:[{entity:'leads', id, data:{…, activities:[…]}, updated_at, deleted, seq}], next_seq, has_more}` |
| GET | `/agents/leads/check-phone?phone=&exclude=` | agent | → `{exists, mine:{id, business_name, stage}\|null, other_agent, existing_client}` *(additive)* |
| POST | `/agents/trials` | agent | `{lead_id?, business_name, business_type, owner_name, phone, email, password?, town, county, lang}` → **201** `{tenant_id, business_code, licence, login:{url, email, password, password_generated}, whatsapp_message, whatsapp_url}` |
| GET | `/agents/trials` | agent | → `{items:[{tenant_id, business_code, business_name, status, days_left, …}]}` *(additive)* |
| POST | `/agents/demo-bookings` | agent | `{lead_id, preferred_date, preferred_time, message}` → **201** `{ok, ref}` *(additive)* |
| GET | `/agents/commissions` | agent | → `{items:[…], totals:{pending, approved, paid, earned}, currency:'KES', unit:'cents'}` |
| GET | `/agents/leaderboard` | agent | → `{period, items:[{rank, name(first name only), won, trials, leads, score, is_me}], me}` |
| GET | `/agents/resources` | agent* | → `{items:[{key, title, title_sw, type, url}], prices, trial_days, terms_url, contact, commission}` |

\* = also allowed while the agent is still pending approval. All other agent endpoints return 403 `agent_pending` until the agent is approved.

### Rate limits (per IP unless noted; editable in Settings)

| Action | Limit |
|---|---|
| Sign-up (owner or agent) | 5 per hour |
| Login | 10 per 15 min per account, plus 30 per 15 min per IP |
| Demo booking | 5 per hour |
| `/public/config` | 120 per min |
| STK push | 20 per min per business |
| Agent trials | 30 per day per agent |
| Backups | 12 per hour per business |

Requests over a limit get **429** with a `Retry-After` header.

## 4. Static hosting (/pos/ and /pos/agents/)

The plugin intercepts `/pos/*` while it loads, before the theme. If something interferes, a WordPress rewrite rule catches the request as a fallback.

**Cache headers**

| Files | Cache-Control |
|---|---|
| `index.html`, `sw.js`, `registerSW.js`, `manifest.webmanifest`, any `.html` | `no-cache` |
| Hashed files in `/assets/` | `public, max-age=31536000, immutable` |
| Everything else | 1 day |

**Other behaviour**

- **Service worker scope.** `Service-Worker-Allowed` is `/pos/` for the POS app and `/pos/agents/` for the agent portal.
- **Revalidation.** ETag and 304 responses are supported.
- **Compression.** Pre-built `.gz` files are served when the browser accepts gzip.
- **App routes.** Paths without a file extension fall back to `index.html` (SPA routes).
- **Path traversal** is blocked.
- **Plain permalinks** also work. The `.htaccess` block sends `/pos/` to WordPress, and `/wp-json/pentarch-pos/...` is mapped to `?rest_route=`.

## 5. Admin guide (wp-admin → Pentarch POS)

- **Dashboard.** It shows:
  - active trials and how many end within 7 days
  - paying businesses and MRR
  - money received in the last 30 days and new leads
  - a *Needs attention* strip: agents waiting for approval, demo bookings to call, licences ending soon, commission owed
  - a 30-day sign-up chart, the latest bookings, agent activity and an activity feed
- **Businesses.** Search by name, code, owner, phone, email or town, and filter by status, plan or agent. The detail page has:
  - **Record a payment**: choose what was paid for, and the amount and licence months fill in from the prices. See the table below.
  - **Licence**: extend the trial; suspend or reactivate; edit plan, dates and limits.
  - **Devices**: see each device and sign one out.
  - **Business details**: reset the owner's password (the new password is shown once, with a WhatsApp link); change the sales agent.
  - **Usage**: records synced, sales in the last 30 days, branches.
  - **M-Pesa STK for sales**: the business's own Daraja keys.
  - **Internal notes** and a *test business* flag; export all of the business's data as JSON.

  | Paid for | Licence | Agent commission |
  |---|---|---|
  | Subscription monthly / yearly | +1 / +12 months per unit | 20% |
  | Extra branch monthly / yearly | — (can also raise the branch limit) | 20% |
  | Package Complete Till | +12 months | KES 3,000 bonus |
  | Package Software + Setup | +12 months | KES 1,500 bonus |
  | Setup only | — | none |
  | Counter Kit | — | KES 1,000 bonus |
  | Extra till | — | none |
  | Other | — | none |

  Licence months are added from the later of today, `paid_until` and the trial end, so paying early never loses trial days. The 20% applies only within the first 12 months counted from the first software payment. The first payment also moves the agent's lead to **Won**. An M-Pesa reference can be recorded only once per business.
- **Agents.**
  - **Approve** pending agents; this sends the agent a welcome email with their links.
  - **Suspend** an agent; this signs them out everywhere.
  - Each agent's page shows their pipeline, businesses brought in, commissions and latest leads. You can override their software % or Complete Till bonus and their M-Pesa payout number.
- **Leads.** All leads, with stage tabs, an agent filter and search. Each lead opens to its details, a map link and its activity timeline.
- **Demo bookings.** These come from the website form and from agents. You can change status and assign an agent inline. Assigning an agent adds the booking to that agent's leads. Each booking has a WhatsApp link with a ready message.
- **Payments.** Find a business by code, name or phone to record a payment. The list filters by type and month and shows a total.
- **Commissions.**
  - Totals are shown for pending, approved and paid.
  - Bulk actions: **Approve**, **Mark paid** (requires the M-Pesa reference) and **Cancel**.
- **Settings.** Licence and trial, prices, commission, M-Pesa and Daraja, contact, agent resource links, rate limits, proxy/Cloudflare IP, and delete-on-uninstall.
- **Tools.** System status (including whether the Authorization header reaches PHP), refresh rewrite rules, clear rate limits, send a test email, purge test businesses, CSV exports of every list, and shortcode help.

**Emails** (`wp_mail`; use an SMTP plugin on shared hosting) go:
- to the admin notification address for a new trial, a new agent sign-up or a new demo booking
- to the agent when they are approved

## 6. M-Pesa Daraja (optional)

- **Global keys** (Settings → M-Pesa payments) are **only** used for licence payments, where `ref` equals the business code. Successful payments are recorded automatically as monthly or yearly subscriptions, based on the amount.
- **Per-business keys** (Businesses → detail → *M-Pesa STK push for sales*) let a shop prompt its own customers at the till, with money going to the shop's own Paybill or Till.
- **When neither is configured**, `/mpesa/stk` returns **501** and the app falls back to entering the M-Pesa code by hand.
- **Callback URL.** It is shown in Settings and contains a secret.

## 7. Agent portal (agents/)

- **Install and offline use.** The portal installs as a PWA (manifest, icons and service worker with scope `/pos/agents/`) and works offline. Leads, activities and offline demo requests are saved in IndexedDB (Dexie) and queued in an outbox.
- **Sync** runs at start, every 60 s, on the `online` event, when the app comes back into view, 1.5 s after a change, and from the status pill. It retries with exponential backoff (5 s up to 5 min).
- **Screens:**
  - sign up, pending approval, login
  - home (earnings, follow-ups due, pipeline, trials, leaderboard)
  - leads (search, stage chips, due filter)
  - lead form (GPS capture, warning when a phone number is already a lead)
  - lead detail (call / WhatsApp / SMS / map; stage change; log visit, call or note; book demo; **start 30-day trial**; share demo or website link)
  - commissions, resources, more, profile (M-Pesa number, code, links, password)
  - English / Kiswahili throughout
- **Fonts** are self-hosted (@fontsource Bricolage Grotesque, DM Sans, JetBrains Mono).
- **Local development:**
  ```bash
  cd agents && POS_CLOUD=http://127.0.0.1:8080 npm run dev
  ```
  Then open `http://localhost:5174/pos/agents/`.

### Price settings (Pentarch POS → Settings → Prices)

Whole Kenyan shillings. They are sent to the POS app and the agent portal in `GET /public/config` → `prices` and `GET /agents/resources` → `prices`, and they fill the amount when you record a payment.

| Key | Label | Default (KES) |
|---|---|---|
| `software_monthly` | Software — per month | 1,200 |
| `software_yearly` | Software — per year | 12,000 |
| `extra_branch_monthly` | Extra branch — per month | 1,000 |
| `extra_branch_yearly` | Extra branch — per year | 10,000 |
| `package_complete_till` | Package: Complete Till | 69,900 |
| `package_software_setup` | Package: Software + Setup | 15,000 |
| `setup_only_fee` | Setup only (with monthly billing) | 3,500 |
| `counter_kit` | Counter Kit add-on | 21,900 |
| `extra_till` | Extra till (second complete till in the same branch) — **new in 1.1.0** | 44,900 |

### What changed in 1.1.0
- `extra_till` price setting (default 44,900) in Settings, `/public/config`, agent resources (the agent portal's price list now shows the server value) and as an *Extra till* payment type.
- The bundled POS app is the integrated Phase 2 build: Stock, Purchases, Reports (24), Expenses, Restaurant (tables, kitchen display), Services (staff commission, appointments), Quotes & invoices. Its local database upgrades itself (schema v2) on the next visit — existing data is kept.
- Website demo: `/pos/?demo=1&type=…` inside an iframe no longer makes the demo the default for that browser. New links: `/pos/?trial=1` opens the trial form, `/pos/?welcome=1` shows Welcome. `/pos/` shows Welcome unless a real business is set up on the device. The website's "Start free trial" buttons now link to `/pos/?trial=1` (with `&ref=` when an agent code is present).

## 8. Testing locally

See `QA-REPORT.md`. The test scripts live in `cloud/qa/`:

| Script | Covers |
|---|---|
| `api-test.mjs` | the REST API |
| `agents-e2e.mjs` | the agent portal in Playwright |
| `admin-e2e.mjs` | wp-admin and the website shortcodes |
| `pos-smoke.mjs` | the POS build served under /pos/ |
| `install-smoke.mjs` | fresh install of the zip through wp-admin (upload, activate) + live smoke: demo, trial, sale + sync, agent sign-in, demo-booking shortcode on a new page. Unlinks a dev symlink first — never deletes it through WordPress |

They expect WordPress at `http://127.0.0.1:8080` (with the SQLite drop-in) and the helper `/home/claude/wptest/wpset.php`.
