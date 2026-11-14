import { useEffect } from 'preact/hooks';
import { session, route, navigate, maybeStartTour } from './store.js';
import { startSync } from './sync.js';
import { lang } from './i18n.js';
import { Toast } from './components/ui.jsx';
import { Tour } from './components/tour.jsx';
import { Login, Signup, Pending } from './screens/auth.jsx';
import { Home } from './screens/home.jsx';
import { Leads } from './screens/leads.jsx';
import { LeadForm } from './screens/leadform.jsx';
import { LeadDetail } from './screens/leaddetail.jsx';
import { Commissions, Resources, Profile, More } from './screens/other.jsx';

let syncStarted = false;

export function App() {
  const s = session.value;
  const r = route.value;
  document.documentElement.lang = lang.value === 'sw' ? 'sw' : 'en';

  const status = s.agent && s.agent.status;
  useEffect(() => {
    if (s.token && !syncStarted) { syncStarted = true; startSync(); }
  }, [s.token]);

  // First-run tour once the agent is approved.
  useEffect(() => { if (s.token && status === 'active') maybeStartTour(); }, [s.token, status]);

  // Guards.
  useEffect(() => {
    if (!s.ready) return;
    if (!s.token && !['/login', '/signup'].includes(r)) navigate('/login', true);
    else if (s.token && status === 'pending' && r !== '/pending') navigate('/pending', true);
    else if (s.token && status === 'active' && ['/login', '/signup', '/pending'].includes(r)) navigate('/', true);
  }, [s.ready, s.token, status, r]);

  let page;
  if (!s.token) page = r === '/signup' ? <Signup /> : <Login />;
  else if (status === 'pending' || r === '/pending') page = <Pending />;
  else {
    let m;
    if (r === '/') page = <Home />;
    else if (r === '/leads') page = <Leads />;
    else if (r === '/leads/new') page = <LeadForm key="new" />;
    else if ((m = /^\/leads\/([A-Za-z0-9_\-]+)\/edit$/.exec(r))) page = <LeadForm id={m[1]} key={m[1]} />;
    else if ((m = /^\/leads\/([A-Za-z0-9_\-]+)$/.exec(r))) page = <LeadDetail id={m[1]} key={m[1]} />;
    else if (r === '/commissions') page = <Commissions />;
    else if (r === '/resources') page = <Resources />;
    else if (r === '/profile') page = <Profile />;
    else if (r === '/more') page = <More />;
    else page = <Home />;
  }
  return (
    <>
      <a class="skip" href="#main">Skip to content</a>
      {page}
      {s.token && status === 'active' && <Tour />}
      <Toast />
    </>
  );
}
