// One stock count: scan-to-count (each scan adds one) or type, blind option, variance report with KES value, apply.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { catalog } from '../../db/catalog.js';
import { db } from '../../db/index.js';
import { PageHeader, Btn, Icon, Badge, Empty, Stat, Tabs, Seg } from '../../ui/kit.jsx';
import { VirtualTable } from '../../ui/table.jsx';
import { confirm, toast } from '../../ui/overlay.jsx';
import { previewPrint } from '../../ui/printpreview.jsx';
import { money, kes } from '../../lib/money.js';
import { navigate } from '../../router.js';
import { can } from '../../auth/permissions.js';
import { requirePerm } from '../../auth/override.jsx';
import { countScope, saveCountLines, applyCount, cancelCount, approvalLimit, r3 } from '../../core/inventory.js';
import { countVariance } from '../../core/stockmath.js';
import { countSheetHtml } from '../../print/stockdocs.js';
import { ProductAdder, QtyIn, StatusPill, useScan, useBranchLevels, resolveCode, fq, unitOf, ctxPrint, d8, userName, Done } from './common.jsx';
import { scopeLabel } from './Counts.jsx';
import * as S from '../../state.js';
import { t, tn } from '../../i18n/index.js';

const w0 = (c) => Math.round((c || 0) / 100) * 100; // whole shillings in the stat cards (exact values in the table)
export default function CountSheet({ params }) {
  const [count, setCount] = useState(null);
  const [counted, setCounted] = useState({});
  const [tab, setTab] = useState('count');
  const [show, setShow] = useState('all');
  const [q, setQ] = useState('');
  const [last, setLast] = useState(null);
  const [unlocked, setUnlocked] = useState(false);
  const [zero, setZero] = useState('leave');
  const [result, setResult] = useState(null);
  const dirty = useRef({});
  const timer = useRef();
  const countRef = useRef(null);
  useEffect(() => {
    db().stock_counts.get(params.id).then((c) => {
      if (!c || c.deleted) return setCount(false);
      setCount(c); countRef.current = c;
      setCounted(Object.fromEntries((c.lines || []).filter((l) => l.counted != null).map((l) => [l.product_id, l.counted])));
    });
    return () => flush();
  }, [params.id]);
  const lv = useBranchLevels(count?.branch_id);
  const flush = async () => {
    clearTimeout(timer.current);
    const d = dirty.current; dirty.current = {};
    if (!Object.keys(d).length || !countRef.current) return;
    countRef.current = await saveCountLines(countRef.current, d);
  };
  const setOne = (pid, v) => {
    setCounted((cur) => { const n = { ...cur }; if (v == null) delete n[pid]; else n[pid] = r3(v); return n; });
    dirty.current[pid] = v == null ? null : r3(v);
    clearTimeout(timer.current); timer.current = setTimeout(flush, 700);
  };
  const isOpen = count && count.status === 'open';
  const scope = useMemo(() => (count ? countScope({ ...count, lines: [...(count.lines || []), ...Object.keys(counted).map((id) => ({ product_id: id }))] }) : []), [count?.id, count?.scope, catalog.value.version, count?.scope === 'custom' ? Object.keys(counted).join() : 0]);
  const inScope = useMemo(() => new Set(scope.map((p) => p.id)), [scope]);
  const add = (p, factor = 1) => {
    if (!isOpen) return;
    if (count.scope !== 'custom' && !inScope.has(p.id)) { toast.warn(t('{name} is not part of this count', { name: p.name })); return; }
    const v = r3((counted[p.id] || 0) + factor);
    setOne(p.id, v); setLast(p.id);
  };
  useScan((code) => { const r = resolveCode(code); if (!r) return toast.error(t('Barcode {c} not found', { c: code })); add(r.product, r.factor); }, [counted, count, inScope]);
  if (count === false) return <div class="page"><Empty icon="list" title={t('Count not found')} /></div>;
  if (!count) return <div class="page" />;
  const blind = count.blind && !unlocked && !can('inventory.approve');
  const expected = (pid) => (count.status === 'applied' ? (count.lines.find((l) => l.product_id === pid)?.expected ?? 0) : lv.get(pid) || 0);
  const lines = count.status === 'applied' ? count.lines : scope.map((p) => ({ product_id: p.id, expected: lv.get(p.id) || 0, counted: counted[p.id] ?? null }));
  const pById = catalog.value.byId;
  const v = countVariance(lines, (id) => pById.get(id)?.cost || 0, (id) => pById.get(id)?.price || 0);
  const nCounted = Object.keys(counted).filter((k) => inScope.has(k)).length;
  const total = scope.length;
  const costs = can('products.cost_view');
  const filtered = scope.filter((p) => {
    if (q.trim() && !(p.name.toLowerCase().includes(q.toLowerCase()) || (p.barcode || '').includes(q) || (p.sku || '').toLowerCase().includes(q.toLowerCase()))) return false;
    if (show === 'todo') return counted[p.id] == null;
    if (show === 'done') return counted[p.id] != null;
    if (show === 'diff') return counted[p.id] != null && r3(counted[p.id] - (lv.get(p.id) || 0)) !== 0;
    return true;
  });
  const lastP = last && pById.get(last);
  const printSheet = (withCounts) => previewPrint(countSheetHtml(count, (count.status === 'applied' ? count.lines.map((l) => ({ product: pById.get(l.product_id), expected: l.expected, counted: l.counted })).filter((r) => r.product) : scope.map((p) => ({ product: p, expected: lv.get(p.id) || 0, counted: withCounts ? counted[p.id] : null }))), ctxPrint(), { blind: blind && !withCounts }), { title: t('Count sheet'), paper: 'a4' });
  const review = async () => {
    await flush();
    if (count.blind && !can('inventory.approve') && !unlocked) {
      const ok = await requirePerm('inventory.approve', t('See the count differences'));
      if (!ok) return;
      setUnlocked(true);
    }
    setTab('review');
  };
  const apply = async () => {
    await flush();
    const zeroUncounted = zero === 'zero' && count.scope !== 'custom';
    const big = Math.abs(v.loss) > approvalLimit() || v.gain > approvalLimit();
    let approver = null;
    if (!can('inventory.count_apply') || (big && !can('inventory.approve'))) {
      approver = await requirePerm(big ? 'inventory.approve' : 'inventory.count_apply', t('Update stock from count {no}', { no: count.no }));
      if (!approver) return;
    }
    const n = zeroUncounted ? total : v.counted;
    if (!(await confirm({ title: t('Update stock?'), message: t('Stock will be set to what you counted for {n} items. {d} items have a difference.', { n, d: v.diffs }) + (zeroUncounted && total > nCounted ? ' ' + t('{n} items you did not count will be set to zero.', { n: total - nCounted }) : ''), ok: t('Yes, update stock') }))) return;
    const fresh = await db().stock_counts.get(count.id);
    const res = await applyCount(fresh, { zeroUncounted, approver });
    setResult(res);
    setCount(await db().stock_counts.get(count.id));
    toast(t('Stock updated from count {no}', { no: count.no }));
  };
  const cancel = async () => {
    if (!(await confirm({ title: t('Cancel this count?'), message: t('What you counted will be discarded. Stock does not change.'), danger: true, ok: t('Yes, cancel the count') }))) return;
    await cancelCount(count);
    navigate('/inventory/counts');
  };
  return (
    <div class="page wide" style={{ maxWidth: '1300px' }}>
      <PageHeader back="#/inventory/counts" title={<span class="row wrap gap-s">{t('Count')} <span class="mono">{count.no}</span><StatusPill s={count.status} />{count.blind && <Badge tone="navy">{t('Blind')}</Badge>}</span>}
        sub={[count.name, scopeLabel(count), t('started {d} by {u}', { d: d8(count.created_at), u: userName(count.started_by).split(' ')[0] || '—' })].filter(Boolean).join(' · ')}
        actions={<>
          <Btn icon="print" onClick={() => printSheet(false)}>{t('Print count sheet')}</Btn>
          {isOpen && <Btn variant="ghost" icon="x" onClick={cancel}>{t('Cancel count')}</Btn>}
        </>} />
      {result || count.status === 'applied' ? (
        <AppliedView count={count} result={result} costs={costs} printSheet={printSheet} />
      ) : (
        <>
          <Tabs value={tab} onValue={(x) => (x === 'review' ? review() : setTab(x))} tabs={[{ value: 'count', label: t('1. Count'), icon: 'barcode' }, { value: 'review', label: t('2. Check differences & finish'), icon: 'check' }]} />
          {tab === 'count' && <>
            <div class="count-scan">
              <ProductAdder autoFocus filter={(p) => p.track_stock && (count.scope === 'custom' || inScope.has(p.id))} onPick={(p, r) => add(p, r?.factor || 1)} placeholder={t('Scan or type an item — each scan adds one')} />
              <div class="right" style={{ minWidth: '120px' }}><div class="small" style={{ color: '#c3cbe0' }}>{t('Counted')}</div><div class="big">{count.scope === 'custom' ? nCounted : `${nCounted} / ${total}`}</div></div>
            </div>
            {lastP && (
              <div class="card pad mb row wrap" style={{ borderColor: 'var(--teal)', boxShadow: '0 0 0 3px var(--teal-50)' }}>
                <Icon name="check-circle" size={22} style={{ color: 'var(--teal-d)' }} />
                <div class="grow"><b>{lastP.name}</b><div class="small mute">{t('Counted so far — type the full number if easier')}</div></div>
                {!blind && <span class="small mute">{t('System')}: <b class="mono">{fq(lv.get(lastP.id) || 0)}</b></span>}
                <QtyIn value={counted[lastP.id] ?? 0} onValue={(x) => setOne(lastP.id, x)} label={t('Counted quantity')} step={lastP.unit === 'kg' ? 0.5 : 1} />
              </div>
            )}
            <div class="row wrap mb" style={{ gap: '8px' }}>
              <div class="input-wrap" style={{ flex: 1, minWidth: '200px' }}><Icon name="search" size={18} /><input class="input" type="search" value={q} placeholder={t('Find in this list')} aria-label={t('Find in this list')} onInput={(e) => setQ(e.target.value)} /></div>
              <div class="row wrap gap-s">{[['all', t('All')], ['todo', t('Not counted')], ['done', t('Counted')], ...(!blind ? [['diff', t('Differences')]] : [])].map(([k, l]) => <button class={'chip' + (show === k ? ' on' : '')} onClick={() => setShow(k)}>{l}</button>)}</div>
            </div>
            <VirtualTable rows={filtered} height="calc(100vh - 360px)" rowHeight={60}
              empty={count.scope === 'custom' && !nCounted ? <Empty icon="barcode" title={t('Scan the first item')} text={t('Each scan adds one. You can also type the number you counted.')} /> : <Empty icon="search" title={t('Nothing here')} />}
              columns={[
                { key: 'name', label: t('Item'), width: '2.4fr', render: (p) => <div style={{ minWidth: 0 }}><div class="ellipsis bold">{p.name}</div><div class="small mute mono ellipsis">{p.barcode || p.sku || ''}</div></div> },
                ...(!blind ? [{ key: 'sys', label: t('System'), width: '.8fr', num: true, hideMobile: true, sort: (p) => lv.get(p.id) || 0, render: (p) => <span class="mute">{fq(lv.get(p.id) || 0)}{unitOf(p)}</span> }] : []),
                { key: 'cnt', label: t('Counted'), width: '170px', sortable: false, render: (p) => <QtyIn value={counted[p.id] ?? null} onValue={(x) => setOne(p.id, x)} label={t('Counted quantity of {name}', { name: p.name })} step={p.unit === 'kg' ? 0.5 : 1} /> },
                ...(!blind ? [{ key: 'var', label: t('Difference'), width: '.8fr', num: true, hideMobile: true, sortable: false, render: (p) => { if (counted[p.id] == null) return <span class="mute">—</span>; const d = r3(counted[p.id] - (lv.get(p.id) || 0)); return <span class={d > 0 ? 'var-pos' : d < 0 ? 'var-neg' : 'mute'}>{d > 0 ? '+' : d < 0 ? '−' : ''}{fq(Math.abs(d))}</span>; } }] : [])
              ]} />
            <div class="row wrap mt" style={{ justifyContent: 'flex-end' }}>
              <span class="small mute grow">{t('Your counting is saved as you go. You can stop and continue later.')}</span>
              <Btn variant="primary" icon="arrow-right" disabled={!nCounted} onClick={review}>{t('Check differences')}</Btn>
            </div>
          </>}
          {tab === 'review' && <>
            <div class="inv-stats">
              <Stat label={t('Items counted')} value={`${v.counted}${count.scope !== 'custom' ? ' / ' + total : ''}`} icon="list" />
              <Stat label={t('Items with a difference')} value={v.diffs} icon="alert" />
              {costs && <Stat label={t('Missing (value at cost)')} value={<span class="down">{money(w0(-v.loss))}</span>} icon="minus" />}
              {costs && <Stat label={t('Extra (value at cost)')} value={money(w0(v.gain))} icon="plus" />}
              {costs && <Stat label={t('Net difference')} value={<span class={v.net < 0 ? 'down' : ''}>{money(w0(v.net))}</span>} icon="wallet" />}
            </div>
            {count.scope !== 'custom' && total > nCounted && (
              <div class="card pad mb row wrap">
                <div class="grow"><b>{tn(total - nCounted, '{n} item was not counted', '{n} items were not counted')}</b><div class="small mute">{t('What should happen to them?')}</div></div>
                <Seg value={zero} onValue={setZero} options={[{ value: 'leave', label: t('Leave as they are') }, { value: 'zero', label: t('Set to zero') }]} />
              </div>
            )}
            <div class="card mb">
              <div class="card-h"><h3>{t('Differences')}</h3><span class="small mute">{t('Counted minus system quantity')}</span></div>
              <VirtualTable rows={v.rows.filter((r) => r.variance !== 0).map((r) => ({ ...r, id: r.product_id }))} height="min(52vh, 520px)" rowHeight={52}
                empty={<Empty icon="check" title={t('No differences — well done!')} text={t('Everything you counted matches the system.')} />}
                columns={[
                  { key: 'product_id', label: t('Item'), width: '2.2fr', sort: (r) => pById.get(r.product_id)?.name || '', render: (r) => <span class="ellipsis bold">{pById.get(r.product_id)?.name}</span> },
                  { key: 'expected', label: t('System'), width: '.8fr', num: true, hideMobile: true, render: (r) => fq(r.expected) },
                  { key: 'counted', label: t('Counted'), width: '.8fr', num: true, render: (r) => fq(r.counted) },
                  { key: 'variance', label: t('Difference'), width: '.8fr', num: true, render: (r) => <span class={r.variance > 0 ? 'var-pos' : 'var-neg'}>{r.variance > 0 ? '+' : '−'}{fq(Math.abs(r.variance))}</span> },
                  ...(costs ? [{ key: 'value', label: t('Value'), width: '.9fr', num: true, hideMobile: true, render: (r) => <span class={r.value < 0 ? 'down' : ''}>{kes(r.value)}</span> }] : [])
                ]} />
            </div>
            <div class="row wrap" style={{ justifyContent: 'flex-end' }}>
              <Btn icon="arrow-left" onClick={() => setTab('count')}>{t('Back to counting')}</Btn>
              <Btn icon="print" onClick={() => printSheet(true)}>{t('Print')}</Btn>
              <Btn variant="primary" icon="check" disabled={!v.counted && zero !== 'zero'} onClick={apply}>{t('Update stock')}</Btn>
            </div>
          </>}
        </>
      )}
    </div>
  );
}

function AppliedView({ count, result, costs, printSheet }) {
  const pById = catalog.value.byId;
  const diffs = (count.lines || []).filter((l) => l.variance);
  return (
    <div class="col gap-l">
      {result && <Done title={t('Stock updated')} text={tn(diffs.length, '{n} item was corrected.', '{n} items were corrected.')}>
        <Btn icon="list" onClick={() => navigate('/inventory/counts')}>{t('All counts')}</Btn><Btn variant="primary" icon="layers" onClick={() => navigate('/inventory')}>{t('Go to stock')}</Btn>
      </Done>}
      <div class="inv-stats">
        <Stat label={t('Items counted')} value={(count.lines || []).length} icon="list" />
        <Stat label={t('Items with a difference')} value={diffs.length} icon="alert" />
        {costs && <Stat label={t('Net difference')} value={<span class={(count.gain || 0) + (count.loss || 0) < 0 ? 'down' : ''}>{money(w0((count.gain || 0) + (count.loss || 0)))}</span>} icon="wallet" />}
        <Stat label={t('Applied')} value={d8(count.applied_at)} icon="calendar"><div class="small mute" style={{ marginTop: '4px' }}>{userName(count.applied_by)}</div></Stat>
      </div>
      <div class="card">
        <div class="card-h"><h3>{t('Differences')}</h3><Btn size="sm" icon="print" onClick={() => printSheet(true)}>{t('Print')}</Btn></div>
        <VirtualTable rows={diffs.map((r) => ({ ...r, id: r.product_id }))} height="min(55vh, 520px)" rowHeight={52} empty={<Empty icon="check" title={t('No differences — well done!')} />}
          columns={[
            { key: 'product_id', label: t('Item'), width: '2.2fr', render: (r) => <a class="bold ellipsis" href={'#/inventory/product/' + r.product_id}>{pById.get(r.product_id)?.name || '—'}</a> },
            { key: 'expected', label: t('System'), width: '.8fr', num: true, render: (r) => fq(r.expected) },
            { key: 'counted', label: t('Counted'), width: '.8fr', num: true, render: (r) => fq(r.counted) },
            { key: 'variance', label: t('Difference'), width: '.8fr', num: true, render: (r) => <span class={r.variance > 0 ? 'var-pos' : 'var-neg'}>{r.variance > 0 ? '+' : '−'}{fq(Math.abs(r.variance))}</span> },
            ...(costs ? [{ key: 'value', label: t('Value'), width: '.9fr', num: true, hideMobile: true, render: (r) => kes(Math.round(r.variance * (pById.get(r.product_id)?.cost || 0))) }] : [])
          ]} />
      </div>
    </div>
  );
}
