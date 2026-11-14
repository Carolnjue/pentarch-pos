import { useState, useEffect } from 'preact/hooks';
import { api, ApiError } from '../api.js';
import { session, navigate, useCache, showToast, signOut, updateAgent, installEvt, online, setLang, tourOpen } from '../store.js';
import { prices as priceList, commission as commissionRates } from '../prices.js';
import { syncNow, syncState } from '../sync.js';
import { t, lang, stageLabel } from '../i18n.js';
import { kes, kesWhole, shortDate, prettyPhone, normPhone, copyText, shareLink, waLink, ago } from '../util.js';
import { Shell, LangToggle } from '../components/layout.jsx';
import { Icon, Empty, Field } from '../components/ui.jsx';

export function Commissions() {
  const data = useCache('commissions');
  const res = useCache('resources');
  const cfg = useCache('config');
  const tot = (data && data.totals) || { earned: 0, pending: 0, approved: 0, paid: 0 };
  const rates = commissionRates((res && res.commission) || (cfg && cfg.agent_commission));
  const p = priceList((res && res.prices) || (cfg && cfg.prices));
  const items = (data && data.items) || [];
  const statusLabel = { pending: t('Pending'), approved: t('Approved'), paid: t('Paid'), cancelled: '—' };
  const n = (v) => Number(v).toLocaleString('en-KE');
  const yearly = Math.round((p.software_yearly * rates.software_rate) / 100);
  return (
    <Shell title={t('Earnings')}>
      <div class="money3">
        <div class="money3__main"><span>{t('Earned')}</span><strong class="num">{kes(tot.earned)}</strong></div>
        <div><span><i class="dot dot--sun" />{t('Pending')}</span><strong class="num">{kes(tot.pending)}</strong></div>
        <div><span><i class="dot dot--navy" />{t('Approved')}</span><strong class="num">{kes(tot.approved)}</strong></div>
        <div><span><i class="dot dot--teal" />{t('Paid')}</span><strong class="num">{kes(tot.paid)}</strong></div>
      </div>
      <ol class="flow" aria-label={t('How you get paid')}>
        <li><i class="dot dot--sun" /><span><strong>{t('Pending')}</strong>{t('client paid, Pentarch is checking')}</span></li>
        <li><i class="dot dot--navy" /><span><strong>{t('Approved')}</strong>{t('will be sent this month')}</span></li>
        <li><i class="dot dot--teal" /><span><strong>{t('Paid')}</strong>{t('sent to your M-Pesa')}</span></li>
      </ol>
      <div class="cols cols--detail">
        <section class="card">
          <div class="card__h"><h3>{t('Your commission')}</h3></div>
          {!items.length ? (
            <Empty icon="money" title={t('No commission yet')} text={t('You earn when a client you brought pays. Start a free trial for a lead to get going.')} action={<button class="btn btn--ghost" onClick={() => navigate('/leads')}>{t('Go to my leads')}</button>} />
          ) : (
            <ul class="rows">
              {items.map((c) => (
                <li class="row">
                  <div class="row__main">
                    <strong>{c.business_name}</strong>
                    <span>{shortDate(c.created_at)} · {c.kind === 'software' ? `${c.rate}% · ${kes(c.base_amount)}` : c.note.replace(/^Bonus: /, '')}{c.mpesa_ref ? ` · M-Pesa ${c.mpesa_ref}` : ''}</span>
                  </div>
                  <div class="row__end">
                    <strong class="num">{kes(c.amount)}</strong>
                    <span class={`status status--${c.status}`}>{statusLabel[c.status]}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section class="card">
          <div class="card__h"><h3>{t('How you earn')}</h3></div>
          <ul class="earn">
            <li><b class="num">{rates.software_rate}%</b><span>{t('of software payments for 12 months').replace('12', rates.commission_months)}</span></li>
            <li><b class="num">{kesWhole(rates.bonus_complete_till)}</b><span>{t('per Complete Till package')} <small>({kesWhole(p.package_complete_till)})</small></span></li>
            <li><b class="num">{kesWhole(rates.bonus_software_setup)}</b><span>{t('per Software + Setup package')} <small>({kesWhole(p.package_software_setup)})</small></span></li>
            <li><b class="num">{kesWhole(rates.bonus_counter_kit)}</b><span>{t('per Counter Kit')} <small>({kesWhole(p.counter_kit)})</small></span></li>
          </ul>
          <p class="example"><strong>{t('Example')}:</strong> {t('a shop on the yearly plan pays KES {y} — you get KES {c}. Sell them a Complete Till too and you get KES {b} more.').replace('{y}', n(p.software_yearly)).replace('{c}', n(yearly)).replace('{b}', n(rates.bonus_complete_till))}</p>
          <p class="muted small pad">{t("Commission is paid by M-Pesa every month once the client's payment has cleared.")}</p>
        </section>
      </div>
    </Shell>
  );
}

export function Resources() {
  const res = useCache('resources');
  const items = (res && res.items) || [];
  const cfg = useCache('config');
  const p = priceList((res && res.prices) || (cfg && cfg.prices));
  const n = (v) => Number(v).toLocaleString('en-KE');
  const c = (res && res.contact) || { whatsapp: '254729455912', phone: '+254 729 455 912', email: 'info@pentarchcommunications.com' };
  return (
    <Shell title={t('Resources')} back="/more">
      <div class="cols cols--detail">
        <section class="card">
          <div class="card__h"><h3>{t('Sales materials')}</h3></div>
          <ul class="res">
            {items.map((r) => (
              <li>
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noopener" class="res__a">
                    <span class={`res__ic res__ic--${r.type}`}><Icon name={r.type === 'pdf' ? 'download' : 'book'} size={20} /></span>
                    <span class="res__t"><strong>{lang.value === 'sw' ? r.title_sw : r.title}</strong><small>{r.type.toUpperCase()}</small></span>
                    <Icon name="external" size={18} />
                  </a>
                ) : (
                  <div class="res__a is-off">
                    <span class={`res__ic res__ic--${r.type}`}><Icon name="book" size={20} /></span>
                    <span class="res__t"><strong>{lang.value === 'sw' ? r.title_sw : r.title}</strong><small>{t('Not available yet')}</small></span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
        <div class="stackc">
          <section class="card">
            <div class="card__h"><h3>{t('Prices')}</h3></div>
            <table class="prices">
              <tbody>
                <tr class="prices__h"><th colspan="2">{t('Software')}</th></tr>
                <tr><td>{t('Free trial')}</td><td class="num">{res ? res.trial_days : 30} {t('days')}</td></tr>
                <tr><td>{t('Software per month')}</td><td class="num">{kesWhole(p.software_monthly)}</td></tr>
                <tr><td>{t('Software per year')}<small>{t('2 months free')}</small></td><td class="num">{kesWhole(p.software_yearly)}</td></tr>
                <tr><td>{t('Extra branch per month')}</td><td class="num">{kesWhole(p.extra_branch_monthly)}</td></tr>
                <tr class="prices__h"><th colspan="2">{t('Packages')}</th></tr>
                <tr><td>{t('Complete Till package')}<small>{t('Computer, screen, printer, scanner, cash drawer, UPS, setup + 12 months software')}</small></td><td class="num">{kesWhole(p.package_complete_till)}</td></tr>
                <tr><td>{t('Software + Setup package')}<small>{t('On their own computer, setup + 12 months software')}</small></td><td class="num">{kesWhole(p.package_software_setup)}</td></tr>
                <tr><td>{t('Or: setup + monthly')}<small>{t('Setup now, then pay monthly')}</small></td><td class="num">{kesWhole(p.setup_only_fee)} + {n(p.software_monthly)}/{t('mo')}</td></tr>
                <tr class="prices__h"><th colspan="2">{t('Add-ons')}</th></tr>
                <tr><td>{t('Counter Kit')}<small>{t('Scanner, receipt printer, cash drawer — for their own computer')}</small></td><td class="num">{kesWhole(p.counter_kit)}</td></tr>
                <tr><td>{t('Extra till')}<small>{t('Second complete till in the same branch')}</small></td><td class="num">{kesWhole(p.extra_till)}</td></tr>
              </tbody>
            </table>
          </section>
          <section class="card">
            <div class="card__h"><h3>{t('Contact Pentarch')}</h3></div>
            <div class="stack">
              <a class="btn btn--wa btn--block" href={waLink(c.whatsapp, 'Hello Pentarch, ')} target="_blank" rel="noopener"><Icon name="wa" size={20} /> WhatsApp {c.phone}</a>
              <a class="btn btn--ghost btn--block" href={'mailto:' + c.email}>{c.email}</a>
            </div>
          </section>
        </div>
      </div>
    </Shell>
  );
}

export function More() {
  const a = session.value.agent || {};
  const s = syncState.value;
  const items = [
    ['/commissions', 'money', t('Earnings')],
    ['/resources', 'book', t('Resources')],
    ['/profile', 'user', t('Profile')]
  ];
  return (
    <Shell title={t('More')}>
      <section class="card mecard">
        <span class="avatar avatar--lg">{(a.first_name || 'A')[0]}</span>
        <div><strong>{a.name}</strong><span><code>{a.code}</code> · {a.town}</span></div>
      </section>
      <ul class="menu">
        {items.map(([p, ic, l]) => (
          <li><a href={'/pos/agents' + p} onClick={(e) => { e.preventDefault(); navigate(p); }}><Icon name={ic} /><span>{l}</span><Icon name="chevron" size={18} /></a></li>
        ))}
        <li><button onClick={() => { tourOpen.value = true; }}><Icon name="help" /><span>{t('How to use the app')}<small>{t('A 1-minute tour')}</small></span><Icon name="chevron" size={18} /></button></li>
        <li><button onClick={() => syncNow({ quiet: false })}><Icon name="sync" /><span>{t('Sync now')}<small>{s.state === 'offline' ? t('No internet') + (s.pending ? ` · ${s.pending} ${t('waiting')}` : '') : s.pending ? `${s.pending} ${t('waiting')}` : s.last ? `${t('Synced')} ${ago(s.last)}` : ''}</small></span></button></li>
        {installEvt.value && <li><button onClick={async () => { installEvt.value.prompt(); installEvt.value = null; }}><Icon name="download" /><span>{t('Install app')}</span></button></li>}
        <li class="menu__lang"><Icon name="globe" /><span>{t('Language')}</span><LangToggle /></li>
        <li><button class="danger" onClick={signOut}><Icon name="back" /><span>{t('Sign out')}</span></button></li>
      </ul>
    </Shell>
  );
}

export function Profile() {
  const a = session.value.agent || {};
  const [mp, setMp] = useState(prettyPhone(a.mpesa_phone));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ current_password: '', new_password: '' });

  async function saveMpesa(e) {
    e.preventDefault();
    if (!normPhone(mp)) { setErr(t('Enter a valid Kenyan phone number')); return; }
    setErr(''); setBusy(true);
    try {
      const r = await api('POST', '/agents/me', { mpesa_phone: normPhone(mp) });
      await updateAgent(r.agent);
      showToast(t('Saved'));
    } catch (e2) { showToast(e2 instanceof ApiError && e2.message && e2.status ? e2.message : t('You are offline. Changes are saved on this phone.').split('.')[0], 'err'); }
    finally { setBusy(false); }
  }
  async function savePw(e) {
    e.preventDefault();
    if (pw.new_password.length < 8) { showToast(t('At least 8 characters'), 'err'); return; }
    try {
      await api('POST', '/agents/me', pw);
      setPw({ current_password: '', new_password: '' });
      showToast(t('Saved'));
    } catch (e2) { showToast(e2.message || t('Something went wrong. Please try again.'), 'err'); }
  }
  async function shareL(url, label) {
    const r = await shareLink({ title: 'Pentarch POS', text: label, url });
    if (r === 'copied') showToast(t('Copied'));
  }
  const links = a.links || {};
  return (
    <Shell title={t('Profile')} back="/more">
      <div class="cols cols--detail">
        <div class="stackc">
          <section class="card codecard">
            <span class="codecard__l">{t('Your agent code')}</span>
            <strong class="codecard__code">{a.code}</strong>
            <div class="codecard__acts">
              <button class="btn btn--light btn--sm" onClick={async () => { if (await copyText(a.code)) showToast(t('Copied')); }}><Icon name="copy" size={16} /> Copy</button>
              <button class="btn btn--light btn--sm" onClick={() => shareL(links.website, 'Pentarch POS')}><Icon name="share" size={16} /> {t('Share your code')}</button>
            </div>
          </section>
          <section class="card">
            <div class="card__h"><h3>{t('Your links')}</h3></div>
            <ul class="links">
              {[[links.demo, t('Live demo')], [links.website, t('Website')], [links.trial, t('Start trial page')]].map(([u, l]) => (
                <li>
                  <div><strong>{l}</strong><span>{(u || '').replace(/^https?:\/\//, '')}</span></div>
                  <button class="icon-btn" onClick={() => shareL(u, l)} aria-label={l}><Icon name="share" size={18} /></button>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <div class="stackc">
          <section class="card">
            <div class="card__h"><h3>{a.name}</h3></div>
            <dl class="dl">
              <dt>{t('Email')}</dt><dd>{a.email}</dd>
              <dt>{t('Phone')}</dt><dd>{prettyPhone(a.phone)}</dd>
              <dt>{t('Town')}</dt><dd>{[a.town, a.county].filter(Boolean).join(', ') || '—'}</dd>
              <dt>{t('Language')}</dt><dd><LangToggle /></dd>
            </dl>
            <form class="inline-form" onSubmit={saveMpesa}>
              <Field label={t('M-Pesa number for commission')} error={err}><input type="tel" inputMode="tel" value={mp} onInput={(e) => setMp(e.target.value)} /></Field>
              <button class="btn btn--primary" disabled={busy || !online.value}>{t('Save')}</button>
            </form>
          </section>
          <section class="card">
            <div class="card__h"><h3>{t('Change password')}</h3></div>
            <form class="stack" onSubmit={savePw}>
              <Field label={t('Current password')}><input type="password" autocomplete="current-password" value={pw.current_password} onInput={(e) => setPw({ ...pw, current_password: e.target.value })} /></Field>
              <Field label={t('New password')} hint={t('At least 8 characters')}><input type="password" autocomplete="new-password" value={pw.new_password} onInput={(e) => setPw({ ...pw, new_password: e.target.value })} /></Field>
              <button class="btn btn--ghost" disabled={!online.value}>{t('Save')}</button>
            </form>
          </section>
          <button class="btn btn--danger btn--block" onClick={signOut}>{t('Sign out')}</button>
          <p class="muted small center">Pentarch POS Agents v1.0 · Pentarch Communications</p>
        </div>
      </div>
    </Shell>
  );
}
