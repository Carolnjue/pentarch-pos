import { useState, useEffect } from 'preact/hooks';
import { db } from '../db.js';
import { navigate, useLive, query } from '../store.js';
import { t, STAGES, stageLabel, typeLabel } from '../i18n.js';
import { todayISO, followLabel, prettyPhone, waLink } from '../util.js';
import { Shell } from '../components/layout.jsx';
import { Icon, Stage, Empty } from '../components/ui.jsx';

export function Leads() {
  const q = new URLSearchParams(query.value);
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState(q.get('stage') || '');
  const [dueOnly, setDueOnly] = useState(q.get('due') === '1');
  useEffect(() => { setStage(q.get('stage') || ''); setDueOnly(q.get('due') === '1'); }, [query.value]);

  const leads = useLive(() => db.leads.orderBy('updated_at').reverse().filter((l) => !l.deleted).toArray(), [], null);
  const today = todayISO();
  const all = leads || [];
  const counts = Object.fromEntries(STAGES.map((s) => [s, 0]));
  all.forEach((l) => { counts[l.stage] = (counts[l.stage] || 0) + 1; });
  const dueCount = all.filter((l) => l.next_follow_up && l.next_follow_up <= today && !['won', 'lost'].includes(l.stage)).length;

  const needle = search.trim().toLowerCase();
  const digits = needle.replace(/\D+/g, '');
  const list = all.filter((l) => {
    if (stage && l.stage !== stage) return false;
    if (dueOnly && !(l.next_follow_up && l.next_follow_up <= today && !['won', 'lost'].includes(l.stage))) return false;
    if (!needle) return true;
    const hay = `${l.business_name || ''} ${l.contact_name || ''} ${l.town || ''} ${typeLabel(l.business_type)}`.toLowerCase();
    return hay.includes(needle) || (digits.length >= 3 && (l.phone || '').includes(digits.replace(/^0/, '')));
  });
  if (dueOnly) list.sort((a, b) => (a.next_follow_up < b.next_follow_up ? -1 : 1));

  const chip = (value, label, n) => (
    <button class={`chip${stage === value && !dueOnly ? ' is-on' : ''}`} onClick={() => { setDueOnly(false); setStage(value); }} aria-pressed={stage === value && !dueOnly}>
      {label}<span class="chip__n">{n}</span>
    </button>
  );

  return (
    <Shell title={t('Leads')} actions={<button class="btn btn--primary btn--sm hide-sm" onClick={() => navigate('/leads/new')}><Icon name="plus" size={18} /> {t('New lead')}</button>}>
      <div class="searchbar">
        <Icon name="search" size={19} />
        <input type="search" placeholder={t('Search by name, phone or town')} value={search} onInput={(e) => setSearch(e.target.value)} aria-label={t('Search leads')} />
      </div>
      <div class="chips" role="toolbar" aria-label={t('Stage')}>
        <button class={`chip chip--due${dueOnly ? ' is-on' : ''}`} onClick={() => { setStage(''); setDueOnly(!dueOnly); }} aria-pressed={dueOnly}><Icon name="calendar" size={15} /> {t('Due')}<span class="chip__n">{dueCount}</span></button>
        {chip('', t('All'), all.length)}
        {STAGES.map((s) => chip(s, stageLabel(s), counts[s]))}
      </div>

      {leads === null ? null : all.length === 0 ? (
        <Empty icon="leads" title={t('No leads yet')} text={t('No leads yet — tap New lead after every shop you visit.')} action={<button class="btn btn--primary" onClick={() => navigate('/leads/new')}><Icon name="plus" size={18} /> {t('New lead')}</button>} />
      ) : list.length === 0 ? (
        <Empty icon="search" title={t('No leads match')} text={dueOnly ? t('Nobody to follow up today. Well done!') : t('Try another name or phone number, or tap All.')} action={<button class="btn btn--ghost" onClick={() => { setSearch(''); setStage(''); setDueOnly(false); }}>{t('Show all leads')}</button>} />
      ) : (
        <ul class="leadlist">
          {list.map((l) => {
            const due = l.next_follow_up && l.next_follow_up <= today && !['won', 'lost'].includes(l.stage);
            return (
              <li class="lead">
                <a class="lead__main" href={'/pos/agents/leads/' + l.id} onClick={(e) => { e.preventDefault(); navigate('/leads/' + l.id); }}>
                  <span class="lead__avatar" aria-hidden="true">{(l.business_name || '?').trim()[0]}</span>
                  <span class="lead__txt">
                    <strong>{l.business_name}</strong>
                    <span>{[l.contact_name, l.town, typeLabel(l.business_type)].filter(Boolean).join(' · ')}</span>
                    <span class="lead__meta">
                      <Stage s={l.stage} small />
                      {l.next_follow_up && !['won', 'lost'].includes(l.stage) && <em class={due ? (l.next_follow_up < today ? 'overdue' : 'due') : 'later'}><Icon name="calendar" size={13} /> {followLabel(l.next_follow_up)}</em>}
                    </span>
                  </span>
                </a>
                {l.phone && (
                  <span class="lead__acts">
                    <a class="icon-btn icon-btn--wa" href={waLink(l.phone)} target="_blank" rel="noopener" aria-label={`${t('WhatsApp')} ${prettyPhone(l.phone)}`}><Icon name="wa" size={20} /></a>
                    <a class="icon-btn" href={'tel:+' + l.phone} aria-label={`${t('Call')} ${prettyPhone(l.phone)}`}><Icon name="phone" size={19} /></a>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Shell>
  );
}
