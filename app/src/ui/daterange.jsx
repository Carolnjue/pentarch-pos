// Date-range picker with presets. value: {preset, from, to} (ms; `to` exclusive)
import { t } from '../i18n/index.js';
import { startOfDay, DAY, dayKey } from '../lib/util.js';

export function rangeFor(preset, now = Date.now()) {
  const today = startOfDay(now);
  const d = new Date(today);
  switch (preset) {
    case 'today': return { from: today, to: today + DAY };
    case 'yesterday': return { from: today - DAY, to: today };
    case 'week': { const dow = (d.getDay() + 6) % 7; return { from: today - dow * DAY, to: today + DAY }; }
    case 'last7': return { from: today - 6 * DAY, to: today + DAY };
    case 'month': return { from: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), to: today + DAY };
    case 'lastmonth': return { from: new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(), to: new Date(d.getFullYear(), d.getMonth(), 1).getTime() };
    case 'last30': return { from: today - 29 * DAY, to: today + DAY };
    default: return { from: today, to: today + DAY };
  }
}
export const PRESETS = () => [
  { value: 'today', label: t('Today') }, { value: 'yesterday', label: t('Yesterday') }, { value: 'week', label: t('This week') },
  { value: 'month', label: t('This month') }, { value: 'lastmonth', label: t('Last month') }, { value: 'custom', label: t('Custom') }
];
export function DateRange({ value, onValue }) {
  const v = value || { preset: 'today', ...rangeFor('today') };
  const set = (preset) => onValue(preset === 'custom' ? { ...v, preset } : { preset, ...rangeFor(preset) });
  return (
    <div class="row wrap gap-s">
      <div class="seg">{PRESETS().map((p) => <button type="button" class={v.preset === p.value ? 'on' : ''} onClick={() => set(p.value)}>{p.label}</button>)}</div>
      {v.preset === 'custom' && (
        <div class="row gap-s">
          <input class="input" type="date" style={{ width: '160px' }} value={dayKey(v.from)} aria-label={t('From')} onChange={(e) => onValue({ ...v, from: new Date(e.target.value + 'T00:00').getTime() })} />
          <span class="mute">–</span>
          <input class="input" type="date" style={{ width: '160px' }} value={dayKey(v.to - 1)} aria-label={t('To')} onChange={(e) => onValue({ ...v, to: new Date(e.target.value + 'T00:00').getTime() + DAY })} />
        </div>
      )}
    </div>
  );
}
