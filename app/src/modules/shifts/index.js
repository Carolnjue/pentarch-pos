import { lazy } from '../../lib/lazy.jsx';
import { openShiftDialog, closeShiftDialog, cashMoveDialog, xReport } from './dialogs.jsx';
import { shift } from '../../state.js';
const ShiftsPage = lazy(() => import('./ShiftsPage.jsx'));
const SM = ['owner', 'manager', 'cashier'];
export default {
  id: 'shifts',
  permissions: [
    { key: 'shift.open_close', label: 'Open & close own shift', group: 'Cash & shifts', roles: SM },
    { key: 'shift.cash_moves', label: 'Pay in / pay out / cash drop', group: 'Cash & shifts', roles: SM },
    { key: 'shift.view_all', label: 'See all shifts & variances', group: 'Cash & shifts', roles: ['owner', 'manager', 'accountant'] }
  ],
  routes: [{ path: '/shifts', component: ShiftsPage, perm: 'shift.open_close', title: 'Cash & shifts' }],
  nav: [{ path: '/shifts', label: 'Cash & shifts', icon: 'clock', order: 40, perm: 'shift.open_close' }],
  commands: [
    { id: 'shift.open', label: 'Open shift', icon: 'play', run: () => openShiftDialog(), keywords: 'float till', perm: 'shift.open_close' },
    { id: 'shift.close', label: 'Close shift (Z report)', icon: 'lock', run: () => closeShiftDialog(), keywords: 'z report count cash', perm: 'shift.open_close' },
    { id: 'shift.x', label: 'X report', icon: 'print', run: () => shift.value && xReport(), perm: 'shift.open_close' },
    { id: 'shift.payout', label: 'Pay out cash', icon: 'upload', run: () => cashMoveDialog('pay_out'), keywords: 'petty cash', perm: 'shift.cash_moves' }
  ]
};
