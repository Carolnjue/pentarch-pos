// Welcome: Try the demo · Start 30-day free trial (offline-first) · Sign in to my business.
import { useEffect, useState } from 'preact/hooks';
import { BUSINESS_TYPES } from '../presets/types.js';
import { startDemo, startTrial, signIn, welcomeIntent, agentRef } from '../auth/session.js';
import { Icon, Btn, Input, Select, Check } from '../ui/kit.jsx';
import { toast } from '../ui/overlay.jsx';
import { normPhone } from '../lib/util.js';
import { t, setLang } from '../i18n/index.js';
import { lang, online } from '../state.js';
import { COUNTIES } from '../modules/settings/panels/general.jsx';

export default function Welcome() {
  const [view, setView] = useState(welcomeIntent.value === 'demo' ? 'demo' : welcomeIntent.value === 'trial' ? 'trial' : 'home');
  return (
    <div class="welcome">
      <div class="glow" style={{ background: '#EE4B3B', left: '-200px', top: '-260px' }} />
      <div class="glow" style={{ background: '#14B1AC', right: '-260px', bottom: '-300px' }} />
      <div class="inner">
        <header class="row" style={{ marginBottom: '40px' }}>
          <img src="/pos/brand/pentarch-mark.svg" alt="" width="42" height="42" />
          <div class="grow"><b style={{ font: '800 21px var(--f-head)', whiteSpace: 'nowrap' }}>Pentarch POS</b><div class="desk-only" style={{ color: '#8f9bb8', fontSize: '13px' }}>{t('by Pentarch Systems Solutions, Nairobi')}</div></div>
          <div class="seg" style={{ background: 'var(--ink-2)' }}>{['en', 'sw'].map((l) => <button style={{ color: lang.value === l ? 'var(--text)' : '#cfd6e6' }} class={lang.value === l ? 'on' : ''} onClick={() => setLang(l)} aria-pressed={lang.value === l} aria-label={l === 'en' ? 'English' : 'Kiswahili'}><span class="desk-only">{l === 'en' ? 'English' : 'Kiswahili'}</span><span class="mobile-only">{l.toUpperCase()}</span></button>)}</div>
        </header>
        {view === 'home' && <Home go={setView} />}
        {view === 'demo' && <DemoPick back={() => setView('home')} />}
        {view === 'trial' && <Trial back={() => setView('home')} />}
        {view === 'signin' && <SignIn back={() => setView('home')} />}
        <footer class="row wrap" style={{ marginTop: '48px', color: '#8f9bb8', fontSize: '14px', gap: '18px' }}>
          <span>+254 729 455 912</span><span>info@pentarchcommunications.com</span>
          <a style={{ color: '#cfd6e6' }} href="https://pentarchcommunications.com/systems/pos/#book" target="_blank" rel="noopener">{t('Book a demo')}</a>
          <a style={{ color: '#cfd6e6' }} href="https://wa.me/254729455912" target="_blank" rel="noopener">WhatsApp</a>
        </footer>
      </div>
    </div>
  );
}

function Home({ go }) {
  return (
    <>
      <div class="hero">
        <h1>{t('Sell faster.')}<br /><em>{t('Know your shop.')}</em></h1>
        <p>{t('The point of sale built for Kenyan businesses: M-Pesa, KRA tax codes, credit customers, barcode labels — and it keeps working when the internet does not.')}</p>
      </div>
      <div class="choice-grid">
        <button class="choice" onClick={() => go('demo')}>
          <span class="ico" style={{ background: 'rgba(246,178,44,.15)', color: 'var(--sun)' }}><Icon name="play" size={24} /></span>
          <h3>{t('Try the demo')}</h3><p>{t('Pick your type of business and play with a shop full of sample products and 30 days of sales.')}</p>
          <span class="go">{t('Open demo')} <Icon name="arrow-right" size={16} /></span>
        </button>
        <button class="choice" onClick={() => go('trial')} style={{ borderColor: '#3a4f86' }}>
          <span class="ico" style={{ background: 'rgba(238,75,59,.16)', color: '#ff7a6c' }}><Icon name="sparkle" size={24} /></span>
          <h3>{t('Start 30-day free trial')}</h3><p>{t('Set up your own business in minutes. No card needed. Works offline from the first minute.')}</p>
          <span class="go">{t('Start free trial')} <Icon name="arrow-right" size={16} /></span>
        </button>
        <button class="choice" onClick={() => go('signin')}>
          <span class="ico" style={{ background: 'rgba(20,177,172,.16)', color: '#5fe0da' }}><Icon name="key" size={24} /></span>
          <h3>{t('Sign in to my business')}</h3><p>{t('Already using Pentarch POS? Add this device and download your products, customers and history.')}</p>
          <span class="go">{t('Sign in')} <Icon name="arrow-right" size={16} /></span>
        </button>
      </div>
    </>
  );
}

function DemoPick({ back }) {
  const [busy, setBusy] = useState(null);
  return (
    <div class="dark-panel">
      <button class="btn ghost" style={{ color: '#cfd6e6', marginBottom: '14px' }} onClick={back}><Icon name="arrow-left" />{t('Back')}</button>
      <h1 style={{ color: '#fff', fontSize: '34px' }}>{t('What kind of business?')}</h1>
      <p style={{ color: '#aab5cf', margin: '8px 0 24px' }}>{t('We load realistic products, staff and a month of sales. Everything stays in this browser.')}</p>
      <div class="type-grid">
        {BUSINESS_TYPES.map((b) => (
          <button class="type-tile" disabled={!!busy} onClick={async () => { setBusy(b.id); await startDemo(b.id); }}>
            <span class="ti" style={{ background: b.color }}><Icon name={b.icon} size={20} /></span>
            <span><b>{t(b.label)}</b>{busy === b.id && <small>{t('Loading…')}</small>}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Trial({ back }) {
  const [f, setF] = useState({ business_name: '', business_type: 'duka', owner_name: '', phone: '', email: '', password: '', town: '', county: 'Nairobi', pin: '', agent_code: agentRef(), agree: false, website: '' });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (p) => setF({ ...f, ...p });
  // load the business builder now, so starting the trial also works if the connection drops while typing
  useEffect(() => { import('../presets/seed.js').catch(() => {}); }, []);
  const submit = async (e) => {
    e.preventDefault();
    if (f.website) return; // honeypot
    const er = {};
    if (f.business_name.trim().length < 2) er.business_name = t('Enter the business name');
    if (f.owner_name.trim().length < 2) er.owner_name = t('Enter your name');
    if (!normPhone(f.phone)) er.phone = t('Enter a valid Kenyan phone number');
    if (!/^\S+@\S+\.\S+$/.test(f.email)) er.email = t('Enter a valid email');
    if (f.password.length < 6) er.password = t('At least 6 characters');
    if (!/^\d{4}$/.test(f.pin)) er.pin = t('4 digits');
    if (!f.town.trim()) er.town = t('Enter your town');
    if (!f.agree) er.agree = t('Please accept the terms');
    setErr(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      const ok = await startTrial({ ...f, business_name: f.business_name.trim(), owner_name: f.owner_name.trim(), town: f.town.trim() });
      toast(ok ? t('Welcome! Your 30-day trial has started.') : t('Trial started on this device. It registers with the cloud when you are online.'), { ms: 5000 });
    } catch (e2) {
      setBusy(false);
      const fields = e2.body?.data?.fields;
      if (e2.status === 409) setErr({ email: t('This email already has a Pentarch POS account. Use “Sign in to my business” instead, or use another email.') });
      else if (fields && typeof fields === 'object') setErr(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, String(v)])));
      toast.error(e2.status === 429 ? t('Too many attempts. Wait a few minutes and try again.') : e2.body?.message || e2.message);
    }
  };
  return (
    <div class="split-trial">
      <div>
        <button class="btn ghost" style={{ color: '#cfd6e6', marginBottom: '14px' }} onClick={back}><Icon name="arrow-left" />{t('Back')}</button>
        <h1 style={{ color: '#fff', fontSize: '34px' }}>{t('Start your free trial')}</h1>
        <p style={{ color: '#aab5cf', marginTop: '10px' }}>{t('30 days, every feature, no card. You can start without internet — your business registers automatically when you connect.')}</p>
        <ul style={{ color: '#cfd6e6', lineHeight: 2, paddingLeft: '18px' }}>
          <li>{t('M-Pesa, cash, card, credit and split payments')}</li><li>{t('Barcode scanning and label printing')}</li><li>{t('Works offline, syncs to the cloud')}</li><li>{t('English and Kiswahili')}</li>
        </ul>
        {!online.value && <div class="callout warn"><Icon name="wifi-off" size={18} />{t('You are offline. You can still start — we register you later.')}</div>}
      </div>
      <form class="card pad" onSubmit={submit} style={{ color: 'var(--text)' }} noValidate>
        <div class="form-grid">
          <Input class="span2" label={t('Business name')} value={f.business_name} onValue={(v) => set({ business_name: v })} error={err.business_name} autoFocus />
          <Select class="span2" label={t('Type of business')} value={f.business_type} onValue={(v) => set({ business_type: v })} options={BUSINESS_TYPES.map((b) => ({ value: b.id, label: t(b.label) }))} />
          <Input label={t('Your name')} value={f.owner_name} onValue={(v) => set({ owner_name: v })} error={err.owner_name} autocomplete="name" />
          <Input label={t('Phone (M-Pesa)')} type="tel" value={f.phone} onValue={(v) => set({ phone: v })} error={err.phone} placeholder="07xx xxx xxx" autocomplete="tel" />
          <Input class="span2" label={t('Email (you sign in with this)')} type="email" value={f.email} onValue={(v) => set({ email: v })} error={err.email} autocomplete="email" />
          <Input label={t('Password')} type="password" value={f.password} onValue={(v) => set({ password: v })} error={err.password} autocomplete="new-password" />
          <Input label={t('Your 4-digit till PIN')} type="password" inputMode="numeric" value={f.pin} onValue={(v) => set({ pin: v.replace(/\D/g, '').slice(0, 4) })} error={err.pin} inputClass="mono" autocomplete="off" />
          <Input label={t('Town')} value={f.town} onValue={(v) => set({ town: v })} error={err.town} />
          <Select label={t('County')} value={f.county} onValue={(v) => set({ county: v })} options={COUNTIES} />
          <Input label={t('Agent code (optional)')} value={f.agent_code} onValue={(v) => set({ agent_code: v.toUpperCase() })} placeholder="AG-XXXX" inputClass="mono" />
          <input type="text" name="website" value={f.website} onInput={(e) => set({ website: e.target.value })} tabIndex={-1} autocomplete="off" class="sr" aria-hidden="true" />
          <div class="full"><Check checked={f.agree} onChange={(v) => set({ agree: v })} label={<span>{t('I agree to the Pentarch POS terms and privacy policy')}</span>} />{err.agree && <div class="small down bold">{err.agree}</div>}</div>
        </div>
        <Btn type="submit" variant="primary" size="lg" class="block mt" disabled={busy}>{busy ? t('Setting up…') : t('Start free trial')}<Icon name="arrow-right" /></Btn>
      </form>
    </div>
  );
}

function SignIn({ back }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [n, setN] = useState(0);
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!navigator.onLine) return setErr(t('Signing in needs internet the first time.'));
    setBusy(true);
    try { await signIn(email, pw, setN); }
    catch (e2) { setBusy(false); setErr(e2.status === 401 || e2.status === 403 ? t('Wrong email or password') : e2.body?.message || e2.message); }
  };
  return (
    <div style={{ maxWidth: '460px' }}>
      <button class="btn ghost" style={{ color: '#cfd6e6', marginBottom: '14px' }} onClick={back}><Icon name="arrow-left" />{t('Back')}</button>
      <h1 style={{ color: '#fff', fontSize: '34px', marginBottom: '18px' }}>{t('Sign in to my business')}</h1>
      <form class="card pad col" onSubmit={submit} style={{ color: 'var(--text)' }}>
        <Input label={t('Email')} type="email" value={email} onValue={setEmail} autoFocus autocomplete="username" />
        <Input label={t('Password')} type="password" value={pw} onValue={setPw} autocomplete="current-password" />
        {err && <div class="callout bad"><Icon name="alert" size={18} />{err}</div>}
        <Btn type="submit" variant="primary" size="lg" disabled={busy || !email || !pw}>{busy ? (n ? t('Downloading {n} records…', { n }) : t('Signing in…')) : t('Sign in')}</Btn>
        <p class="small mute" style={{ margin: 0 }}>{t('Forgot your password? WhatsApp Pentarch on +254 729 455 912.')}</p>
      </form>
    </div>
  );
}
