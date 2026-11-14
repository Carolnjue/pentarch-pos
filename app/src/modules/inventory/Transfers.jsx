// Stock transfers between branches: incoming (to receive) and sent.
import { useEffect, useState } from 'preact/hooks';
import { db } from '../../db/index.js';
import { PageHeader, Btn, Icon, Empty, Badge } from '../../ui/kit.jsx';
import { Table } from '../../ui/table.jsx';
import { on } from '../../lib/bus.js';
import { navigate } from '../../router.js';
import { StockTabs, StatusPill, d8, branchName, userName, fq, multiBranch } from './common.jsx';
import * as S from '../../state.js';
import { t, tn } from '../../i18n/index.js';

export default function Transfers() {
  const [rows, setRows] = useState(null);
  const [tab, setTab] = useState('all');
  const load = async () => setRows((await db().transfers.toArray()).filter((x) => !x.deleted).sort((a, b) => b.created_at - a.created_at));
  useEffect(() => { load(); return on('change', (e) => e === 'transfers' && load()); }, []);
  const me = S.branch.value?.id;
  const incoming = (rows || []).filter((r) => r.status === 'sent' && r.to_branch_id === me);
  const list = (rows || []).filter((r) => tab === 'all' || (tab === 'in' ? r.to_branch_id === me : r.from_branch_id === me));
  return (
    <div class="page wide" style={{ maxWidth: '1400px' }}>
      <PageHeader title={t('Stock')} sub={t('Move stock between your branches. The sending branch sends, the receiving branch confirms what arrived.')}
        actions={multiBranch() && <Btn variant="primary" icon="truck" onClick={() => navigate('/inventory/transfers/new')}>{t('Move stock to another branch')}</Btn>} />
      <StockTabs active="/inventory/transfers" />
      {!multiBranch() && <div class="callout mb"><Icon name="info" size={18} /><span class="grow">{t('You have one branch. Add another branch in Settings → Branches & devices to move stock between them.')}</span><Btn size="sm" onClick={() => navigate('/settings/branches')}>{t('Branches')}</Btn></div>}
      {incoming.length > 0 && <div class="callout warn mb"><Icon name="truck" size={18} /><span class="grow">{tn(incoming.length, '{n} delivery from another branch is waiting for you to receive it.', '{n} deliveries from other branches are waiting for you to receive them.')}</span><Btn size="sm" variant="primary" onClick={() => navigate('/inventory/transfers/' + incoming[0].id)}>{t('Receive now')}</Btn></div>}
      <div class="row wrap mb gap-s">{[['all', t('All')], ['in', t('Coming in')], ['out', t('Sent out')]].map(([k, l]) => <button class={'chip' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l}</button>)}</div>
      <div class="card">
        {!rows ? <div style={{ height: '200px' }} /> : (
          <Table rows={list} onRowClick={(r) => navigate('/inventory/transfers/' + r.id)}
            empty={<Empty icon="truck" title={t('No transfers yet')} text={t('When one branch has too much and another too little, move stock here — both branches stay correct.')}>{multiBranch() && <Btn variant="primary" icon="truck" onClick={() => navigate('/inventory/transfers/new')}>{t('Move stock to another branch')}</Btn>}</Empty>}
            columns={[
              { key: 'no', label: t('Transfer'), render: (r) => <b class="mono">{r.no}</b> },
              { key: 'created_at', label: t('Date'), render: (r) => d8(r.sent_at || r.created_at) },
              { key: 'from', label: t('From'), render: (r) => <span class="row gap-s">{branchName(r.from_branch_id)}<Icon name="arrow-right" size={14} /></span> },
              { key: 'to', label: t('To'), render: (r) => branchName(r.to_branch_id) },
              { key: 'items', label: t('Items'), num: true, hideMobile: true, render: (r) => fq(r.lines.reduce((s, l) => s + l.qty, 0)) },
              { key: 'by', label: t('Sent by'), hideMobile: true, render: (r) => userName(r.sent_by).split(' ')[0] || '—' },
              { key: 'status', label: t('Status'), render: (r) => <span class="row gap-s"><StatusPill s={r.status === 'sent' ? 'transit' : r.status} />{r.discrepancy && <Badge tone="bad">{t('Difference')}</Badge>}</span> }
            ]} />
        )}
      </div>
    </div>
  );
}
