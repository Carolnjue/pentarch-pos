// Licence & billing — SPEC §5: status, M-Pesa Paybill instructions (account number = business code), prices, WhatsApp support.
// Prices come from the cloud: GET /licence → pay{}, else GET /public/config → prices{} (cached), else the published defaults.
import { useEffect, useState } from 'preact/hooks';
import { Btn, Icon, Badge, Progress, Input } from '../../../ui/kit.jsx';
import { toast } from '../../../ui/overlay.jsx';
import { licenceState, refreshLicence, exitDemo, retryRegistration, completeRegistration } from '../../../auth/session.js';
import { pricesFrom } from '../../../auth/licence.js';
import { Cloud } from '../../../sync/api.js';
import { getMeta, setMeta } from '../../../db/index.js';
import { money } from '../../../lib/money.js';
import { waLink } from '../../../lib/util.js';
import { Panel } from './general.jsx';
import * as S from '../../../state.js';
import { t } from '../../../i18n/index.js';

export const SUPPORT_WA = '254729455912';
const fmtDate = (ms) => (ms ? new Date(ms).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

export default function LicencePanel() {
  const [cfg, setCfg] = useState(null);
  const [regErr, setRegErr] = useState(null);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    getMeta('public_config').then((c) => c && setCfg(c));
    getMeta('register_error').then(setRegErr);
    getMeta('pending_register').then(setPending);
    if (navigator.onLine && !S.isDemo.value) Cloud.config().then((c) => { setCfg(c); setMeta('public_config', c); }).catch(() => {});
  }, []);
  const L = S.licence.value;
  const lic = licenceState();
  const pay = L?.pay || {};
  const paybill = pay.paybill || cfg?.paybill || '';
  const account = L?.business_code || pay.account || '';
  const P = pricesFrom(pay, cfg);
  const extraBranches = Math.max(0, (S.branches.value?.length || 1) - 1);
  const perMonth = P.monthly + extraBranches * P.branch_monthly;
  const perYear = P.yearly + extraBranches * P.branch_yearly;
  const waNo = pay.whatsapp || cfg?.whatsapp || SUPPORT_WA;
  const wa = waLink(waNo, t('Hello Pentarch, I would like to pay for Pentarch POS. Business: {b}. Account: {a}.', { b: S.business.value?.name, a: account || '—' }));

  if (S.isDemo.value) return (
    <Panel title={t('Licence & billing')}>
      <div class="callout"><Icon name="info" /><div><b>{t('This is the demo')}</b><div>{t('The demo has no licence. Start a free 30-day trial to use Pentarch POS with your own business.')}</div></div></div>
      <PriceCards P={P} />
      <div class="row gap-s mt"><Btn variant="primary" onClick={() => exitDemo({ trial: true })}>{t('Start free trial')}</Btn><a class="btn" href={wa} target="_blank" rel="noopener"><Icon name="whatsapp" />{t('Talk to Pentarch')}</a></div>
    </Panel>
  );

  const tone = { trial: 'navy', active: 'ok', grace: 'warn', expired: 'bad', suspended: 'bad', unregistered: 'warn' }[lic.status];
  const label = { trial: 'Free trial', active: 'Active', grace: 'Payment overdue', expired: 'Expired', suspended: 'Suspended', unregistered: 'Not yet registered' }[lic.status];
  const refresh = async () => {
    setBusy(true);
    try {
      if (pending) await completeRegistration();
      await refreshLicence();
      setPending(await getMeta('pending_register'));
      toast(navigator.onLine ? t('Licence refreshed') : t('You are offline. Connect to the internet and try again.'));
    } catch (e) { toast.error(e.body?.message || e.message); } finally { setBusy(false); }
  };
  return (
    <div class="col gap-l">
      {regErr && pending && <FixRegistration err={regErr} pending={pending} onDone={async () => { setRegErr(null); setPending(await getMeta('pending_register')); }} />}
      <div class="card" style={{ overflow: 'hidden' }}>
        <div class="pill-grad" style={{ borderRadius: 0 }} />
        <div class="card-b row wrap" style={{ gap: '20px' }}>
          <div class="grow" style={{ minWidth: '220px' }}>
            <div class="row gap-s wrap"><h2>{t('Pentarch POS')}{L?.plan ? ' — ' + L.plan : ''}</h2><Badge tone={tone}>{t(label)}</Badge></div>
            <p class="mute" style={{ margin: '6px 0 0' }}>
              {lic.status === 'trial' && t('Your free trial ends in {n} days ({d}).', { n: Math.max(0, lic.days_left), d: fmtDate(lic.until) })}
              {lic.status === 'active' && t('Paid until {d}.', { d: fmtDate(lic.until) })}
              {lic.status === 'grace' && t('Payment overdue. Selling stops on {d} unless you pay.', { d: fmtDate(lic.grace_ends) })}
              {lic.status === 'expired' && t('Selling and purchasing are paused. Viewing, reports, export and backup still work.')}
              {lic.status === 'suspended' && t('This account is suspended. Contact Pentarch.')}
              {lic.status === 'unregistered' && t('Connect to the internet once so your trial registers with Pentarch Cloud.')}
            </p>
            {L?.fetched_at && <p class="small mute" style={{ margin: '4px 0 0' }}>{t('Last checked {d}', { d: new Date(L.fetched_at).toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })}</p>}
          </div>
          {lic.days_left != null && lic.status === 'trial' && <div style={{ width: '220px' }}><div class="small mute bold mb">{t('{n} of {m} days left', { n: Math.max(0, lic.days_left), m: P.trial_days })}</div><Progress value={(Math.max(0, lic.days_left) / P.trial_days) * 100} /></div>}
          <Btn icon="refresh" onClick={refresh} disabled={busy}>{busy ? t('Checking…') : t('I have paid — refresh')}</Btn>
        </div>
      </div>

      <Panel title={t('How to pay')} sub={t('Pay by M-Pesa from any phone. Your licence updates within minutes.')}>
        <div class="grid2" style={{ alignItems: 'start' }}>
          <div class="card pad paybox">
            <div class="row gap-s mb"><span class="ico-bub" style={{ background: '#2f8f2f', color: '#fff' }}><Icon name="phone" /></span><h3>{t('M-Pesa Paybill')}</h3></div>
            <ol class="pay-steps">
              <li>{t('Go to M-Pesa → Lipa na M-Pesa → Pay Bill')}</li>
              <li>{t('Business number')}: <b class="mono big">{paybill || t('(shown when online)')}</b></li>
              <li>{t('Account number')}: {account ? <CodeChip code={account} /> : <b>{t('(your business code, shown when online)')}</b>}</li>
              <li>{t('Amount')}: <span class="nowrap"><b class="mono">{money(perMonth * 100)}</b> {t('per month')}</span> · <span class="nowrap">{t('or')} <b class="mono">{money(perYear * 100)}</b> {t('per year')}</span></li>
            </ol>
            {account && <p class="small" style={{ margin: '12px 0 0' }}>{t('Your business code {c} is your account number. Always use it so the payment reaches your business.', { c: account })}</p>}
          </div>
          <div class="col">
            <a class="btn ok lg" href={wa} target="_blank" rel="noopener"><Icon name="whatsapp" />{t('WhatsApp Pentarch')}</a>
            <a class="btn lg" href="tel:+254729455912"><Icon name="phone" />{t('Call +254 729 455 912')}</a>
            <a class="btn lg" href="mailto:info@pentarchsystemssolutions.co.ke"><Icon name="mail" />info@pentarchsystemssolutions.co.ke</a>
            <div class="callout small"><Icon name="shield" size={18} /><span>{t('We never hold your data hostage: even after expiry you can view reports, export and back up.')}</span></div>
          </div>
        </div>
      </Panel>

      <Panel title={t('Prices')} sub={extraBranches ? t('Your business has {n} branches.', { n: extraBranches + 1 }) : t('One branch with unlimited products, staff and devices.')}>
        <PriceCards P={P} extra={extraBranches} />
      </Panel>
    </div>
  );
}

function PriceCards({ P, extra = 0 }) {
  return (
    <div class="price-cards">
      <div class="price-card">
        <div class="small bold mute">{t('Monthly')}</div>
        <div class="amt mono">{money((P.monthly + extra * P.branch_monthly) * 100)}</div>
        <div class="small mute">{t('per month')}{extra ? ' · ' + t('{n} extra branches included', { n: extra }) : ''}</div>
      </div>
      <div class="price-card best">
        <Badge tone="ok">{t('2 months free')}</Badge>
        <div class="small bold mute">{t('Yearly')}</div>
        <div class="amt mono">{money((P.yearly + extra * P.branch_yearly) * 100)}</div>
        <div class="small mute">{t('per year')}</div>
      </div>
      <div class="price-card">
        <div class="small bold mute">{t('Each extra branch')}</div>
        <div class="amt mono">+{money(P.branch_monthly * 100)}</div>
        <div class="small mute">{t('per month')}</div>
      </div>
      <p class="small mute" style={{ gridColumn: '1 / -1', margin: 0 }}>{t('Includes cloud backup, sync between devices, updates and WhatsApp support. {d}-day free trial, no card needed.', { d: P.trial_days })}</p>
    </div>
  );
}

function CodeChip({ code }) {
  const copy = async () => { try { await navigator.clipboard.writeText(code); toast(t('Copied {c}', { c: code })); } catch { toast(code); } };
  return <button type="button" class="code-chip" onClick={copy} title={t('Copy')} aria-label={t('Copy account number {c}', { c: code })}><b class="mono">{code}</b><Icon name="copy" size={15} /></button>;
}

/** Shown when the cloud rejected an offline-started trial (e.g. the email is already registered). */
function FixRegistration({ err, pending, onDone }) {
  const [email, setEmail] = useState(pending.email || '');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const fields = err.fields || {};
  const go = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast.error(t('Enter a valid email'));
    if (pw && pw.length < 6) return toast.error(t('Password: at least 6 characters'));
    setBusy(true);
    try {
      const ok = await retryRegistration({ email: email.trim().toLowerCase(), ...(pw ? { password: pw } : {}) });
      if (ok) { toast(t('Your business is registered. Free trial active.')); onDone(); }
      else toast.error(t('You are offline. Connect to the internet and try again.'));
    } catch (e) { toast.error(e.body?.message || e.message); } finally { setBusy(false); }
  };
  return (
    <div class="callout bad" style={{ alignItems: 'flex-start' }}>
      <Icon name="alert" />
      <div class="grow col gap-s">
        <div><b>{t('Your trial is not registered yet')}</b><div>{err.message}{Object.values(fields).length ? ' — ' + Object.values(fields).join(' ') : ''}</div></div>
        <div class="small">{t('Selling still works on this device. Fix the details below and tap Register.')}</div>
        <div class="form-grid">
          <Input label={t('Email (you sign in with this)')} value={email} onValue={setEmail} />
          <Input label={t('New password (optional)')} type="password" value={pw} onValue={setPw} autocomplete="new-password" />
        </div>
        <div><Btn variant="primary" icon="refresh" onClick={go} disabled={busy}>{busy ? t('Registering…') : t('Register')}</Btn></div>
      </div>
    </div>
  );
}
