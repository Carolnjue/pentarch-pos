// Cloud API client — SPEC §4. Base: <cloud_url or same origin>/wp-json/pentarch-pos/v1
import { getMeta } from '../db/index.js';

export const API_PATH = '/wp-json/pentarch-pos/v1';
let baseOverride = '';
export const setCloudBase = (url) => { baseOverride = (url || '').replace(/\/+$/, ''); };
export const apiBase = () => (baseOverride || '') + API_PATH;

export class ApiError extends Error {
  constructor(status, body) { super(body?.message || body?.error || `HTTP ${status}`); this.status = status; this.body = body; }
}

export async function api(method, path, body, { token, timeout = 20000 } = {}) {
  const tok = token === undefined ? await getMeta('device_token') : token;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(apiBase() + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok, 'X-PPC-Token': tok } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl.signal,
      cache: 'no-store'
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = { message: text.slice(0, 200) }; }
    if (!res.ok) throw new ApiError(res.status, json);
    return json;
  } finally { clearTimeout(timer); }
}

export const Cloud = {
  register: (b) => api('POST', '/auth/register', b, { token: null }),
  login: (b) => api('POST', '/auth/login', b, { token: null }),
  logout: () => api('POST', '/auth/logout', {}),
  licence: () => api('GET', '/licence'),
  me: () => api('GET', '/me'),
  push: (changes) => api('POST', '/sync/push', { changes }, { timeout: 45000 }),
  pull: (since, limit = 1000) => api('GET', `/sync/pull?since=${encodeURIComponent(since)}&limit=${limit}`, null, { timeout: 45000 }),
  stk: (b) => api('POST', '/mpesa/stk', b),
  stkStatus: (id) => api('GET', '/mpesa/stk/' + encodeURIComponent(id)),
  config: () => api('GET', '/public/config', null, { token: null }),
  demoBooking: (b) => api('POST', '/public/demo-booking', b, { token: null })
};
