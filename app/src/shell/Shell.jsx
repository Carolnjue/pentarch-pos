import { useEffect, useMemo, useState } from 'preact/hooks';
import * as S from '../state.js';
import { allRoutes, navItems } from '../modules/index.js';
import { setRoutes, startRouter, navigate, href } from '../router.js';
import { can, ROLE_LABELS } from '../auth/permissions.js';
import { lock, licenceState, switchBranch, resetDemo, startDemo, exitDemo } from '../auth/session.js';
import { syncNow } from '../sync/client.js';
import { Icon, Avatar, Kbd, Badge, Empty } from '../ui/kit.jsx';
import { Dropdown, openModal, toast, hasModal } from '../ui/overlay.jsx';
import { t, setLang } from '../i18n/index.js';
import { relTime, cls } from '../lib/util.js';
import { startScanner } from '../lib/scanner.js';
import { on, emit } from '../lib/bus.js';
import { openPalette } from './Palette.jsx';
import { openShortcuts } from './Shortcuts.jsx';
import { Notifications } from './Notifications.jsx';
import { BUSINESS_TYPES } from '../presets/types.js';
import { openShiftDialog } from '../modules/shifts/dialogs.jsx';

let routesSet = false;
export function Shell() {
  if (!routesSet) { setRoutes(allRoutes()); routesSet = true; }
  const [mnav, setMnav] = useState(false);
  useEffect(() => {
    startRouter();
    startScanner();
    const offN = on('notify', (n) => toast(n.text, { type: n.type }));
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (!hasModal()) openPalette(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') { e.preventDefault(); lock(); }
      else if (e.key === 'F1' || (e.key === '?' && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) { e.preventDefault(); if (!hasModal()) openShortcuts(); }
      else if (e.key === 'F2' && S.route.value.path !== '/sell' && !hasModal()) { e.preventDefault(); navigate('/sell'); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); offN(); };
  }, []);
  useEffect(() => setMnav(false), [S.route.value.path]);
  const r = S.route.value;
  const def = r.def;
  const allowed = def && def.enabled() && (!def.perm || can(def.perm));
  const Comp = def?.component;
  const lic = licenceState();
  return (
    <div class={cls('shell', S.sidebarCollapsed.value && 'collapsed', mnav && 'mnav')}>
      <Sidebar />
      {mnav && <div class="scrim" onClick={() => setMnav(false)} />}
      <div class="main">
        <Banners lic={lic} />
        <TopBar onMenu={() => setMnav(true)} title={def ? t(def.title || '') : ''} lic={lic} />
        <main class="content" id="main">
          {!def ? <div class="page"><Empty icon="search" title={t('Page not found')} text={t('This page does not exist or its module is switched off.')}><a class="btn navy" href="#/home">{t('Go home')}</a></Empty></div>
            : !allowed ? <div class="page"><Empty icon="shield" title={t('No access')} text={t('Your role cannot open this page. Ask the owner or a manager.')}><button class="btn" onClick={() => lock()}>{t('Switch user')}</button></Empty></div>
            : <Comp params={r.params} query={r.query} key={def.path} />}
        </main>
      </div>
    </div>
  );
}

function Sidebar() {
  const items = navItems();
  const sections = [['main', ''], ['manage', t('Manage')], ['system', t('System')]];
  const cur = S.route.value.path;
  const u = S.user.value;
  return (
    <aside class="side" aria-label={t('Main navigation')}>
      <a class="brand" href="#/home">
        <img src="/pos/brand/pentarch-mark.svg" alt="" />
        <div><b>Pentarch POS</b><small>{S.business.value?.name}</small></div>
      </a>
      <nav>
        {sections.map(([sec, label]) => {
          const its = items.filter((n) => (n.section || 'main') === sec);
          if (!its.length) return null;
          return (
            <>
              {label && <div class="nav-sec">{label}</div>}
              {its.map((n) => {
                const active = cur === n.path || (n.path !== '/home' && cur.startsWith(n.path + '/')) || n.match?.some((m) => cur.startsWith(m));
                const badge = n.badge?.();
                return (
                  <a class={'nav-a' + (active ? ' on' : '')} href={href(n.path)} title={t(n.label)} aria-current={active ? 'page' : undefined}>
                    <Icon name={n.icon} size={20} /><span>{t(n.label)}</span>
                    {badge ? <span class={'badge ' + (badge.tone || 'bad')}>{badge.text}</span> : n.kbd && <span class="kbd">{n.kbd}</span>}
                  </a>
                );
              })}
            </>
          );
        })}
      </nav>
      <div class="foot">
        <div class="me">
          <Avatar name={u?.name || '?'} />
          <div class="who grow"><b class="ellipsis">{u?.name}</b><small>{t(ROLE_LABELS[u?.role] || '')}</small></div>
        </div>
        <button class="nav-a desk-only" style={{ border: 0, background: 'none', cursor: 'pointer', width: '100%' }} onClick={() => (S.sidebarCollapsed.value = !S.sidebarCollapsed.value)} aria-label={t('Collapse sidebar')}>
          <Icon name={S.sidebarCollapsed.value ? 'chevron-right' : 'chevron-left'} /><span>{t('Collapse')}</span>
        </button>
      </div>
    </aside>
  );
}

function SyncPill() {
  const s = S.sync.value;
  const [, tick] = useState(0);
  useEffect(() => { const i = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(i); }, []);
  if (S.isDemo.value) return <span class="tchip" title={t('Demo data stays in this browser')}><span class="dot warn" /><span class="lab">{t('Demo')}</span></span>;
  const online = S.online.value;
  let tone = 'ok', icon = 'cloud', text;
  if (!online || s.state === 'offline') { tone = 'warn'; icon = 'wifi-off'; text = s.pending ? t('Offline · {n} waiting', { n: s.pending }) : t('Offline'); }
  else if (s.state === 'syncing') { icon = 'refresh'; text = t('Syncing…'); tone = ''; }
  else if (s.state === 'error') { tone = 'bad'; icon = 'alert'; text = t('Sync problem'); }
  else if (s.pending) { tone = 'warn'; icon = 'cloud'; text = t('{n} waiting', { n: s.pending }); }
  else text = s.lastAt ? t('Synced {when}', { when: relTime(s.lastAt, t) }) : t('Not synced yet');
  return (
    <button class={'tchip ' + tone} onClick={() => { syncNow('manual'); toast(t('Syncing now…'), { icon: 'refresh' }); }} title={s.error || t('Sync now')} aria-label={text}>
      <Icon name={icon} size={16} class={s.state === 'syncing' ? 'spin' : ''} /><span class="lab">{text}</span>
    </button>
  );
}

function TopBar({ onMenu, title, lic }) {
  const sh = S.shift.value;
  const brs = S.branches.value;
  const u = S.user.value;
  return (
    <header class="top">
      <button class="btn ghost icon mobile-only" onClick={onMenu} aria-label={t('Menu')}><Icon name="menu" /></button>
      <div class="title ellipsis">{title}</div>
      {brs.length > 1 && can('branches.switch') ? (
        <Dropdown align="left" trigger={({ toggle }) => <button class="tchip desk-only" onClick={toggle}><Icon name="store" size={16} /><span class="lab">{S.branch.value?.name}</span><Icon name="chevron-down" size={14} /></button>}>
          <div class="lbl">{t('Branch')}</div>
          {brs.map((b) => <button class={b.id === S.branch.value?.id ? 'on' : ''} onClick={() => switchBranch(b.id)}><Icon name="store" size={16} />{b.name}</button>)}
        </Dropdown>
      ) : <span class="tchip desk-only" style={{ cursor: 'default' }}><Icon name="store" size={16} /><span class="lab">{S.branch.value?.name}</span></span>}
      <button class={'tchip ' + (sh ? 'ok' : '')} onClick={() => (sh ? navigate('/shifts') : openShiftDialog())} title={sh ? t('Shift open') : t('Open shift')}>
        <Icon name="clock" size={16} /><span class="lab">{sh ? t('Shift open') + ' · ' + new Date(sh.opened_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) : t('No shift')}</span>
      </button>
      <div class="spacer" />
      <SyncPill />
      {lic.days_left != null && ['trial', 'grace', 'active'].includes(lic.status) && lic.days_left <= 30 && (
        <a class={'tchip desk-only ' + (lic.days_left <= 7 ? 'warn' : '')} href="#/settings/licence"><Icon name="calendar" size={16} /><span class="lab">{lic.status === 'trial' ? t('Trial: {n} days', { n: Math.max(0, lic.days_left) }) : t('{n} days left', { n: Math.max(0, lic.days_left) })}</span></a>
      )}
      <button class="btn ghost icon sm desk-only" onClick={() => openPalette()} title={t('Search everything (Ctrl+K)')} aria-label={t('Search everything')}><Icon name="search" /></button>
      <Notifications />
      <button class="tchip" onClick={() => setLang(S.lang.value === 'en' ? 'sw' : 'en')} title={t('Language')} aria-label={t('Switch language')}><Icon name="globe" size={16} />{S.lang.value.toUpperCase()}</button>
      <Dropdown trigger={({ toggle }) => <button class="btn ghost sm" style={{ padding: '0 6px' }} onClick={toggle} aria-label={t('User menu')}><Avatar name={u?.name || '?'} size={32} /></button>}>
        <div style={{ padding: '8px 10px' }}><b>{u?.name}</b><div class="small mute">{t(ROLE_LABELS[u?.role] || '')} · {S.device.value.name}</div></div>
        <hr />
        <button onClick={() => openShortcuts()}><Icon name="keyboard" size={18} />{t('Keyboard shortcuts')}<span class="spacer" /><Kbd>F1</Kbd></button>
        <a href="#/help"><Icon name="help" size={18} />{t('Help & support')}</a>
        {can('settings.view') && <a href="#/settings"><Icon name="settings" size={18} />{t('Settings')}</a>}
        {S.isDemo.value && <button onClick={() => exitDemo()}><Icon name="logout" size={18} />{t('Leave demo')}</button>}
        <hr />
        <button onClick={() => lock()}><Icon name="lock" size={18} />{t('Lock / switch user')}<span class="spacer" /><Kbd>Ctrl L</Kbd></button>
      </Dropdown>
      <button class="btn ink sm desk-only" onClick={() => lock()} title={t('Lock (Ctrl+L)')}><Icon name="lock" size={16} />{t('Lock')}</button>
    </header>
  );
}

function Banners({ lic }) {
  if (S.isDemo.value) {
    return (
      <div class="banner demo">
        <span class="grad-dot" />
        <span class="grow ellipsis">{t('Demo — your changes stay in this browser')} · <span style={{ color: '#aab5cf' }}>{t(BUSINESS_TYPES.find((x) => x.id === S.business.value?.type)?.label || '')}</span></span>
        <Dropdown trigger={({ toggle }) => <button class="btn ghost sm desk-only" style={{ color: '#fff' }} onClick={toggle}><Icon name="layers" size={16} />{t('Switch business type')}</button>} width="300px">
          <div style={{ maxHeight: '360px', overflow: 'auto' }}>{BUSINESS_TYPES.map((bt) => <button onClick={() => startDemo(bt.id)}><Icon name={bt.icon} size={16} />{t(bt.label)}</button>)}</div>
        </Dropdown>
        <button class="btn ghost sm desk-only" style={{ color: '#fff' }} onClick={async () => { await resetDemo(); toast(t('Demo reset')); }}><Icon name="refresh" size={16} />{t('Reset demo')}</button>
        <a class="btn ghost sm desk-only" style={{ color: '#fff' }} href="https://pentarchsystemssolutions.co.ke/pos/#demo" target="_blank" rel="noopener">{t('Book a demo')}</a>
        <button class="btn sun sm" onClick={() => exitDemo({ trial: true })}>{t('Start free trial')}</button>
      </div>
    );
  }
  if (lic.status === 'unregistered') return <div class="banner warn"><Icon name="cloud" size={18} /><span class="grow">{t('Your trial has started on this device. It registers with Pentarch Cloud automatically when you are online.')}</span><button class="btn sm" onClick={() => syncNow('manual')}>{t('Try now')}</button></div>;
  if (lic.banner === 'expired' || lic.banner === 'suspended') {
    return <div class="banner bad"><Icon name="alert" size={18} /><span class="grow">{lic.banner === 'suspended' ? t('This account is suspended. Selling is paused — your data is safe and you can still view, export and back up.') : t('Your subscription has expired. Selling is paused — reports, export and backup still work.')}</span><a class="btn sun sm" href="#/settings/licence">{t('Pay now')}</a></div>;
  }
  if (lic.banner === 'grace') return <div class="banner bad"><Icon name="alert" size={18} /><span class="grow">{t('Payment overdue. Selling stops in {n} days.', { n: Math.max(0, Math.ceil((lic.grace_ends - Date.now()) / 86400000)) })}</span><a class="btn sun sm" href="#/settings/licence">{t('Pay now')}</a></div>;
  if (lic.banner === 'trial' || lic.banner === 'active') return <div class="banner warn"><Icon name="calendar" size={18} /><span class="grow">{lic.status === 'trial' ? t('Your free trial ends in {n} days.', { n: Math.max(0, lic.days_left) }) : t('Your subscription renews in {n} days.', { n: Math.max(0, lic.days_left) })}</span><a class="btn sm" href="#/settings/licence">{t('See plans')}</a></div>;
  if (lic.needsConnect) return <div class="banner warn"><Icon name="wifi-off" size={18} /><span class="grow">{t('This device has not been online for a long time. Connect to the internet to refresh your licence and back up.')}</span></div>;
  return null;
}
