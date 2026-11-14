// Purchasing module: suppliers (balances, statements), purchase orders, receiving goods, supplier payments and returns.
import { lazy } from '../../lib/lazy.jsx';
import { navigate } from '../../router.js';
const Deliveries = lazy(() => import('./Deliveries.jsx'));
const Receive = lazy(() => import('./Receive.jsx'));
const GrnView = lazy(() => import('./GrnView.jsx'));
const Orders = lazy(() => import('./Orders.jsx'));
const OrderEdit = lazy(() => import('./OrderEdit.jsx'));
const Suppliers = lazy(() => import('./Suppliers.jsx'));
const SupplierProfile = lazy(() => import('./SupplierProfile.jsx'));
const Payments = lazy(() => import('./Payments.jsx'));
const Returns = lazy(() => import('./Returns.jsx'));
const ReturnNew = lazy(() => import('./ReturnNew.jsx'));

const DO = ['owner', 'manager', 'stock'];
export default {
  id: 'purchasing',
  permissions: [
    { key: 'purchasing.view', label: 'View suppliers, orders & deliveries', group: 'Purchasing', roles: [...DO, 'accountant'] },
    { key: 'purchasing.receive', label: 'Receive stock from suppliers', group: 'Purchasing', roles: DO },
    { key: 'purchasing.orders', label: 'Create & send purchase orders', group: 'Purchasing', roles: DO },
    { key: 'purchasing.pay', label: 'Pay suppliers', group: 'Purchasing', roles: ['owner', 'manager'] },
    { key: 'purchasing.returns', label: 'Return goods to suppliers', group: 'Purchasing', roles: DO },
    { key: 'suppliers.edit', label: 'Add & edit suppliers', group: 'Purchasing', roles: DO }
  ],
  routes: [
    { path: '/purchasing', component: Deliveries, perm: 'purchasing.view', title: 'Purchases' },
    { path: '/purchasing/receive', component: Receive, perm: 'purchasing.receive', title: 'Receive stock' },
    { path: '/purchasing/grn/:id', component: GrnView, perm: 'purchasing.view', title: 'Delivery@@goods' },
    { path: '/purchasing/orders', component: Orders, perm: 'purchasing.view', title: 'Purchase orders' },
    { path: '/purchasing/orders/new', component: OrderEdit, perm: 'purchasing.orders', title: 'New purchase order' },
    { path: '/purchasing/orders/:id', component: OrderEdit, perm: 'purchasing.view', title: 'Purchase order' },
    { path: '/purchasing/suppliers', component: Suppliers, perm: 'purchasing.view', title: 'Suppliers' },
    { path: '/purchasing/suppliers/:id', component: SupplierProfile, perm: 'purchasing.view', title: 'Supplier' },
    { path: '/purchasing/payments', component: Payments, perm: 'purchasing.pay', title: 'Supplier payments' },
    { path: '/purchasing/returns', component: Returns, perm: 'purchasing.view', title: 'Returns to supplier' },
    { path: '/purchasing/returns/new', component: ReturnNew, perm: 'purchasing.returns', title: 'Return goods to supplier' }
  ],
  nav: [{ path: '/purchasing', label: 'Purchases', icon: 'truck', order: 27, perm: 'purchasing.view' }],
  commands: [
    { id: 'buy.receive', label: 'Receive stock (delivery)', icon: 'truck', run: () => navigate('/purchasing/receive'), perm: 'purchasing.receive', keywords: 'grn delivery pokea mzigo supplier goods received' },
    { id: 'buy.po', label: 'New purchase order', icon: 'file', run: () => navigate('/purchasing/orders/new'), perm: 'purchasing.orders', keywords: 'lpo order supplier agiza' },
    { id: 'buy.pay', label: 'Pay a supplier', icon: 'wallet', run: () => navigate('/purchasing/payments?new=1'), perm: 'purchasing.pay', keywords: 'supplier payment lipa' },
    { id: 'buy.sup', label: 'Add supplier', icon: 'store', run: () => navigate('/purchasing/suppliers?new=1'), perm: 'suppliers.edit', keywords: 'vendor msambazaji' },
    { id: 'buy.bal', label: 'Supplier balances (what we owe)', icon: 'credit', run: () => navigate('/purchasing/suppliers'), perm: 'purchasing.view', keywords: 'creditors payable deni' },
    { id: 'buy.ret', label: 'Return goods to a supplier', icon: 'undo', run: () => navigate('/purchasing/returns/new'), perm: 'purchasing.returns', keywords: 'supplier return credit note' }
  ],
  shortcuts: [{ keys: 'Scan', label: 'Scan items while receiving — each scan adds one', scope: 'Receive stock' }]
};
