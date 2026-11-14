// Activity (audit) log viewer: filter by user, action and date.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { db } from '../../../db/index.js';
import { Badge, Select, SearchBox, Empty, Btn } from '../../../ui/kit.jsx';
import { VirtualTable } from '../../../ui/table.jsx';
import { DateRange, rangeFor } from '../../../ui/daterange.jsx';
import { toCsv, download } from '../../../lib/util.js';
import { money } from '../../../lib/money.js';
import { Panel } from './general.jsx';
import * as S from '../../../state.js';
import { t } from '../../../i18n/index.js';

const TONE = { 'sale.void': 'bad', 'sale.return': 'warn', 'price.change': 'warn', 'discount.apply': 'warn', 'drawer.open': 'warn', 'user.login_failed': 'bad', 'override.grant': 'navy', 'product.delete': 'bad', 'backup.restore': 'bad', 'shift.close': 'ok' };
const money2 = (d) => Object.entries(d || {}).filter(([k]) => !['id'].includes(k)).map(([k, v]) => `${k}: ${typeof v === 'number' && ['total', 'amount', 'from', 'to', 'variance', 'expected', 'float', 'counted'].includes(k) ? money(v) : Array.isArray(v) ? v.join(',') : v}`).join(' · ');

export default function AuditPanel() {
  const [range, setRange] = useState({ preset: 'week', ...rangeFor('week') });
  const [rows, setRows] = useState([]);
  const [user, setUser] = useState('');
  const [action, setAction] = useState('');
  const [q, setQ] = useState('');
  const users = new Map((S.users.value || []).map((u) => [u.id, u.name]));
  useEffect(() => { db().audit.where('at').between(range.from, range.to).reverse().toArray().then(setRows); }, [range.from, range.to]);
  const actions = useMemo(() => [...new Set(rows.map((r) => r.action))].sort(), [rows]);
  const shown = rows.filter((r) => (!user || r.user_id === user) && (!action || r.action === action) && (!q || JSON.stringify(r.details || {}).toLowerCase().includes(q.toLowerCase())));
  return (
    <Panel title={t('Activity log')} sub={t('Everything sensitive is recorded: who, what, when and on which device.')} extra={<Btn size="sm" icon="download" onClick={() => download('activity-log.csv', '﻿' + toCsv(shown, [{ label: 'time', get: (r) => new Date(r.at).toISOString() }, { key: 'action' }, { label: 'user', get: (r) => users.get(r.user_id) || '' }, { label: 'details', get: (r) => JSON.stringify(r.details) }]), 'text/csv')}>{t('Export')}</Btn>}>
      <div class="col gap-s mb">
        <DateRange value={range} onValue={setRange} />
        <div class="row wrap gap-s">
          <Select value={user} onValue={setUser} options={[{ value: '', label: t('Everyone') }, ...[...users].map(([id, n]) => ({ value: id, label: n }))]} />
          <Select value={action} onValue={setAction} options={[{ value: '', label: t('All actions') }, ...actions.map((a) => ({ value: a, label: a }))]} />
          <SearchBox value={q} onValue={setQ} placeholder={t('Search details')} />
        </div>
      </div>
      <VirtualTable rows={shown} height="56vh" rowHeight={50} empty={<Empty icon="shield" title={t('Nothing recorded in this period')} />} columns={[
        { key: 'at', label: t('Time'), width: '1fr', render: (r) => new Date(r.at).toLocaleString('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) },
        { key: 'action', label: t('Action'), width: '1.1fr', render: (r) => <Badge tone={TONE[r.action]}>{r.action}</Badge> },
        { key: 'user_id', label: t('By'), width: '1fr', sort: (r) => users.get(r.user_id) || '', render: (r) => users.get(r.user_id) || '—' },
        { key: 'details', label: t('Details'), width: '2.4fr', sortable: false, hideMobile: true, render: (r) => <span class="small mute" title={JSON.stringify(r.details)}>{money2(r.details)}</span> }
      ]} />
    </Panel>
  );
}
