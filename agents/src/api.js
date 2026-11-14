// Thin client for /wp-json/pentarch-pos/v1 (same origin).
export const API_BASE = '/wp-json/pentarch-pos/v1';

export class ApiError extends Error {
  constructor(status, code, message, data) {
    super(message || code || 'Request failed');
    this.status = status; this.code = code; this.data = data;
  }
}

let token = null;
export function setToken(t) { token = t; }
export function getToken() { return token; }

export async function api(method, path, body, { timeout = 20000 } = {}) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ApiError(0, 'offline', 'offline');
  }
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) {
    headers.Authorization = 'Bearer ' + token;
    headers['X-PPC-Token'] = token; // Fallback for hosts that strip Authorization.
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  let res;
  try {
    res = await fetch(API_BASE + path, {
      method, headers, credentials: 'omit', cache: 'no-store', signal: ctl.signal,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch (e) {
    throw new ApiError(0, 'network', 'network');
  } finally {
    clearTimeout(timer);
  }
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  if (!res.ok) {
    throw new ApiError(res.status, json && json.code, json && json.message, json && json.data);
  }
  return json;
}
