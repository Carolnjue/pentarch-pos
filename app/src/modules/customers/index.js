import { lazy } from '../../lib/lazy.jsx';
import { navigate } from '../../router.js';
import { editCustomer } from './edit.jsx';
const CustomersPage = lazy(() => import('./CustomersPage.jsx'));
const CustomerProfile = lazy(() => import('./CustomerProfile.jsx'));
const LoyaltyPanel = lazy(() => import('./LoyaltyPanel.jsx'));
const CM = ['owner', 'manager', 'cashier'];
export default {
  id: 'customers',
  permissions: [
    { key: 'customers.view', label: 'View customers', group: 'Customers', roles: [...CM, 'accountant', 'waiter'] },
    { key: 'customers.edit', label: 'Add & edit customers', group: 'Customers', roles: CM },
    { key: 'customers.payments', label: 'Receive debt payments', group: 'Customers', roles: CM },
    { key: 'customers.credit_limit', label: 'Set credit limits', group: 'Customers', roles: ['owner', 'manager'] },
    { key: 'customers.delete', label: 'Delete customers', group: 'Customers', roles: ['owner', 'manager'] }
  ],
  routes: [
    { path: '/customers', component: CustomersPage, perm: 'customers.view', title: 'Customers' },
    { path: '/customers/:id', component: CustomerProfile, perm: 'customers.view', title: 'Customer' }
  ],
  nav: [{ path: '/customers', label: 'Customers', icon: 'users', order: 30, perm: 'customers.view' }],
  settings: [{ id: 'loyalty', label: 'Loyalty & credit', icon: 'gift', order: 45, component: LoyaltyPanel, perm: 'settings.edit' }],
  commands: [
    { id: 'c.new', label: 'Add customer', icon: 'user-plus', run: async () => { const c = await editCustomer(); if (c) navigate('/customers/' + c.id); }, perm: 'customers.edit', keywords: 'mteja new' },
    { id: 'c.debtors', label: 'Debtors (who owes money)', icon: 'credit', run: () => navigate('/customers?filter=owing'), perm: 'customers.view', keywords: 'deni credit aging' }
  ]
};
