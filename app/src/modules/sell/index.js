import { lazy } from '../../lib/lazy.jsx';
import SellPage from './SellPage.jsx';
import { navigate } from '../../router.js';

const SalesPage = lazy(() => import('./SalesPage.jsx'));
const SaleDetail = lazy(() => import('./SalesPage.jsx').then((m) => ({ default: m.SaleDetail })));
const S = ['owner', 'manager', 'cashier'];

export default {
  id: 'sell',
  permissions: [
    { key: 'sell.use', label: 'Sell', group: 'Selling', roles: ['owner', 'manager', 'cashier', 'waiter'] },
    { key: 'sell.discount', label: 'Give discounts (up to own limit)', group: 'Selling', roles: ['owner', 'manager', 'cashier'] },
    { key: 'sell.price_override', label: 'Change selling price on a sale', group: 'Selling', roles: ['owner', 'manager'] },
    { key: 'sell.below_cost', label: 'Sell below cost', group: 'Selling', roles: ['owner'] },
    { key: 'sell.negative_stock', label: 'Sell items that are out of stock', group: 'Selling', roles: ['owner', 'manager'] },
    { key: 'sell.credit', label: 'Sell on credit', group: 'Selling', roles: S },
    { key: 'sell.credit_over_limit', label: 'Exceed customer credit limit', group: 'Selling', roles: ['owner', 'manager'] },
    { key: 'sell.mpesa_reuse', label: 'Accept an M-Pesa code already used', group: 'Selling', roles: ['owner'] },
    { key: 'sell.void', label: 'Void a sale', group: 'Selling', roles: ['owner', 'manager'] },
    { key: 'sell.return', label: 'Returns & refunds', group: 'Selling', roles: ['owner', 'manager'] },
    { key: 'sell.drawer', label: 'Open cash drawer (no sale)', group: 'Selling', roles: ['owner', 'manager'] },
    { key: 'sales.view', label: 'View sales & receipts', group: 'Selling', roles: ['owner', 'manager', 'cashier', 'accountant'] },
    { key: 'sales.view_all', label: 'See all staff sales (not only own)', group: 'Selling', roles: ['owner', 'manager', 'accountant'] }
  ],
  routes: [
    { path: '/sell', component: SellPage, perm: 'sell.use', title: 'Sell' },
    { path: '/sales', component: SalesPage, perm: 'sales.view', title: 'Sales & receipts' },
    { path: '/sales/:id', component: SaleDetail, perm: 'sales.view', title: 'Receipt' }
  ],
  nav: [
    { path: '/sell', label: 'Sell', icon: 'cart', order: 10, perm: 'sell.use', kbd: 'F2' },
    { path: '/sales', label: 'Sales & receipts', icon: 'receipt', order: 15, perm: 'sales.view' }
  ],
  commands: [
    { id: 'sell.new', label: 'New sale', icon: 'cart', run: () => navigate('/sell'), keywords: 'sell pos checkout uza', perm: 'sell.use', kbd: 'F2' },
    { id: 'sell.recent', label: 'Find a receipt', icon: 'receipt', run: () => navigate('/sales'), keywords: 'receipt reprint return void', perm: 'sales.view' }
  ],
  shortcuts: [
    { keys: 'F2', label: 'Search / scan', scope: 'Sell' }, { keys: 'F4 / Enter', label: 'Pay (Enter on empty search)', scope: 'Sell' },
    { keys: 'F6', label: 'Discount on whole sale', scope: 'Sell' }, { keys: 'F7', label: 'Recall held sale', scope: 'Sell' },
    { keys: 'F8', label: 'Hold sale', scope: 'Sell' }, { keys: 'F9', label: 'Customer', scope: 'Sell' }, { keys: 'F10', label: 'Open cash drawer', scope: 'Sell' },
    { keys: '↑ / ↓', label: 'Select cart line', scope: 'Sell' }, { keys: '+ / -', label: 'Change quantity of selected line', scope: 'Sell' },
    { keys: '*', label: 'Edit selected line (price, discount, note)', scope: 'Sell' }, { keys: 'Del', label: 'Remove selected line', scope: 'Sell' },
    { keys: 'Ctrl Del', label: 'Clear cart', scope: 'Sell' }, { keys: '3*', label: 'Type 3* before a search to add 3', scope: 'Sell' },
    { keys: 'Alt 1–6', label: 'Choose payment method', scope: 'Payment' }, { keys: 'Enter', label: 'Complete payment / new sale', scope: 'Payment' }, { keys: 'P', label: 'Print receipt after sale', scope: 'Payment' }
  ]
};
