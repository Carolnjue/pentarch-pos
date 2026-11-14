// Virtualised table for large lists (20k+ rows). Columns: {key, label, width:'2fr'|'120px', render(row), num, sort(row)→value, hideMobile}
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Icon } from './icons.jsx';

export function VirtualTable({ rows, columns, rowHeight = 52, onRowClick, height, selected, rowKey = 'id', empty, initialSort, footer }) {
  const box = useRef();
  const [scroll, setScroll] = useState(0);
  const [vh, setVh] = useState(600);
  const [sort, setSort] = useState(initialSort || null); // {key, dir}
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(() => setVh(el.clientHeight));
    ro.observe(el); setVh(el.clientHeight);
    return () => ro.disconnect();
  }, []);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    const f = col?.sort || ((r) => r[sort.key]);
    const out = rows.slice().sort((a, b) => { const x = f(a), y = f(b); return (x > y ? 1 : x < y ? -1 : 0) * (sort.dir === 'desc' ? -1 : 1); });
    return out;
  }, [rows, sort, columns]);
  const tpl = columns.map((c) => c.width || '1fr').join(' ');
  const tplM = columns.filter((c) => !c.hideMobile).map((c) => c.width || '1fr').join(' ');
  const start = Math.max(0, Math.floor((scroll - 44) / rowHeight) - 6);
  const end = Math.min(sorted.length, Math.ceil((scroll + vh) / rowHeight) + 6);
  const isM = typeof window !== 'undefined' && window.innerWidth <= 720;
  const gt = isM ? tplM : tpl;
  const vis = [];
  for (let i = start; i < end; i++) {
    const r = sorted[i];
    vis.push(
      <div class={'vt-row' + (onRowClick ? ' click' : '') + (selected?.(r) ? ' sel' : '')} key={r[rowKey]} role="row"
        style={{ top: i * rowHeight + 'px', height: rowHeight + 'px', gridTemplateColumns: gt }} onClick={onRowClick && (() => onRowClick(r))}>
        {columns.map((c) => <div role="cell" class={(c.num ? 'num mono ' : '') + (c.hideMobile ? 'vt-hide-m ' : '') + (c.class || '')}>{c.render ? c.render(r) : r[c.key]}</div>)}
      </div>
    );
  }
  return (
    <div class="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', height: height || 'auto' }}>
      <div class="vt" ref={box} style={{ flex: 1, minHeight: '200px' }} onScroll={(e) => setScroll(e.currentTarget.scrollTop)} role="table">
        <div class="vt-head" style={{ gridTemplateColumns: gt, height: '44px' }} role="row">
          {columns.map((c) => (
            <div role="columnheader" class={(c.num ? 'num ' : '') + (c.hideMobile ? 'vt-hide-m ' : '') + (c.sortable !== false && c.label ? 'sortable' : '')}
              onClick={() => c.sortable !== false && c.label && setSort(sort?.key === c.key ? { key: c.key, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: c.num ? 'desc' : 'asc' })}>
              {c.label}{sort?.key === c.key && <span aria-hidden="true"> {sort.dir === 'asc' ? '↑' : '↓'}</span>}
            </div>
          ))}
        </div>
        <div style={{ height: sorted.length * rowHeight + 'px', position: 'relative' }}>{vis}</div>
        {!sorted.length && empty}
      </div>
      {footer}
    </div>
  );
}

/** Simple non-virtual table for short lists. */
export function Table({ rows, columns, onRowClick, empty, dense }) {
  if (!rows.length && empty) return empty;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table class="table" style={dense ? { fontSize: '13.5px' } : null}>
        <thead><tr>{columns.map((c) => <th class={(c.num ? 'num ' : '') + (c.hideMobile ? 'hide-m' : '')} style={{ width: c.width }}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr class={onRowClick ? 'click' : ''} onClick={onRowClick && (() => onRowClick(r))} key={r.id || i}>
              {columns.map((c) => <td class={(c.num ? 'num mono ' : '') + (c.hideMobile ? 'hide-m ' : '') + (c.class || '')}>{c.render ? c.render(r, i) : r[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export { Icon };
