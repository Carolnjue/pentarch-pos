import { useState, useEffect, useRef } from 'preact/hooks';
import { db, saveLead, addActivity } from '../db.js';
import { api } from '../api.js';
import { navigate, showToast, online, useLive } from '../store.js';
import { syncSoon } from '../sync.js';
import { t, STAGES, stageLabel, BUSINESS_TYPES, lang } from '../i18n.js';
import { normPhone, prettyPhone, isEmail, todayISO, formatPhoneTyping, intlPhone } from '../util.js';
import { Shell } from '../components/layout.jsx';
import { Field, Icon } from '../components/ui.jsx';

const EMPTY = { business_name: '', contact_name: '', phone: '', email: '', business_type: '', town: '', location: null, current_system: '', current_system_other: '', branches: 1, package_interest: 'unsure', stage: 'new', next_follow_up: '', notes: '', lost_reason: '' };

export function LeadForm({ id }) {
  const existing = useLive(() => (id ? db.leads.get(id) : Promise.resolve(null)), [id], undefined);
  const [f, setF] = useState(null);
  const [errs, setErrs] = useState({});
  const [dup, setDup] = useState(null);
  const [gps, setGps] = useState('');
  const [busy, setBusy] = useState(false);
  const checkTimer = useRef();

  useEffect(() => {
    if (existing === undefined) return;
    if (!f) setF(existing ? { ...EMPTY, ...existing, phone: prettyPhone(existing.phone) } : { ...EMPTY, next_follow_up: todayISO(1) });
  }, [existing]);

  // Duplicate warning by phone: local first, then the cloud (other agents / existing clients).
  useEffect(() => {
    if (!f) return;
    const p = normPhone(f.phone);
    clearTimeout(checkTimer.current);
    if (!p) { setDup(null); return; }
    checkTimer.current = setTimeout(async () => {
      const mine = await db.leads.where('phone').equals(p).filter((l) => !l.deleted && l.id !== id).first();
      if (mine) { setDup({ mine }); return; }
      if (online.value) {
        try {
          const r = await api('GET', `/agents/leads/check-phone?phone=${p}&exclude=${encodeURIComponent(id || '')}`);
          if (r.exists) { setDup({ other: r.other_agent, client: r.existing_client, mineRemote: r.mine }); return; }
        } catch { /* offline or error: local check only */ }
      }
      setDup(null);
    }, 450);
  }, [f && f.phone]);

  if (!f) return <Shell title={id ? t('Edit') : t('New lead')} back="/leads"><div /></Shell>;
  const set = (k) => (e) => { { const v = e.target.value; setF((c) => ({ ...c, [k]: v })); } setErrs((x) => (x[k] ? { ...x, [k]: undefined } : x)); };

  function captureGps() {
    if (!navigator.geolocation) { setGps(t('GPS is not available on this device.')); return; }
    setGps(t('Getting location…'));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setF((cur) => ({ ...cur, location: { lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6), accuracy: Math.round(pos.coords.accuracy), at: Date.now() } }));
        setGps('');
      },
      () => setGps(t('Allow location access to capture GPS.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }

  async function submit(e) {
    e.preventDefault();
    const x = {};
    if (f.business_name.trim().length < 2) x.business_name = t('Required');
    if (!normPhone(f.phone)) x.phone = t('Enter a valid Kenyan phone number, e.g. 0712 345 678');
    if (!id && !f.business_type) x.business_type = t('Choose the type of business');
    if (f.email && !isEmail(f.email)) x.email = t('Enter a valid email');
    setErrs(x);
    if (Object.keys(x).length) {
      if (x.email) { const d = document.querySelector('details.more'); if (d) d.open = true; }
      const el = document.querySelector('.field--err input, .field--err select');
      if (el) el.focus();
      return;
    }
    setBusy(true);
    const rec = {
      ...(existing || {}),
      ...f,
      business_name: f.business_name.trim(),
      contact_name: f.contact_name.trim(),
      phone: normPhone(f.phone),
      email: f.email.trim(),
      town: f.town.trim(),
      branches: Math.max(1, parseInt(f.branches, 10) || 1),
      lost_reason: f.stage === 'lost' ? f.lost_reason : ''
    };
    const saved = await saveLead(rec);
    if (existing && existing.stage !== saved.stage) await addActivity(saved.id, 'stage', `${stageLabel(existing.stage)} → ${stageLabel(saved.stage)}`);
    if (!existing) await addActivity(saved.id, 'note', lang.value === 'sw' ? 'Mteja ameongezwa' : 'Lead added');
    syncSoon();
    showToast(online.value ? t('Lead saved') : t('Saved on this phone — will send when you are back online'), online.value ? 'ok' : 'off');
    navigate('/leads/' + saved.id, true);
  }

  const systems = [['paper', t('Paper book')], ['excel', t('Excel')], ['other_pos', t('Another POS')], ['none', t('Nothing')]];
  const interests = [['bundle', t('Complete Till (with devices)')], ['software', t('Software only')], ['unsure', t('Not sure yet')]];
  const lost = ['Price too high', 'Using another system', 'Not interested now', 'Business closed', 'Other'];

  const follow = [[1, t('Tomorrow')], [3, t('In 3 days')], [7, t('In a week')]];
  const p = normPhone(f.phone);
  return (
    <Shell title={id ? t('Edit lead') : t('New lead')} back={id ? '/leads/' + id : '/leads'}>
      <form class="form-card" onSubmit={submit} noValidate>
        {!id && <p class="form-intro">{t('Just three things. You can add the rest later.')}</p>}
        <div class="grid2">
          <Field label={t('Business name')} required error={errs.business_name}><input value={f.business_name} onInput={set('business_name')} autocomplete="organization" maxLength={190} placeholder={t('e.g. Mama Njeri Shop')} enterKeyHint="next" /></Field>
          <Field label={t('Phone number')} required error={errs.phone} hint={p ? '✓ ' + t('Saved as') + ' ' + intlPhone(p) : t('Owner or manager. Start with 07 or 01.')}>
            <input type="tel" inputMode="tel" value={f.phone} onInput={(e) => { { const v = formatPhoneTyping(e.target.value); setF((c) => ({ ...c, phone: v })); } setErrs((x) => (x.phone ? { ...x, phone: undefined } : x)); }} placeholder="0712 345 678" autocomplete="tel" />
          </Field>
          {dup && (
            <div class="warn span2" role="alert">
              <Icon name="leads" size={18} />
              <span>
                {dup.mine ? t('This phone number is already in your leads') + ': ' + dup.mine.business_name
                  : dup.client ? t('This number is already a Pentarch POS client')
                    : dup.mineRemote ? t('This phone number is already in your leads') + ': ' + dup.mineRemote.business_name
                      : t('This business is already being followed up by another agent')}
                {dup.mine && <> · <a href={'/pos/agents/leads/' + dup.mine.id} onClick={(e) => { e.preventDefault(); navigate('/leads/' + dup.mine.id); }}>{t('Open it')}</a></>}
              </span>
            </div>
          )}
          <Field label={t('Type of business')} required error={errs.business_type}>
            <select value={f.business_type} onChange={set('business_type')}>
              <option value="">{t('Choose type…')}</option>
              {BUSINESS_TYPES.map(([k, en, sw]) => <option value={k}>{lang.value === 'sw' ? sw : en}</option>)}
            </select>
          </Field>
          <div class="field">
            <span class="field__label">{t('When will you follow up?')}</span>
            <div class="quickdates quickdates--form" role="radiogroup" aria-label={t('When will you follow up?')}>
              {follow.map(([d, l]) => <button type="button" role="radio" aria-checked={f.next_follow_up === todayISO(d)} class={`chip${f.next_follow_up === todayISO(d) ? ' is-on' : ''}`} onClick={() => setF({ ...f, next_follow_up: todayISO(d) })}>{l}</button>)}
              <input type="date" class="datechip" value={f.next_follow_up} onInput={set('next_follow_up')} min={todayISO(-30)} aria-label={t('Next follow-up')} />
            </div>
          </div>
        </div>

        <details class="more" open={!!id}>
          <summary><span>{t('More details')}</span><em>{t('Optional')} · {t('contact, town, GPS, notes')}</em><Icon name="chevron" size={18} /></summary>
          <div class="grid2">
            <Field label={t('Contact person')} optional><input value={f.contact_name} onInput={set('contact_name')} autocomplete="name" maxLength={190} placeholder={t('e.g. Mary Njeri')} /></Field>
            <Field label={t('Email')} error={errs.email} optional><input type="email" inputMode="email" value={f.email} onInput={set('email')} autocomplete="email" /></Field>
            <Field label={t('Town / area')} optional><input value={f.town} onInput={set('town')} placeholder="e.g. Kitengela, Rongai" maxLength={100} /></Field>

            <div class="gps">
              <span class="field__label">{t('Location')} <em>· {t('Optional')}</em></span>
              {f.location ? (
                <div class="gps__ok">
                  <Icon name="pin" size={18} />
                  <span>{t('Location saved')} · ±{f.location.accuracy} m</span>
                  <a href={`https://www.google.com/maps?q=${f.location.lat},${f.location.lng}`} target="_blank" rel="noopener">{t('Open')}</a>
                  <button type="button" class="link" onClick={() => setF({ ...f, location: null })}>{t('Remove')}</button>
                </div>
              ) : (
                <button type="button" class="btn btn--ghost" onClick={captureGps}><Icon name="pin" size={18} /> {t('Capture GPS location')}</button>
              )}
              <span class="field__hint">{gps || t('Stand at the shop and tap — helps you find it again.')}</span>
            </div>

            <Field label={t('What do they use now?')} optional>
              <select value={f.current_system} onChange={set('current_system')}>
                <option value="">{t('Choose…')}</option>
                {systems.map(([k, l]) => <option value={k}>{l}</option>)}
              </select>
            </Field>
            {f.current_system === 'other_pos' && (
              <Field label={t('Which POS?')} optional><input value={f.current_system_other} onInput={set('current_system_other')} placeholder="e.g. Uzapoint" /></Field>
            )}
            <Field label={t('Branches')} optional><input type="number" min="1" max="99" inputMode="numeric" value={f.branches} onInput={set('branches')} /></Field>

            <div class="span2">
              <span class="field__label">{t('Interested in')}</span>
              <div class="seg seg--full" role="radiogroup" aria-label={t('Interested in')}>
                {interests.map(([k, l]) => <button type="button" role="radio" aria-checked={f.package_interest === k} class={f.package_interest === k ? 'is-on' : ''} onClick={() => setF({ ...f, package_interest: k })}>{l}</button>)}
              </div>
            </div>

            <Field label={t('Stage')}>
              <select value={f.stage} onChange={set('stage')}>{STAGES.map((s) => <option value={s}>{stageLabel(s)}</option>)}</select>
            </Field>
            {f.stage === 'lost' && (
              <Field label={t('Why lost?')}>
                <select value={f.lost_reason} onChange={set('lost_reason')}><option value="">{t('Choose…')}</option>{lost.map((r) => <option value={r}>{t(r)}</option>)}</select>
              </Field>
            )}
            <div class="span2"><Field label={t('Notes')} optional><textarea rows={3} value={f.notes} onInput={set('notes')} maxLength={2000} placeholder={t('e.g. Busy shop near the stage. Owner keeps stock in a book.')} /></Field></div>
          </div>
        </details>

        <div class="form-actions">
          <button type="button" class="btn btn--ghost" onClick={() => history.back()}>{t('Cancel')}</button>
          <button class="btn btn--primary" disabled={busy}><Icon name="check" size={19} stroke={2.4} /> {id ? t('Save changes') : t('Save lead')}</button>
        </div>
      </form>
    </Shell>
  );
}
