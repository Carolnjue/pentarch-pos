// Global app state (Preact signals). Read with `.value` in components — they re-render automatically.
import { signal, computed } from '@preact/signals';

export const phase = signal('boot');          // 'boot' | 'welcome' | 'wizard' | 'locked' | 'app'
export const mode = signal('live');           // 'live' | 'demo'
export const business = signal(null);         // business record
export const branches = signal([]);
export const branch = signal(null);           // current branch record
export const device = signal({ id: null, no: 1, name: '' });
export const user = signal(null);             // logged-in staff record
export const users = signal([]);
export const shift = signal(null);            // open shift on this device (or null)
export const online = signal(typeof navigator !== 'undefined' ? navigator.onLine : true);
export const sync = signal({ state: 'idle', pending: 0, lastAt: 0, error: '' }); // state: idle|syncing|offline|error|demo
export const licence = signal(null);
export const lang = signal('en');
export const route = signal({ path: '/home', params: {}, query: {} });
export const sidebarCollapsed = signal(false);
export const tenantId = signal(null);

export const settings = computed(() => ({ ...DEFAULT_SETTINGS, ...(business.value?.settings || {}) }));
export const modulesOn = computed(() => business.value?.modules || {});
export const isDemo = computed(() => mode.value === 'demo');

export const DEFAULT_SETTINGS = {
  vat_inclusive: true,
  default_tax: 'B',
  receipt_width: 80,
  receipt_header: '',
  receipt_footer: 'Thank you for shopping with us!',
  receipt_show_logo: true,
  receipt_show_qr: true,
  receipt_show_barcode: false,
  receipt_show_cashier: true,
  receipt_show_tax: true,
  receipt_font_size: 12,
  auto_print: false,
  print_copies: 1,
  print_mode: 'browser',          // browser print dialog
  label_preset: '38x25',
  kitchen_stations: ['kitchen', 'bar'],
  pay_cash: true, pay_mpesa: true, pay_card: true, pay_bank: false, pay_credit: true, pay_points: false, pay_voucher: false,
  mpesa_type: 'till',             // 'till' | 'paybill'
  mpesa_till: '', mpesa_paybill: '', mpesa_account: '',
  mpesa_stk: false,               // request STK push via cloud (needs Daraja on cloud)
  allow_below_cost: false,
  allow_negative_stock: true,
  require_shift: false,
  rounding: true,                 // round totals to nearest 1 KES
  wholesale_auto_qty: true,
  default_customer_id: '',
  tips_enabled: false,
  service_charge_pct: 0,
  sound_on_scan: true,
  auto_lock_min: 10,
  loyalty_enabled: false,
  loyalty_earn_per: 100,          // 1 point per KES X spent
  loyalty_point_value: 100,       // cents per point when redeeming
  weight_prefix: '21', price_prefix: '22', price_decimals: 0,
  notify_low_stock: true, notify_expiry_days: 30, notify_backup_days: 7,
  quick_cash: [50, 100, 200, 500, 1000],
  cloud_url: '',
  role_perms: {}                  // { role: { permKey: bool } } owner overrides of the defaults
};
