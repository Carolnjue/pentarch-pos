// Keyboard-wedge barcode scanner detection: ≥4 chars, each within 50 ms, ending with Enter (or Tab).
// Emits bus 'scan' (code). If the burst landed in a text field, the typed characters are removed again.
import { emit } from './bus.js';

const GAP = 50, MIN = 4; // SPEC: ≥4 chars, each within 50 ms (measured with the event's own timestamp)
let buf = '', last = 0, target = null, before = null, started = false;

export function startScanner() {
  if (started) return; started = true;
  window.addEventListener('keydown', (e) => {
    const now = e.timeStamp || performance.now();
    if (e.ctrlKey || e.metaKey || e.altKey) { buf = ''; return; }
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (buf.length >= MIN && now - last < GAP * 2) {
        const code = buf;
        const el = target;
        buf = '';
        // fields that want raw scans opt out of stripping: data-scan="keep" (Sell search box; still emits 'scan')
        // or data-scan="own" (the field handles its own Enter, e.g. stock product finders and serial boxes; no 'scan' event)
        if (el && 'value' in el && before !== null && el.dataset?.scan !== 'keep' && el.dataset?.scan !== 'own') {
          el.value = before;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (!(el?.dataset?.scan === 'keep' || el?.dataset?.scan === 'own')) { e.preventDefault(); e.stopPropagation(); }
        else e._ppScan = code; // field handlers can tell this Enter ended a scan
        if (el?.dataset?.scan !== 'own') emit('scan', code, { target: el });
        return;
      }
      buf = '';
      return;
    }
    if (e.key.length !== 1) return;
    if (now - last > GAP || !buf) {
      buf = '';
      target = e.target;
      before = 'value' in (e.target || {}) ? e.target.value : null;
    }
    buf += e.key;
    last = now;
  }, true);
}

/** Simulate a scan (testing / camera scanning). */
export const injectScan = (code) => emit('scan', code, { target: null });
