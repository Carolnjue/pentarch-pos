// Expenses module: record running costs (optionally from the till), monthly totals by category, custom categories.
import { lazy } from '../../lib/lazy.jsx';
import { navigate } from '../../router.js';
import './expenses.css';

const ExpensesPage = lazy(() => import('./ExpensesPage.jsx'));
const record = () => import('./dialogs.jsx').then((m) => m.recordExpenseDialog());

export default {
  id: 'expenses',
  permissions: [
    { key: 'expenses.view', label: 'View expenses', group: 'Expenses', roles: ['owner', 'manager', 'accountant'] },
    { key: 'expenses.record', label: 'Record & delete expenses', group: 'Expenses', roles: ['owner', 'manager'] },
    { key: 'expenses.categories', label: 'Manage expense categories', group: 'Expenses', roles: ['owner', 'manager'] }
  ],
  routes: [{ path: '/expenses', component: ExpensesPage, perm: 'expenses.view', title: 'Expenses' }],
  nav: [{ path: '/expenses', label: 'Expenses', icon: 'wallet', order: 45, perm: 'expenses.view' }],
  commands: [
    { id: 'exp.new', label: 'Record expense', icon: 'wallet', run: record, perm: 'expenses.record', keywords: 'matumizi petty cash rent salary transport bill' },
    { id: 'exp.list', label: 'Expenses', icon: 'wallet', run: () => navigate('/expenses'), perm: 'expenses.view', keywords: 'matumizi costs' }
  ]
};
