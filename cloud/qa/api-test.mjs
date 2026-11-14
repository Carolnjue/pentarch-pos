// End-to-end API test for Pentarch POS Cloud against a running WordPress.
// Usage: node api-test.mjs [baseUrl]   (default http://127.0.0.1:8080)
// Requires the test helper /home/claude/wptest/wpset.php for settings/SQL tweaks.
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const BASE = process.argv[2] || 'http://127.0.0.1:8080';
const API = BASE + '/wp-json/pentarch-pos/v1';
const WPSET = '/home/claude/wptest/wpset.php';
const results = [];
let failures = 0;

const php = (...a) => execFileSync('php', [WPSET, ...a], { encoding: 'utf8' });
const sqlVar = (q) => JSON.parse(php('var', q) || '[]');
const settings = (o) => php('settings', JSON.stringify(o));

async function api(method, path, body, token, extraHeaders = {}) {
  const h = { 'Accept': 'application/json', ...extraHeaders };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (token) h['Authorization'] = 'Bearer ' + token;
  const r = await fetch(API + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  let j = null; const txt = await r.text();
  try { j = JSON.parse(txt); } catch { j = txt; }
  return { status: r.status, body: j, headers: r.headers };
}

async function test(name, fn) {
  const t0 = Date.now();
  try { await fn(); results.push({ name, ok: true, ms: Date.now() - t0 }); console.log('  PASS', name); }
  catch (e) { failures++; results.push({ name, ok: false, err: String(e && e.message || e) }); console.log('  FAIL', name, '\n      ', e && e.message); }
}

// ULID-ish id generator for test records.
let ctr = 0;
const rid = (p = 'T') => (p + Date.now().toString(36) + (ctr++).toString(36).padStart(5, '0') + Math.random().toString(36).slice(2, 6)).toUpperCase().slice(0, 26);

// ---------- WP admin session (real admin-post handlers) ----------
const jar = {};
function storeCookies(res) {
  for (const c of res.headers.getSetCookie ? res.headers.getSetCookie() : []) {
    const [kv] = c.split(';'); const i = kv.indexOf('=');
    jar[kv.slice(0, i)] = kv.slice(i + 1);
  }
}
const cookieHeader = () => Object.entries(jar).map(([k, v]) => k + '=' + v).join('; ');
async function adminLogin() {
  jar['wordpress_test_cookie'] = 'WP%20Cookie%20check';
  const r = await fetch(BASE + '/wp-login.php', {
    method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieHeader() },
    body: new URLSearchParams({ log: 'admin', pwd: 'AdminPass123!', 'wp-submit': 'Log In', redirect_to: BASE + '/wp-admin/', testcookie: '1' })
  });
  storeCookies(r);
  assert.equal(r.status, 302, 'admin login redirect');
}
async function adminGet(page) {
  const r = await fetch(BASE + '/wp-admin/admin.php?' + page, { headers: { Cookie: cookieHeader() }, redirect: 'manual' });
  return { status: r.status, html: await r.text() };
}
let nonce = null;
async function adminDo(fields) {
  if (!nonce) {
    const { html } = await adminGet('page=ppc-tools');
    nonce = /name="_wpnonce" value="([a-f0-9]+)"/.exec(html)[1];
  }
  const body = new URLSearchParams({ action: 'ppc_do', _wpnonce: nonce, _back: BASE + '/wp-admin/admin.php?page=ppc', ...fields });
  const r = await fetch(BASE + '/wp-admin/admin-post.php', { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieHeader() }, body });
  assert.equal(r.status, 302, 'admin-post should redirect, got ' + r.status);
  const page = await adminGet('page=ppc');
  const flash = /class="ppc-flash ppc-flash--(\w+)"[^>]*>(.*?)<\/div>/s.exec(page.html);
  return flash ? { type: flash[1], msg: flash[2].replace(/<[^>]+>/g, '') } : { type: 'none', msg: '' };
}

// ---------- Tests ----------
const S = {};
const now = Date.now();

console.log('Pentarch POS Cloud — API test against', BASE);
php('sql', 'DELETE FROM {p}rate_limits');
settings({ rate_register: 1000, rate_login: 1000, rate_booking: 1000 });

await test('GET /public/config returns trial days, prices and contact', async () => {
  const r = await api('GET', '/public/config');
  assert.equal(r.status, 200);
  assert.equal(r.body.trial_days, 30);
  assert.equal(r.body.prices.software_monthly, 1200);
  assert.equal(r.body.prices.software_yearly, 12000);
  // plugin defaults (Pentarch POS → Settings → Prices)
  assert.equal(r.body.prices.package_complete_till, 69900);
  assert.equal(r.body.prices.counter_kit, 21900);
  assert.equal(r.body.prices.extra_till, 44900);
  assert.equal(r.body.whatsapp, '254729455912');
  assert.match(r.headers.get('cache-control'), /no-store/);
  assert.equal(r.headers.get('x-litespeed-cache-control'), 'no-cache');
});

await test('POST /auth/register validates input (422 with field errors)', async () => {
  const r = await api('POST', '/auth/register', { business_name: 'X', owner_name: '', phone: '123', email: 'bad', password: '1' });
  assert.equal(r.status, 422);
  assert.equal(r.body.code, 'invalid_input');
  assert.ok(r.body.data.fields.phone && r.body.data.fields.email && r.body.data.fields.password);
});

const emailA = `owner.a.${now}@example.com`;
await test('POST /auth/register creates tenant A with 30-day trial, PP code, normalised phone', async () => {
  const r = await api('POST', '/auth/register', { business_name: 'Kamau Hardware', business_type: 'hardware', owner_name: 'John Kamau', phone: '+254 722 000 111', email: emailA.toUpperCase(), password: 'secret123', town: 'Nakuru', county: 'Nakuru', device_name: 'Counter 1', source: 'app' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.match(r.body.tenant_id, /^[0-9A-Z]{26}$/);
  assert.match(r.body.device_token, /^ppd_[a-f0-9]{64}$/);
  assert.equal(r.body.licence.status, 'trial');
  assert.equal(r.body.licence.days_left, 30);
  assert.match(r.body.licence.pay.account, /^PP\d{5}$/);
  S.A = r.body;
  const row = sqlVar(`SELECT phone, email, password_hash FROM {p}tenants WHERE id='${r.body.tenant_id}'`)[0];
  assert.equal(row.phone, '254722000111');
  assert.equal(row.email, emailA);
  assert.ok(!row.password_hash.includes('secret123'));
  const dev = sqlVar(`SELECT token_hash FROM {p}devices WHERE device_uid='${r.body.device_id}'`)[0];
  assert.equal(dev.token_hash.length, 64, 'only SHA-256 of token stored');
  assert.notEqual(dev.token_hash, r.body.device_token);
});

await test('POST /auth/register rejects duplicate email (409)', async () => {
  const r = await api('POST', '/auth/register', { business_name: 'Dup', owner_name: 'Dup Owner', phone: '0700000001', email: emailA, password: 'secret123' });
  assert.equal(r.status, 409);
  assert.equal(r.body.code, 'email_exists');
});

await test('POST /auth/login: wrong password 401, correct gives a second device', async () => {
  let r = await api('POST', '/auth/login', { email: emailA, password: 'nope', device_name: 'Laptop' });
  assert.equal(r.status, 401);
  r = await api('POST', '/auth/login', { email: emailA, password: 'secret123', device_name: 'Laptop' });
  assert.equal(r.status, 200);
  assert.equal(r.body.tenant_id, S.A.tenant_id);
  assert.notEqual(r.body.device_id, S.A.device_id);
  S.A2 = r.body;
});

await test('GET /licence requires a token and returns full shape', async () => {
  assert.equal((await api('GET', '/licence')).status, 401);
  assert.equal((await api('GET', '/licence', undefined, 'ppd_' + 'f'.repeat(64))).status, 401);
  const r = await api('GET', '/licence', undefined, S.A.device_token);
  assert.equal(r.status, 200);
  for (const k of ['status', 'plan', 'trial_ends', 'paid_until', 'days_left', 'max_branches', 'max_devices', 'pay']) assert.ok(k in r.body, 'missing ' + k);
  for (const k of ['paybill', 'account', 'amount_monthly', 'amount_yearly', 'whatsapp']) assert.ok(k in r.body.pay, 'missing pay.' + k);
});

await test('X-PPC-Token header works when Authorization is stripped by the host', async () => {
  const r = await api('GET', '/licence', undefined, null, { 'X-PPC-Token': S.A.device_token });
  assert.equal(r.status, 200);
});

// 2,000 mixed records.
const entities = ['products', 'customers', 'categories', 'sales', 'stock_moves', 'audit', 'suppliers', 'expenses'];
const pushed = [];
await test('POST /sync/push 2,000 mixed records in 4 batches of 500', async () => {
  for (let b = 0; b < 4; b++) {
    const changes = [];
    for (let i = 0; i < 500; i++) {
      const entity = entities[(b * 500 + i) % entities.length];
      const id = rid('R');
      const updated_at = now - 100000 + b * 500 + i;
      const data = { id, created_at: updated_at, updated_at, name: `${entity} item ${b}-${i}`, price: 10000 + i, branch_id: 'BR1' };
      if (entity === 'sales') Object.assign(data, { no: `NRB1-${String(b * 500 + i).padStart(6, '0')}`, total: 25000 + i, status: 'completed', lines: [{ product_id: 'P1', qty: 1, price: 25000 + i }] });
      changes.push({ entity, id, branch_id: 'BR1', data, updated_at, deleted: 0 });
      pushed.push({ entity, id, updated_at });
    }
    const t0 = Date.now();
    const r = await api('POST', '/sync/push', { changes }, S.A.device_token);
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
    assert.equal(r.body.accepted.length, 500);
    assert.equal(r.body.rejected.length, 0);
    assert.ok(r.body.server_seq > 0);
    S.pushMs = (S.pushMs || 0) + (Date.now() - t0);
  }
});

await test('POST /sync/push rejects batches over 500 (413)', async () => {
  const changes = Array.from({ length: 501 }, () => ({ entity: 'products', id: rid(), data: {}, updated_at: now }));
  const r = await api('POST', '/sync/push', { changes }, S.A.device_token);
  assert.equal(r.status, 413);
});

await test('GET /sync/pull pages 2,000 records (limit 1000, has_more, next_seq)', async () => {
  let since = 0, all = [], pages = 0, more = true;
  const t0 = Date.now();
  while (more) {
    const r = await api('GET', `/sync/pull?since=${since}&limit=1000`, undefined, S.A2.device_token);
    assert.equal(r.status, 200);
    assert.ok(r.body.changes.length <= 1000);
    all = all.concat(r.body.changes);
    more = r.body.has_more; since = r.body.next_seq; pages++;
    if (pages > 5) throw new Error('too many pages');
  }
  S.pullMs = Date.now() - t0;
  assert.equal(all.length, 2000);
  assert.equal(pages, 2);
  const ids = new Set(all.map((c) => c.entity + ':' + c.id));
  assert.equal(ids.size, 2000);
  for (const p of pushed) assert.ok(ids.has(p.entity + ':' + p.id));
  const seqs = all.map((c) => c.seq);
  assert.ok(seqs.every((s, i) => i === 0 || s > seqs[i - 1]), 'seq strictly increasing');
  const c = all[0];
  for (const k of ['entity', 'id', 'branch_id', 'data', 'updated_at', 'deleted', 'seq']) assert.ok(k in c, 'missing ' + k);
  S.seqAfterBulk = since;
  // Limit is capped at 1000.
  const r2 = await api('GET', `/sync/pull?since=0&limit=5000`, undefined, S.A.device_token);
  assert.equal(r2.body.changes.length, 1000);
});

await test('LWW: newer update wins, older update is ignored (accepted + superseded)', async () => {
  const p = pushed.find((x) => x.entity === 'products');
  const newer = p.updated_at + 50000, older = p.updated_at + 10;
  let r = await api('POST', '/sync/push', { changes: [{ entity: 'products', id: p.id, data: { id: p.id, name: 'Cement 50kg (NEW PRICE)', price: 79000, updated_at: newer }, updated_at: newer }] }, S.A2.device_token);
  assert.deepEqual(r.body.accepted, [p.id]);
  assert.deepEqual(r.body.superseded, []);
  r = await api('POST', '/sync/push', { changes: [{ entity: 'products', id: p.id, data: { id: p.id, name: 'Cement 50kg (STALE)', price: 1, updated_at: older }, updated_at: older }] }, S.A.device_token);
  assert.deepEqual(r.body.accepted, [p.id]);
  assert.deepEqual(r.body.superseded, [p.id]);
  const pull = await api('GET', `/sync/pull?since=${S.seqAfterBulk}`, undefined, S.A.device_token);
  const got = pull.body.changes.filter((c) => c.id === p.id);
  assert.equal(got.length, 1, 'changed record appears once after since');
  assert.equal(got[0].data.name, 'Cement 50kg (NEW PRICE)');
  assert.equal(got[0].updated_at, newer);
  S.seqAfterLww = pull.body.next_seq;
  // Soft delete propagates.
  const del = newer + 1000;
  r = await api('POST', '/sync/push', { changes: [{ entity: 'products', id: p.id, data: { id: p.id, deleted: 1, updated_at: del }, updated_at: del, deleted: 1 }] }, S.A.device_token);
  const pull2 = await api('GET', `/sync/pull?since=${S.seqAfterLww}`, undefined, S.A2.device_token);
  assert.equal(pull2.body.changes.find((c) => c.id === p.id).deleted, 1);
  S.seqAfterLww = pull2.body.next_seq;
});

await test('Ledger idempotency: re-pushing 250 sales changes nothing; a newer version (void) is applied', async () => {
  const sales = pushed.filter((x) => x.entity === 'sales').slice(0, 250);
  const before = sqlVar(`SELECT COUNT(*) AS n, MAX(server_seq) AS m FROM {p}records WHERE tenant_id='${S.A.tenant_id}'`)[0];
  const changes = sales.map((s) => ({ entity: 'sales', id: s.id, data: { id: s.id, total: 1, status: 'completed', updated_at: s.updated_at }, updated_at: s.updated_at }));
  const r = await api('POST', '/sync/push', { changes }, S.A2.device_token);
  assert.equal(r.body.accepted.length, 250);
  assert.equal(r.body.rejected.length, 0);
  const after = sqlVar(`SELECT COUNT(*) AS n, MAX(server_seq) AS m FROM {p}records WHERE tenant_id='${S.A.tenant_id}'`)[0];
  assert.equal(after.n, before.n);
  assert.equal(after.m, before.m, 'no re-sequencing for duplicates');
  const pull = await api('GET', `/sync/pull?since=${S.seqAfterLww}`, undefined, S.A.device_token);
  assert.equal(pull.body.changes.length, 0);
  // Void: strictly newer version of a ledger row.
  const s = sales[0];
  const r2 = await api('POST', '/sync/push', { changes: [{ entity: 'sales', id: s.id, data: { id: s.id, status: 'void', void_reason: 'Wrong item', updated_at: s.updated_at + 999 }, updated_at: s.updated_at + 999 }] }, S.A.device_token);
  assert.deepEqual(r2.body.superseded, []);
  const pull2 = await api('GET', `/sync/pull?since=${S.seqAfterLww}`, undefined, S.A2.device_token);
  assert.equal(pull2.body.changes.length, 1);
  assert.equal(pull2.body.changes[0].data.status, 'void');
  // Same-batch duplicates are collapsed (newest kept).
  const id = rid('D');
  const r3 = await api('POST', '/sync/push', { changes: [
    { entity: 'stock_moves', id, data: { id, qty: -1 }, updated_at: now },
    { entity: 'stock_moves', id, data: { id, qty: -1 }, updated_at: now }] }, S.A.device_token);
  assert.deepEqual(r3.body.accepted, [id]);
  assert.equal(Number(sqlVar(`SELECT COUNT(*) AS n FROM {p}records WHERE record_id='${id}'`)[0].n), 1);
});

await test('Invalid changes are rejected with reasons, valid ones in the same batch accepted', async () => {
  const ok = rid('V');
  const r = await api('POST', '/sync/push', { changes: [
    { entity: 'meta', id: 'x1', data: {}, updated_at: now },
    { entity: 'Bad Entity', id: 'x2', data: {}, updated_at: now },
    { entity: 'products', id: 'has space', data: {}, updated_at: now },
    { entity: 'products', id: 'noupd', data: {} },
    { entity: 'products', id: 'future', data: {}, updated_at: now + 5 * 86400000 },
    { entity: 'products', id: ok, data: { id: ok }, updated_at: now }] }, S.A.device_token);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.accepted, [ok]);
  const reasons = Object.fromEntries(r.body.rejected.map((x) => [x.id, x.reason]));
  assert.equal(reasons.x1, 'local_only_entity');
  assert.equal(reasons.x2, 'invalid_entity');
  assert.equal(reasons['has space'], 'invalid_id');
  assert.equal(reasons.noupd, 'invalid_updated_at');
  assert.equal(reasons.future, 'updated_at_in_future');
});

const emailB = `owner.b.${now}@example.com`;
await test('Tenant isolation: B cannot see A, same record id stored separately', async () => {
  const r = await api('POST', '/auth/register', { business_name: 'Wanjiru Salon', business_type: 'salon', owner_name: 'Grace Wanjiru', phone: '0711222333', email: emailB, password: 'secret456', town: 'Thika', device_name: 'Phone', source: 'app' });
  assert.equal(r.status, 201);
  S.B = r.body;
  let p = await api('GET', '/sync/pull?since=0', undefined, S.B.device_token);
  assert.equal(p.body.changes.length, 0, 'B sees nothing of A');
  const shared = pushed[3];
  await api('POST', '/sync/push', { changes: [{ entity: shared.entity, id: shared.id, data: { id: shared.id, name: 'B private' }, updated_at: now + 1 }] }, S.B.device_token);
  p = await api('GET', '/sync/pull?since=0', undefined, S.B.device_token);
  assert.equal(p.body.changes.length, 1);
  assert.equal(p.body.changes[0].data.name, 'B private');
  const a = await api('GET', `/sync/pull?since=${S.seqAfterLww}`, undefined, S.A.device_token);
  assert.ok(!a.body.changes.some((c) => c.data && c.data.name === 'B private'), 'A must not receive B data');
  const rowA = sqlVar(`SELECT data FROM {p}records WHERE tenant_id='${S.A.tenant_id}' AND record_id='${shared.id}'`)[0];
  assert.ok(!rowA.data.includes('B private'));
});

await test('M-Pesa STK returns 501 when Daraja is not configured; unknown status 404', async () => {
  let r = await api('POST', '/mpesa/stk', { phone: '0712345678', amount: 100, ref: 'NRB1-000001' }, S.A.device_token);
  assert.equal(r.status, 501);
  assert.equal(r.body.code, 'mpesa_not_configured');
  r = await api('GET', '/mpesa/stk/ws_CO_123456', undefined, S.A.device_token);
  assert.equal(r.status, 404);
});

await test('M-Pesa callback: wrong secret 403; valid callback for a licence request records payment', async () => {
  const sec = sqlVar(`SELECT option_value FROM wp_options WHERE option_name='ppc_settings'`)[0].option_value.match(/mpesa_callback_secret";s:\d+:"([a-z0-9]+)"/)[1];
  let r = await api('POST', '/mpesa/callback/wrongsecret123', { Body: {} });
  assert.equal(r.status, 403);
  php('sql', `INSERT INTO {p}mpesa_requests (tenant_id, checkout_request_id, purpose, phone, amount, ref, status, created_at, updated_at) VALUES ('${S.B.tenant_id}', 'ws_CO_${now}', 'licence', '254711222333', 1200, 'PPX', 'pending', '2026-11-09 00:00:00', '2026-11-09 00:00:00')`);
  r = await api('POST', '/mpesa/callback/' + sec, { Body: { stkCallback: { MerchantRequestID: 'm1', CheckoutRequestID: `ws_CO_${now}`, ResultCode: 0, ResultDesc: 'The service request is processed successfully.', CallbackMetadata: { Item: [{ Name: 'Amount', Value: 1200 }, { Name: 'MpesaReceiptNumber', Value: 'TKA1B2C3D4' }, { Name: 'PhoneNumber', Value: 254711222333 }] } } } });
  assert.equal(r.status, 200);
  assert.equal(r.body.ResultCode, 0);
  r = await api('GET', `/mpesa/stk/ws_CO_${now}`, undefined, S.B.device_token);
  assert.equal(r.body.status, 'paid');
  assert.equal(r.body.mpesa_receipt, 'TKA1B2C3D4');
  const lic = await api('GET', '/licence', undefined, S.B.device_token);
  assert.equal(lic.body.status, 'active');
  assert.equal(lic.body.plan, 'monthly');
  // Another tenant cannot read B's STK request.
  r = await api('GET', `/mpesa/stk/ws_CO_${now}`, undefined, S.A.device_token);
  assert.equal(r.status, 404);
});

await test('POST /backup stores a JSON snapshot', async () => {
  const r = await api('POST', '/backup', { tenant: S.A.tenant_id, products: [1, 2, 3] }, S.A.device_token);
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
});

await test('GET /me returns tenant + device', async () => {
  const r = await api('GET', '/me', undefined, S.A.device_token);
  assert.equal(r.body.tenant_id, S.A.tenant_id);
  assert.equal(r.body.device_id, S.A.device_id);
});

await test('POST /auth/logout revokes only that device token', async () => {
  const r = await api('POST', '/auth/logout', {}, S.A2.device_token);
  assert.equal(r.status, 200);
  assert.equal((await api('GET', '/licence', undefined, S.A2.device_token)).status, 401);
  assert.equal((await api('GET', '/licence', undefined, S.A.device_token)).status, 200);
});

// ---------------- Agents ----------------
const agentEmail = `agent.${now}@example.com`;
await test('Agent sign-up → pending; terms required; duplicate email 409', async () => {
  let r = await api('POST', '/agents/auth/register', { name: 'Peter Otieno', phone: '0733444555', email: agentEmail, password: 'agentpass1', town: 'Kisumu' });
  assert.equal(r.status, 422);
  assert.ok(r.body.data.fields.agree_terms);
  r = await api('POST', '/agents/auth/register', { name: 'Peter Otieno', phone: '0733444555', email: agentEmail, password: 'agentpass1', town: 'Kisumu', county: 'Kisumu', heard_from: 'Friend', agree_terms: true, device_name: 'Tecno' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.status, 'pending');
  assert.match(r.body.agent.code, /^AG-[A-Z2-9]{4,5}$/);
  assert.match(r.body.token, /^ppa_/);
  S.agent = r.body;
  r = await api('POST', '/agents/auth/register', { name: 'Peter Two', phone: '0733444556', email: agentEmail, password: 'agentpass1', agree_terms: true });
  assert.equal(r.status, 409);
});

await test('Pending agent: login works, /me shows pending, leads endpoints 403', async () => {
  let r = await api('POST', '/agents/auth/login', { email: agentEmail, password: 'agentpass1' });
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'pending');
  r = await api('GET', '/agents/me', undefined, S.agent.token);
  assert.equal(r.body.agent.status, 'pending');
  r = await api('POST', '/agents/leads/push', { changes: [] }, S.agent.token);
  assert.equal(r.status, 403);
  assert.equal(r.body.code, 'agent_pending');
  // Login by phone too.
  r = await api('POST', '/agents/auth/login', { login: '0733 444 555', password: 'agentpass1' });
  assert.equal(r.status, 200);
});

await test('Admin approves agent in wp-admin (admin-post) → approval email', async () => {
  await adminLogin();
  const f = await adminDo({ do: 'agent_status', agent_id: String(S.agent.agent.id), status: 'active' });
  assert.equal(f.type, 'success', f.msg);
  const r = await api('GET', '/agents/me', undefined, S.agent.token);
  assert.equal(r.body.agent.status, 'active');
  assert.ok(r.body.stats.leads_by_stage);
});

const L1 = rid('L'), L2 = rid('L'), L3 = rid('L');
await test('Agent leads push/pull with activities, LWW and phone duplicate check', async () => {
  const t = Date.now();
  const lead = (id, name, phone, stage, upd) => ({ entity: 'leads', id, updated_at: upd, data: { id, business_name: name, contact_name: 'Owner ' + name, phone, business_type: 'minimart', town: 'Kisumu', location: { lat: -0.0917, lng: 34.768, accuracy: 12 }, current_system: 'paper', branches: 1, package_interest: 'software', stage, next_follow_up: '2026-11-10', notes: 'Met at the shop', created_at: upd, updated_at: upd } });
  let r = await api('POST', '/agents/leads/push', { changes: [
    lead(L1, 'Otieno Minimart', '0700111222', 'new', t),
    lead(L2, 'Akinyi Agrovet', '0700111333', 'contacted', t),
    lead(L3, 'Lakeside Butchery', '0700111444', 'demo_booked', t),
    { entity: 'lead_activities', id: rid('A'), data: { lead_id: L1, type: 'visit', note: 'Visited, interested', at: t } },
    { entity: 'lead_activities', id: rid('A'), data: { lead_id: L1, type: 'call', note: 'Called back', at: t + 1 } }] }, S.agent.token);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.accepted.length, 5);
  r = await api('GET', '/agents/leads/pull?since=0', undefined, S.agent.token);
  assert.equal(r.body.changes.length, 3);
  const l1 = r.body.changes.find((c) => c.id === L1);
  assert.equal(l1.data.activities.length, 2);
  assert.equal(l1.data.location.lat, -0.0917);
  S.leadSeq = r.body.next_seq;
  // Older update ignored, newer applied.
  await api('POST', '/agents/leads/push', { changes: [lead(L2, 'Akinyi Agrovet OLD', '0700111333', 'new', t - 5)] }, S.agent.token);
  await api('POST', '/agents/leads/push', { changes: [lead(L2, 'Akinyi Agrovet Ltd', '0700111333', 'demo_done', t + 50)] }, S.agent.token);
  r = await api('GET', `/agents/leads/pull?since=${S.leadSeq}`, undefined, S.agent.token);
  assert.equal(r.body.changes.length, 1);
  assert.equal(r.body.changes[0].data.business_name, 'Akinyi Agrovet Ltd');
  // Duplicate phone check.
  r = await api('GET', '/agents/leads/check-phone?phone=0700111222', undefined, S.agent.token);
  assert.equal(r.body.exists, true);
  assert.equal(r.body.mine.id, L1);
  r = await api('GET', '/agents/leads/check-phone?phone=0799999999', undefined, S.agent.token);
  assert.equal(r.body.exists, false);
});

await test('Agent starts a 30-day trial for a lead → tenant with agent attribution + WhatsApp message', async () => {
  const r = await api('POST', '/agents/trials', { lead_id: L1, business_name: 'Otieno Minimart', business_type: 'minimart', owner_name: 'James Otieno', phone: '0700111222', email: `otieno.${now}@example.com`, town: 'Kisumu', county: 'Kisumu' }, S.agent.token);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.match(r.body.business_code, /^PP\d{5}$/);
  assert.equal(r.body.licence.status, 'trial');
  assert.ok(r.body.login.password.length >= 8);
  assert.ok(r.body.whatsapp_url.startsWith('https://wa.me/254700111222?text='));
  assert.ok(r.body.whatsapp_message.includes(r.body.login.password));
  S.trial = r.body;
  const t = sqlVar(`SELECT agent_id, source, lead_id FROM {p}tenants WHERE id='${r.body.tenant_id}'`)[0];
  assert.equal(Number(t.agent_id), S.agent.agent.id);
  assert.equal(t.source, 'agent');
  assert.equal(t.lead_id, L1);
  // Owner can sign in with the credentials, and gets the seeded business record.
  const login = await api('POST', '/auth/login', { email: r.body.login.email, password: r.body.login.password, device_name: 'Shop PC' });
  assert.equal(login.status, 200);
  const pull = await api('GET', '/sync/pull?since=0', undefined, login.body.device_token);
  const biz = pull.body.changes.find((c) => c.entity === 'business');
  assert.equal(biz.id, r.body.tenant_id);
  assert.equal(biz.data.name, 'Otieno Minimart');
  assert.equal(biz.updated_at, 1, 'seed record loses to any app edit');
  // Lead moved to trial with activity.
  const lp = await api('GET', `/agents/leads/pull?since=${S.leadSeq}`, undefined, S.agent.token);
  const l1 = lp.body.changes.find((c) => c.id === L1);
  assert.equal(l1.data.stage, 'trial');
  assert.equal(l1.data.tenant_id, r.body.tenant_id);
  assert.ok(l1.data.activities.some((a) => a.type === 'trial'));
  const tr = await api('GET', '/agents/trials', undefined, S.agent.token);
  assert.equal(tr.body.items[0].business_code, r.body.business_code);
});

await test('Agent books a demo for a lead → booking linked to agent + lead stage demo_booked', async () => {
  const r = await api('POST', '/agents/demo-bookings', { lead_id: L3, preferred_date: '2026-11-12', preferred_time: 'morning', message: 'Owner available after 10am' }, S.agent.token);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.match(r.body.ref, /^DB-[A-Z0-9]{6}$/);
  const b = sqlVar(`SELECT agent_id, lead_id, business FROM {p}demo_bookings WHERE ref='${r.body.ref}'`)[0];
  assert.equal(Number(b.agent_id), S.agent.agent.id);
  assert.equal(b.lead_id, L3);
  assert.equal(b.business, 'Lakeside Butchery');
});

await test('Admin records yearly subscription → paid_until +12 months, 20% commission (KES 2,400)', async () => {
  const f = await adminDo({ do: 'record_payment', tenant_id: S.trial.tenant_id, type: 'subscription_yearly', qty: '1', amount: '12000', method: 'mpesa', ref: 'TKX' + now.toString().slice(-7), paid_at: '' });
  assert.equal(f.type, 'success', f.msg);
  assert.match(f.msg, /commission created: KES 2,400/);
  const c = await api('GET', '/agents/commissions', undefined, S.agent.token);
  assert.equal(c.body.totals.pending, 240000);
  assert.equal(c.body.items[0].amount, 240000);
  assert.equal(c.body.items[0].rate, 20);
  const t = sqlVar(`SELECT plan, paid_until, trial_ends, first_paid_at FROM {p}tenants WHERE id='${S.trial.tenant_id}'`)[0];
  assert.equal(t.plan, 'yearly');
  const months = (new Date(t.paid_until + 'Z') - new Date(t.trial_ends + 'Z')) / 86400000;
  assert.ok(months > 360 && months < 370, 'paid period starts after the trial: ' + months);
  // First payment marks the agent's lead as won.
  const lp = await api('GET', '/agents/leads/pull?since=0', undefined, S.agent.token);
  assert.equal(lp.body.changes.find((c) => c.id === L1).data.stage, 'won');
  // Duplicate M-Pesa ref blocked.
  const f2 = await adminDo({ do: 'record_payment', tenant_id: S.trial.tenant_id, type: 'subscription_yearly', qty: '1', amount: '12000', method: 'mpesa', ref: 'TKX' + now.toString().slice(-7) });
  assert.equal(f2.type, 'error');
});

await test('Admin records Complete Till package → KES 3,000 bonus; Counter Kit → KES 1,000; setup only → none', async () => {
  await adminDo({ do: 'record_payment', tenant_id: S.trial.tenant_id, type: 'package_complete_till', qty: '1', amount: '69900', method: 'bank', ref: 'BANK1' });
  await adminDo({ do: 'record_payment', tenant_id: S.trial.tenant_id, type: 'counter_kit', qty: '1', amount: '', method: 'cash', ref: '' });
  await adminDo({ do: 'record_payment', tenant_id: S.trial.tenant_id, type: 'setup_only', qty: '1', amount: '', method: 'cash', ref: '' });
  const c = await api('GET', '/agents/commissions', undefined, S.agent.token);
  const bonuses = c.body.items.filter((i) => i.kind === 'bonus').map((i) => i.amount).sort();
  assert.deepEqual(bonuses, [100000, 300000]);
  assert.equal(c.body.totals.pending, 240000 + 300000 + 100000);
  const pays = sqlVar(`SELECT type, amount FROM {p}payments WHERE tenant_id='${S.trial.tenant_id}' ORDER BY id`);
  assert.equal(Number(pays.find((p) => p.type === 'counter_kit').amount), 2190000, 'default amount = price');
});

await test('Admin approves then marks commissions paid with M-Pesa ref', async () => {
  const ids = sqlVar(`SELECT id FROM {p}commissions WHERE agent_id=${S.agent.agent.id}`).map((r) => r.id);
  const body = { do: 'commission_status', status: 'approved' };
  const params = new URLSearchParams({ action: 'ppc_do', _wpnonce: nonce, _back: BASE + '/wp-admin/admin.php?page=ppc', ...body });
  ids.forEach((id) => params.append('ids[]', id));
  let r = await fetch(BASE + '/wp-admin/admin-post.php', { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieHeader() }, body: params });
  assert.equal(r.status, 302);
  let c = await api('GET', '/agents/commissions', undefined, S.agent.token);
  assert.equal(c.body.totals.approved, 640000);
  const f = await adminDo({ do: 'commission_status', commission_id: ids[0], status: 'paid', mpesa_ref: '' });
  assert.equal(f.type, 'error', 'paid requires a reference');
  await adminDo({ do: 'commission_status', commission_id: ids[0], status: 'paid', mpesa_ref: 'tkp123abc' });
  c = await api('GET', '/agents/commissions', undefined, S.agent.token);
  const paid = c.body.items.find((i) => i.status === 'paid');
  assert.equal(paid.mpesa_ref, 'TKP123ABC');
});

await test('Agent leaderboard (first names only) and resources', async () => {
  let r = await api('GET', '/agents/leaderboard', undefined, S.agent.token);
  assert.equal(r.status, 200);
  const me = r.body.items.find((i) => i.is_me) || r.body.me;
  assert.equal(me.name, 'Peter');
  assert.ok(!JSON.stringify(r.body).includes('Otieno'), 'no surnames');
  assert.equal(r.body.me.is_me, true);
  r = await api('GET', '/agents/resources', undefined, S.agent.token);
  assert.equal(r.body.items.length, 6);
  assert.equal(r.body.commission.software_rate, 20);
  assert.equal(r.body.prices.extra_till, 44900, 'agents resources carry the extra till price');
  assert.equal(r.body.prices.counter_kit, 21900);
});

await test('Agent profile update (M-Pesa number, language) and logout', async () => {
  let r = await api('POST', '/agents/me', { mpesa_phone: '0799 000 111', lang: 'sw' }, S.agent.token);
  assert.equal(r.body.agent.mpesa_phone, '254799000111');
  assert.equal(r.body.agent.lang, 'sw');
  const l = await api('POST', '/agents/auth/login', { email: agentEmail, password: 'agentpass1' });
  r = await api('POST', '/agents/auth/logout', {}, l.body.token);
  assert.equal(r.status, 200);
  assert.equal((await api('GET', '/agents/me', undefined, l.body.token)).status, 401);
  assert.equal((await api('GET', '/agents/me', undefined, S.agent.token)).status, 200, 'other sessions unaffected');
});

// ---------------- Public demo booking ----------------
await test('Demo booking: honeypot pretends success but stores nothing', async () => {
  const before = sqlVar('SELECT COUNT(*) AS n FROM {p}demo_bookings')[0].n;
  const r = await api('POST', '/public/demo-booking', { name: 'Bot', business: 'Spam Inc', phone: '0712345678', website: 'http://spam.example' });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(sqlVar('SELECT COUNT(*) AS n FROM {p}demo_bookings')[0].n, before);
});

await test('Demo booking: validation, stored with ref, agent ref creates a lead for that agent', async () => {
  let r = await api('POST', '/public/demo-booking', { name: 'A', business: '', phone: '12' });
  assert.equal(r.status, 422);
  r = await api('POST', '/public/demo-booking', { name: 'Mary Wambui', business: 'Wambui Cosmetics', business_type: 'cosmetics', phone: '0722 555 666', email: 'mary@example.com', town: 'Ruiru', preferred_date: '2026-11-14', preferred_time: 'afternoon', message: 'Two shops', agent_code: S.agent.agent.code.toLowerCase(), source_page: BASE + '/systems/pos/?ref=' + S.agent.agent.code });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.match(r.body.ref, /^DB-[A-Z0-9]{6}$/);
  const b = sqlVar(`SELECT * FROM {p}demo_bookings WHERE ref='${r.body.ref}'`)[0];
  assert.equal(b.phone, '254722555666');
  assert.equal(Number(b.agent_id), S.agent.agent.id);
  const p = await api('GET', '/agents/leads/pull?since=0', undefined, S.agent.token);
  assert.ok(p.body.changes.some((c) => c.data.business_name === 'Wambui Cosmetics' && c.data.stage === 'demo_booked'));
  const mails = execFileSync('cat', ['/home/claude/wptest/wp/wp-content/mail.log'], { encoding: 'utf8' });
  assert.ok(mails.includes(r.body.ref), 'admin emailed about booking');
});

// ---------------- Licence lifecycle ----------------
await test('Licence lifecycle: trial → grace → expired → active (payment) → suspended', async () => {
  const id = S.B.tenant_id;
  const set = (sql) => php('sql', `UPDATE {p}tenants SET ${sql} WHERE id='${id}'`);
  const lic = async () => (await api('GET', '/licence', undefined, S.B.device_token)).body;
  set(`paid_until=NULL, plan='trial', trial_ends='${new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 19).replace('T', ' ')}'`);
  let l = await lic(); assert.equal(l.status, 'trial'); assert.equal(l.days_left, 3);
  set(`trial_ends='${new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 19).replace('T', ' ')}'`);
  l = await lic(); assert.equal(l.status, 'grace'); assert.equal(l.days_left, 5);
  set(`trial_ends='${new Date(Date.now() - 9 * 864e5).toISOString().slice(0, 19).replace('T', ' ')}'`);
  l = await lic(); assert.equal(l.status, 'expired'); assert.equal(l.days_left, 0);
  // Expired businesses can still pull (never hold data hostage).
  assert.equal((await api('GET', '/sync/pull?since=0', undefined, S.B.device_token)).status, 200);
  await adminDo({ do: 'record_payment', tenant_id: id, type: 'subscription_monthly', qty: '2', amount: '', method: 'mpesa', ref: 'TKM' + now.toString().slice(-6) });
  l = await lic(); assert.equal(l.status, 'active'); assert.ok(l.days_left >= 58 && l.days_left <= 62, 'two months: ' + l.days_left);
  await adminDo({ do: 'suspend', tenant_id: id, reason: 'Test' });
  l = await lic(); assert.equal(l.status, 'suspended');
  assert.equal((await api('GET', '/sync/pull?since=0', undefined, S.B.device_token)).status, 200, 'suspended can still read');
  await adminDo({ do: 'unsuspend', tenant_id: id });
  l = await lic(); assert.equal(l.status, 'active');
  await adminDo({ do: 'extend_trial', tenant_id: S.A.tenant_id, days: '10' });
  l = (await api('GET', '/licence', undefined, S.A.device_token)).body;
  assert.equal(l.days_left, 40);
});

await test('Admin resets owner password (old stops working)', async () => {
  const f = await adminDo({ do: 'reset_password', tenant_id: S.B.tenant_id });
  const pw = /New owner password: (\S+)/.exec(f.msg)[1];
  assert.equal((await api('POST', '/auth/login', { email: emailB, password: 'secret456' })).status, 401);
  assert.equal((await api('POST', '/auth/login', { email: emailB, password: pw })).status, 200);
});

// ---------------- Rate limits ----------------
await test('Rate limits: demo booking (429 + Retry-After) and login brute force', async () => {
  php('sql', 'DELETE FROM {p}rate_limits');
  settings({ rate_booking: 3, rate_login: 4 });
  const codes = [];
  for (let i = 0; i < 5; i++) codes.push((await api('POST', '/public/demo-booking', { name: 'Rate Test', business: 'RL Shop', phone: '0712000' + (100 + i) })).status);
  assert.deepEqual(codes, [200, 200, 200, 429, 429]);
  const r = await api('POST', '/public/demo-booking', { name: 'Rate Test', business: 'RL Shop', phone: '0712000999' });
  assert.ok(Number(r.headers.get('retry-after')) > 0);
  const lc = [];
  for (let i = 0; i < 6; i++) lc.push((await api('POST', '/auth/login', { email: emailA, password: 'wrong' + i })).status);
  assert.deepEqual(lc, [401, 401, 401, 401, 429, 429]);
  // A different account from the same IP is not locked out by the per-account limit.
  assert.equal((await api('POST', '/auth/login', { email: emailB, password: 'wrong' })).status, 401);
  php('sql', 'DELETE FROM {p}rate_limits');
  settings({ rate_register: 1000, rate_login: 1000, rate_booking: 1000 });
});

// ---------------- Headers, CORS, static ----------------
await test('CORS is same-origin only on the POS API', async () => {
  let r = await api('GET', '/public/config', undefined, null, { Origin: 'https://evil.example' });
  assert.equal(r.headers.get('access-control-allow-origin'), null);
  r = await api('GET', '/public/config', undefined, null, { Origin: BASE });
  assert.equal(r.headers.get('access-control-allow-origin'), BASE);
});

await test('Static: /pos/ and /pos/agents/ served with correct types and cache headers', async () => {
  let r = await fetch(BASE + '/pos', { redirect: 'manual' });
  assert.equal(r.status, 301);
  assert.equal(new URL(r.headers.get('location')).pathname, '/pos/');
  r = await fetch(BASE + '/pos/?demo=1');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /text\/html/);
  assert.match(r.headers.get('cache-control'), /no-cache/);
  assert.equal(r.headers.get('x-litespeed-cache-control'), 'no-cache');
  r = await fetch(BASE + '/pos/agents/');
  assert.equal(r.status, 200);
  const agentsHtml = await r.text();
  assert.ok(/pos\/agents\//.test(agentsHtml) || agentsHtml.includes('Agents'), 'agents index');
  r = await fetch(BASE + '/pos/agents/leads/123');
  assert.equal(r.status, 200, 'SPA fallback for app routes');
  r = await fetch(BASE + '/pos/missing.js');
  assert.equal(r.status, 404);
  r = await fetch(BASE + '/pos/..%2F..%2Fwp-config.php');
  assert.notEqual(r.status, 200);
  r = await fetch(BASE + '/pos/agents/sw.js');
  if (r.status === 200) {
    assert.match(r.headers.get('content-type'), /javascript/);
    assert.equal(r.headers.get('service-worker-allowed'), '/pos/agents/');
    assert.match(r.headers.get('cache-control'), /no-cache/);
  }
  r = await fetch(BASE + '/pos/agents/manifest.webmanifest');
  if (r.status === 200) assert.match(r.headers.get('content-type'), /application\/manifest\+json/);
  const html = agentsHtml;
  const asset = /\/pos\/agents\/assets\/[^"']+\.js/.exec(html);
  if (asset) {
    r = await fetch(BASE + asset[0], { headers: { 'Accept-Encoding': 'gzip' } });
    assert.equal(r.status, 200);
    assert.match(r.headers.get('cache-control'), /immutable/);
    const etag = r.headers.get('etag');
    const r304 = await fetch(BASE + asset[0], { headers: { 'If-None-Match': etag } });
    assert.equal(r304.status, 304);
  }
  // Rest of the WordPress site still works.
  r = await fetch(BASE + '/');
  assert.equal(r.status, 200);
  r = await fetch(BASE + '/wp-json/');
  assert.equal(r.status, 200);
});

// ---------------- Summary ----------------
console.log(`\nPush 2,000 records: ${S.pushMs} ms total; pull 2,000: ${S.pullMs} ms`);
console.log(`${results.length - failures}/${results.length} passed`);
import('node:fs').then((fs) => fs.writeFileSync(new URL('./api-results.json', import.meta.url), JSON.stringify({ base: BASE, at: new Date().toISOString(), pushMs: S.pushMs, pullMs: S.pullMs, results }, null, 2)));
process.exitCode = failures ? 1 : 0;
