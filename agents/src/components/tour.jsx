import { useState, useEffect, useRef } from 'preact/hooks';
import { tourOpen, finishTour, navigate, useCache } from '../store.js';
import { commission } from '../prices.js';
import { t } from '../i18n.js';
import { Icon } from './ui.jsx';

// First-run tour: four short cards. Skippable; replay from More → "How to use the app".
const STEPS = [
  { icon: 'plus', tone: 'coral', title: 'Add every shop you visit', text: 'Tap New lead at the bottom. You only need the business name, phone number and type. It saves on your phone even without internet.' },
  { icon: 'check', tone: 'navy', title: 'Start each day on Home', text: 'The Today list shows who to call and which free trials are ending. Tap Call or WhatsApp, then tick it off.' },
  { icon: 'rocket', tone: 'sun', title: 'Book a demo, then a free trial', text: 'Open a lead and tap the big button. It always shows the next step: book a demo, start the 30-day free trial, or send WhatsApp.' },
  { icon: 'money', tone: 'teal', title: 'Get paid by M-Pesa', text: 'You earn {rate}% of what your clients pay for the software for 12 months, plus a bonus for every package they buy. See it all under Earnings.' }
];

export function Tour() {
  const [i, setI] = useState(0);
  const ref = useRef();
  const res = useCache('resources');
  const rate = commission(res && res.commission).software_rate;
  useEffect(() => { setI(0); }, [tourOpen.value]);
  useEffect(() => {
    if (!tourOpen.value) return;
    const b = ref.current && ref.current.querySelector('.tour__next');
    if (b) b.focus();
    const onKey = (e) => { if (e.key === 'Escape') finishTour(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tourOpen.value, i]);
  if (!tourOpen.value) return null;
  const s = STEPS[i];
  const last = i === STEPS.length - 1;
  return (
    <div class="tour-backdrop">
      <div class="tour" role="dialog" aria-modal="true" aria-labelledby="tour-h" ref={ref}>
        <div class="tour__top">
          <span class="tour__count">{i + 1} / {STEPS.length}</span>
          <button class="link tour__skip" onClick={finishTour}>{t('Skip')}</button>
        </div>
        <div class={`tour__art tour__art--${s.tone}`} aria-hidden="true"><Icon name={s.icon} size={40} stroke={2.2} /></div>
        <h2 id="tour-h">{t(s.title)}</h2>
        <p>{t(s.text).replace('{rate}', rate)}</p>
        <div class="tour__dots" aria-hidden="true">{STEPS.map((_, k) => <i class={k === i ? 'is-on' : ''} />)}</div>
        <div class="tour__btns">
          {i > 0 && <button class="btn btn--ghost" onClick={() => setI(i - 1)}>{t('Back')}</button>}
          <button class="btn btn--primary tour__next" onClick={() => { if (last) { finishTour(); navigate('/'); } else setI(i + 1); }}>
            {last ? t('Start selling') : t('Next')} {!last && <Icon name="arrow" size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
