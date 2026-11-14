// Short UI sounds via WebAudio (no files). beep('scan' | 'error' | 'done')
let ctx;
export function beep(kind = 'scan') {
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    const now = ctx.currentTime;
    const f = { scan: [1760, 0.07], error: [220, 0.22], done: [1046, 0.12] }[kind] || [880, 0.08];
    o.type = kind === 'error' ? 'square' : 'sine';
    o.frequency.setValueAtTime(f[0], now);
    if (kind === 'done') o.frequency.setValueAtTime(1568, now + 0.07);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(kind === 'error' ? 0.08 : 0.15, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + f[1] + (kind === 'done' ? 0.08 : 0));
    o.connect(g).connect(ctx.destination);
    o.start(now); o.stop(now + f[1] + 0.1);
  } catch { /* audio not available */ }
}
