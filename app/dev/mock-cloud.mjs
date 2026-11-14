#!/usr/bin/env node
// Pentarch POS — mock cloud (SPEC §4) for development & tests. No dependencies.
// Usage: node dev/mock-cloud.mjs [--port 8787] [--persist dev/.mock-state.json]
// Env: MOCK_STK=1 (simulate Daraja STK push: paid after ~6 s), MOCK_STRICT_LEDGER=1 (never update ledger rows, even sales status)
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';

const args = process.argv.slice(2);
const PORT = +(args[args.indexOf('--port') + 1] || process.env.PORT || 8787) || 8787;
const PERSIST = args.includes('--persist') ? args[args.indexOf('--persist') + 1] : null;
const BASE = '/wp-json/pentarch-pos/v1';
const TRIAL_DAYS = 30;
const LEDGER = new Set(['stock_moves', 'customer_payments', 'goods_received', 'supplier_payments', 'sales', 'returns', 'cash_moves', 'expenses', 'audit']);
const ENTITIES = new Set(['business', 'branches', 'devices', 'users', 'categories', 'products', 'modifier_groups', 'stock_moves', 'batches', 'serials', 'customers', 'customer_payments', 'suppliers', 'purchase_orders', 'goods_received', 'supplier_payments', 'sales', 'returns', 'quotes', 'orders', 'tables', 'shifts', 'cash_moves', 'expenses', 'transfers', 'stock_counts', 'promotions', 'audit']);
const UPDATABLE_LEDGER = process.env.MOCK_STRICT_LEDGER ? new Set() : LEDGER; // real server applies strictly newer ledger versions (e.g. sale → void)

let S = { tenants: {}, devices: {}, records: {}, log: [], seq: 0, stk: {}, bookings: [] };
if (PERSIST && fs.existsSync(PERSIST)) S = JSON.parse(fs.readFileSync(PERSIST, 'utf8'));
const persist = () => { if (PERSIST) fs.writeFileSync(PERSIST, JSON.stringify(S)); };

const now = () => Date.now();
const id = () => crypto.randomBytes(8).toString('hex');
const hash = (s) => crypto.createHash('sha256').update(s).digest('hex');
const normPhone = (p) => { let s = String(p || '').replace(/[^\d]/g, ''); if (/^0[17]\d{8}$/.test(s)) s = '254' + s.slice(1); if (/^[17]\d{8}$/.test(s)) s = '254' + s; return /^254[17]\d{8}$/.test(s) ? s : ''; };

function licence(t) {
  const n = now();
  const D = 86400000;
  let status = t.suspended ? 'suspended' : 'trial';
  const until = Math.max(t.trial_ends || 0, t.paid_until || 0);
  if (!t.suspended) {
    if (t.paid_until && t.paid_until >= t.trial_ends) status = n <= t.paid_until ? 'active' : n <= t.paid_until + 7 * D ? 'grace' : 'expired';
    else status = n <= t.trial_ends ? 'trial' : n <= t.trial_ends + 7 * D ? 'grace' : 'expired';
  }
  return {
    status, plan: t.plan || 'standard', trial_ends: new Date(t.trial_ends).toISOString(), paid_until: t.paid_until ? new Date(t.paid_until).toISOString() : null,
    days_left: Math.ceil((until - n) / D), max_branches: t.max_branches || 3, max_devices: t.max_devices || 5,
    business_code: t.code, grace_days: 7, grace_ends: new Date(until + 7 * D).toISOString(), server_time: new Date(n).toISOString(),
    pay: { paybill: '247247', account: t.code, amount_monthly: 1200, amount_yearly: 12000, amount_branch_monthly: 1000, whatsapp: '254729455912' }
  };
}
function newDevice(tenantId, name) {
  const d = { id: id(), tenant_id: tenantId, name: name || 'Device', token: crypto.randomBytes(24).toString('hex'), created_at: now(), revoked: false };
  S.devices[d.token] = d;
  return d;
}
function send(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-PPC-Token', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' });
  res.end(JSON.stringify(body));
}
const err = (res, code, message, extra = {}) => send(res, code, { code: 'ppos_error', message, ...extra });
function auth(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  const tok = (m && m[1]) || req.headers['x-ppc-token'];
  const d = tok && S.devices[tok];
  return d && !d.revoked ? d : null;
}
async function body(req) {
  let s = '';
  for await (const c of req) { s += c; if (s.length > 20e6) throw new Error('too large'); }
  return s ? JSON.parse(s) : {};
}

const routes = {
  'POST /auth/register': async (req, res) => {
    const b = await body(req);
    const email = String(b.email || '').trim().toLowerCase();
    const phone = normPhone(b.phone);
    // validation like the real plugin: 422 with data.fields; 409 email_exists
    const fields = {};
    if (!String(b.business_name || '').trim()) fields.business_name = 'Enter the business name.';
    if (!phone) fields.phone = 'Enter a valid Kenyan phone number.';
    if (!/^\S+@\S+\.\S+$/.test(email)) fields.email = 'Enter a valid email address.';
    if (String(b.password || '').length < 6) fields.password = 'Use at least 6 characters.';
    if (Object.keys(fields).length) return err(res, 422, 'Please correct the highlighted fields.', { code: 'invalid_fields', data: { status: 422, fields } });
    if (Object.values(S.tenants).some((t) => t.email === email)) return err(res, 409, 'This email is already registered. Sign in instead.', { code: 'email_exists', data: { status: 409 } });
    const tid = 'T' + id();
    const t = { id: tid, code: 'PP' + String(10000 + Object.keys(S.tenants).length + Math.floor(Math.random() * 80000)).slice(0, 5), business_name: b.business_name, business_type: b.business_type, owner_name: b.owner_name, phone, email, pw: hash(b.password), town: b.town, county: b.county, agent_code: b.agent_code || null, source: b.source || 'app', created_at: now(), trial_ends: now() + TRIAL_DAYS * 86400000 };
    S.tenants[tid] = t;
    // agent / website trials: the server seeds a minimal business record (no modules/settings, updated_at 1); the app completes it
    if (t.source !== 'app') {
      const rec = { entity: 'business', id: tid, branch_id: null, data: { id: tid, name: t.business_name, type: t.business_type || 'other', phone, email, town: t.town || '', county: t.county || '', owner_name: t.owner_name || '', currency: 'KES', updated_at: 1 }, updated_at: 1, deleted: 0, seq: ++S.seq, tenant_id: tid };
      (S.records[tid] ||= {})['business:' + tid] = rec; S.log.push(rec);
    }
    const d = newDevice(tid, b.device_name);
    persist();
    send(res, 201, { tenant_id: tid, business_code: t.code, device_id: d.id, device_token: d.token, licence: licence(t) });
  },
  'POST /auth/login': async (req, res) => {
    const b = await body(req);
    const t = Object.values(S.tenants).find((x) => x.email === String(b.email || '').trim().toLowerCase());
    if (!t || t.pw !== hash(b.password || '')) return err(res, 401, 'Wrong email or password');
    const d = newDevice(t.id, b.device_name);
    persist();
    send(res, 200, { tenant_id: t.id, business_code: t.code, device_id: d.id, device_token: d.token, licence: licence(t), business_name: t.business_name, business_type: t.business_type, owner_name: t.owner_name, phone: t.phone, town: t.town, county: t.county });
  },
  'POST /auth/logout': async (req, res, dev) => { dev.revoked = true; persist(); send(res, 200, { ok: true }); },
  'GET /licence': async (req, res, dev) => send(res, 200, licence(S.tenants[dev.tenant_id])),
  'GET /me': async (req, res, dev) => { const t = S.tenants[dev.tenant_id]; send(res, 200, { tenant_id: t.id, business_code: t.code, business_name: t.business_name, device_id: dev.id, device_name: dev.name, licence: licence(t) }); },
  'POST /sync/push': async (req, res, dev) => {
    const b = await body(req);
    const changes = Array.isArray(b.changes) ? b.changes : [];
    if (changes.length > 500) return err(res, 413, 'Max 500 changes per push');
    const recs = (S.records[dev.tenant_id] ||= {});
    const accepted = [], rejected = [], superseded = [];
    for (const c of changes) {
      if (!c || !c.id || !(ENTITIES.has(c.entity) || (/^[a-z][a-z0-9_]{0,39}$/.test(c.entity || '') && !['meta', 'outbox', 'stock_levels'].includes(c.entity)))) { rejected.push({ id: c?.id || null, reason: 'unknown entity or missing id' }); continue; }
      const key = c.entity + ':' + c.id;
      const cur = recs[key];
      accepted.push(c.id);
      if (cur) {
        if (LEDGER.has(c.entity) && !UPDATABLE_LEDGER.has(c.entity)) continue; // insert-once, duplicate ignored
        if ((cur.updated_at || 0) > (c.updated_at || 0)) { superseded.push(c.id); continue; } // server has newer → client re-pulls
        if ((cur.updated_at || 0) === (c.updated_at || 0)) continue;
      }
      const rec = { entity: c.entity, id: c.id, branch_id: c.branch_id || null, data: c.data, updated_at: c.updated_at || now(), deleted: c.deleted ? 1 : 0, seq: ++S.seq, tenant_id: dev.tenant_id };
      recs[key] = rec;
      S.log.push(rec);
    }
    dev.last_seen = now();
    persist();
    send(res, 200, { accepted, rejected, superseded, server_seq: S.seq });
  },
  'GET /sync/pull': async (req, res, dev) => {
    const u = new URL(req.url, 'http://x');
    const since = +u.searchParams.get('since') || 0;
    const limit = Math.min(1000, +u.searchParams.get('limit') || 1000);
    const mine = S.log.filter((r) => r.tenant_id === dev.tenant_id && r.seq > since && S.records[dev.tenant_id][r.entity + ':' + r.id]?.seq === r.seq);
    const page = mine.slice(0, limit);
    send(res, 200, { changes: page.map(({ tenant_id, ...r }) => r), next_seq: page.length ? page[page.length - 1].seq : since, has_more: mine.length > limit });
  },
  'POST /mpesa/stk': async (req, res, dev) => {
    if (!process.env.MOCK_STK) return err(res, 501, 'Daraja is not configured on this cloud');
    const b = await body(req);
    if (!normPhone(b.phone) || !(b.amount > 0)) return err(res, 400, 'phone and amount required');
    const cid = 'ws_CO_' + id();
    S.stk[cid] = { at: now(), phone: b.phone, amount: b.amount, ref: b.ref, fail: String(b.phone).endsWith('000') };
    send(res, 200, { checkout_request_id: cid });
  },
  'GET /mpesa/stk/': async (req, res, dev) => {
    const cid = decodeURIComponent(req.url.split('/mpesa/stk/')[1].split('?')[0]);
    const s = S.stk[cid];
    if (!s) return err(res, 404, 'unknown request');
    if (now() - s.at < 6000) return send(res, 200, { status: 'pending' });
    send(res, 200, s.fail ? { status: 'failed' } : { status: 'paid', mpesa_receipt: 'TK' + crypto.randomBytes(4).toString('hex').toUpperCase() });
  },
  'POST /public/demo-booking': async (req, res) => {
    const b = await body(req);
    if (b.website) return send(res, 200, { ok: true, ref: 'IGNORED' });
    if (!b.name || !normPhone(b.phone)) return err(res, 400, 'name and phone required');
    const ref = 'DB-' + (S.bookings.length + 1001);
    S.bookings.push({ ...b, ref, at: now() });
    persist();
    send(res, 200, { ok: true, ref });
  },
  // same shape as the real plugin (cloud/pentarch-pos-cloud/includes/class-ppc-rest.php)
  'GET /public/config': async (req, res) => send(res, 200, {
    trial_days: TRIAL_DAYS, grace_days: 7,
    prices: { software_monthly: 1200, software_yearly: 12000, extra_branch_monthly: 1000, extra_branch_yearly: 10000, package_software_setup: 15000, setup_only_fee: 3500, package_complete_till: 69900, counter_kit: 21900, extra_till: 44900, currency: 'KES' },
    whatsapp: '254729455912', phone: '+254 729 455 912', email: 'info@pentarchcommunications.com', paybill: '247247', mpesa_stk: !!process.env.MOCK_STK,
    business_types: { duka: 'General shop / duka', minimart: 'Minimart & supermarket', hardware: 'Hardware & building materials', agrovet: 'Agrovet', pharmacy: 'Pharmacy / chemist', boutique: 'Boutique, fashion & shoes', electronics: 'Electronics & phone shop', cosmetics: 'Cosmetics & beauty shop', butchery: 'Butchery', bakery: 'Bakery & cake shop', restaurant: 'Restaurant, café & hotel', bar: 'Bar & liquor store', salon: 'Salon, barber & spa', stationery: 'Stationery, bookshop & cyber', wholesale: 'Wholesale & distribution', autospares: 'Auto spares', gas_water: 'LPG gas & water refill', other: 'Other / services' },
    agent_terms_url: '', agent_commission: { software_rate: 20, commission_months: 12, bonus_complete_till: 3000, bonus_software_setup: 1500, bonus_counter_kit: 1000 }
  }),
  // ---- dev-only helpers (not part of the contract) ----
  'POST /__dev/tenant': async (req, res) => {
    const b = await body(req);
    const t = S.tenants[b.tenant_id] || Object.values(S.tenants).find((x) => x.email === b.email);
    if (!t) return err(res, 404, 'no tenant');
    Object.assign(t, b.patch || {});
    persist();
    send(res, 200, { ok: true, licence: licence(t) });
  },
  'GET /__dev/state': async (req, res) => send(res, 200, { tenants: Object.values(S.tenants).map((t) => ({ ...t, pw: undefined, licence: licence(t) })), devices: Object.keys(S.devices).length, records: Object.fromEntries(Object.entries(S.records).map(([k, v]) => [k, Object.keys(v).length])), seq: S.seq })
};
const PUBLIC = new Set(['POST /auth/register', 'POST /auth/login', 'POST /public/demo-booking', 'GET /public/config', 'POST /__dev/tenant', 'GET /__dev/state']);

http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const url = req.url.split('?')[0];
  if (!url.startsWith(BASE)) return err(res, 404, 'not found');
  const path = url.slice(BASE.length);
  let key = req.method + ' ' + path;
  if (!routes[key] && req.method === 'GET' && path.startsWith('/mpesa/stk/')) key = 'GET /mpesa/stk/';
  const h = routes[key];
  if (!h) return err(res, 404, 'no route ' + key);
  let dev = null;
  if (!PUBLIC.has(key)) { dev = auth(req); if (!dev) return err(res, 401, 'invalid or revoked device token'); }
  try { await h(req, res, dev); } catch (e) { console.error(e); err(res, 500, e.message); }
}).listen(PORT, '127.0.0.1', () => console.log(`Pentarch POS mock cloud on http://127.0.0.1:${PORT}${BASE}`));
