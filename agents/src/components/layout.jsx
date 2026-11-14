import { useEffect, useRef, useState } from 'preact/hooks';
import { route, navigate, session, setLang, online } from '../store.js';
import { syncState, syncNow } from '../sync.js';
import { lang, t } from '../i18n.js';
import { ago } from '../util.js';
import { Icon, Mark } from './ui.jsx';

export function SyncPill() {
  const s = syncState.value;
  let cls = 'ok', label;
  if (s.state === 'offline') { cls = 'off'; label = t('Offline') + (s.pending ? ` · ${s.pending} ${t('waiting')}` : ''); }
  else if (s.state === 'syncing') { cls = 'busy'; label = t('Syncing…'); }
  else if (s.pending) { cls = 'warn'; label = `${s.pending} ${t('waiting')}`; }
  else if (s.state === 'error') { cls = 'warn'; label = t('Sync now'); }
  else { label = s.last ? `${t('Synced')} ${ago(s.last)}` : t('Sync now'); }
  return (
    <button class={`pill pill--${cls}`} onClick={() => syncNow({ quiet: false })} title={t('Sync now')} aria-label={`${label}. ${t('Sync now')}`}>
      <span class="pill__dot" aria-hidden="true">{s.state === 'offline' ? <Icon name="cloudoff" size={14} /> : <Icon name="sync" size={14} class={s.state === 'syncing' ? 'spin' : ''} />}</span>
      <span class="pill__t">{label}</span>
    </button>
  );
}

/** Banner under the top bar while offline: says plainly that nothing is lost. */
export function OfflineBar() {
  const s = syncState.value;
  if (online.value && s.state !== 'offline') return null;
  return (
    <div class="offbar" role="status">
      <Icon name="cloudoff" size={18} />
      <span><strong>{t('No internet')}</strong> — {t('keep working. Everything is saved on this phone and will send when you are back online.')}{s.pending ? ` (${s.pending} ${t('waiting')})` : ''}</span>
    </div>
  );
}

/** Pull down at the top of the page to sync (phones). */
function usePullToRefresh() {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const st = useRef({ y: null, d: 0 });
  useEffect(() => {
    const MAX = 90, TRIGGER = 64;
    const start = (e) => {
      if (window.scrollY > 0 || document.body.classList.contains('no-scroll') || e.touches.length !== 1) { st.current.y = null; return; }
      st.current = { y: e.touches[0].clientY, d: 0 };
    };
    const move = (e) => {
      if (st.current.y === null) return;
      const d = e.touches[0].clientY - st.current.y;
      if (d <= 0 || window.scrollY > 0) { if (st.current.d) setPull(0); st.current.d = 0; return; }
      st.current.d = Math.min(MAX, d * 0.5);
      setPull(st.current.d);
    };
    const end = () => {
      if (st.current.y === null) return;
      if (st.current.d >= TRIGGER) { setBusy(true); syncNow({ quiet: false }).finally(() => setBusy(false)); }
      st.current = { y: null, d: 0 };
      setPull(0);
    };
    window.addEventListener('touchstart', start, { passive: true });
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);
    return () => {
      window.removeEventListener('touchstart', start); window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', end); window.removeEventListener('touchcancel', end);
    };
  }, []);
  return [pull, busy];
}

export function LangToggle() {
  return (
    <div class="seg seg--sm" role="group" aria-label={t('Language')}>
      <button class={lang.value === 'en' ? 'is-on' : ''} onClick={() => setLang('en')} aria-pressed={lang.value === 'en'}>EN</button>
      <button class={lang.value === 'sw' ? 'is-on' : ''} onClick={() => setLang('sw')} aria-pressed={lang.value === 'sw'}>SW</button>
    </div>
  );
}

const TABS = [
  { path: '/', icon: 'home', label: 'Home' },
  { path: '/leads', icon: 'leads', label: 'Leads' },
  { path: '/leads/new', icon: 'plus', label: 'New lead', fab: true },
  { path: '/commissions', icon: 'money', label: 'Earnings' },
  { path: '/more', icon: 'more', label: 'More' }
];

function active(path) {
  const r = route.value;
  if (path === '/') return r === '/';
  if (path === '/leads') return r === '/leads' || (/^\/leads\/(?!new)/.test(r));
  if (path === '/more') return ['/more', '/resources', '/profile'].includes(r);
  if (path === '/commissions') return r === '/commissions';
  return r === path;
}

export function Shell({ title, back, actions, children, wide }) {
  const a = session.value.agent;
  const [pull, syncing] = usePullToRefresh();
  return (
    <div class="shell">
      <aside class="side" aria-label="Main">
        <div class="side__brand"><Mark size={34} /><div><strong>Pentarch POS</strong><span>{t('Sales agents')}</span></div></div>
        <nav>
          {TABS.map((tab) => (
            <a href={'/pos/agents' + tab.path} class={`side__link${active(tab.path) ? ' is-on' : ''}${tab.fab ? ' side__link--cta' : ''}`} onClick={(e) => { e.preventDefault(); navigate(tab.path); }}>
              <Icon name={tab.icon} size={20} /><span>{t(tab.label)}</span>
            </a>
          ))}
          <a href="/pos/agents/resources" class={`side__link${route.value === '/resources' ? ' is-on' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/resources'); }}><Icon name="book" size={20} /><span>{t('Resources')}</span></a>
          <a href="/pos/agents/profile" class={`side__link${route.value === '/profile' ? ' is-on' : ''}`} onClick={(e) => { e.preventDefault(); navigate('/profile'); }}><Icon name="user" size={20} /><span>{t('Profile')}</span></a>
        </nav>
        {a && <div class="side__me"><span class="avatar">{(a.first_name || 'A')[0]}</span><div><strong>{a.first_name}</strong><code>{a.code}</code></div></div>}
      </aside>
      <div class="main">
        <header class="top">
          <div class="top__l">
            {back ? (
              <button class="icon-btn" onClick={() => (history.length > 1 ? history.back() : navigate(back))} aria-label={t('Back')}><Icon name="back" /></button>
            ) : (
              <span class="top__mark"><Mark size={28} /></span>
            )}
            <h1 class="top__title">{title}</h1>
          </div>
          <div class="top__r">{actions}<SyncPill /></div>
        </header>
        <div class="strip" aria-hidden="true" />
        <OfflineBar />
        {(pull > 0 || syncing) && (
          <div class="ptr" style={{ height: pull > 0 ? pull + 'px' : '36px' }} aria-hidden="true">
            <span class={`ptr__i${pull >= 64 || syncing ? ' is-ready' : ''}`}><Icon name="sync" size={18} class={syncing ? 'spin' : ''} style={pull > 0 ? { transform: `rotate(${pull * 4}deg)` } : undefined} /></span>
            <span>{syncing ? t('Syncing…') : pull >= 64 ? t('Release to refresh') : t('Pull down to refresh')}</span>
          </div>
        )}
        <main class={`page${wide ? ' page--wide' : ''}`} id="main">{children}</main>
      </div>
      <nav class="tabs" aria-label="Main">
        {TABS.map((tab) => (
          <a href={'/pos/agents' + tab.path} class={`tabs__a${active(tab.path) ? ' is-on' : ''}${tab.fab ? ' tabs__fab' : ''}`} onClick={(e) => { e.preventDefault(); navigate(tab.path); }} aria-current={active(tab.path) ? 'page' : undefined}>
            <span class="tabs__i"><Icon name={tab.icon} size={tab.fab ? 26 : 22} stroke={tab.fab ? 2.4 : 1.9} /></span>
            <span class="tabs__l">{t(tab.label)}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
