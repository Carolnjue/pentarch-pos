// Inventory module: stock on hand, movement ledger, adjustments, stock takes, transfers, repack, reorder, expiry, serials.
import { lazy } from '../../lib/lazy.jsx';
import { navigate } from '../../router.js';
const StockPage = lazy(() => import('./StockPage.jsx'));
const Ledger = lazy(() => import('./Ledger.jsx'));
const Adjustments = lazy(() => import('./Adjustments.jsx'));
const Counts = lazy(() => import('./Counts.jsx'));
const CountSheet = lazy(() => import('./CountSheet.jsx'));
const Transfers = lazy(() => import('./Transfers.jsx'));
const TransferNew = lazy(() => import('./TransferNew.jsx'));
const TransferView = lazy(() => import('./TransferView.jsx'));
const Reorder = lazy(() => import('./Reorder.jsx'));
const Expiry = lazy(() => import('./Expiry.jsx'));
const Serials = lazy(() => import('./Serials.jsx'));
const Repack = lazy(() => import('./Repack.jsx'));
const SettingsPanel = lazy(() => import('./SettingsPanel.jsx'));

const VIEW = ['owner', 'manager', 'stock', 'accountant'];
const DO = ['owner', 'manager', 'stock'];
export default {
  id: 'inventory',
  permissions: [
    { key: 'inventory.view', label: 'View stock levels & movements', group: 'Inventory', roles: VIEW },
    { key: 'inventory.adjust', label: 'Adjust stock (damaged, expired, found…)', group: 'Inventory', roles: DO },
    { key: 'inventory.approve', label: 'Approve large stock changes', group: 'Inventory', roles: ['owner', 'manager'] },
    { key: 'inventory.count', label: 'Count stock (stock take)', group: 'Inventory', roles: DO },
    { key: 'inventory.count_apply', label: 'Apply stock counts', group: 'Inventory', roles: DO },
    { key: 'inventory.transfer', label: 'Move stock between branches', group: 'Inventory', roles: DO },
    { key: 'inventory.repack', label: 'Repack / convert stock', group: 'Inventory', roles: DO }
  ],
  routes: [
    { path: '/inventory', component: StockPage, perm: 'inventory.view', title: 'Stock' },
    { path: '/inventory/product/:id', component: Ledger, perm: 'inventory.view', title: 'Stock history' },
    { path: '/inventory/adjustments', component: Adjustments, perm: 'inventory.adjust', title: 'Adjustments' },
    { path: '/inventory/counts', component: Counts, perm: 'inventory.count', title: 'Count stock' },
    { path: '/inventory/counts/:id', component: CountSheet, perm: 'inventory.count', title: 'Count stock' },
    { path: '/inventory/transfers', component: Transfers, perm: 'inventory.transfer', title: 'Move stock' },
    { path: '/inventory/transfers/new', component: TransferNew, perm: 'inventory.transfer', title: 'Move stock' },
    { path: '/inventory/transfers/:id', component: TransferView, perm: 'inventory.transfer', title: 'Move stock' },
    { path: '/inventory/reorder', component: Reorder, perm: 'inventory.view', title: 'Reorder' },
    { path: '/inventory/expiry', component: Expiry, perm: 'inventory.view', title: 'Expiry' },
    { path: '/inventory/serials', component: Serials, perm: 'inventory.view', title: 'Serial / IMEI lookup' },
    { path: '/inventory/repack', component: Repack, perm: 'inventory.repack', title: 'Repack stock' }
  ],
  nav: [{ path: '/inventory', label: 'Stock', icon: 'layers', order: 25, perm: 'inventory.view' }],
  // Home 'Low stock' / 'Expiring soon' widgets live in modules/home/widgets.jsx (one each; they drill into Stock pages)
  settings: [{ id: 'stock', label: 'Stock & purchasing', icon: 'layers', order: 8, component: SettingsPanel, perm: 'settings.view' }],
  commands: [
    { id: 'inv.stock', label: 'Stock on hand', icon: 'layers', run: () => navigate('/inventory'), perm: 'inventory.view', keywords: 'stoki inventory levels value' },
    { id: 'inv.adjust', label: 'Adjust stock', icon: 'sliders', run: () => navigate('/inventory/adjustments?new=1'), perm: 'inventory.adjust', keywords: 'damaged expired theft loss found correction rekebisha' },
    { id: 'inv.count', label: 'Count stock (stock take)', icon: 'list', run: () => navigate('/inventory/counts?new=1'), perm: 'inventory.count', keywords: 'stock take hesabu' },
    { id: 'inv.transfer', label: 'Move stock to another branch', icon: 'truck', run: () => navigate('/inventory/transfers/new'), perm: 'inventory.transfer', keywords: 'transfer branch hamisha' },
    { id: 'inv.repack', label: 'Repack stock (e.g. 50 kg bag into 1 kg packets)', icon: 'scale', run: () => navigate('/inventory/repack'), perm: 'inventory.repack', keywords: 'convert break bulk' },
    { id: 'inv.reorder', label: 'What to reorder', icon: 'refresh', run: () => navigate('/inventory/reorder'), perm: 'inventory.view', keywords: 'low stock reorder suggestions' },
    { id: 'inv.expiry', label: 'Expiry dates', icon: 'calendar', run: () => navigate('/inventory/expiry'), perm: 'inventory.view', keywords: 'expired batch fefo' },
    { id: 'inv.serial', label: 'Find a serial / IMEI number', icon: 'hash', run: () => navigate('/inventory/serials'), perm: 'inventory.view', keywords: 'imei serial warranty' }
  ],
  shortcuts: [
    { keys: 'Scan', label: 'Scan on the Stock page to open that item’s history', scope: 'Stock' },
    { keys: 'Scan', label: 'Scan to count: each scan adds one', scope: 'Stock take' }
  ]
};
