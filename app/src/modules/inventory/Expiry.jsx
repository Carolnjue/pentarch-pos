// Expiry tracker: expired / within 30, 60, 90 days, per batch (sold first-expiry-first-out). Remove expired stock in one tap.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { PageHeader, Btn, Icon, Empty, Badge, Stat, SearchBox } from '../../ui/kit.jsx';
import { VirtualTable } from '../../ui/table.jsx';
import { confirm, toast } from '../../ui/overlay.jsx';
import { money, kes } from '../../lib/money.js';
import { toCsv, download } from '../../lib/util.js';
import { on } from '../../lib/bus.js';
import { navigate } from '../../router.js';
import { can } from '../../auth/permissions.js';
import { requirePerm } from '../../auth/override.jsx';
import { batchRows, adjustStock, approvalLimit } from '../../core/inventory.js';
import { StockTabs, BranchSelect, fq, unitOf } from './common.jsx';
import * as S from '../../state.js';
import { t } from '../../i18n/index.js';

const BUCKETS = [['expired', 'Expired', 'bad'], ['30', 'Within 30 days', 'warn'], ['60', '31–60 days', 'warn'], ['90', '61–90 days', ''], ['all', 'All batches', '']];

export default function Expiry() {
  const [rows, setRows] = useState(null);
  const [b, setB] = useState('30');
  const [q, setQ] = useState('');
  const [bid, setBid] = useState(S.branch.value?.id);
  const load = () => batchRows(bid).then(setRows);
  useEffect(() => { load(); return on('change', (e) => (e === 'stock_levels' || e === 'stock_moves') && load()); }, [bid]);
  const counts = useMemo(() => { const c = { expired: 0, 30: 0, 60: 0, 90: 0, all: 0 }; for (const r of rows || []) { c.all++; if (c[r.bucket] != null) c[r.bucket]++; } return c; }, [rows]);
  const value = (k) => (rows || []).filter((r) => r.bucket === k).reduce((s, r) => s + r.value, 0);
  const list = useMemo(() => (rows || []).filter((r) => (b === 'all' || r.bucket === b) && (!q.trim() || r.product.name.toLowerCase().includes(q.toLowerCase()) || r.batch_no.toLowerCase().includes(q.toLowerCase()))), [rows, b, q]);
  const costs = can('products.cost_view');
  const mine = bid === S.branch.value?.id;
  const writeOff = async (r) => {
    if (!(await confirm({ title: t('Remove expired stock?'), message: t('{n} of {name} (batch {b}) will be removed from stock as expired.', { n: fq(r.qty) + unitOf(r.product), name: r.product.name, b: r.batch_no }), ok: t('Yes, remove'), danger: true }))) return;
    let approver = null;
    if (r.value > approvalLimit() && !can('inventory.approve')) { approver = await requirePerm('inventory.approve', t('Stock change of {v}', { v: money(r.value) })); if (!approver) return; }
    await adjustStock({ product_id: r.product.id, qty: -r.qty, reason: 'expired', batch_no: r.batch_no, expiry: r.expiry, note: t('Expired batch {b}', { b: r.batch_no }), approver });
    toast(t('Expired stock removed'));
  };
  const exportCsv = () => download(`expiry-${new Date().toISOString().slice(0, 10)}.csv`, '﻿' + toCsv(list.map((r) => ({ name: r.product.name, batch: r.batch_no, expiry: r.expiry, days_left: r.days, qty: r.qty, value_at_cost: r.value / 100 })), ['name', 'batch', 'expiry', 'days_left', 'qty', ...(costs ? ['value_at_cost'] : [])].map((key) => ({ key }))), 'text/csv');
  return (
    <div class="page wide" style={{ maxWidth: '1400px' }}>
      <PageHeader title={t('Stock')} sub={t('Batches by expiry date. The oldest batch is always sold first (FEFO).')} actions={<><BranchSelect value={bid} onValue={setBid} /><Btn icon="download" onClick={exportCsv} disabled={!list.length}>{t('Export')}</Btn></>} />
      <StockTabs active="/inventory/expiry" />
      {rows && rows.length > 0 && <div class="inv-stats">
        <div class="card stat click" role="button" onClick={() => setB('expired')}><div class="k"><Icon name="ban" size={16} />{t('Expired')}</div><div class="v down">{counts.expired}</div>{costs && <div class="small mute">{money(value('expired'))}</div>}</div>
        <div class="card stat click" role="button" onClick={() => setB('30')}><div class="k"><Icon name="alert" size={16} />{t('Within 30 days')}</div><div class="v" style={{ color: counts[30] ? 'var(--sun-d)' : '' }}>{counts[30]}</div>{costs && <div class="small mute">{money(value('30'))}</div>}</div>
        <div class="card stat click" role="button" onClick={() => setB('60')}><div class="k"><Icon name="calendar" size={16} />{t('31–60 days')}</div><div class="v">{counts[60]}</div></div>
        <div class="card stat click" role="button" onClick={() => setB('90')}><div class="k"><Icon name="calendar" size={16} />{t('61–90 days')}</div><div class="v">{counts[90]}</div></div>
      </div>}
      <div class="row wrap mb" style={{ gap: '8px' }}>
        <SearchBox value={q} onValue={setQ} placeholder={t('Search item or batch')} />
        <div class="row wrap gap-s">{BUCKETS.map(([k, l]) => <button class={'chip' + (b === k ? ' on' : '')} onClick={() => setB(k)}>{t(l)}{counts[k] ? <span class="badge" style={{ height: '18px', marginLeft: '2px' }}>{counts[k]}</span> : null}</button>)}</div>
      </div>
      {!rows ? <div class="card" style={{ height: '300px' }} /> : (
        <VirtualTable rows={list} height="calc(100vh - 340px)" rowHeight={56} onRowClick={(r) => navigate('/inventory/product/' + r.product.id)}
          empty={rows.length ? <Empty icon="check-circle" title={t('Nothing here')} text={t('No batches in this group.')} /> : <Empty icon="calendar" title={t('No batches with expiry dates yet')} text={t('Switch on “Batches & expiry” for items like medicine or food, then enter the batch and expiry date when you receive stock.')}>{can('purchasing.receive') && <Btn variant="primary" icon="truck" onClick={() => navigate('/purchasing/receive')}>{t('Receive stock')}</Btn>}</Empty>}
          columns={[
            { key: 'product', label: t('Item'), width: '2.2fr', sort: (r) => r.product.name, render: (r) => <div class="ellipsis"><span class="bold">{r.product.name}</span><div class="small mute mobile-only mono">{r.batch_no || '—'} · {r.expiry || '—'}</div></div> },
            { key: 'batch_no', label: t('Batch'), width: '1fr', hideMobile: true, render: (r) => <span class="mono">{r.batch_no || '—'}</span> },
            { key: 'expiry', label: t('Expires'), width: '1fr', hideMobile: true, render: (r) => r.expiry || '—' },
            { key: 'days', label: t('Days left'), width: '.9fr', num: true, render: (r) => <Badge tone={r.days < 0 ? 'bad' : r.days <= 30 ? 'warn' : r.days <= 90 ? 'navy' : ''}>{r.days < 0 ? t('Expired') : r.days === Infinity ? '—' : r.days}</Badge> },
            { key: 'qty', label: t('Qty'), width: '.7fr', num: true, render: (r) => fq(r.qty) + unitOf(r.product) },
            ...(costs ? [{ key: 'value', label: t('Value'), width: '.9fr', num: true, hideMobile: true, render: (r) => kes(r.value) }] : []),
            ...(mine && can('inventory.adjust') ? [{ key: 'act', label: '', width: '120px', sortable: false, render: (r) => (r.days < 0 ? <Btn size="xs" variant="danger" icon="trash" onClick={(e) => { e.stopPropagation(); writeOff(r); }}>{t('Remove')}</Btn> : null) }] : [])
          ]} />
      )}
    </div>
  );
}
