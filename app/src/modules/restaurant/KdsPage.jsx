// Kitchen display (KDS): open tickets per station with timers; tap Done to bump, recall from the Done list.
// Works on this device and on a second device (tablet / TV in the kitchen) through sync.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Btn, Icon, Badge, Empty } from '../../ui/kit.jsx';
import { toast } from '../../ui/overlay.jsx';
import { db } from '../../db/index.js';
import { on } from '../../lib/bus.js';
import { beep } from '../../lib/sound.js';
import { syncNow } from '../../sync/client.js';
import * as S from '../../state.js';
import { t, tn } from '../../i18n/index.js';
import { setTicketStatus, stationLabel, firstName, here } from './logic.js';
import './restaurant.css';

const LS = 'ppos.kds.station';
// "4 min" / "1h 05" — never looks like a clock time
const ago = (ms) => { const m = Math.max(0, Math.floor((Date.now() - ms) / 60000)); return m < 1 ? t('now') : m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}`; };

export default function KdsPage() {
  const [rows, setRows] = useState(null);
  const [station, setStation] = useState(() => { try { return localStorage.getItem(LS) || 'all'; } catch { return 'all'; } });
  const [view, setView] = useState('open');
  const [, tick] = useState(0);
  const seen = useRef(null);
  const load = async () => {
    const since = Date.now() - 6 * 3600e3;
    const list = (await db().kitchen_tickets.where('updated_at').above(since - 12 * 3600e3).toArray()).filter((x) => here(x));
    const open = list.filter((x) => x.status === 'new');
    if (seen.current && open.some((x) => !seen.current.has(x.id))) { try { beep('scan'); } catch {} }
    seen.current = new Set(open.map((x) => x.id));
    setRows(list);
  };
  useEffect(() => {
    load();
    const off = on('change', (e) => e === 'kitchen_tickets' && load());
    const iv = setInterval(() => tick((x) => x + 1), 10000);
    // a kitchen screen should pick up new tickets quickly and never lock itself
    const sy = setInterval(() => { if (!S.isDemo.value) syncNow('kds'); window.dispatchEvent(new Event('wheel')); }, 8000);
    let lock = null;
    try { navigator.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {}); } catch {}
    if (!S.isDemo.value) syncNow('kds');
    return () => { off(); clearInterval(iv); clearInterval(sy); try { lock?.release(); } catch {} };
  }, [S.branch.value?.id]);
  const stations = useMemo(() => [...new Set([...(S.settings.value.kitchen_stations || ['kitchen', 'bar']), ...(rows || []).map((x) => x.station).filter(Boolean)])], [rows]);
  if (!rows) return <div class="page" />;
  const pickSt = (s) => { setStation(s); try { localStorage.setItem(LS, s); } catch {} };
  const inSt = (x) => station === 'all' || x.station === station;
  const open = rows.filter((x) => x.status === 'new' && inSt(x)).sort((a, b) => (a.sent_at || a.created_at) - (b.sent_at || b.created_at));
  const done = rows.filter((x) => x.status === 'done' && inSt(x) && (x.bumped_at || 0) > Date.now() - 3 * 3600e3).sort((a, b) => (b.bumped_at || 0) - (a.bumped_at || 0)).slice(0, 40);
  const shown = view === 'open' ? open : done;
  const bump = async (tk) => { await setTicketStatus(tk, 'done'); if (!S.isDemo.value) syncNow('bump'); toast(t('{where} done', { where: tk.table_name || '#' + tk.order_no }), { icon: 'check-circle', action: { label: t('Undo'), fn: () => setTicketStatus({ ...tk, status: 'done' }, 'new') } }); };
  const recall = async (tk) => { await setTicketStatus(tk, 'new'); if (!S.isDemo.value) syncNow('recall'); setView('open'); };
  const full = () => { try { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); } catch {} };
  return (
    <div class="kds">
      <div class="kds-top">
        <h1 class="grow"><Icon name="monitor" size={22} /> {t('Kitchen display')}</h1>
        <div class="seg" role="tablist" aria-label={t('Station')}>
          <button role="tab" aria-selected={station === 'all'} class={station === 'all' ? 'on' : ''} onClick={() => pickSt('all')}>{t('All stations')}</button>
          {stations.map((s) => <button role="tab" aria-selected={station === s} class={station === s ? 'on' : ''} onClick={() => pickSt(s)}>{stationLabel(s)} <span class="mono small">{rows.filter((x) => x.status === 'new' && x.station === s).length}</span></button>)}
        </div>
        <div class="seg">
          <button class={view === 'open' ? 'on' : ''} onClick={() => setView('open')}>{t('To prepare')} <b class="mono">{open.length}</b></button>
          <button class={view === 'done' ? 'on' : ''} onClick={() => setView('done')}>{t('Done')}</button>
        </div>
        <Btn size="sm" icon="external" onClick={full} aria-label={t('Full screen')}>{t('Full screen')}</Btn>
      </div>
      {!shown.length ? (
        <div class="kds-empty"><Empty icon={view === 'open' ? 'check-circle' : 'history'} title={view === 'open' ? t('All caught up') : t('Nothing done yet')} text={view === 'open' ? t('New orders appear here as soon as a waiter taps Send to kitchen.') : t('Tickets you mark Done show here for 3 hours so you can recall them.')} /></div>
      ) : (
        <div class="kds-grid">
          {shown.map((tk) => {
            const mins = ((Date.now() - (tk.sent_at || tk.created_at)) / 60000);
            const tone = tk.kind === 'void' ? 'void' : view === 'done' ? 'done' : mins >= 20 ? 'late' : mins >= 10 ? 'warn' : 'ok';
            return (
              <div class={'kt kt-' + tone}>
                <div class="kt-h">
                  <div class="grow ellipsis"><b class="kt-where">{tk.table_name || (tk.order_type === 'delivery' ? t('Delivery') : t('Takeaway'))}</b>
                    <div class="kt-sub">#{tk.order_no}{tk.customer_name && !tk.table_name ? ' · ' + tk.customer_name : ''}{tk.waiter_name ? ' · ' + firstName(tk.waiter_name) : ''}{tk.round > 1 ? ' · ' + t('Round {n}', { n: tk.round }) : ''}</div></div>
                  <div class="kt-time mono">{view === 'done' ? ago(tk.bumped_at || tk.updated_at) : ago(tk.sent_at || tk.created_at)}</div>
                </div>
                {tk.kind === 'void' && <div class="kt-vbar">{t('VOID — stop, do not prepare')}</div>}
                <div class="kt-b">
                  {tk.lines.map((l) => (
                    <div class={'kt-l' + (tk.kind === 'void' ? ' x' : '')}>
                      <span class="kt-q mono">{l.qty}×</span>
                      <div class="grow"><b>{l.name}</b>{(l.modifiers || []).map((m) => <div class="kt-m">+ {m}</div>)}{l.note && <div class="kt-n">{tk.kind === 'void' ? t('Reason') + ': ' : ''}{l.note}</div>}</div>
                    </div>
                  ))}
                </div>
                <div class="kt-f">
                  <Badge tone={tk.station === 'bar' ? 'navy' : ''}>{stationLabel(tk.station)}</Badge>
                  <span class="spacer" />
                  {view === 'open'
                    ? <Btn variant={tk.kind === 'void' ? 'primary' : 'ok'} size="lg" icon="check" onClick={() => bump(tk)}>{tk.kind === 'void' ? t('Seen') : t('Done')}</Btn>
                    : <Btn icon="undo" onClick={() => recall(tk)}>{t('Recall')}</Btn>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div class="kds-foot small mute">{tn(open.length, '{n} ticket waiting', '{n} tickets waiting')} · {S.online.value ? t('Live — updates every few seconds') : t('Offline — showing tickets from this device')}</div>
    </div>
  );
}
