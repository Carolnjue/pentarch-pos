// Licence evaluation — SPEC §5. Pure: works offline from the cached licence.
export const GRACE_DAYS = 7;
const D = 86400000;
const ms = (v) => (v == null || v === '' ? null : typeof v === 'number' ? (v < 1e12 ? v * 1000 : v) : Date.parse(v));

/**
 * @param {object|null} lic cached licence from GET /licence (+ fetched_at)
 * @returns {{status, days_left, canSell, canPurchase, banner, needsConnect, until}}
 */
export function evaluateLicence(lic, now = Date.now(), { demo = false } = {}) {
  if (demo) return { status: 'demo', days_left: null, canSell: true, canPurchase: true, banner: null, needsConnect: false };
  if (!lic) return { status: 'unregistered', days_left: null, canSell: true, canPurchase: true, banner: 'unregistered', needsConnect: false };
  if (lic.status === 'suspended') return { status: 'suspended', days_left: 0, canSell: false, canPurchase: false, banner: 'suspended', needsConnect: false };
  const graceDays = Number(lic.grace_days) >= 0 && lic.grace_days !== null && lic.grace_days !== undefined ? Number(lic.grace_days) : GRACE_DAYS;
  const trialEnds = ms(lic.trial_ends);
  const paidUntil = ms(lic.paid_until);
  const until = paidUntil && (!trialEnds || paidUntil > trialEnds) ? paidUntil : trialEnds;
  const onTrial = !paidUntil || (trialEnds && trialEnds >= paidUntil && lic.status === 'trial');
  let status;
  if (!until) status = lic.status || 'active';
  else if (now <= until) status = onTrial ? 'trial' : 'active';
  else if (now <= until + graceDays * D) status = 'grace';
  else status = 'expired';
  const days_left = until ? Math.ceil((until - now) / D) : null;
  const neverOnline = lic.fetched_at && now - lic.fetched_at > 45 * D;
  const banner = status === 'expired' ? 'expired' : status === 'grace' ? 'grace' : (days_left != null && days_left <= 7) ? status : null;
  return {
    status, days_left, until, canSell: status !== 'expired', canPurchase: status !== 'expired', banner,
    needsConnect: status === 'trial' && !!neverOnline, grace_ends: until ? until + graceDays * D : null
  };
}

/** Published prices (KES) — used only until the cloud has been reached once. */
export const DEFAULT_PRICES = { monthly: 1200, yearly: 12000, branch_monthly: 1000, branch_yearly: 10000, trial_days: 30 };

/** Normalise prices from GET /licence pay{} and GET /public/config prices{} (both naming styles) — KES whole shillings. */
export function pricesFrom(pay = {}, cfg = null) {
  const pr = cfg?.prices || {};
  const pick = (...v) => v.find((x) => x != null && x !== '' && !isNaN(x));
  return {
    monthly: +pick(pay.amount_monthly, pr.software_monthly, pr.monthly, DEFAULT_PRICES.monthly),
    yearly: +pick(pay.amount_yearly, pr.software_yearly, pr.yearly, DEFAULT_PRICES.yearly),
    branch_monthly: +pick(pay.amount_branch_monthly, pay.extra_branch_monthly, pr.extra_branch_monthly, DEFAULT_PRICES.branch_monthly),
    branch_yearly: +pick(pay.amount_branch_yearly, pay.extra_branch_yearly, pr.extra_branch_yearly, DEFAULT_PRICES.branch_yearly),
    trial_days: +pick(cfg?.trial_days, DEFAULT_PRICES.trial_days)
  };
}
