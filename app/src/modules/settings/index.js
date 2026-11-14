import { lazy } from '../../lib/lazy.jsx';
const SettingsPage = lazy(() => import('./SettingsPage.jsx'));
const P = (fn) => lazy(fn);
export default {
  id: 'settings',
  routes: [{ path: '/settings', component: SettingsPage, perm: 'settings.view', title: 'Settings' }, { path: '/settings/:panel', component: SettingsPage, title: 'Settings' }],
  nav: [{ path: '/settings', label: 'Settings', icon: 'settings', order: 90, perm: 'settings.view', section: 'system' }],
  settings: [
    { id: 'business', label: 'Business profile', icon: 'store', order: 1, component: P(() => import('./panels/general.jsx').then((m) => ({ default: m.BusinessPanel }))), perm: 'settings.view' },
    { id: 'tax', label: 'Tax & KRA', icon: 'percent', order: 2, component: P(() => import('./panels/general.jsx').then((m) => ({ default: m.TaxPanel }))), perm: 'settings.view' },
    { id: 'receipt', label: 'Receipt designer', icon: 'receipt', order: 3, component: P(() => import('./panels/receipt.jsx')), perm: 'settings.view' },
    { id: 'printing', label: 'Printing', icon: 'print', order: 4, component: P(() => import('./panels/general.jsx').then((m) => ({ default: m.PrintingPanel }))), perm: 'settings.view' },
    { id: 'payments', label: 'Payments & M-Pesa', icon: 'wallet', order: 5, component: P(() => import('./panels/general.jsx').then((m) => ({ default: m.PaymentsPanel }))), perm: 'settings.view' },
    { id: 'selling', label: 'Selling options', icon: 'cart', order: 6, component: P(() => import('./panels/general.jsx').then((m) => ({ default: m.SellingPanel }))), perm: 'settings.view' },
    { id: 'promotions', label: 'Promotions', icon: 'gift', order: 7, component: P(() => import('./panels/promotions.jsx')), perm: 'settings.view' },
    { id: 'modules', label: 'Modules & business type', icon: 'grid', order: 10, component: P(() => import('./panels/general.jsx').then((m) => ({ default: m.ModulesPanel }))), perm: 'settings.view' },
    { id: 'staff', label: 'Staff & roles', icon: 'users', order: 20, component: P(() => import('./panels/staff.jsx')), perm: 'staff.manage' },
    { id: 'branches', label: 'Branches & devices', icon: 'monitor', order: 21, component: P(() => import('./panels/branches.jsx')), perm: 'settings.view' },
    { id: 'language', label: 'Language & notifications', icon: 'globe', order: 30, component: P(() => import('./panels/general.jsx').then((m) => ({ default: m.LanguagePanel }))), perm: 'settings.view' },
    { id: 'backup', label: 'Backup, restore & export', icon: 'database', order: 40, component: P(() => import('./panels/data.jsx')), perm: 'export.data' },
    { id: 'audit', label: 'Activity log', icon: 'shield', order: 50, component: P(() => import('./panels/audit.jsx')), perm: 'audit.view' },
    { id: 'licence', label: 'Licence & billing', icon: 'calendar', order: 60, component: P(() => import('./panels/licence.jsx')), perm: 'settings.view' },
    { id: 'about', label: 'About & support', icon: 'info', order: 70, component: P(() => import('./panels/about.jsx')) }
  ]
};
