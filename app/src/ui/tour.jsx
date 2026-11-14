// Interactive spotlight tour. Steps: [{sel, title, text}]. Shown once per user per tour id; replay with startTour(id, steps, {force:true}).
import { signal } from '@preact/signals';
import { useEffect, useLayoutEffect, useState } from 'preact/hooks';
import { Icon } from './icons.jsx';
import { t } from '../i18n/index.js';

const active = signal(null); // {id, steps, i}
const key = (id) => 'ppos.tour.' + id;
export const tourSeen = (id) => { try { return localStorage.getItem(key(id)) === 'done'; } catch { return true; } };
export function startTour(id, steps, { force } = {}) {
  if (!force && tourSeen(id)) return;
  active.value = { id, steps, i: 0 };
}
function finish() {
  try { localStorage.setItem(key(active.value.id), 'done'); } catch {}
  active.value = null;
}
export function TourHost() {
  const a = active.value;
  const [rect, setRect] = useState(null);
  const step = a?.steps[a.i];
  useLayoutEffect(() => {
    if (!step) return;
    const measure = () => {
      const el = document.querySelector(step.sel);
      if (!el || el.offsetParent === null) { setRect(null); return; }
      el.scrollIntoView?.({ block: 'nearest' });
      const r = el.getBoundingClientRect();
      setRect({ x: r.left - 6, y: r.top - 6, w: r.width + 12, h: r.height + 12 });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [a?.i, a?.id]);
  useEffect(() => {
    if (!a) return;
    const h = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); finish(); } else if (e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); next(); } };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  });
  if (!a || !step) return null;
  const next = () => (a.i + 1 >= a.steps.length ? finish() : (active.value = { ...a, i: a.i + 1 }));
  const vw = window.innerWidth, vh = window.innerHeight;
  const W = Math.min(340, vw - 24);
  let pos;
  if (!rect) pos = { left: (vw - W) / 2, top: vh / 2 - 90 };
  else {
    const below = rect.y + rect.h + 12, above = rect.y - 12;
    const left = Math.max(12, Math.min(vw - W - 12, rect.x + rect.w / 2 - W / 2));
    if (below + 180 < vh) pos = { left, top: below };
    else if (above > 200) pos = { left, top: above, transform: 'translateY(-100%)' };
    else pos = { left: Math.max(12, rect.x - W - 14), top: Math.max(12, Math.min(vh - 220, rect.y)) };
  }
  return (
    <div class="tour" role="dialog" aria-modal="true" aria-label={t('Quick tour')}>
      <svg class="tour-mask" width={vw} height={vh} aria-hidden="true">
        <defs><mask id="tm"><rect width={vw} height={vh} fill="#fff" />{rect && <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} rx="14" fill="#000" />}</mask></defs>
        <rect width={vw} height={vh} fill="rgba(10,21,48,.62)" mask="url(#tm)" />
        {rect && <rect class="tour-ring" x={rect.x} y={rect.y} width={rect.w} height={rect.h} rx="14" />}
      </svg>
      <div class="tour-card" style={{ ...pos, width: W + 'px' }}>
        <div class="row" style={{ marginBottom: '6px' }}><span class="badge navy">{t('Step {a} of {b}', { a: a.i + 1, b: a.steps.length })}</span><span class="spacer" /><button class="btn ghost xs" onClick={finish}>{t('Skip tour')}</button></div>
        <h3>{t(step.title)}</h3>
        <p style={{ margin: '6px 0 14px' }}>{t(step.text)}</p>
        <div class="row">
          {a.i > 0 && <button class="btn sm" onClick={() => (active.value = { ...a, i: a.i - 1 })}><Icon name="arrow-left" size={16} />{t('Back')}</button>}
          <span class="spacer" />
          <button class="btn primary sm" onClick={next} autoFocus>{a.i + 1 >= a.steps.length ? t('Start selling') : t('Next')}<Icon name={a.i + 1 >= a.steps.length ? 'check' : 'arrow-right'} size={16} /></button>
        </div>
      </div>
    </div>
  );
}

export const SELL_TOUR = [
  { sel: '.sell .search', title: 'Find or scan products', text: 'Point the barcode scanner at any item — it goes straight into the sale. No scanner? Type part of the name here.' },
  { sel: '.tiles', title: 'Or tap a product', text: 'Tap a picture to add it. The coloured tabs above show one group of products at a time.' },
  { sel: '.cart .lines', title: 'This is the sale', text: 'Tap an item to change how many, or to remove it. The total updates by itself.' },
  { sel: '.cart-actions', title: 'Hold sale, discount, change item', text: 'Serving someone else? Tap “Hold sale” and bring it back later with “Held sales”.' },
  { sel: '.pay-btn', title: 'Take payment', text: 'Tap “Pay”, choose Cash or M-Pesa, and the receipt is ready. That is all!' }
];
