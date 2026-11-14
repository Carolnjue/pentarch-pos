// Responsive chart primitives for the dashboard and reports. Measured width (no stretched text), tabular numbers,
// readable at a glance. Pure SVG/HTML, no dependencies.
import { useEffect, useRef, useState } from 'preact/hooks';

export const C = { navy: '#1F3C7A', teal: '#14B1AC', tealD: '#0A7F7B', coral: '#EE4B3B', sun: '#F6B22C', ink: '#182A55', plum: '#5b3a8c', mute: '#646E82', mpesa: '#3BA935' };
export const SERIES = [C.navy, C.teal, C.coral, C.sun, C.plum, C.tealD, C.mute, '#8a6d3b', '#2f7dd1', '#c25b8f'];
export const METHOD_COLORS = { mpesa: C.mpesa, cash: C.sun, card: C.navy, credit: C.coral, bank: C.ink, points: C.plum, voucher: C.tealD };

export const short = (v) => { const a = Math.abs(v); return a >= 1e6 ? (v / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M' : a >= 1e3 ? (v / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(Math.round(v)); };
const nice = (v) => { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; };

function useWidth(init = 600) {
  const ref = useRef();
  const [w, setW] = useState(init);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(160, el.clientWidth)));
    ro.observe(el); setW(Math.max(160, el.clientWidth));
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/**
 * Vertical bars. data: [{label, value, color?, title?}]; values in KES (not cents).
 * line: optional second series drawn as a line (e.g. profit) [{value}]; onPick(i) makes bars clickable.
 */
export function Bars({ data, height = 200, color = C.navy, format = short, highlight, line, lineColor = C.coral, lineDash, onPick, showValues, ariaLabel }) {
  const [ref, W] = useWidth();
  const H = height, pl = 42, pb = 24, pt = showValues ? 18 : 10, pr = 6;
  const vals = data.map((d) => d.value).concat(line ? line.map((d) => d.value) : []);
  const max = nice(Math.max(...vals, 0));
  const n = Math.max(1, data.length);
  const bw = (W - pl - pr) / n;
  const y = (v) => pt + (H - pt - pb) * (1 - Math.max(0, v) / max);
  const every = Math.ceil(n / Math.max(2, Math.floor((W - pl) / 34)));
  const vals2 = showValues ?? (n <= 12 && W / n > 44);
  return (
    <div ref={ref} class="viz">
      <svg class="chart" width={W} height={H} role="img" aria-label={ariaLabel}>
        <g class="grid">{[0, 0.25, 0.5, 0.75, 1].map((f) => <g><line x1={pl} x2={W - pr} y1={y(max * f)} y2={y(max * f)} /><text x={pl - 6} y={y(max * f) + 4} text-anchor="end">{format(max * f)}</text></g>)}</g>
        {data.map((d, i) => {
          const h = Math.max(d.value > 0 ? 2 : 0, H - pb - y(d.value));
          const x = pl + i * bw + bw * 0.16;
          return (
            <g class={onPick ? 'pick' : ''} onClick={onPick && (() => onPick(i))}>
              {onPick && <rect x={pl + i * bw} y={pt} width={bw} height={H - pt - pb} fill="transparent" />}
              <rect x={x} y={H - pb - h} width={Math.max(1, bw * 0.68)} height={h} rx={Math.min(4, bw * 0.2)} fill={d.color || (highlight === i ? C.coral : color)}><title>{d.title || d.label + ': ' + format(d.value)}</title></rect>
              {vals2 && d.value > 0 && <text class="val" x={x + bw * 0.34} y={H - pb - h - 5} text-anchor="middle">{format(d.value)}</text>}
              {i % every === 0 && <text x={pl + i * bw + bw / 2} y={H - 7} text-anchor="middle">{d.label}</text>}
            </g>
          );
        })}
        {line && line.length > 1 && <polyline points={line.map((d, i) => `${(pl + i * bw + bw / 2).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ')} fill="none" stroke={lineColor} stroke-width={lineDash ? 2 : 2.5} stroke-dasharray={lineDash || null} stroke-linejoin="round" stroke-linecap="round" />}
        {line && line.length > 1 && !lineDash && line.map((d, i) => <circle cx={pl + i * bw + bw / 2} cy={y(d.value)} r={n > 40 ? 0 : 3} fill="#fff" stroke={lineColor} stroke-width="2" />)}
      </svg>
    </div>
  );
}

/** Horizontal bar list (best for ranked names). rows: [{label, value, color?, right?, sub?}]; stack: label above the bar (narrow cards). */
export function HBars({ rows, format = short, color = C.navy, onPick, max: mx, stack }) {
  const max = mx || Math.max(...rows.map((r) => r.value), 1);
  return (
    <div class={'hbars' + (stack ? ' stack' : '')}>
      {rows.map((r, i) => (
        <div class={'hb' + (onPick ? ' click' : '')} onClick={onPick && (() => onPick(r, i))} onKeyDown={onPick && ((e) => e.key === 'Enter' && onPick(r, i))} role={onPick ? 'button' : null} tabIndex={onPick ? 0 : null}>
          <div class="hb-l"><span class="ellipsis">{r.label}</span>{r.sub && <small class="mute">{r.sub}</small>}</div>
          <div class="hb-bar"><i style={{ width: Math.max(0.5, (Math.max(0, r.value) / max) * 100) + '%', background: r.color || color }} /></div>
          <b class="mono hb-v">{r.right ?? format(r.value)}</b>
        </div>
      ))}
    </div>
  );
}

/** Heatmap grid. grid[r][c] values; colour intensity teal. */
export function Heat({ grid, rowLabels, colLabels, format = short, title }) {
  const max = Math.max(1, ...grid.flat());
  const cols = colLabels.length;
  return (
    <div class="heat" style={{ gridTemplateColumns: `44px repeat(${cols}, minmax(0, 1fr))` }} role="table" aria-label={title}>
      <span />
      {colLabels.map((c, i) => <span class="hx">{i % 2 === 0 ? c : ''}</span>)}
      {grid.map((row, r) => [
        <span class="hy">{rowLabels[r]}</span>,
        ...row.map((v, c) => { const a = v / max; return <i title={`${rowLabels[r]} ${colLabels[c]}:00 — ${format(v)}`} style={{ background: v ? `rgba(10,127,123,${(0.1 + a * 0.9).toFixed(3)})` : '#f3f1ec' }} />; })
      ])}
    </div>
  );
}

/** Stacked horizontal proportion bar. parts: [{label, value, color}] */
export function Stack({ parts, height = 14 }) {
  const tot = parts.reduce((a, p) => a + Math.max(0, p.value), 0) || 1;
  return (
    <div class="stackbar" style={{ height: height + 'px' }}>
      {parts.map((p) => p.value > 0 && <i style={{ width: (p.value / tot) * 100 + '%', background: p.color }} title={p.label} />)}
    </div>
  );
}
