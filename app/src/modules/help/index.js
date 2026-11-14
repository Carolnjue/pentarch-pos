import { lazy } from '../../lib/lazy.jsx';
import { openShortcuts } from '../../shell/Shortcuts.jsx';
import { navigate } from '../../router.js';
const HelpPage = lazy(() => import('./HelpPage.jsx'));
export default {
  id: 'help',
  routes: [{ path: '/help', component: HelpPage, title: 'Help' }],
  nav: [{ path: '/help', label: 'Help', icon: 'help', order: 95, section: 'system' }],
  commands: [
    { id: 'help.keys', label: 'Keyboard shortcuts', icon: 'keyboard', run: () => openShortcuts(), kbd: 'F1' },
    { id: 'help.guide', label: 'Quick guide', icon: 'help', run: () => navigate('/help'), keywords: 'msaada how to' }
  ]
};
