import { useEffect, useState, useRef } from 'preact/hooks';
import { users, business, isDemo, branch } from '../state.js';
import { loginPin, loginPassword, exitDemo } from '../auth/session.js';
import { Avatar, NumPad, Icon, Btn } from '../ui/kit.jsx';
import { t, setLang } from '../i18n/index.js';
import { lang } from '../state.js';
import { ROLE_LABELS } from '../auth/permissions.js';
import { getMeta } from '../db/index.js';
import { beep } from '../lib/sound.js';

export function Lock() {
  const list = users.value.filter((u) => u.active !== false).sort((a, b) => ['owner', 'manager', 'cashier', 'waiter', 'stock', 'accountant'].indexOf(a.role) - ['owner', 'manager', 'cashier', 'waiter', 'stock', 'accountant'].indexOf(b.role));
  const [sel, setSel] = useState(list.length === 1 ? list[0].id : null);
  const [pin, setPin] = useState('');
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pwMode, setPwMode] = useState(false);
  const [pw, setPw] = useState('');
  const [now, setNow] = useState(Date.now());
  const [pinHint, setPinHint] = useState(false);
  const selUser = list.find((u) => u.id === sel);
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 10000); getMeta('first_pin_hint').then(setPinHint); return () => clearInterval(i); }, []);

  const tryPin = async (p) => {
    if (!sel || busy) return;
    setBusy(true);
    const ok = await loginPin(sel, p);
    setBusy(false);
    if (!ok) { setErr(true); beep('error'); setTimeout(() => { setErr(false); setPin(''); }, 450); }
  };
  const key = (k) => {
    if (!sel) return;
    if (k === 'back') return setPin((p) => p.slice(0, -1));
    if (k === 'clear') return setPin('');
    if (k === 'ok') return pin.length >= 4 && tryPin(pin);
    setPin((p) => {
      if (p.length >= 6) return p;
      const n = p + k;
      if (n.length === 4) setTimeout(() => tryPin(n), 60);
      return n;
    });
  };
  const keyRef = useRef(key); keyRef.current = key;
  useEffect(() => {
    if (pwMode) return;
    const h = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (/^\d$/.test(e.key)) keyRef.current(e.key);
      else if (e.key === 'Backspace') keyRef.current('back');
      else if (e.key === 'Enter') keyRef.current('ok');
      else if (e.key === 'Escape') { setSel(null); setPin(''); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [pwMode]);
  const submitPw = async (e) => {
    e.preventDefault();
    if (!(await loginPassword(pw))) { setErr(true); beep('error'); setTimeout(() => setErr(false), 600); }
  };
  const d = new Date(now);
  return (
    <div class="lock">
      <div class="l">
        <div class="row" style={{ gap: '12px' }}>
          <img src="/pos/brand/pentarch-mark.svg" alt="" width="40" height="40" />
          <div class="grow"><b style={{ font: '800 19px var(--f-head)' }}>Pentarch POS</b><div class="muted small">{business.value?.name}{branch.value ? ' · ' + branch.value.name : ''}</div></div>
          <div class="seg" style={{ background: 'var(--ink-2)' }}>
            {['en', 'sw'].map((l) => <button style={{ color: lang.value === l ? 'var(--text)' : '#cfd6e6' }} class={lang.value === l ? 'on' : ''} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}
          </div>
        </div>
        <div style={{ marginTop: '10px' }}>
          <div class="clock">{d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</div>
          <div class="muted" style={{ fontSize: '17px', marginTop: '4px' }}>{d.toLocaleDateString(lang.value === 'sw' ? 'sw-KE' : 'en-KE', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
        <h1 style={{ marginTop: '6px' }}>{t('Who is selling?')}</h1>
        <div class="staff-grid" role="listbox" aria-label={t('Staff')}>
          {list.map((u) => (
            <button class={'staff-tile' + (sel === u.id ? ' on' : '')} role="option" aria-selected={sel === u.id} onClick={() => { setSel(u.id); setPin(''); setPwMode(false); }}>
              <Avatar name={u.name} />
              <b>{u.name.split(' ')[0]}</b>
              <small>{t(ROLE_LABELS[u.role] || u.role)}</small>
              {isDemo.value && u.demo_pin && <span class="hintpin">PIN {u.demo_pin}</span>}
            </button>
          ))}
        </div>
        {isDemo.value && (
          <div class="row wrap" style={{ marginTop: 'auto', paddingBottom: '20px' }}>
            <span class="muted small">{t('Demo — your changes stay in this browser')}</span>
            <button class="btn ghost sm" style={{ color: '#fff' }} onClick={() => exitDemo()}><Icon name="logout" size={16} />{t('Leave demo')}</button>
          </div>
        )}
      </div>
      <div class="r">
        <div class="pin-box">
          {!selUser ? (
            <div class="center" style={{ color: '#9aa6c2' }}>
              <div style={{ width: '84px', height: '84px', borderRadius: '26px', background: 'var(--ink-3)', display: 'grid', placeItems: 'center', margin: '0 auto 16px', color: 'var(--sun)' }}><Icon name="lock" size={36} /></div>
              <h2 style={{ color: '#fff' }}>{t('Locked')}</h2>
              <p style={{ color: '#9aa6c2' }}>{t('Tap your name, then enter your 4-digit PIN.')}</p>
            </div>
          ) : pwMode ? (
            <form onSubmit={submitPw} class="col" style={{ gap: '14px' }}>
              <div class="center"><Avatar name={selUser.name} size={64} /><h2 style={{ color: '#fff', marginTop: '10px' }}>{selUser.name}</h2></div>
              <label class="lbl" style={{ color: '#cfd6e6' }} for="ownpw">{t('Account password')}</label>
              <input id="ownpw" class={'input' + (err ? ' bad' : '')} type="password" autoFocus value={pw} onInput={(e) => setPw(e.target.value)} />
              <button class="btn sun lg block" type="submit">{t('Unlock')}</button>
              <button type="button" class="btn ghost" style={{ color: '#cfd6e6' }} onClick={() => setPwMode(false)}>{t('Use PIN instead')}</button>
            </form>
          ) : (
            <>
              <div class="center"><Avatar name={selUser.name} size={64} /><h2 style={{ color: '#fff', marginTop: '10px' }}>{t('Hello, {name}', { name: selUser.name.split(' ')[0] })}</h2>
                <p style={{ color: '#9aa6c2', margin: '4px 0 0' }}>{t('Enter your PIN')}</p></div>
              <div class={'pin-dots' + (err ? ' shake' : '')} style={{ color: '#fff' }} aria-live="polite">{[0, 1, 2, 3].map((i) => <i class={pin.length > i ? 'on' : ''} />)}</div>
              <NumPad dark onKey={key} showDot={false} />
              {pinHint && selUser.role === 'owner' && <p class="center small" style={{ color: 'var(--sun)', marginTop: '12px' }}>{t('First sign-in on this device: the owner PIN is 1234. Change it in Settings → Staff.')}</p>}
              {selUser.role === 'owner' && !isDemo.value && <button class="btn ghost block" style={{ color: '#cfd6e6', marginTop: '10px' }} onClick={() => setPwMode(true)}><Icon name="key" size={16} />{t('Forgot PIN? Use account password')}</button>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
