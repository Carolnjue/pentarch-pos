// Services module (salon / barber / spa, cyber, other services): staff per line with a fast picker, commission per staff
// and per service, staff commission report, simple appointments (book → arrived → sale).
import { lazy } from '../../lib/lazy.jsx';
import { navigate } from '../../router.js';
import { on } from '../../lib/bus.js';
import * as S from '../../state.js';
import { db } from '../../db/index.js';
import { save } from '../../db/repo.js';
import { sellExt } from './bridge.jsx';
import { AppointmentsWidget } from './widget.jsx';
import { demoSeed } from './seed.js';

const AppointmentsPage = lazy(() => import('./AppointmentsPage.jsx'));
const CommissionPage = lazy(() => import('./CommissionPage.jsx'));
const FRONT = ['owner', 'manager', 'cashier'];

// a sale that started from an appointment closes the appointment
on('sale', async (sale) => {
  if (!sale.appointment_id) return;
  const a = await db().appointments.get(sale.appointment_id);
  if (a && a.status !== 'done') await save('appointments', { ...a, status: 'done', sale_id: sale.id, done_at: Date.now() });
});

// fetch this module's pages in the background so they also open offline on a freshly installed till
let preloaded = false;
on('route', () => {
  if (preloaded || !(S.business.value?.modules?.services)) return;
  preloaded = true;
  (window.requestIdleCallback || setTimeout)(() => { AppointmentsPage.preload(); CommissionPage.preload(); });
});

export default {
  id: 'services',
  enabled: (biz) => !!biz.modules?.services,
  permissions: [
    { key: 'appointments.use', label: 'Book & manage appointments', group: 'Services', roles: FRONT },
    { key: 'commission.view', label: 'View staff commission', group: 'Services', roles: ['owner', 'manager', 'accountant'] }
  ],
  routes: [
    { path: '/appointments', component: AppointmentsPage, perm: 'appointments.use', title: 'Appointments' },
    { path: '/commission', component: CommissionPage, perm: 'commission.view', title: 'Staff commission' }
  ],
  nav: [
    { path: '/appointments', label: 'Appointments', icon: 'calendar', order: 12, perm: 'appointments.use' },
    { path: '/commission', label: 'Staff commission', icon: 'percent', order: 35, perm: 'commission.view', section: 'manage' }
  ],
  widgets: [{ id: 'appointments', order: 3, size: 'sm', component: AppointmentsWidget, perm: 'appointments.use' }],
  settings: [{ id: 'services', label: 'Services & commission', icon: 'scissors', order: 9, component: lazy(() => import('./Settings.jsx')), perm: 'settings.view' }],
  commands: [
    { id: 's.book', label: 'Book appointment', icon: 'calendar', run: async () => { navigate('/appointments'); const m = await import('./AppointmentsPage.jsx'); m.book({ day: Date.now() }); }, perm: 'appointments.use', keywords: 'booking miadi salon' },
    { id: 's.appts', label: 'Appointments', icon: 'calendar', run: () => navigate('/appointments'), perm: 'appointments.use', keywords: 'today miadi' },
    { id: 's.comm', label: 'Staff commission', icon: 'percent', run: () => navigate('/commission'), perm: 'commission.view', keywords: 'commission stylist kamisheni' }
  ],
  sell: sellExt,
  demoSeed
};
