// Prices and commission shown in the portal. The server config (Pentarch POS → Settings)
// is the source of truth; these defaults match research/pricing-decisions.md (9 Nov 2026)
// and are only used before the first sync or for items the server does not send yet.
export const DEFAULT_PRICES = {
  software_monthly: 1200,
  software_yearly: 12000,
  extra_branch_monthly: 1000,
  extra_branch_yearly: 10000,
  package_software_setup: 15000,
  setup_only_fee: 3500,
  package_complete_till: 69900,
  counter_kit: 21900,
  extra_till: 44900
};
export const DEFAULT_COMMISSION = {
  software_rate: 20,
  commission_months: 12,
  bonus_complete_till: 3000,
  bonus_software_setup: 1500,
  bonus_counter_kit: 1000
};

const pick = (srv, def) => {
  const out = { ...def };
  if (srv) for (const k of Object.keys(def)) if (srv[k] !== undefined && srv[k] !== null && srv[k] !== '') out[k] = Number(srv[k]);
  return out;
};
export const prices = (srv) => pick(srv, DEFAULT_PRICES);
export const commission = (srv) => pick(srv, DEFAULT_COMMISSION);
