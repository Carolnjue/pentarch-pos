// SVG chart primitives — no dependencies. All values are plain numbers.
const PALETTE = ['#1F3C7A', '#14B1AC', '#EE4B3B', '#F6B22C', '#5b3a8c', '#0A7F7B', '#646E82'];
export const chartColors = PALETTE;

export function Sparkline({ data, width = 120, height = 36, color = '#14B1AC', fill = true }) {
  if (!data?.length) return null;
  const max = Math.max(...data, 1), min = Math.min(...data, 0);
  const sx = width / Math.max(1, data.length - 1);
  const y = (v) => height - 3 - ((v - min) / (max - min || 1)) * (height - 6);
  const pts = data.map((v, i) => `${(i * sx).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {fill && <polygon points={`0,${height} ${pts} ${width},${height}`} fill={color} opacity=".12" />}
      <polyline points={pts} fill="none" stroke={color} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
    </svg>
  );
}

const nice = (v) => { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };
const short = (v) => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'k' : String(Math.round(v)));

/** Vertical bar chart. data: [{label, value, color?}] */
export function BarChart({ data, height = 200, color = '#1F3C7A', format = short, highlight }) {
  const W = 640, H = height, pl = 40, pb = 24, pt = 10;
  const max = nice(Math.max(...data.map((d) => d.value), 0));
  const bw = (W - pl) / Math.max(1, data.length);
  const y = (v) => pt + (H - pt - pb) * (1 - v / max);
  const every = Math.ceil(data.length / 12);
  return (
    <svg class="chart" viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img">
      <g class="grid">{[0, 0.25, 0.5, 0.75, 1].map((f) => <g><line x1={pl} x2={W} y1={y(max * f)} y2={y(max * f)} /><text x={pl - 6} y={y(max * f) + 4} text-anchor="end">{format(max * f)}</text></g>)}</g>
      {data.map((d, i) => {
        const h = H - pb - y(d.value);
        return (
          <g>
            <rect x={pl + i * bw + bw * 0.18} y={y(d.value)} width={bw * 0.64} height={Math.max(0, h)} rx="3" fill={d.color || (highlight === i ? '#EE4B3B' : color)}><title>{d.label}: {format(d.value)}</title></rect>
            {i % every === 0 && <text x={pl + i * bw + bw / 2} y={H - 6} text-anchor="middle">{d.label}</text>}
          </g>
        );
      })}
    </svg>
  );
}

/** Multi-series line chart. series: [{name, color, values:[]}], labels: [] */
export function LineChart({ series, labels, height = 220, format = short }) {
  const W = 640, H = height, pl = 40, pb = 24, pt = 10, pr = 8;
  const all = series.flatMap((s) => s.values);
  const max = nice(Math.max(...all, 0));
  const n = Math.max(1, labels.length - 1);
  const x = (i) => pl + ((W - pl - pr) * i) / n;
  const y = (v) => pt + (H - pt - pb) * (1 - v / max);
  const every = Math.ceil(labels.length / 10);
  return (
    <svg class="chart" viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img">
      <g class="grid">{[0, 0.25, 0.5, 0.75, 1].map((f) => <g><line x1={pl} x2={W - pr} y1={y(max * f)} y2={y(max * f)} /><text x={pl - 6} y={y(max * f) + 4} text-anchor="end">{format(max * f)}</text></g>)}</g>
      {labels.map((l, i) => i % every === 0 && <text x={x(i)} y={H - 6} text-anchor="middle">{l}</text>)}
      {series.map((s, si) => {
        const pts = s.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
        const c = s.color || PALETTE[si];
        return (
          <g>
            {si === 0 && <polygon points={`${x(0)},${y(0)} ${pts} ${x(s.values.length - 1)},${y(0)}`} fill={c} opacity=".08" />}
            <polyline points={pts} fill="none" stroke={c} stroke-width="2.5" stroke-dasharray={s.dashed ? '5 5' : null} stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
          </g>
        );
      })}
    </svg>
  );
}

/** Donut. data: [{label, value, color?}] */
export function Donut({ data, size = 160, thickness = 22, center }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2, c = 2 * Math.PI * r;
  let off = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EFEBE3" stroke-width={thickness} />
      {data.map((d, i) => {
        const len = (d.value / total) * c;
        const el = <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color || PALETTE[i % PALETTE.length]} stroke-width={thickness}
          stroke-dasharray={`${Math.max(0, len - 2)} ${c}`} stroke-dashoffset={-off} transform={`rotate(-90 ${size / 2} ${size / 2})`}><title>{d.label}</title></circle>;
        off += len;
        return el;
      })}
      {center && <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" style={{ font: '800 18px var(--f-mono)', fill: 'var(--text)' }}>{center}</text>}
    </svg>
  );
}
export function Legend({ items }) {
  return <div class="legend">{items.map((it, i) => <span><i style={{ background: it.color || PALETTE[i % PALETTE.length] }} />{it.label}{it.value != null && <b style={{ marginLeft: 6 }}>{it.value}</b>}</span>)}</div>;
}
