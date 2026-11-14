import { useEffect, useMemo, useState } from 'preact/hooks';
import { db } from '../../db/index.js';
import { allBalances } from '../../core/customers.js';
import { PageHeader, Btn, Icon, Badge, SearchBox, Empty, Avatar, Stat } from '../../ui/kit.jsx';
import { VirtualTable } from '../../ui/table.jsx';
import { money, kes } from '../../lib/money.js';
import { norm } from '../../lib/search.js';
import { prettyPhone, toCsv, download, DAY } from '../../lib/util.js';
import { on } from '../../lib/bus.js';
import { navigate } from '../../router.js';
import { can } from '../../auth/permissions.js';
import { audit } from '../../db/repo.js';
import { editCustomer } from './edit.jsx';
import * as S from '../../state.js';
import { t } from '../../i18n/index.js';

export default function CustomersPage({ query }) {
  const [list, setList] = useState(null);
  const [bal, setBal] = useState(new Map());
  const [last, setLast] = useState(new Map());
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState(query?.filter || 'all');
  const load = async () => {
    const [cs, b, sales] = await Promise.all([db().customers.toArray(), allBalances(), db().sales.where('customer_id').above('').toArray()]);
    const l = new Map();
    for (const s of sales) if (!l.has(s.customer_id) || l.get(s.customer_id).at < s.created_at) l.set(s.customer_id, { at: s.created_at, n: (l.get(s.customer_id)?.n || 0) + 1, spent: (l.get(s.customer_id)?.spent || 0) + (s.status !== 'void' ? s.total : 0) });
      else { const x = l.get(s.customer_id); x.n++; if (s.status !== 'void') x.spent += s.total; }
    setList(cs.filter((c) => !c.deleted)); setBal(b); setLast(l);
  };
  useEffect(() => { load(); return on('change', (e) => ['customers', 'customer_payments', 'sales'].includes(e) && load()); }, []);
  const rows = useMemo(() => {
    if (!list) return [];
    const n = norm(q), d = q.replace(/\D/g, '').replace(/^0/, '');
    return list.filter((c) => (!n || norm(c.name).includes(n) || (d.length > 2 && (c.phone || '').includes(d)))
      && (filter === 'all' || (filter === 'owing' && (bal.get(c.id) || 0) > 0) || (filter === 'wholesale' && c.group === 'wholesale') || (filter === 'points' && c.loyalty_points > 0) || (filter === 'inactive' && (!last.get(c.id) || Date.now() - last.get(c.id).at > 60 * DAY))))
      .map((c) => ({ ...c, _bal: bal.get(c.id) || 0, _last: last.get(c.id)?.at || 0, _n: last.get(c.id)?.n || 0, _spent: last.get(c.id)?.spent || 0 }));
  }, [list, q, filter, bal, last]);
  const owed = [...bal.values()].filter((v) => v > 0).reduce((a, b) => a + b, 0);
  const exp = () => { download('customers.csv', '﻿' + toCsv(rows, [{ key: 'name', label: 'name' }, { label: 'phone', get: (c) => prettyPhone(c.phone) }, { key: 'email', label: 'email' }, { key: 'group', label: 'group' }, { label: 'balance', get: (c) => c._bal / 100 }, { key: 'loyalty_points', label: 'points' }, { label: 'total_spent', get: (c) => c._spent / 100 }]), 'text/csv'); audit('export.customers', 'customers', null, { rows: rows.length }); };
  return (
    <div class="page">
      <PageHeader title={t('Customers')} sub={t('Accounts, credit, loyalty points and statements.')} actions={<>
        {can('export.data') && <Btn icon="download" onClick={exp}>{t('Export')}</Btn>}
        {can('customers.edit') && <Btn variant="primary" icon="user-plus" onClick={async () => { const c = await editCustomer(); if (c) navigate('/customers/' + c.id); }}>{t('Add customer')}</Btn>}
      </>} />
      <div class="grid3 mb" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <Stat label={t('Customers')} value={list?.length ?? '—'} icon="users" />
        <Stat label={t('Owed to you')} value={money(owed)} icon="credit"><a class="small" href="#/customers?filter=owing" onClick={() => setFilter('owing')}>{t('{n} debtors', { n: [...bal.values()].filter((v) => v > 0).length })}</a></Stat>
        {S.settings.value.loyalty_enabled && <Stat label={t('Loyalty points out')} value={(list || []).reduce((s, c) => s + (c.loyalty_points || 0), 0)} icon="star" />}
      </div>
      <div class="row wrap mb" style={{ gap: '8px' }}>
        <SearchBox value={q} onValue={setQ} placeholder={t('Name or phone')} />
        <div class="row wrap gap-s">{[['all', 'All'], ['owing', 'Owe money'], ...(S.modulesOn.value.wholesale ? [['wholesale', 'Wholesale']] : []), ...(S.settings.value.loyalty_enabled ? [['points', 'With points']] : []), ['inactive', 'Not seen in 60 days']].map(([k, l]) => <button class={'chip' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>{t(l)}</button>)}</div>
      </div>
      {list && <VirtualTable rows={rows} height="calc(100vh - 380px)" rowHeight={58} onRowClick={(c) => navigate('/customers/' + c.id)} initialSort={filter === 'owing' ? { key: '_bal', dir: 'desc' } : null}
        empty={list.length || q || filter !== 'all'
          ? <Empty icon="users" title={t('No customers found')} text={t('Try another name or phone number, or choose “All”.')} />
          : <Empty icon="users" title={t('No customers yet')} text={t('Add customers while selling (tap “Add customer” or press F9) or here. You need a customer to sell on credit, give loyalty points and send receipts on WhatsApp.')}>
              {can('customers.edit') && <Btn variant="primary" icon="user-plus" onClick={async () => { const c = await editCustomer(); if (c) navigate('/customers/' + c.id); }}>{t('Add customer')}</Btn>}
            </Empty>}
        columns={[
          { key: 'name', label: t('Customer'), width: '2fr', render: (c) => <div class="row" style={{ gap: '10px' }}><Avatar name={c.name} size={34} /><div style={{ minWidth: 0 }}><b class="ellipsis" style={{ display: 'block' }}>{c.name}</b><span class="small mute">{prettyPhone(c.phone)}</span></div></div> },
          { key: 'group', label: t('Group'), width: '.8fr', hideMobile: true, render: (c) => (c.group === 'wholesale' ? <Badge tone="navy">{t('Wholesale')}</Badge> : <span class="mute">{t('Retail')}</span>) },
          { key: '_n', label: t('Visits'), width: '.6fr', num: true, hideMobile: true },
          { key: '_spent', label: t('Spent'), width: '1fr', num: true, hideMobile: true, render: (c) => kes(c._spent) },
          { key: '_last', label: t('Last visit'), width: '1fr', hideMobile: true, render: (c) => (c._last ? new Date(c._last).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' }) : '—') },
          ...(S.settings.value.loyalty_enabled ? [{ key: 'loyalty_points', label: t('Points'), width: '.6fr', num: true, hideMobile: true }] : []),
          { key: '_bal', label: t('Balance'), width: '1fr', num: true, render: (c) => (c._bal > 0 ? <b class="down">{kes(c._bal)}</b> : c._bal < 0 ? <span class="up">{t('Credit')} {kes(-c._bal)}</span> : <span class="mute">0</span>) }
        ]} />}
    </div>
  );
}
