// Returns to suppliers: list (credit notes) + "Return goods".
import { useEffect, useState } from 'preact/hooks';
import { PageHeader, Btn, Empty } from '../../ui/kit.jsx';
import { VirtualTable } from '../../ui/table.jsx';
import { kes } from '../../lib/money.js';
import { on } from '../../lib/bus.js';
import { navigate } from '../../router.js';
import { can } from '../../auth/permissions.js';
import { allDocs, suppliersList } from '../../core/purchasing.js';
import { BuyTabs, d8, userName } from '../inventory/common.jsx';
import { t } from '../../i18n/index.js';

export default function Returns() {
  const [rows, setRows] = useState(null);
  const [sups, setSups] = useState(new Map());
  const load = async () => { const [d, s] = await Promise.all([allDocs('return'), suppliersList()]); setRows(d); setSups(new Map(s.map((x) => [x.id, x]))); };
  useEffect(() => { load(); return on('change', (e) => e === 'goods_received' && load()); }, []);
  return (
    <div class="page wide" style={{ maxWidth: '1400px' }}>
      <PageHeader title={t('Purchases')} sub={t('Goods sent back to suppliers. Each return reduces what you owe them.')} actions={can('purchasing.returns') && <Btn variant="primary" icon="undo" onClick={() => navigate('/purchasing/returns/new')}>{t('Return goods')}</Btn>} />
      <BuyTabs active="/purchasing/returns" />
      {!rows ? <div class="card" style={{ height: '300px' }} /> : (
        <VirtualTable rows={rows} height="calc(100vh - 240px)" rowHeight={56} onRowClick={(g) => navigate('/purchasing/grn/' + g.id)}
          empty={<Empty icon="undo" title={t('No returns yet')} text={t('Damaged, expired or wrong items can go back to the supplier. Stock goes down and the supplier owes you a credit.')}>{can('purchasing.returns') && <Btn variant="primary" icon="undo" onClick={() => navigate('/purchasing/returns/new')}>{t('Return goods')}</Btn>}</Empty>}
          columns={[
            { key: 'no', label: t('Return'), width: '1.1fr', render: (g) => <b class="mono">{g.no}</b> },
            { key: 'created_at', label: t('Date'), width: '1fr', render: (g) => d8(g.created_at) },
            { key: 'sup', label: t('Supplier'), width: '1.6fr', render: (g) => <span class="ellipsis">{sups.get(g.supplier_id)?.name || '—'}</span> },
            { key: 'reason', label: t('Reason'), width: '1.2fr', hideMobile: true, render: (g) => <span class="small">{g.reason || '—'}</span> },
            { key: 'by', label: t('By'), width: '.8fr', hideMobile: true, render: (g) => userName(g.user_id).split(' ')[0] || '—' },
            { key: 'total', label: t('Credit (return)'), width: '1fr', num: true, render: (g) => <b>{kes(-g.total)}</b> }
          ]} />
      )}
    </div>
  );
}
