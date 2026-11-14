import { db, saveLead, addActivity, dropUnsentActivity } from '../db.js';
import { session, navigate, useLive, useCache, showToast } from '../store.js';
import { syncSoon } from '../sync.js';
import { t, STAGES, stageLabel, lang } from '../i18n.js';
import { kes, todayISO, greeting, shareLink, waLink, shortDate } from '../util.js';
import { prices } from '../prices.js';
import { Shell } from '../components/layout.jsx';
import { Icon } from '../components/ui.jsx';

const go = (path) => (e) => { e.preventDefault(); navigate(path); };

export function Home() {
  const a = session.value.agent || {};
  const leads = useLive(() => db.leads.filter((l) => !l.deleted).toArray(), [], null);
  const stats = useCache('stats');
  const trials = useCache('trials') || [];
  const board = useCache('leaderboard');
  const cfg = useCache('config');
  const com = (stats && stats.commission) || { earned: 0, pending: 0, approved: 0, paid: 0 };
  const all = leads || [];

  const today = todayISO();
  const due = all
    .filter((l) => l.next_follow_up && l.next_follow_up <= today && !['won', 'lost'].includes(l.stage))
    .sort((x, y) => (x.next_follow_up < y.next_follow_up ? -1 : 1));
  const byStage = Object.fromEntries(STAGES.map((s) => [s, 0]));
  all.forEach((l) => { byStage[l.stage] = (byStage[l.stage] || 0) + 1; });
  const maxStage = Math.max(1, ...Object.values(byStage));
  const activeTrials = trials.filter((x) => x.status === 'trial');
  const ending = activeTrials.filter((x) => x.days_left <= 7).sort((x, y) => x.days_left - y.days_left);

  async function shareCode() {
    const r = await shareLink({ title: 'Pentarch POS', text: t('Live demo') + ' — Pentarch POS:', url: a.links ? a.links.demo : '' });
    if (r === 'copied') showToast(t('Copied'));
  }

  /** Tick a follow-up off: next one in 3 days, with Undo. */
  async function done(l) {
    const before = { next_follow_up: l.next_follow_up, stage: l.stage };
    const next = todayISO(3);
    const saved = await saveLead({ ...l, next_follow_up: next, stage: l.stage === 'new' ? 'contacted' : l.stage });
    const act = await addActivity(l.id, 'note', t('Followed up') + ' · ' + t('next') + ' ' + shortDate(next));
    syncSoon();
    showToast(`${t('Done')} — ${t('next follow-up')} ${shortDate(next)}`, 'ok', {
      label: t('Undo'),
      run: async () => {
        const cur = (await db.leads.get(l.id)) || saved;
        await saveLead({ ...cur, ...before });
        await dropUnsentActivity(act.id);
        syncSoon();
      }
    });
  }

  function trialMsg(x) {
    const p = prices((cfg && cfg.prices) || null);
    const pay = cfg && cfg.paybill ? (lang.value === 'sw' ? ` Lipa kwa M-Pesa Paybill ${cfg.paybill}, akaunti ${x.business_code}.` : ` Pay by M-Pesa Paybill ${cfg.paybill}, account ${x.business_code}.`) : '';
    const first = (x.owner_name || '').split(' ')[0];
    return lang.value === 'sw'
      ? `Habari ${first}, majaribio yako ya Pentarch POS yanaisha baada ya siku ${x.days_left}. Ili kuendelea ni KES ${p.software_monthly.toLocaleString('en-KE')} kwa mwezi au KES ${p.software_yearly.toLocaleString('en-KE')} kwa mwaka.${pay} Niko tayari kukusaidia.`
      : `Hello ${first}, your Pentarch POS free trial ends in ${x.days_left} days. To keep using it: KES ${p.software_monthly.toLocaleString('en-KE')} per month or KES ${p.software_yearly.toLocaleString('en-KE')} per year.${pay} I am happy to help.`;
  }

  const todayCount = due.length + ending.length;
  const dateStr = new Date().toLocaleDateString(lang.value === 'sw' ? 'sw-KE' : 'en-KE', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <Shell title={t('Home')}>
      <section class="hero">
        <div class="hero__l">
          <p class="hero__hi">{greeting()},</p>
          <h2 class="hero__name">{a.first_name || ''}</h2>
          <button class="codechip" onClick={shareCode} aria-label={t('Share your code')}>
            <span>{a.code}</span><Icon name="share" size={16} />
          </button>
        </div>
        <a class="hero__money" href="/pos/agents/commissions" onClick={go('/commissions')}>
          <span class="hero__label">{t('Earned')}</span>
          <strong class="hero__big num">{kes(com.earned)}</strong>
          <div class="hero__split">
            <span><i class="dot dot--sun" />{t('Pending')} <b class="num">{kes(com.pending + com.approved, false)}</b></span>
            <span><i class="dot dot--teal" />{t('Paid')} <b class="num">{kes(com.paid, false)}</b></span>
            <span class="hero__more">{t('See earnings')} <Icon name="chevron" size={14} /></span>
          </div>
        </a>
      </section>

      <div class="cols">
        <section class="card today" aria-labelledby="today-h">
          <div class="card__h">
            <div>
              <h3 id="today-h">{t('Today')}</h3>
              <span class="today__date">{dateStr}</span>
            </div>
            {todayCount > 0 && <span class="today__badge num">{todayCount} {t('to do')}</span>}
          </div>

          {leads === null ? null : all.length === 0 ? (
            <StartHere />
          ) : todayCount === 0 ? (
            <div class="today__clear">
              <span class="today__clear-i"><Icon name="check" size={22} stroke={2.4} /></span>
              <div>
                <strong>{t('All done for today')}</strong>
                <p>{t('Visit a new shop and add it as a lead.')}</p>
              </div>
            </div>
          ) : (
            <ul class="checklist">
              {due.map((l) => {
                const late = l.next_follow_up < today;
                return (
                  <li class="todo todo--call">
                    <button class="todo__tick" onClick={() => done(l)} aria-label={`${t('Mark done')}: ${l.business_name}`} title={t('Mark done')}><Icon name="check" size={18} stroke={2.6} /></button>
                    <a class="todo__main" href={'/pos/agents/leads/' + l.id} onClick={go('/leads/' + l.id)}>
                      <strong>{l.business_name}</strong>
                      <span>
                        <em class={late ? 'overdue' : 'due'}>{late ? t('Overdue') : l.stage === 'demo_booked' ? t('Demo today') : t('Call today')}</em>
                        {l.contact_name ? ' · ' + l.contact_name : ''}{l.town ? ' · ' + l.town : ''}
                      </span>
                    </a>
                    {l.phone && <a class="icon-btn icon-btn--wa" href={waLink(l.phone)} target="_blank" rel="noopener" aria-label={`${t('WhatsApp')} ${l.business_name}`}><Icon name="wa" size={21} /></a>}
                    {l.phone && <a class="icon-btn icon-btn--call" href={'tel:+' + l.phone} aria-label={`${t('Call')} ${l.business_name}`}><Icon name="phone" size={19} /></a>}
                  </li>
                );
              })}
              {ending.map((x) => (
                <li class="todo todo--trial">
                  <span class="todo__tick todo__tick--trial" aria-hidden="true"><Icon name="clock" size={18} /></span>
                  <a class="todo__main" href={x.lead_id ? '/pos/agents/leads/' + x.lead_id : '#'} onClick={(e) => { e.preventDefault(); if (x.lead_id) navigate('/leads/' + x.lead_id); }}>
                    <strong>{x.business_name}</strong>
                    <span><em class="due">{x.days_left <= 0 ? t('Trial ends today') : t('Trial ends in {n} days').replace('{n}', x.days_left)}</em> · {t('remind them to pay')}</span>
                  </a>
                  {x.phone && <a class="btn btn--wa btn--sm" href={waLink(x.phone, trialMsg(x))} target="_blank" rel="noopener"><Icon name="wa" size={17} /> {t('Remind')}</a>}
                </li>
              ))}
            </ul>
          )}
          {todayCount > 0 && <p class="hint"><Icon name="help" size={15} /> {t('Tap ✓ when you have followed up. We will remind you again in 3 days.')}</p>}
        </section>

        <section class="card">
          <div class="card__h"><h3>{t('Your leads by stage')}</h3><a class="link" href="/pos/agents/leads" onClick={go('/leads')}>{t('View all')}</a></div>
          {all.length === 0 ? (
            <p class="muted pad">{t('No leads yet — tap New lead after every shop you visit.')}</p>
          ) : (
            <ul class="pipe">
              {STAGES.map((s) => (
                <li>
                  <a href={'/pos/agents/leads?stage=' + s} onClick={go('/leads?stage=' + s)}>
                    <span class="pipe__l">{stageLabel(s)}</span>
                    <span class="pipe__bar"><i class={`bar--${s}`} style={{ width: `${Math.max(byStage[s] ? 6 : 0, (byStage[s] / maxStage) * 100)}%` }} /></span>
                    <span class="pipe__n num">{byStage[s]}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section class="card">
          <div class="card__h"><h3>{t('Clients on free trial')}</h3>{activeTrials.length > 0 && <span class="muted small">{activeTrials.length}</span>}</div>
          {activeTrials.length === 0 ? (
            <p class="muted pad">{t('No clients on trial yet. Open a lead and tap Start 30-day trial.')}</p>
          ) : (
            <ul class="rows">
              {activeTrials.slice(0, 5).map((x) => (
                <li class="row">
                  <a class="row__main" href={x.lead_id ? '/pos/agents/leads/' + x.lead_id : '#'} onClick={(e) => { e.preventDefault(); if (x.lead_id) navigate('/leads/' + x.lead_id); }}>
                    <strong>{x.business_name}</strong>
                    <span><code>{x.business_code}</code>{x.town ? ' · ' + x.town : ''}</span>
                  </a>
                  <span class={`days${x.days_left <= 7 ? ' days--warn' : ''}`}><b class="num">{x.days_left}</b> {t('days left')}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section class="card">
          <div class="card__h"><h3><Icon name="trophy" size={18} /> {t('Leaderboard')}</h3><span class="muted small">{t('This month')}</span></div>
          {!board || !board.items.length ? (
            <p class="muted pad">{t('Win clients this month to get on the board.')}</p>
          ) : (
            <ol class="board">
              {board.items.slice(0, 5).map((r) => (
                <li class={r.is_me ? 'is-me' : ''}>
                  <span class={`board__rank board__rank--${r.rank}`}>{r.rank}</span>
                  <span class="board__name">{r.name}{r.is_me && <em> ({t('you')})</em>}</span>
                  <span class="board__stat">{r.won} {stageLabel('won').toLowerCase()} · {r.trials} {t('Trials').toLowerCase()}</span>
                </li>
              ))}
              {board.me && board.me.rank > 5 && (
                <li class="is-me"><span class="board__rank">{board.me.rank}</span><span class="board__name">{board.me.name} <em>({t('you')})</em></span><span class="board__stat">{board.me.won} · {board.me.trials}</span></li>
              )}
            </ol>
          )}
        </section>
      </div>
    </Shell>
  );
}

/** Shown to a brand-new agent instead of an empty Today list. */
function StartHere() {
  const steps = [
    ['1', t('Visit a shop and tell them about Pentarch POS'), t('Show the live demo on your phone.')],
    ['2', t('Tap New lead and save the shop'), t('Business name, phone and type — that is all.')],
    ['3', t('Book a demo or start a free 30-day trial'), t('Open the lead and tap the big button.')]
  ];
  return (
    <div class="starthere">
      <p class="starthere__lead">{t('No leads yet — tap New lead after every shop you visit.')}</p>
      <ol class="steps">
        {steps.map(([n, h, p]) => <li><span class="steps__n">{n}</span><div><strong>{h}</strong><span>{p}</span></div></li>)}
      </ol>
      <button class="btn btn--primary btn--block" onClick={() => navigate('/leads/new')}><Icon name="plus" size={20} stroke={2.4} /> {t('Add your first lead')}</button>
    </div>
  );
}
