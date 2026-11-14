// Business-type presets: modules switched on, look, sales pattern and demo people.
// Catalogues live in catalogues.js (code-split; loaded only when seeding).
export const BUSINESS_TYPES = [
  { id: 'duka', label: 'General shop / duka', icon: 'store', color: '#C9301F', vat: false, salesPerDay: 70, pattern: 'retail',
    modules: { credit: true, loyalty: false, units: true, weights: false } },
  { id: 'minimart', label: 'Minimart & supermarket', icon: 'cart', color: '#1F3C7A', vat: true, salesPerDay: 110, pattern: 'retail',
    modules: { credit: true, loyalty: true, units: true, weights: true, multi_branch: true } },
  { id: 'hardware', label: 'Hardware & building materials', icon: 'wrench', color: '#B97A00', vat: true, salesPerDay: 26, pattern: 'trade',
    modules: { credit: true, wholesale: true, units: true, quotes: true } },
  { id: 'agrovet', label: 'Agrovet', icon: 'leaf', color: '#0A7F7B', vat: false, salesPerDay: 34, pattern: 'trade',
    modules: { credit: true, batches: true, units: true } },
  { id: 'pharmacy', label: 'Pharmacy / chemist', icon: 'pill', color: '#0A7F7B', vat: true, salesPerDay: 48, pattern: 'retail',
    modules: { batches: true, credit: false, loyalty: true } },
  { id: 'boutique', label: 'Boutique, fashion & shoes', icon: 'shirt', color: '#5b3a8c', vat: false, salesPerDay: 14, pattern: 'fashion',
    modules: { variants: true, loyalty: true } },
  { id: 'electronics', label: 'Electronics & phone shop', icon: 'phone', color: '#182A55', vat: true, salesPerDay: 12, pattern: 'fashion',
    modules: { serials: true, credit: true, quotes: true } },
  { id: 'cosmetics', label: 'Cosmetics & beauty shop', icon: 'sparkle', color: '#C9301F', vat: false, salesPerDay: 30, pattern: 'fashion',
    modules: { loyalty: true, batches: false } },
  { id: 'butchery', label: 'Butchery', icon: 'scale', color: '#C9301F', vat: false, salesPerDay: 60, pattern: 'retail',
    modules: { weights: true, credit: true } },
  { id: 'bakery', label: 'Bakery & cake shop', icon: 'cake', color: '#B97A00', vat: false, salesPerDay: 55, pattern: 'cafe',
    modules: { recipes: true, quotes: true } },
  { id: 'restaurant', label: 'Restaurant, café & hotel', icon: 'utensils', color: '#C9301F', vat: true, salesPerDay: 62, pattern: 'restaurant',
    modules: { restaurant: true, recipes: true } },
  { id: 'bar', label: 'Bar & liquor store', icon: 'wine', color: '#5b3a8c', vat: true, salesPerDay: 75, pattern: 'bar',
    modules: { restaurant: true, units: true, credit: true } },
  { id: 'salon', label: 'Salon, barber & spa', icon: 'scissors', color: '#5b3a8c', vat: false, salesPerDay: 22, pattern: 'salon',
    modules: { services: true, loyalty: true } },
  { id: 'stationery', label: 'Stationery, bookshop & cyber', icon: 'book', color: '#1F3C7A', vat: false, salesPerDay: 45, pattern: 'retail',
    modules: { services: true, credit: true } },
  { id: 'wholesale', label: 'Wholesale & distribution', icon: 'truck', color: '#182A55', vat: true, salesPerDay: 24, pattern: 'trade',
    modules: { wholesale: true, units: true, credit: true, quotes: true, multi_branch: true } },
  { id: 'autospares', label: 'Auto spares', icon: 'car', color: '#182A55', vat: true, salesPerDay: 18, pattern: 'trade',
    modules: { quotes: true, credit: true } },
  { id: 'gas_water', label: 'LPG gas & water refill', icon: 'flame', color: '#0A7F7B', vat: false, salesPerDay: 40, pattern: 'retail',
    modules: { credit: true } },
  { id: 'other', label: 'Other / services', icon: 'grid', color: '#646E82', vat: false, salesPerDay: 20, pattern: 'retail',
    modules: { services: true, credit: true, quotes: true } }
];
export const typeById = (id) => BUSINESS_TYPES.find((x) => x.id === id) || BUSINESS_TYPES[0];

export const ALL_MODULES = ['restaurant', 'services', 'variants', 'batches', 'serials', 'weights', 'wholesale', 'units', 'credit', 'loyalty', 'quotes', 'recipes', 'multi_branch'];
export const MODULE_INFO = {
  restaurant: { label: 'Restaurant & tables', desc: 'Tables, kitchen tickets, bills and waiters', icon: 'utensils' },
  services: { label: 'Services & commission', desc: 'Services with duration, staff per line and commission', icon: 'scissors' },
  variants: { label: 'Variants', desc: 'Sizes and colours with their own barcodes and stock', icon: 'layers' },
  batches: { label: 'Batches & expiry', desc: 'Batch numbers, expiry dates and first-expiry-first-out selling', icon: 'calendar' },
  serials: { label: 'Serial numbers / IMEI', desc: 'Capture serials when selling and receiving', icon: 'hash' },
  weights: { label: 'Weighed items', desc: 'Sell by kg and read scale barcodes', icon: 'scale' },
  wholesale: { label: 'Wholesale pricing', desc: 'Wholesale price tiers by customer group or quantity', icon: 'truck' },
  units: { label: 'Units of measure', desc: 'Sell by piece, carton, bale or dozen', icon: 'package' },
  credit: { label: 'Credit sales (debtors)', desc: 'Sell on account, statements and debt reminders', icon: 'credit' },
  loyalty: { label: 'Loyalty points', desc: 'Customers earn and redeem points', icon: 'gift' },
  quotes: { label: 'Quotes & invoices', desc: 'Quotations, invoices and delivery notes', icon: 'file' },
  recipes: { label: 'Recipes & composites', desc: 'Selling an item deducts its ingredients', icon: 'coffee' },
  multi_branch: { label: 'Multiple branches', desc: 'Branches, transfers and per-branch prices', icon: 'store' }
};

/** Demo people. Owner 1234, Manager 2222, Cashier 1111, then type-specific roles. */
export function demoStaff(type) {
  const base = [
    { name: 'Grace Wanjiru', role: 'owner', pin: '1234', phone: '0722 418 903' },
    { name: 'Peter Ouma', role: 'manager', pin: '2222', phone: '0711 205 774', max_discount_pct: 15 },
    { name: 'Mercy Akinyi', role: 'cashier', pin: '1111', phone: '0798 334 120', max_discount_pct: 5 }
  ];
  if (type === 'restaurant' || type === 'bar') base.push({ name: 'Brian Kiptoo', role: 'waiter', pin: '3333', phone: '0745 902 316' }, { name: 'Lilian Chebet', role: 'waiter', pin: '3434', phone: '0727 610 448' });
  if (['minimart', 'hardware', 'wholesale', 'agrovet', 'autospares', 'pharmacy'].includes(type)) base.push({ name: 'Samuel Mutiso', role: 'stock', pin: '4444', phone: '0733 551 862' });
  if (type === 'salon') base.push(
    { name: 'Esther Njeri', role: 'cashier', pin: '5151', phone: '0790 118 245', commission_pct: 30 },
    { name: 'Kevin Omondi', role: 'cashier', pin: '5252', phone: '0701 476 309', commission_pct: 35 },
    { name: 'Faith Moraa', role: 'cashier', pin: '5353', phone: '0757 203 961', commission_pct: 30 });
  if (['wholesale', 'minimart', 'hardware'].includes(type)) base.push({ name: 'Janet Wairimu', role: 'accountant', pin: '6666', phone: '0720 845 113' });
  return base;
}

export const DEMO_CUSTOMERS = [
  ['Wanjiku Kamau', '0722 314 562', 'retail', 5000], ['Otieno Odhiambo', '0711 908 245', 'retail', 3000], ['Achieng Atieno', '0798 662 017', 'retail', 0],
  ['Kiprotich Kibet', '0726 401 338', 'retail', 2000], ['Mwangi Njoroge', '0733 772 904', 'retail', 10000], ['Fatuma Hassan', '0745 128 690', 'retail', 0],
  ['Mutua Musyoka', '0712 553 870', 'retail', 4000], ['Nekesa Wafula', '0790 337 451', 'retail', 0], ['Chebet Rotich', '0701 846 205', 'retail', 2500],
  ['Juma Bakari', '0757 290 664', 'retail', 0], ['Mama Njeri Shop', '0724 610 993', 'wholesale', 50000], ['Kilimani Mini Mart', '0716 205 388', 'wholesale', 80000],
  ['Baraka Builders Ltd', '0735 418 207', 'wholesale', 150000], ['Ruiru Fresh Hotel', '0729 904 115', 'wholesale', 60000]
];

export const DEMO_SUPPLIERS = {
  duka: ['Brookside Dairy', 'Unga Ltd', 'Bidco Africa', 'Kapa Oil Refineries', 'Twiga Foods'],
  minimart: ['Brookside Dairy', 'Unga Ltd', 'Bidco Africa', 'Kenafric Industries', 'Pwani Oil', 'Twiga Foods'],
  hardware: ['Bamburi Cement', 'Mabati Rolling Mills', 'Crown Paints', 'Doshi Hardware', 'Kenbro Industries'],
  agrovet: ['Elgon Kenya', 'Kenya Seed Company', 'Unga Farm Care', 'Twiga Chemicals', 'Osho Chemicals'],
  pharmacy: ['Dawa Ltd', 'Harleys Ltd', 'Surgipharm', 'Cosmos Ltd', 'Laborex Kenya'],
  boutique: ['Gikomba Wholesalers', 'Eastleigh Fashion House', 'Bata Shoe Company', 'Rivatex East Africa'],
  electronics: ['Safaricom Dealer Desk', 'Transsion Kenya', 'Samsung Distributor EA', 'Mobicom Kenya'],
  cosmetics: ['Beiersdorf EA', 'Haco Industries', 'Sasini Beauty Imports', 'Interconsumer Products'],
  butchery: ['Kenya Meat Commission', 'Ngong Livestock Traders', 'Kenchic', 'Farmers Choice'],
  bakery: ['Unga Ltd', 'Kabras Sugar', 'Brookside Dairy', 'Kenchic (eggs)', 'Bidco Africa'],
  restaurant: ['Twiga Foods', 'Kenchic', 'Brookside Dairy', 'Coca-Cola Beverages Africa', 'Wakulima Market Traders'],
  bar: ['East African Breweries', 'Kenya Wine Agencies', 'Coca-Cola Beverages Africa', 'Keroche Breweries'],
  salon: ['Darling Kenya', 'Haco Industries', 'Beauty Supply Kenya', 'Strategic Industries'],
  stationery: ['Kartasi Brands', 'Text Book Centre', 'Kenya Literature Bureau', 'Office Point Ltd'],
  wholesale: ['Bidco Africa', 'Unga Ltd', 'Pwani Oil', 'Kapa Oil Refineries', 'Mumias Sugar', 'Menengai Oil'],
  autospares: ['Toyota Kenya Parts', 'Kingsway Tyres', 'Total Energies Kenya', 'CMC Motors Parts', 'Ryce East Africa'],
  gas_water: ['K-Gas Distributors', 'Total Gas', 'Pro Gas', 'Keringet Water'],
  other: ['Office Point Ltd', 'Twiga Foods', 'Text Book Centre']
};

export const CATEGORY_COLORS = ['#C9301F', '#1F3C7A', '#0A7F7B', '#B97A00', '#5b3a8c', '#182A55', '#EE4B3B', '#14B1AC', '#F6B22C', '#646E82'];
