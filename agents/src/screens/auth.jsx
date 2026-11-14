import { useState, useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import { api, ApiError } from '../api.js';
import { setSession, navigate, session, signOut, online, showToast, updateAgent } from '../store.js';
import { syncNow } from '../sync.js';
import { t, COUNTIES } from '../i18n.js';
import { normPhone, isEmail, waLink, copyText, formatPhoneTyping, intlPhone } from '../util.js';
import { Field, Icon, Mark } from '../components/ui.jsx';
import { LangToggle } from '../components/layout.jsx';

const pubConfig = signal(null);
function loadConfig() {
  if (pubConfig.value) return;
  api('GET', '/public/config').then((c) => { pubConfig.value = c; }).catch(() => {});
}

function AuthFrame({ children, wide, hero = true }) {
  useEffect(loadConfig, []);
  const cfg = pubConfig.value || {};
  const ac = cfg.agent_commission || {};
  const c = { rate: ac.software_rate ?? 20, months: ac.commission_months ?? 12, bonus: ac.bonus_complete_till ?? 3000, days: cfg.trial_days ?? 30 };
  return (
    <div class="auth">
      <div class="auth__hero" aria-hidden="true">
        <div class="auth__glow" />
        <div class="auth__brand"><Mark size={40} /><div><strong>Pentarch POS</strong><span>{t('Sales agents')}</span></div></div>
        <p class="auth__pitch">{t('Sell a POS system Kenyan businesses love. Earn on every client you bring.')}</p>
        <ul class="auth__points">
          <li><Icon name="check" size={18} /> {t('{rate}% of software payments for {months} months').replace('{rate}', c.rate).replace('{months}', c.months)}</li>
          <li><Icon name="check" size={18} /> {t('KES {bonus} for every Complete Till package').replace('{bonus}', Number(c.bonus).toLocaleString('en-KE'))}</li>
          <li><Icon name="check" size={18} /> {t('{days}-day free trial for your clients').replace('{days}', c.days)}</li>
        </ul>
      </div>
      <div class={`auth__panel${wide ? ' auth__panel--wide' : ''}`}>
        <div class="auth__top"><span class="auth__mobile-brand"><Mark size={30} /><strong>Pentarch POS</strong></span><LangToggle /></div>
        {hero && <div class="auth__mhero">
          <p>{t('Sell a POS system Kenyan businesses love. Earn on every client you bring.')}</p>
          <ul>
            <li><Icon name="check" size={16} /> {t('{rate}% of software payments for {months} months').replace('{rate}', c.rate).replace('{months}', c.months)}</li>
            <li><Icon name="check" size={16} /> {t('KES {bonus} for every Complete Till package').replace('{bonus}', Number(c.bonus).toLocaleString('en-KE'))}</li>
          </ul>
        </div>}
        {children}
        <p class="auth__foot">Pentarch Systems Solutions · <a href="https://wa.me/254729455912">+254 729 455 912</a></p>
      </div>
    </div>
  );
}

function errText(e) {
  if (e instanceof ApiError) {
    if (e.code === 'offline' || e.code === 'network') return t('You are offline. Changes are saved on this phone.').split('.')[0] + '.';
    if (e.code === 'invalid_credentials') return t('Wrong email/phone or password.');
    if (e.message) return e.message;
  }
  return t('Something went wrong. Please try again.');
}

export function Login() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!login.trim() || !password) { setErr(t('Required')); return; }
    setBusy(true);
    try {
      const r = await api('POST', '/agents/auth/login', { login: login.trim(), password, device_name: deviceName() });
      await setSession(r.token, r.agent);
      navigate(r.agent.status === 'active' ? '/' : '/pending', true);
      syncNow();
    } catch (e2) { setErr(errText(e2)); } finally { setBusy(false); }
  }
  return (
    <AuthFrame>
      <h1 class="auth__h">{t('Sign in')}</h1>
      <form onSubmit={submit} class="stack" noValidate>
        <Field label={t('Email or phone')}><input type="text" autocomplete="username" inputMode="email" value={login} onInput={(e) => setLogin(e.target.value)} placeholder="you@example.com / 07…" /></Field>
        <Field label={t('Password')}><input type="password" autocomplete="current-password" value={password} onInput={(e) => setPassword(e.target.value)} /></Field>
        {err && <p class="form-err" role="alert">{err}</p>}
        <button class="btn btn--primary btn--block" disabled={busy}>{busy ? <span class="spinner" /> : t('Sign in')}</button>
      </form>
      <div class="auth__switch">{t('New here?')} <a href="/pos/agents/signup" onClick={(e) => { e.preventDefault(); navigate('/signup'); }}>{t('Apply to become an agent')}</a></div>
    </AuthFrame>
  );
}

function deviceName() {
  const ua = navigator.userAgent;
  const m = /Android [\d.]+; ([^;)]+)/.exec(ua);
  return (m ? m[1].trim() : /iPhone/.test(ua) ? 'iPhone' : /Windows/.test(ua) ? 'Windows PC' : 'Browser').slice(0, 60);
}

export function Signup() {
  const [f, setF] = useState({ name: '', phone: '', email: '', town: '', county: '', password: '', heard_from: '', agree_terms: false });
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const terms = (pubConfig.value && pubConfig.value.agent_terms_url) || '';
  const clear = (k) => { setErrs((x) => (x[k] ? { ...x, [k]: undefined } : x)); };
  const set = (k) => (e) => { { const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value; setF((c) => ({ ...c, [k]: v })); } clear(k); };
  async function submit(e) {
    e.preventDefault();
    const x = {};
    if (f.name.trim().length < 3) x.name = t('Required');
    if (!normPhone(f.phone)) x.phone = t('Enter a valid Kenyan phone number, e.g. 0712 345 678');
    if (!isEmail(f.email)) x.email = t('Enter a valid email');
    if (f.password.length < 8) x.password = t('At least 8 characters');
    if (!f.agree_terms) x.agree_terms = t('Required');
    if (Object.keys(x).length) setErr(t('Please fix the fields marked in red.'));
    setErrs(x);
    if (Object.keys(x).length) return;
    setErr('');
    setBusy(true);
    try {
      const r = await api('POST', '/agents/auth/register', { ...f, device_name: deviceName(), lang: document.documentElement.lang });
      await setSession(r.token, r.agent);
      navigate('/pending', true);
    } catch (e2) {
      if (e2 instanceof ApiError && e2.data && e2.data.fields) setErrs(e2.data.fields);
      setErr(errText(e2));
    } finally { setBusy(false); }
  }
  const heard = ['Friend or colleague', 'Facebook', 'WhatsApp group', 'Pentarch staff', 'Other'];
  return (
    <AuthFrame wide>
      <h1 class="auth__h">{t('Become a Pentarch POS agent')}</h1>
      <form onSubmit={submit} class="grid2" noValidate>
        <Field label={t('Full name')} required error={errs.name}><input autocomplete="name" value={f.name} onInput={set('name')} placeholder={t('e.g. Wanjiku Mwangi')} /></Field>
        <Field label={t('Phone (M-Pesa)')} required error={errs.phone} hint={normPhone(f.phone) ? '✓ ' + t('Commission is sent to') + ' ' + intlPhone(normPhone(f.phone)) : t('We send your commission to this M-Pesa number')}><input type="tel" inputMode="tel" autocomplete="tel" value={f.phone} onInput={(e) => { { const v = formatPhoneTyping(e.target.value); setF((c) => ({ ...c, phone: v })); } clear('phone'); }} placeholder="0712 345 678" /></Field>
        <Field label={t('Email')} required error={errs.email}><input type="email" autocomplete="email" value={f.email} onInput={set('email')} placeholder="you@gmail.com" /></Field>
        <Field label={t('Password')} required error={errs.password} hint={t('At least 8 characters')}><input type="password" autocomplete="new-password" value={f.password} onInput={set('password')} /></Field>
        <Field label={t('Town')} optional><input autocomplete="address-level2" value={f.town} onInput={set('town')} /></Field>
        <Field label={t('County')} optional>
          <select value={f.county} onChange={set('county')}><option value="">{t('Choose…')}</option>{COUNTIES.map((c) => <option value={c}>{c}</option>)}</select>
        </Field>
        <Field label={t('How did you hear about us?')} optional>
          <select value={f.heard_from} onChange={set('heard_from')}><option value="">{t('Choose…')}</option>{heard.map((h) => <option value={h}>{t(h)}</option>)}</select>
        </Field>
        <div class="span2">
          <label class={`check${errs.agree_terms ? ' check--err' : ''}`}>
            <input type="checkbox" checked={f.agree_terms} onChange={set('agree_terms')} />
            <span>{t('I agree to the agent terms')}{terms && <> · <a href={terms} target="_blank" rel="noopener">{t('Agent terms')}</a></>}</span>
          </label>
        </div>
        {err && <p class="form-err span2" role="alert">{err}</p>}
        <div class="span2"><button class="btn btn--primary btn--block" disabled={busy}>{busy ? <span class="spinner" /> : t('Send my application')}</button></div>
      </form>
      <div class="auth__switch">{t('Already an agent?')} <a href="/pos/agents/login" onClick={(e) => { e.preventDefault(); navigate('/login'); }}>{t('Sign in')}</a></div>
    </AuthFrame>
  );
}

export function Pending() {
  const a = session.value.agent || {};
  const [busy, setBusy] = useState(false);
  async function check() {
    setBusy(true);
    try {
      const r = await api('GET', '/agents/me');
      await updateAgent(r.agent);
      if (r.agent.status === 'active') { navigate('/', true); syncNow(); }
      else showToast(t('Pentarch is reviewing your application. You will get an email when you are approved — usually within one working day.').split('.')[0] + '.');
    } catch (e) { showToast(errText(e), 'err'); } finally { setBusy(false); }
  }
  useEffect(() => {
    const id = setInterval(() => { if (online.value) check(); }, 60000);
    return () => clearInterval(id);
  }, []);
  return (
    <AuthFrame hero={false}>
      <div class="pending">
        <div class="pending__icon"><Icon name="check" size={30} stroke={2.6} /></div>
        <h1 class="auth__h">{t('Application received')}</h1>
        <p class="muted">{t('Pentarch is reviewing your application. You will get an email when you are approved — usually within one working day.')}</p>
        <div class="codebox">
          <span>{t('Your agent code')}</span>
          <strong>{a.code}</strong>
          <button class="icon-btn" onClick={async () => { if (await copyText(a.code)) showToast(t('Copied')); }} aria-label="Copy"><Icon name="copy" size={18} /></button>
        </div>
        <div class="stack">
          <button class="btn btn--primary btn--block" onClick={check} disabled={busy}>{busy ? <span class="spinner" /> : t('Check status')}</button>
          <a class="btn btn--wa btn--block" href={waLink('254729455912', `Hello Pentarch, I have applied to be a Pentarch POS agent. My code is ${a.code}.`)} target="_blank" rel="noopener"><Icon name="wa" size={20} /> {t('Message Pentarch')}</a>
          <button class="btn btn--ghost btn--block" onClick={signOut}>{t('Sign out')}</button>
        </div>
      </div>
    </AuthFrame>
  );
}
