import { lazy } from '../../lib/lazy.jsx';
import { KpiRow, HourlyWidget, TrendWidget, PaymentsWidget, TopProductsWidget, LowStockWidget, DebtorsWidget, SetupChecklist, ExpiryWidget, OpenShiftsWidget, BranchesWidget, TrialWidget } from './widgets.jsx';
import './dashboard.css';
const HomePage = lazy(() => import('./HomePage.jsx'));
export default {
  id: 'home',
  routes: [{ path: '/home', component: HomePage, title: 'Home' }],
  nav: [{ path: '/home', label: 'Home', icon: 'home', order: 0 }],
  widgets: [
    { id: 'setup', order: 0, size: 'full', component: SetupChecklist },
    { id: 'trial', order: 0.5, size: 'full', component: TrialWidget },
    { id: 'kpis', order: 1, size: 'full', component: KpiRow, perm: 'dashboard.view' },
    { id: 'hourly', order: 10, size: 'md', component: HourlyWidget, perm: 'dashboard.view' },
    { id: 'payments', order: 11, size: 'sm', component: PaymentsWidget, perm: 'dashboard.view' },
    { id: 'branches', order: 12, size: 'full', component: BranchesWidget, perm: 'dashboard.view' },
    { id: 'top', order: 20, size: 'sm', component: TopProductsWidget, perm: 'dashboard.view' },
    { id: 'low', order: 21, size: 'sm', component: LowStockWidget, perm: 'products.view' },
    { id: 'debtors', order: 22, size: 'sm', component: DebtorsWidget, perm: 'customers.view' },
    { id: 'expiry', order: 23, size: 'sm', component: ExpiryWidget, perm: 'products.view' },
    { id: 'shifts', order: 24, size: 'sm', component: OpenShiftsWidget, perm: 'shift.view_all' },
    { id: 'trend', order: 30, size: 'full', component: TrendWidget, perm: 'dashboard.view' }
  ]
};
