// Minimal monotonic ULID (Crockford base32) — 26 chars, time-sortable.
const ENC = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
let lastTime = 0;
let lastRand = [];
function randChars(n) {
  const out = [];
  const bytes = new Uint8Array(n);
  (globalThis.crypto || require('crypto').webcrypto).getRandomValues(bytes);
  for (let i = 0; i < n; i++) out.push(bytes[i] % 32);
  return out;
}
export function ulid(time = Date.now()) {
  let rand;
  if (time === lastTime) {
    rand = lastRand.slice();
    for (let i = rand.length - 1; i >= 0; i--) { if (rand[i] < 31) { rand[i]++; break; } rand[i] = 0; }
  } else rand = randChars(16);
  lastTime = time; lastRand = rand;
  let t = time, ts = '';
  for (let i = 0; i < 10; i++) { ts = ENC[t % 32] + ts; t = Math.floor(t / 32); }
  return ts + rand.map((r) => ENC[r]).join('');
}
export const ulidTime = (id) => {
  let t = 0;
  for (let i = 0; i < 10; i++) t = t * 32 + ENC.indexOf(id[i]);
  return t;
};
