import { useState } from 'preact/hooks';
import { db, saveLead, addActivity, queueAction, dropUnsentActivity } from '../db.js';
import { api, ApiError } from '../api.js';
import { navigate, showToast, online, useLive, session } from '../store.js';
import { syncSoon, syncNow } from '../sync.js';
import { t, STAGES, stageLabel, typeLabel, lang, COUNTIES } from '../i18n.js';
import { prettyPhone, waLink, followLabel, dateTime, todayISO, isEmail, normPhone, copyText, shareLink, shortDate, formatPhoneTyping } from '../util.js';
import { Shell } from '../components/layout.jsx';
import { Icon, Stage, Sheet, Field, Empty } from '../components/ui.jsx';

const ACT_EN = { visit: 'Visit', call: 'Call', whatsapp: 'WhatsApp', sms: 'SMS', demo: 'Demo', note: 'Note', stage: 'Stage changed', trial: 'Trial started', email: 'Email' };
function actLabel(type) { return lang.value === 'sw' ? t(type) : ACT_EN[type] || type; }
const ACT_ICON = { visit: 'walk', call: 'phone', whatsapp: 'wa', sms: 'sms', demo: 'calendar', note: 'note', stage: 'chevron', trial: 'rocket', email: 'note' };

export function LeadDetail({ id }) {
  const lead = useLive(() => db.leads.get(id), [id], undefined);
  const acts = useLive(() => db.activities.where('lead_id').equals(id).toArray().then((a) => a.sort((x, y) => y.at - x.at)), [id], []);
  const [sheet, setSheet] = useState(null);
  const a = session.value.agent || {};

  if (lead === undefined) return <Shell title="" back="/leads"><div /></Shell>;
  if (!lead || lead.deleted) {
    return <Shell title={t('Leads')} back="/leads"><Empty icon="search" title={t('Lead not found')} action={<button class="btn btn--ghost" onClick={() => navigate('/leads')}>{t('Back')}</button>} /></Shell>;
  }

  const first = (lead.contact_name || '').split(' ')[0];
  const hello = lang.value === 'sw' ? `Habari ${first || ''}, ` : `Hello ${first || ''}, `;

  async function log(type, note = '') {
    await addActivity(lead.id, type, note);
    syncSoon();
  }
  async function changeStage(s) {
    if (s === lead.stage) return;
    const prev = lead.stage;
    await saveLead({ ...lead, stage: s });
    const act = await addActivity(lead.id, 'stage', `${stageLabel(prev)} → ${stageLabel(s)}`);
    syncSoon();
    showToast(`${t('Moved to')} ${stageLabel(s)}`, 'ok', {
      label: t('Undo'),
      run: async () => {
        const cur = await db.leads.get(lead.id);
        await saveLead({ ...cur, stage: prev });
        if (!(await dropUnsentActivity(act.id))) await addActivity(lead.id, 'stage', `${stageLabel(s)} → ${stageLabel(prev)}`);
        syncSoon();
        showToast(`${t('Back to')} ${stageLabel(prev)}`);
      }
    });
  }
  async function remove() {
    await saveLead({ ...lead, deleted: 1 });
    syncSoon();
    navigate('/leads', true);
    showToast(t('Lead deleted'), 'ok', {
      label: t('Undo'),
      run: async () => {
        const cur = await db.leads.get(lead.id);
        await saveLead({ ...cur, deleted: 0 });
        syncSoon();
        navigate('/leads/' + lead.id);
      }
    });
  }
  async function share(kind) {
    const url = kind === 'demo' ? a.links.demo : a.links.website;
    const text = kind === 'demo'
      ? (lang.value === 'sw' ? `${hello}jaribu Pentarch POS hapa — onyesho kamili kwenye simu au kompyuta yako:` : `${hello}try Pentarch POS here — a full live demo on your phone or computer:`)
      : (lang.value === 'sw' ? `${hello}haya ni maelezo ya Pentarch POS, bei na vifurushi:` : `${hello}here are the Pentarch POS details, prices and packages:`);
    if (lead.phone) {
      window.open(waLink(lead.phone, `${text} ${url}`), '_blank', 'noopener');
      log('whatsapp', kind === 'demo' ? t('Share demo link') : t('Share website'));
    } else {
      const r = await shareLink({ title: 'Pentarch POS', text, url });
      if (r === 'copied') showToast(t('Copied'));
    }
  }
  function checkIn() {
    const msg = lang.value === 'sw'
      ? `${hello}unaendeleaje na Pentarch POS? Kama kuna kitu chochote nikusaidie nacho, niambie.`
      : `${hello}how is Pentarch POS working for you? If you need any help, just tell me.`;
    window.open(waLink(lead.phone, msg), '_blank', 'noopener');
    log('whatsapp', t('Checked in on WhatsApp'));
  }

  // The one big button: always the next sensible step for this stage.
  const st = lead.stage;
  let next;
  if (st === 'won') next = { key: 'earn', icon: 'money', label: t('See your earnings'), hint: t('Paying client. You earn commission on their payments.'), run: () => navigate('/commissions') };
  else if (st === 'trial' || lead.tenant_id) next = { key: 'wa', icon: 'wa', label: t('Check in on WhatsApp'), hint: t('They are on the free trial. A quick message keeps them using it — and paying.'), run: checkIn, off: !lead.phone };
  else if (st === 'demo_booked' || st === 'demo_done') next = { key: 'trial', icon: 'rocket', label: t('Start 30-day trial'), hint: t('Next step: start their free trial on their own computer. Takes 1 minute.'), run: () => setSheet('trial') };
  else next = { key: 'demo', icon: 'calendar', label: t('Book demo'), hint: st === 'lost' ? t('Try again when they are ready: book a free demo.') : t('Next step: book a free demo. Pentarch shows the owner the system.'), run: () => setSheet('demo') };

  const secondary = [
    next.key !== 'demo' && st !== 'won' && !lead.tenant_id && { icon: 'calendar', label: t('Book demo'), run: () => setSheet('demo') },
    next.key !== 'trial' && st !== 'won' && !lead.tenant_id && { icon: 'rocket', label: t('Start 30-day trial'), run: () => setSheet('trial') },
    { icon: 'share', label: t('Share demo link'), run: () => share('demo') },
    { icon: 'globe', label: t('Share website'), run: () => share('website') }
  ].filter(Boolean);

  const loc = lead.location;
  return (
    <Shell title={lead.business_name} back="/leads" actions={<button class="icon-btn" onClick={() => navigate(`/leads/${lead.id}/edit`)} aria-label={t('Edit')}><Icon name="edit" size={20} /></button>}>
      <section class="lhead">
        <div class="lhead__top">
          <div>
            <h2 class="lhead__name">{lead.business_name}</h2>
            <p class="lhead__sub">{[lead.contact_name, typeLabel(lead.business_type), lead.town].filter(Boolean).join(' · ')}</p>
          </div>
          <Stage s={lead.stage} />
        </div>
        {lead.phone && (
          <div class="quick">
            <a class="quick__b" href={'tel:+' + lead.phone} onClick={() => log('call')}><Icon name="phone" /><span>{t('Call')}</span></a>
            <a class="quick__b quick__b--wa" href={waLink(lead.phone, hello)} target="_blank" rel="noopener" onClick={() => log('whatsapp')}><Icon name="wa" /><span>{t('WhatsApp')}</span></a>
            <a class="quick__b" href={`sms:+${lead.phone}`} onClick={() => log('sms')}><Icon name="sms" /><span>{t('SMS')}</span></a>
            {loc && <a class="quick__b" href={`https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`} target="_blank" rel="noopener"><Icon name="pin" /><span>{t('Map')}</span></a>}
          </div>
        )}
        {lead.next_follow_up && !['won', 'lost'].includes(st) && (
          <p class={`lhead__follow${lead.next_follow_up <= todayISO() ? ' is-due' : ''}`}><Icon name="calendar" size={15} /> {t('Next follow-up')}: <strong>{followLabel(lead.next_follow_up)}{followLabel(lead.next_follow_up) !== shortDate(lead.next_follow_up) ? ' · ' + shortDate(lead.next_follow_up) : ''}</strong></p>
        )}
      </section>

      <div class="cols cols--detail">
        <div class="stackc">
          <section class="next">
            <p class="next__hint">{next.hint}</p>
            <button class={`action action--primary next__btn next__btn--${next.key}`} onClick={next.run} disabled={next.off}>
              <Icon name={next.icon} size={24} /><span><strong>{next.label}</strong></span><Icon name="arrow" size={20} class="next__arrow" />
            </button>
          </section>

          <section class="actions" aria-label={t('More actions')}>
            <button class="action action--visit" onClick={() => setSheet({ act: 'visit' })}><Icon name="walk" /><span><strong>{t('Log visit')}</strong></span></button>
            {secondary.map((x) => <button class="action" onClick={x.run}><Icon name={x.icon} /><span><strong>{x.label}</strong></span></button>)}
          </section>
          {lead.tenant_id && <p class="okline"><Icon name="check" size={16} stroke={2.4} /> {t('Trial account created')}</p>}

          <section class="card">
            <div class="card__h"><h3>{t('Stage')}</h3><span class="muted small">{t('Tap to move. You can undo.')}</span></div>
            <div class="stages" role="radiogroup" aria-label={t('Stage')}>
              {STAGES.map((s) => (
                <button role="radio" aria-checked={lead.stage === s} class={`stagebtn stagebtn--${s}${lead.stage === s ? ' is-on' : ''}`} onClick={() => changeStage(s)}>{stageLabel(s)}</button>
              ))}
            </div>
          </section>

          <section class="card">
            <div class="card__h"><h3>{t('Activity')}</h3></div>
            <div class="logbar">
              <button class="btn btn--ghost btn--sm" onClick={() => setSheet({ act: 'call' })}><Icon name="phone" size={17} /> {t('Log call')}</button>
              <button class="btn btn--ghost btn--sm" onClick={() => setSheet({ act: 'note' })}><Icon name="note" size={17} /> {t('Add note')}</button>
            </div>
            {acts.length === 0 ? <p class="muted pad">{t('No activity yet. After you visit or call, tap Log visit so you remember what was said.')}</p> : (
              <ol class="timeline">
                {acts.map((x) => (
                  <li class={`tl tl--${x.type}`}>
                    <span class="tl__i"><Icon name={ACT_ICON[x.type] || 'note'} size={15} /></span>
                    <div><strong>{actLabel(x.type)}</strong> <time>{dateTime(x.at)}</time>{x.note && <p>{x.note}</p>}</div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <section class="card">
          <div class="card__h"><h3>{t('Lead details')}</h3></div>
          <dl class="dl">
            <dt>{t('Contact person')}</dt><dd>{lead.contact_name || '—'}</dd>
            <dt>{t('Phone')}</dt><dd>{lead.phone ? <a href={'tel:+' + lead.phone}>{prettyPhone(lead.phone)}</a> : '—'}</dd>
            <dt>{t('Email')}</dt><dd>{lead.email || '—'}</dd>
            <dt>{t('Business type')}</dt><dd>{typeLabel(lead.business_type) || '—'}</dd>
            <dt>{t('Town / area')}</dt><dd>{lead.town || '—'}</dd>
            <dt>{t('Location')}</dt><dd>{loc ? <a href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`} target="_blank" rel="noopener">{t('Open map')}</a> : '—'}</dd>
            <dt>{t('Uses now')}</dt><dd>{({ paper: t('Paper book'), excel: t('Excel'), other_pos: t('Another POS') + (lead.current_system_other ? ` (${lead.current_system_other})` : ''), none: t('Nothing') })[lead.current_system] || '—'}</dd>
            <dt>{t('Branches')}</dt><dd>{lead.branches || 1}</dd>
            <dt>{t('Interested in')}</dt><dd>{({ bundle: t('Complete Till (with devices)'), software: t('Software only'), unsure: t('Not sure yet') })[lead.package_interest] || '—'}</dd>
            {lead.stage === 'lost' && <><dt>{t('Lost reason')}</dt><dd>{t(lead.lost_reason) || '—'}</dd></>}
            <dt>{t('Notes')}</dt><dd class="pre">{lead.notes || '—'}</dd>
          </dl>
          <div class="card__foot">
            <button class="btn btn--ghost btn--sm" onClick={() => navigate(`/leads/${lead.id}/edit`)}><Icon name="edit" size={16} /> {t('Edit')}</button>
            <button class="btn btn--danger btn--sm" onClick={remove}><Icon name="trash" size={16} /> {t('Delete')}</button>
          </div>
        </section>
      </div>

      {sheet && sheet.act && <ActivitySheet lead={lead} type={sheet.act} onClose={() => setSheet(null)} />}
      {sheet === 'demo' && <DemoSheet lead={lead} onClose={() => setSheet(null)} />}
      {sheet === 'trial' && <TrialSheet lead={lead} onClose={() => setSheet(null)} />}
    </Shell>
  );
}

function ActivitySheet({ lead, type, onClose }) {
  const [note, setNote] = useState('');
  const [follow, setFollow] = useState(lead.next_follow_up || '');
  async function save(e) {
    e.preventDefault();
    await addActivity(lead.id, type, note.trim());
    if (follow !== (lead.next_follow_up || '') || lead.stage === 'new') {
      await saveLead({ ...lead, next_follow_up: follow, stage: lead.stage === 'new' && type !== 'note' ? 'contacted' : lead.stage });
    }
    syncSoon();
    showToast(online.value ? t('Saved') : t('Saved on this phone — will send when you are back online'), online.value ? 'ok' : 'off');
    onClose();
  }
  const title = { visit: t('Log visit'), call: t('Log call'), note: t('Add note') }[type];
  return (
    <Sheet title={title} onClose={onClose}>
      <form class="stack" onSubmit={save}>
        <Field label={t('What happened?')} optional><textarea rows={3} value={note} onInput={(e) => setNote(e.target.value)} maxLength={2000} placeholder={type === 'note' ? t('e.g. Owner travels on Mondays') : t('e.g. Met the owner, showed the demo on my phone')} /></Field>
        <div class="field">
          <span class="field__label">{t('When will you follow up?')}</span>
          <div class="quickdates quickdates--form">
            {[1, 3, 7].map((d) => <button type="button" class={`chip${follow === todayISO(d) ? ' is-on' : ''}`} aria-pressed={follow === todayISO(d)} onClick={() => setFollow(todayISO(d))}>{d === 1 ? t('Tomorrow') : d === 3 ? '+3 ' + t('days') : t('In a week')}</button>)}
            <input type="date" class="datechip" value={follow} onInput={(e) => setFollow(e.target.value)} aria-label={t('Next follow-up')} />
          </div>
        </div>
        <button class="btn btn--primary btn--block">{t('Save activity')}</button>
      </form>
    </Sheet>
  );
}

function DemoSheet({ lead, onClose }) {
  const [date, setDate] = useState(todayISO(1));
  const [time, setTime] = useState('morning');
  const [msg, setMsg] = useState('');
  const [name, setName] = useState(lead.contact_name || '');
  const [nameErr, setNameErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function book(e) {
    e.preventDefault();
    if (name.trim().length < 2) { setNameErr(t('Who should Pentarch call? Enter a name.')); return; }
    setBusy(true);
    // Make sure the lead exists in the cloud before booking.
    await saveLead({ ...lead, contact_name: name.trim(), stage: ['new', 'contacted'].includes(lead.stage) ? 'demo_booked' : lead.stage, next_follow_up: date });
    await addActivity(lead.id, 'demo', `${shortDate(date)} · ${t(time === 'morning' ? 'Morning' : time === 'afternoon' ? 'Afternoon' : 'Late afternoon')}${msg ? ' — ' + msg : ''}`);
    await queueAction('demo_booking', { lead_id: lead.id, name: name.trim(), preferred_date: date, preferred_time: time, message: msg });
    if (online.value) {
      await syncNow();
    } else {
      showToast(t('Demo request saved. It will be sent when you are back online.'));
    }
    setBusy(false);
    onClose();
  }
  return (
    <Sheet title={t('Book demo')} onClose={onClose}>
      <form class="stack" onSubmit={book}>
        <p class="muted">{lead.business_name}{lead.phone ? ' · ' + prettyPhone(lead.phone) : ''}</p>
        <Field label={t('Who should Pentarch talk to?')} required error={nameErr}><input value={name} onInput={(e) => { setName(e.target.value); setNameErr(''); }} placeholder={t('Owner or manager name')} autocomplete="off" /></Field>
        <p class="hint"><Icon name="help" size={15} /> {t('Pentarch will call the owner to confirm the time. You earn the same commission when they buy.')}</p>
        <Field label={t('Preferred date')}><input type="date" value={date} min={todayISO()} onInput={(e) => setDate(e.target.value)} required /></Field>
        <div>
          <span class="field__label">{t('Preferred time')}</span>
          <div class="seg seg--full">
            {[['morning', 'Morning'], ['afternoon', 'Afternoon'], ['late_afternoon', 'Late afternoon']].map(([k, l]) => <button type="button" class={time === k ? 'is-on' : ''} aria-pressed={time === k} onClick={() => setTime(k)}>{t(l)}</button>)}
          </div>
        </div>
        <Field label={t('Message for Pentarch')} optional><textarea rows={3} value={msg} onInput={(e) => setMsg(e.target.value)} maxLength={1000} /></Field>
        <button class="btn btn--primary btn--block" disabled={busy}>{busy ? <span class="spinner" /> : t('Book the demo')}</button>
      </form>
    </Sheet>
  );
}

function TrialSheet({ lead, onClose }) {
  const [f, setF] = useState({ business_name: lead.business_name || '', owner_name: lead.contact_name || '', phone: prettyPhone(lead.phone), email: lead.email || '', business_type: lead.business_type || 'duka', town: lead.town || '', county: '', password: '' });
  const [errs, setErrs] = useState({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const set = (k) => (e) => { { const v = e.target.value; setF((c) => ({ ...c, [k]: v })); } setErrs((x) => (x[k] ? { ...x, [k]: undefined } : x)); };

  async function submit(e) {
    e.preventDefault();
    const x = {};
    if (f.business_name.trim().length < 2) x.business_name = t('Required');
    if (f.owner_name.trim().length < 2) x.owner_name = t('Required');
    if (!normPhone(f.phone)) x.phone = t('Enter a valid Kenyan phone number');
    if (!isEmail(f.email)) x.email = t('Enter a valid email');
    if (f.password && f.password.length < 6) x.password = t('At least 8 characters').replace('8', '6');
    setErrs(x); setErr('');
    if (Object.keys(x).length) return;
    if (!online.value) { setErr(t('You need internet to start a trial.')); return; }
    setBusy(true);
    try {
      // Ensure the lead is in the cloud first so it can be linked.
      await syncNow();
      const r = await api('POST', '/agents/trials', { ...f, phone: normPhone(f.phone), lead_id: lead.id, lang: lang.value, source: 'agent' });
      await saveLead({ ...lead, stage: 'trial', tenant_id: r.tenant_id, email: f.email, contact_name: f.owner_name });
      syncSoon();
      setDone(r);
    } catch (e2) {
      if (e2 instanceof ApiError && e2.data && e2.data.fields) setErrs(e2.data.fields);
      setErr(e2 instanceof ApiError && e2.message && e2.code !== 'network' && e2.code !== 'offline' ? e2.message : t('You need internet to start a trial.'));
    } finally { setBusy(false); }
  }

  if (done) {
    return (
      <Sheet title={t('Trial started')} onClose={onClose} footer={<button class="btn btn--ghost btn--block" onClick={onClose}>{t('Done')}</button>}>
        <div class="success">
          <div class="success__icon"><Icon name="check" size={28} stroke={2.6} /></div>
          <p class="success__h">{t('Send these details to the owner')}</p>
          <p class="muted small">{t('Tap Send on WhatsApp — the message is ready, just press send.')}</p>
        </div>
        <dl class="creds">
          <dt>{t('Business code')}</dt><dd><code>{done.business_code}</code></dd>
          <dt>{t('Link')}</dt><dd><a href={done.login.url} target="_blank" rel="noopener">{done.login.url.replace(/^https?:\/\//, '')}</a></dd>
          <dt>{t('Email')}</dt><dd>{done.login.email}</dd>
          <dt>{t('Password')}</dt><dd><code class="big">{done.login.password}</code></dd>
        </dl>
        <div class="stack">
          <a class="btn btn--wa btn--block" href={done.whatsapp_url} target="_blank" rel="noopener" onClick={() => addActivity(lead.id, 'whatsapp', t('Send on WhatsApp')).then(syncSoon)}><Icon name="wa" size={20} /> {t('Send on WhatsApp')}</a>
          <button class="btn btn--ghost btn--block" onClick={async () => { if (await copyText(done.whatsapp_message)) showToast(t('Copied')); }}><Icon name="copy" size={18} /> {t('Copy message')}</button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={t('Start 30-day trial')} onClose={onClose}>
      <form class="stack" onSubmit={submit} noValidate>
        <p class="hint"><Icon name="help" size={15} /> {t('Free for 30 days on their own computer. No payment now. We send the login to the owner.')}</p>
        <Field label={t('Business name')} required error={errs.business_name}><input value={f.business_name} onInput={set('business_name')} /></Field>
        <Field label={t("Owner's name")} required error={errs.owner_name}><input value={f.owner_name} onInput={set('owner_name')} /></Field>
        <div class="grid2 grid2--tight">
          <Field label={t('Phone')} required error={errs.phone}><input type="tel" inputMode="tel" value={f.phone} onInput={(e) => { { const v = formatPhoneTyping(e.target.value); setF((c) => ({ ...c, phone: v })); } setErrs((x) => (x.phone ? { ...x, phone: undefined } : x)); }} /></Field>
          <Field label={t("Owner's email")} required error={errs.email} hint={t('The owner signs in with this email')}><input type="email" inputMode="email" value={f.email} onInput={set('email')} placeholder="owner@gmail.com" /></Field>
          <Field label={t('Town')} optional><input value={f.town} onInput={set('town')} /></Field>
          <Field label={t('County')} optional><select value={f.county} onChange={set('county')}><option value="">{t('Choose…')}</option>{COUNTIES.map((c) => <option value={c}>{c}</option>)}</select></Field>
        </div>
        <details class="more more--sheet">
          <summary><span>{t('Password')}</span><em>{t('Optional')} · {t('we create one if you leave it blank')}</em><Icon name="chevron" size={18} /></summary>
          <Field label={t('Password (optional)')} hint={t('Leave blank to create one automatically')} error={errs.password}><input type="text" autocomplete="off" value={f.password} onInput={set('password')} /></Field>
        </details>
        {!online.value && <p class="form-err" role="alert">{t('You need internet to start a trial.')}</p>}
        {err && <p class="form-err" role="alert">{err}</p>}
        <button class="btn btn--primary btn--block" disabled={busy || !online.value}>{busy ? <span class="spinner" /> : t('Create trial account')}</button>
      </form>
    </Sheet>
  );
}
