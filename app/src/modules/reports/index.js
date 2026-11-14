// Reports module: catalogue + 24 code-split reports (see defs.jsx). Nothing here is loaded until a report opens.
import { lazy } from '../../lib/lazy.jsx';
import { navigate } from '../../router.js';
import './reports.css';

const ReportsHome = lazy(() => import('./ReportsHome.jsx'));
const ReportPage = lazy(() => import('./ReportPage.jsx'));
const VIEW = ['owner', 'manager', 'accountant'];

export default {
  id: 'reports',
  permissions: [
    { key: 'reports.open', label: 'Open reports', group: 'Reports', roles: ['owner', 'manager', 'accountant', 'stock'] },
    { key: 'reports.view', label: 'Sales, customer & staff reports', group: 'Reports', roles: VIEW },
    { key: 'reports.profit', label: 'Profit & margin report', group: 'Reports', roles: ['owner', 'manager', 'accountant'] },
    { key: 'reports.pnl', label: 'Profit & loss (with expenses)', group: 'Reports', roles: ['owner'] },
    { key: 'reports.stock', label: 'Stock reports', group: 'Reports', roles: ['owner', 'manager', 'accountant', 'stock'] },
    { key: 'reports.purchases', label: 'Purchases & supplier reports', group: 'Reports', roles: ['owner', 'manager', 'accountant', 'stock'] },
    { key: 'reports.exceptions', label: 'Discounts, voids & returns report', group: 'Reports', roles: ['owner', 'manager', 'accountant'] }
  ],
  routes: [
    { path: '/reports', component: ReportsHome, perm: 'reports.open', title: 'Reports' },
    { path: '/reports/:id', component: ReportPage, perm: 'reports.open', title: 'Reports' }
  ],
  nav: [{ path: '/reports', label: 'Reports', icon: 'chart', order: 50, perm: 'reports.open' }],
  commands: [
    { id: 'rep.all', label: 'Reports', icon: 'chart', run: () => navigate('/reports'), perm: 'reports.open', keywords: 'ripoti report analysis' },
    { id: 'rep.sales', label: 'Sales report', icon: 'receipt', run: () => navigate('/reports/sales'), perm: 'reports.view', keywords: 'mauzo summary daily' },
    { id: 'rep.pnl', label: 'Profit & loss', icon: 'bars', run: () => navigate('/reports/pnl'), perm: 'reports.pnl', keywords: 'faida income statement net profit' },
    { id: 'rep.vat', label: 'VAT & tax report', icon: 'percent', run: () => navigate('/reports/vat'), perm: 'reports.view', keywords: 'kra etims tax return itax' },
    { id: 'rep.stock', label: 'Stock value report', icon: 'layers', run: () => navigate('/reports/stock'), perm: 'reports.stock', keywords: 'valuation inventory stoki' },
    { id: 'rep.aging', label: 'Debtors aging', icon: 'credit', run: () => navigate('/reports/aging'), perm: 'reports.view', keywords: 'madeni debt owe credit' },
    { id: 'rep.exceptions', label: 'Voids, discounts & returns', icon: 'shield', run: () => navigate('/reports/exceptions'), perm: 'reports.exceptions', keywords: 'theft exceptions anti-theft' },
    { id: 'rep.audit', label: 'Activity log', icon: 'history', run: () => navigate('/reports/audit'), perm: 'audit.view', keywords: 'audit log who' }
  ]
};
