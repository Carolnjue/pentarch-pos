// Adjustments: list of every stock adjustment (who, why, value) + "Adjust stock". Scan an item to adjust it.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { catalog } from '../../db/catalog.js';
import { PageHeader, Btn, Badge, Empty, Stat } from '../../ui/kit.jsx';
import { VirtualTable } from '../../ui/table.jsx';
import { money, kes } from '../../lib/money.js';
import { on } from '../../lib/bus.js';
import { navigate } from '../../router.js';
import { can } from '../../auth/permissions.js';
import { recentAdjustments, ADJUST_REASONS } from '../../core/inventory.js';
import { StockTabs, useScan, resolveCode, fq, unitOf, dtm, userName, reasonLabel } from './common.jsx';
import { adjustDialog } from './AdjustDialog.jsx';
import * as S from '../../state.js';
import { hasModal } from '../../ui/overlay.jsx';
import { t } from '../../i18n/index.js';

export default function Adjustments({ query }) {
  const [rows, setRows] = useState(null);
  const [reason, setReason] = useState('');
  const load = () => recentAdjustments(S.branch.value?.id, 2000).then(setRows);
  useEffect(() => { load(); return on('change', (e) => (e === 'stock_levels' || e === 'stock_moves') && load()); }, []);
  useEffect(() => { if (query?.new && !hasModal()) { navigate('/inventory/adjustments', { replace: true }); adjustDialog(); } }, [query?.new]);
  useScan((code) => { const r = resolveCode(code); if (r?.product?.track_stock) adjustDialog(r.product); });
  const list = useMemo(() => (rows || []).filter((m) => !reason || m.reason === reason), [rows, reason]);
  const month0 = new Date(); month0.setDate(1); month0.setHours(0, 0, 0, 0);
  const lost = (rows || []).filter((m) => m.created_at >= month0.getTime() && m.qty < 0).reduce((s, m) => s + Math.round(-m.qty * (m.cost || 0)), 0);
  const found = (rows || []).filter((m) => m.created_at >= month0.getTime() && m.qty > 0).reduce((s, m) => s + Math.round(m.qty * (m.cost || 0)), 0);
  const costs = can('products.cost_view');
  const reasons = [...ADJUST_REASONS.map((r) => [r.value, r.label]), ['returned_to_supplier', 'Returned to supplier']];
  return (
    <div class="page wide" style={{ maxWidth: '1400px' }}>
      <PageHeader title={t('Stock')} sub={t('Adjustments: stock removed or added outside sales and deliveries')}
        actions={<Btn variant="primary" icon="sliders" onClick={() => adjustDialog()}>{t('Adjust stock')}</Btn>} />
      <StockTabs active="/inventory/adjustments" />
      {costs && <div class="inv-stats">
        <Stat label={t('Removed this month')} value={<span class="down">{money(lost)}</span>} icon="minus" />
        <Stat label={t('Added this month')} value={money(found)} icon="plus" />
        <Stat label={t('Adjustments this month')} value={(rows || []).filter((m) => m.created_at >= month0.getTime()).length} icon="sliders" />
      </div>}
      <div class="row wrap mb gap-s">
        <button class={'chip' + (!reason ? ' on' : '')} onClick={() => setReason('')}>{t('All reasons')}</button>
        {reasons.map(([v, l]) => <button class={'chip' + (reason === v ? ' on' : '')} onClick={() => setReason(v)}>{t(l)}</button>)}
      </div>
      {!rows ? <div class="card" style={{ height: '300px' }} /> : (
        <VirtualTable rows={list} height="calc(100vh - 330px)" rowHeight={56} onRowClick={(m) => navigate('/inventory/product/' + m.product_id)}
          empty={<Empty icon="sliders" title={t('No adjustments yet')} text={t('When something is damaged, expires, goes missing or is found, record it here so your stock stays correct.')}><Btn variant="primary" icon="sliders" onClick={() => adjustDialog()}>{t('Adjust stock')}</Btn></Empty>}
          columns={[
            { key: 'created_at', label: t('When'), width: '1fr', render: (m) => <span class="small">{dtm(m.created_at)}</span> },
            { key: 'product_id', label: t('Item'), width: '2fr', sort: (m) => catalog.value.byId.get(m.product_id)?.name || '', render: (m) => { const p = catalog.value.byId.get(m.product_id); return <div style={{ minWidth: 0 }}><div class="ellipsis bold">{p?.name || t('Deleted product')}</div>{m.note && <div class="small mute ellipsis">{m.note}</div>}</div>; } },
            { key: 'reason', label: t('Reason'), width: '1.1fr', render: (m) => <Badge tone={m.qty < 0 ? 'warn' : 'ok'}>{reasonLabel(m.reason) || t('Adjustment')}</Badge> },
            { key: 'qty', label: t('Change'), width: '.8fr', num: true, render: (m) => <span class={m.qty > 0 ? 'ledger-in' : 'ledger-out'}>{m.qty > 0 ? '+' : '−'}{fq(Math.abs(m.qty))}{unitOf(catalog.value.byId.get(m.product_id))}</span> },
            ...(costs ? [{ key: 'value', label: t('Value'), width: '.9fr', num: true, hideMobile: true, sort: (m) => m.qty * (m.cost || 0), render: (m) => kes(Math.round(Math.abs(m.qty) * (m.cost || 0))) }] : []),
            { key: 'user_id', label: t('By'), width: '.9fr', hideMobile: true, render: (m) => <span class="small">{userName(m.user_id).split(' ')[0] || '—'}</span> }
          ]} />
      )}
    </div>
  );
}
