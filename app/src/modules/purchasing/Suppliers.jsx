// Suppliers list with what we owe each one (balances) and when we last received from them.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { PageHeader, Btn, Empty, Badge, SearchBox, Avatar, Stat } from '../../ui/kit.jsx';
import { VirtualTable } from '../../ui/table.jsx';
import { money, kes } from '../../lib/money.js';
import { prettyPhone } from '../../lib/util.js';
import { on } from '../../lib/bus.js';
import { navigate } from '../../router.js';
import { can } from '../../auth/permissions.js';
import { suppliersList, allSupplierBalances } from '../../core/purchasing.js';
import { BuyTabs, d8 } from '../inventory/common.jsx';
import { editSupplier } from './supplierDialog.jsx';
import { hasModal } from '../../ui/overlay.jsx';
import { t, tn } from '../../i18n/index.js';

export default function Suppliers({ query }) {
  const [rows, setRows] = useState(null);
  const [bal, setBal] = useState(new Map());
  const [q, setQ] = useState('');
  const [f, setF] = useState('all');
  const load = async () => { const [s, b] = await Promise.all([suppliersList(), allSupplierBalances()]); setRows(s); setBal(b); };
  useEffect(() => { load(); return on('change', (e) => ['suppliers', 'goods_received', 'supplier_payments'].includes(e) && load()); }, []);
  useEffect(() => { if (query?.new && !hasModal()) { navigate('/purchasing/suppliers', { replace: true }); add(); } }, [query?.new]);
  const add = async () => { const s = await editSupplier(); if (s) navigate('/purchasing/suppliers/' + s.id); };
  const over = (s) => (bal.get(s.id)?.open || []).filter((o) => o.age > (s.terms_days || 0)).reduce((x, o) => x + o.due, 0);
  const list = useMemo(() => (rows || []).filter((s) => (!q.trim() || [s.name, s.phone, s.contact].join(' ').toLowerCase().includes(q.toLowerCase())) && (f === 'all' || (f === 'owe' ? (bal.get(s.id)?.balance || 0) > 0 : over(s) > 0))).map((s) => ({ ...s, _bal: bal.get(s.id)?.balance || 0, _last: bal.get(s.id)?.last || 0, _over: over(s) })), [rows, bal, q, f]);
  const owed = [...bal.values()].reduce((s, a) => s + Math.max(0, a.balance), 0);
  const overdue = (rows || []).reduce((s, x) => s + over(x), 0);
  return (
    <div class="page wide" style={{ maxWidth: '1400px' }}>
      <PageHeader title={t('Purchases')} sub={t('Your suppliers and how much you owe each one')} actions={can('suppliers.edit') && <Btn variant="primary" icon="plus" onClick={add}>{t('Add supplier')}</Btn>} />
      <BuyTabs active="/purchasing/suppliers" />
      <div class="inv-stats">
        <Stat label={t('We owe suppliers')} value={money(owed)} icon="credit" />
        <Stat label={t('Overdue')} value={<span class={overdue ? 'down' : ''}>{money(overdue)}</span>} icon="alert" />
        <Stat label={t('Suppliers')} value={(rows || []).length} icon="store" />
      </div>
      <div class="row wrap mb" style={{ gap: '8px' }}>
        <SearchBox value={q} onValue={setQ} placeholder={t('Search supplier name or phone')} />
        <div class="row wrap gap-s">{[['all', t('All')], ['owe', t('We owe them')], ['over', t('Overdue')]].map(([k, l]) => <button class={'chip' + (f === k ? ' on' : '')} onClick={() => setF(k)}>{l}</button>)}</div>
      </div>
      {!rows ? <div class="card" style={{ height: '300px' }} /> : (
        <VirtualTable rows={list} height="calc(100vh - 320px)" rowHeight={60} onRowClick={(s) => navigate('/purchasing/suppliers/' + s.id)}
          empty={rows.length ? <Empty icon="search" title={t('No suppliers match')} /> : <Empty icon="store" title={t('No suppliers yet')} text={t('Add the companies and people you buy stock from. You will see what you owe each one and can send them orders on WhatsApp.')}>{can('suppliers.edit') && <Btn variant="primary" icon="plus" onClick={add}>{t('Add supplier')}</Btn>}</Empty>}
          columns={[
            { key: 'name', label: t('Supplier'), width: '2.2fr', render: (s) => <div class="row" style={{ gap: '10px', minWidth: 0 }}><Avatar name={s.name} size={34} /><div style={{ minWidth: 0 }}><div class="ellipsis bold">{s.name}</div><div class="small mute ellipsis">{[prettyPhone(s.phone), s.contact].filter(Boolean).join(' · ')}</div></div></div> },
            { key: 'terms_days', label: t('Pay within'), width: '1fr', hideMobile: true, render: (s) => (s.terms_days ? tn(s.terms_days, '{n} day', '{n} days') : t('On delivery')) },
            { key: '_last', label: t('Last delivery'), width: '1fr', hideMobile: true, render: (s) => (s._last ? d8(s._last) : <span class="mute">—</span>) },
            { key: '_bal', label: t('We owe'), width: '1.1fr', num: true, render: (s) => (s._bal > 0 ? <span class="row gap-s" style={{ justifyContent: 'flex-end' }}>{s._over > 0 && <Badge tone="bad">{t('overdue')}</Badge>}<b>{kes(s._bal)}</b></span> : s._bal < 0 ? <span class="up">{t('{v} credit', { v: kes(-s._bal) })}</span> : <span class="mute">0</span>) }
          ]} />
      )}
    </div>
  );
}
