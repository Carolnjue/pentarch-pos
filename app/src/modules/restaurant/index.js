// Restaurant module: floor plan & tables, table orders on the Sell screen, kitchen tickets (KOT) + kitchen display (KDS),
// bills, split / transfer / merge, takeaway & delivery queue, waiter mode. On for restaurant / café / hotel and bar types.
import { lazy } from '../../lib/lazy.jsx';
import { navigate } from '../../router.js';
import { on } from '../../lib/bus.js';
import { can } from '../../auth/permissions.js';
import * as S from '../../state.js';
import { effect } from '@preact/signals';
import { sellExt } from './bridge.jsx';
import { TablesWidget } from './widget.jsx';
import { demoSeed } from './seed.js';

const FloorPage = lazy(() => import('./FloorPage.jsx'));
const OrdersPage = lazy(() => import('./OrdersPage.jsx'));
const KdsPage = lazy(() => import('./KdsPage.jsx'));
const SERVE = ['owner', 'manager', 'cashier', 'waiter'];
const enabled = (biz) => !!biz.modules?.restaurant;

// Waiters land on the floor plan instead of the dashboard; after a dine-in bill is paid the floor plan comes back.
const waiterHome = () => {
  if (S.route.value.path === '/home' && S.phase.value === 'app' && enabled(S.business.value || {}) && S.user.value && !can('dashboard.view') && can('tables.use')) setTimeout(() => navigate('/tables', { replace: true }), 0);
};
on('route', waiterHome);
// also when a waiter signs in on a till that is showing Home (the route does not change then)
let lastUser = null;
effect(() => { const u = S.user.value, ph = S.phase.value; if (u && ph === 'app' && u.id !== lastUser) { lastUser = u.id; waiterHome(); } else if (!u || ph !== 'app') lastUser = null; });
on('sale', (sale) => {
  if (sale.order_type === 'dine_in' && sale.order_id && !sale.parent_id && S.route.value.path === '/sell') navigate('/tables');
});

// fetch this module's pages in the background so they also open offline on a freshly installed till
let preloaded = false;
on('route', () => {
  if (preloaded || !(enabled(S.business.value || {}))) return;
  preloaded = true;
  (window.requestIdleCallback || setTimeout)(() => { FloorPage.preload(); OrdersPage.preload(); KdsPage.preload(); import('./dialogs.jsx'); import('../sell/Tender.jsx'); });
});

export default {
  id: 'restaurant',
  enabled,
  permissions: [
    { key: 'tables.use', label: 'Use tables, takeaway & delivery orders', group: 'Restaurant', roles: SERVE },
    { key: 'tables.layout', label: 'Edit table layout', group: 'Restaurant', roles: ['owner', 'manager'] },
    { key: 'restaurant.void_sent', label: 'Remove items already sent to the kitchen', group: 'Restaurant', roles: ['owner', 'manager'] },
    { key: 'restaurant.take_payment', label: 'Take payment for orders', group: 'Restaurant', roles: ['owner', 'manager', 'cashier'] },
    { key: 'kds.view', label: 'Kitchen display', group: 'Restaurant', roles: SERVE }
  ],
  routes: [
    { path: '/tables', component: FloorPage, perm: 'tables.use', title: 'Tables' },
    { path: '/orders', component: OrdersPage, perm: 'tables.use', title: 'Takeaway & delivery' },
    { path: '/kds', component: KdsPage, perm: 'kds.view', title: 'Kitchen display' }
  ],
  nav: [
    { path: '/tables', label: 'Tables', icon: 'utensils', order: 11, perm: 'tables.use' },
    { path: '/orders', label: 'Takeaway & delivery', icon: 'bag', order: 12, perm: 'tables.use' },
    { path: '/kds', label: 'Kitchen display', icon: 'monitor', order: 13, perm: 'kds.view' }
  ],
  widgets: [{ id: 'tables', order: 2, size: 'full', component: TablesWidget, perm: 'tables.use' }],
  settings: [{ id: 'restaurant', label: 'Restaurant & tables', icon: 'utensils', order: 8, component: lazy(() => import('./Settings.jsx')), perm: 'settings.view' }],
  commands: [
    { id: 'r.tables', label: 'Tables', icon: 'utensils', run: () => navigate('/tables'), perm: 'tables.use', keywords: 'meza floor restaurant waiter' },
    { id: 'r.orders', label: 'Takeaway & delivery', icon: 'bag', run: () => navigate('/orders'), perm: 'tables.use', keywords: 'takeaway delivery rider oda' },
    { id: 'r.kds', label: 'Kitchen display', icon: 'monitor', run: () => navigate('/kds'), perm: 'kds.view', keywords: 'kds kitchen jikoni bump' }
  ],
  shortcuts: [{ keys: 'F8', label: 'Save the table and go back to the floor', scope: 'Tables' }],
  sell: sellExt,
  demoSeed
};
