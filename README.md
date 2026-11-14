# Pentarch POS

Offline-first point-of-sale for Kenyan SMEs by Pentarch Systems Solutions.

- `app/` — POS web app (Vite + Preact + Dexie PWA). `npm install && npm run build` → `dist/` (served at `/pos/`).
- `agents/` — sales agent portal PWA (served at `/pos/agents/`).
- `cloud/pentarch-pos-cloud/` — WordPress plugin: sync API, licences, superadmin, agent portal, demo bookings. `cloud/build.sh` builds both PWAs into the plugin and zips it (`cloud/pentarch-pos-cloud.zip`).
- `docs/` — sales guide, marketing strategy, hardware & setup guide, price list (PDF + sources).
- `research/` — hardware, market and pricing decisions.
- `SPEC.md` — product & API contract.

Live: https://pos.pentarchsystemssolutions.co.ke/pos/ (agents: /pos/agents/, admin: wp-admin → Pentarch POS).
